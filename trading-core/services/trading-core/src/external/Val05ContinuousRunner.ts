import type { Val04B1CredentialSource } from './Val04B1AuthenticatedReadHarness.js';
import { Val04B2LiveTransport } from './Val04B2LiveTransport.js';
import type { Val04B2Transport } from './Val04B2ControlledOrderHarness.js';
import {
  ContinuousBinanceTestnetProvider,
  type ContinuousBinanceTestnetOpenOrder,
  type ContinuousBinanceTestnetVenueSnapshot,
} from '../execution/providers/binance/ContinuousBinanceTestnetProvider.js';
import { ContinuousExecutionRuntime } from '../execution/continuous/ContinuousExecutionRuntime.js';
import { ContinuousKillSwitch } from '../execution/continuous/ContinuousKillSwitch.js';
import { ContinuousOrderRecoveryService } from '../execution/continuous/ContinuousOrderRecoveryService.js';
import { ContinuousPositionReconciliationService, type ContinuousPositionRecord, type ContinuousPositionReconciliationResult } from '../execution/continuous/ContinuousPositionReconciliationService.js';
import { ContinuousRiskEnvelopeService } from '../execution/continuous/ContinuousRiskEnvelopeService.js';
import { ContinuousIntentAdmissionService, type ContinuousTradingIntent, type AdmissionEvaluationResult } from '../admission/ContinuousIntentAdmissionService.js';
import { ContinuousObservabilityCollector } from '../telemetry/continuous/ContinuousObservabilityCollector.js';
import { InMemoryPostgresClient } from '../repositories/postgres/InMemoryPostgresClient.js';
import { PostgresDurableExecutionRepository } from '../repositories/postgres/PostgresDurableExecutionRepository.js';
import { DurableCexExecutionLifecycleService } from '../execution/DurableCexExecutionLifecycleService.js';
import type { TransactionalPostgresQueryClient } from '../repositories/postgres/PostgresClient.js';

export const VAL_05_ENVIRONMENT = 'binance_perpetual_testnet' as const;
export const VAL_05_SYMBOL = 'BTCUSDT' as const;
export const VAL_05_EXECUTION_CONFIRMATION = 'VAL-05-CONTROLLED-EXECUTION-CONFIRMED' as const;

export type Val05RunnerMode = 'public' | 'authenticated-read-only' | 'controlled-execute';

export interface Val05SessionEnvelope {
  environment: typeof VAL_05_ENVIRONMENT;
  symbol: typeof VAL_05_SYMBOL;
  maxActiveExternalOrders: 1;
  maxParallelExternalExecutions: 1;
  maxOrderSubmissions: 3;
  maxPerOrderNotional: number;
  maxTotalRunNotional: number;
  noBlindRetry: true;
}

export const VAL_05_SESSION_ENVELOPE: Val05SessionEnvelope = {
  environment: VAL_05_ENVIRONMENT,
  symbol: VAL_05_SYMBOL,
  maxActiveExternalOrders: 1,
  maxParallelExternalExecutions: 1,
  maxOrderSubmissions: 3,
  maxPerOrderNotional: 250,
  maxTotalRunNotional: 750,
  noBlindRetry: true,
};

export interface Val05SessionBudgetState {
  sessionId: string;
  submissions: number;
  activeOrders: number;
  durable: boolean;
}

export interface Val05SessionBudgetStore {
  readonly durable: boolean;
  load(sessionId: string): Promise<Val05SessionBudgetState>;
  reserveSubmission(sessionId: string, envelope: Val05SessionEnvelope): Promise<Val05SessionBudgetState>;
  releaseActiveOrder(sessionId: string): Promise<Val05SessionBudgetState>;
}

export const VAL_05_SESSION_BUDGET_SCHEMA = `
CREATE TABLE IF NOT EXISTS trading_val05_session_budgets (
  session_id TEXT PRIMARY KEY,
  submissions INTEGER NOT NULL DEFAULT 0,
  active_orders INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`;

export class PostgresVal05SessionBudgetStore implements Val05SessionBudgetStore {
  readonly durable = true;

  constructor(
    private readonly database: TransactionalPostgresQueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async load(sessionId: string): Promise<Val05SessionBudgetState> {
    await this.ensureSchema();
    const result = await this.database.query<{ session_id: string; submissions: number | string; active_orders: number | string }>(
      'SELECT session_id, submissions, active_orders FROM trading_val05_session_budgets WHERE session_id = $1',
      [sessionId],
    );
    const row = result.rows[0];
    return {
      sessionId,
      submissions: row ? Number(row.submissions) : 0,
      activeOrders: row ? Number(row.active_orders) : 0,
      durable: true,
    };
  }

  async reserveSubmission(sessionId: string, envelope: Val05SessionEnvelope): Promise<Val05SessionBudgetState> {
    return this.database.transaction(async (tx) => {
      await tx.query(VAL_05_SESSION_BUDGET_SCHEMA);
      const selected = await tx.query<{ session_id: string; submissions: number | string; active_orders: number | string }>(
        'SELECT session_id, submissions, active_orders FROM trading_val05_session_budgets WHERE session_id = $1 FOR UPDATE',
        [sessionId],
      );
      const row = selected.rows[0];
      const submissions = row ? Number(row.submissions) : 0;
      const activeOrders = row ? Number(row.active_orders) : 0;
      if (submissions >= envelope.maxOrderSubmissions) throw new Error('VAL-05 session submission budget exhausted');
      if (activeOrders >= envelope.maxActiveExternalOrders) throw new Error('VAL-05 session active-order budget exhausted');
      const next = { sessionId, submissions: submissions + 1, activeOrders: activeOrders + 1, durable: true };
      await tx.query(
        `INSERT INTO trading_val05_session_budgets (session_id, submissions, active_orders, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id) DO UPDATE SET submissions = EXCLUDED.submissions, active_orders = EXCLUDED.active_orders, updated_at = EXCLUDED.updated_at`,
        [sessionId, next.submissions, next.activeOrders, this.now()],
      );
      return next;
    });
  }

  async releaseActiveOrder(sessionId: string): Promise<Val05SessionBudgetState> {
    return this.database.transaction(async (tx) => {
      await tx.query(VAL_05_SESSION_BUDGET_SCHEMA);
      const selected = await tx.query<{ submissions: number | string; active_orders: number | string }>(
        'SELECT submissions, active_orders FROM trading_val05_session_budgets WHERE session_id = $1 FOR UPDATE',
        [sessionId],
      );
      const row = selected.rows[0];
      const next = {
        sessionId,
        submissions: row ? Number(row.submissions) : 0,
        activeOrders: Math.max(0, row ? Number(row.active_orders) - 1 : 0),
        durable: true,
      };
      await tx.query(
        `INSERT INTO trading_val05_session_budgets (session_id, submissions, active_orders, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id) DO UPDATE SET submissions = EXCLUDED.submissions, active_orders = EXCLUDED.active_orders, updated_at = EXCLUDED.updated_at`,
        [sessionId, next.submissions, next.activeOrders, this.now()],
      );
      return next;
    });
  }

  private async ensureSchema(): Promise<void> {
    await this.database.query(VAL_05_SESSION_BUDGET_SCHEMA);
  }
}

export class InMemoryVal05SessionBudgetStore implements Val05SessionBudgetStore {
  readonly durable = false;
  private readonly states = new Map<string, Val05SessionBudgetState>();

  async load(sessionId: string): Promise<Val05SessionBudgetState> {
    return { ...(this.states.get(sessionId) ?? { sessionId, submissions: 0, activeOrders: 0, durable: false }) };
  }

  async reserveSubmission(sessionId: string, envelope: Val05SessionEnvelope): Promise<Val05SessionBudgetState> {
    const current = await this.load(sessionId);
    if (current.submissions >= envelope.maxOrderSubmissions) throw new Error('VAL-05 session submission budget exhausted');
    if (current.activeOrders >= envelope.maxActiveExternalOrders) throw new Error('VAL-05 session active-order budget exhausted');
    const next = { ...current, submissions: current.submissions + 1, activeOrders: current.activeOrders + 1 };
    this.states.set(sessionId, next);
    return { ...next };
  }

  async releaseActiveOrder(sessionId: string): Promise<Val05SessionBudgetState> {
    const current = await this.load(sessionId);
    const next = { ...current, activeOrders: Math.max(0, current.activeOrders - 1) };
    this.states.set(sessionId, next);
    return { ...next };
  }
}

export interface Val05RunnerHealth {
  mode: Val05RunnerMode;
  environment: typeof VAL_05_ENVIRONMENT;
  credentialsLoaded: boolean;
  privateReads: number;
  postOrderCalls: number;
  deleteOrderCalls: number;
  venue: ContinuousBinanceTestnetVenueSnapshot;
  openOrders?: ContinuousBinanceTestnetOpenOrder[];
  positions?: ContinuousPositionRecord[];
  positionReconciliation?: ContinuousPositionReconciliationResult;
  mutationAuthorized: false;
  failures: string[];
}

export interface Val05ContinuousRuntime {
  runner: Val05ContinuousRunner;
  provider: ContinuousBinanceTestnetProvider;
  runtime: ContinuousExecutionRuntime;
  recovery: ContinuousOrderRecoveryService;
  positionReconciliation: ContinuousPositionReconciliationService;
  risk: ContinuousRiskEnvelopeService;
  admission: ContinuousIntentAdmissionService;
  killSwitch: ContinuousKillSwitch;
  observability: ContinuousObservabilityCollector;
  sessionEnvelope: Val05SessionEnvelope;
}

export class Val05ContinuousRunner {
  constructor(
    private readonly provider: ContinuousBinanceTestnetProvider,
    private readonly admission: ContinuousIntentAdmissionService,
    private readonly recovery: ContinuousOrderRecoveryService,
    private readonly positionReconciliation: ContinuousPositionReconciliationService,
    private readonly killSwitch: ContinuousKillSwitch,
    private readonly observability: ContinuousObservabilityCollector,
    private readonly sessionBudget: Val05SessionBudgetStore,
    private readonly sessionId = 'val-05-session',
    private readonly envelope = VAL_05_SESSION_ENVELOPE,
  ) {}

  async runPublicPreflight(): Promise<Val05RunnerHealth> {
    const venue = await this.provider.getVenueSnapshot();
    return {
      mode: 'public', environment: VAL_05_ENVIRONMENT, credentialsLoaded: false, privateReads: 0,
      postOrderCalls: 0, deleteOrderCalls: 0, venue, mutationAuthorized: false, failures: [],
    };
  }

  async runAuthenticatedReadOnlyPreflight(localPositions: ContinuousPositionRecord[] = []): Promise<Val05RunnerHealth> {
    const venue = await this.provider.getVenueSnapshot();
    const openOrders = await this.provider.getOpenOrders(this.envelope.symbol);
    const positions = await this.provider.getPositions(this.envelope.symbol);
    const positionReconciliation = this.positionReconciliation.reconcile(localPositions, positions, this.provider.providerId);
    const failures: string[] = [];
    if (openOrders.length > this.envelope.maxActiveExternalOrders) failures.push('Unexpected active external order count');
    if (positionReconciliation.divergent) failures.push('Position reconciliation is divergent');
    if (this.killSwitch.isActive()) failures.push('Kill switch is active');
    return {
      mode: 'authenticated-read-only', environment: VAL_05_ENVIRONMENT, credentialsLoaded: true, privateReads: 2,
      postOrderCalls: 0, deleteOrderCalls: 0, venue, openOrders, positions, positionReconciliation,
      mutationAuthorized: false, failures,
    };
  }

  async submitControlledIntent(intent: ContinuousTradingIntent, localPositions: ContinuousPositionRecord[] = [], confirmation?: string): Promise<AdmissionEvaluationResult> {
    if (confirmation !== VAL_05_EXECUTION_CONFIRMATION) throw new Error('VAL-05 controlled execution requires an explicit operational confirmation gate');
    if (!this.sessionBudget.durable) throw new Error('VAL-05 controlled execution requires durable session accounting');
    const health = await this.runAuthenticatedReadOnlyPreflight(localPositions);
    if (health.failures.length > 0) throw new Error(`VAL-05 mutation authorization denied: ${health.failures.join('; ')}`);
    await this.sessionBudget.reserveSubmission(this.sessionId, this.envelope);
    const result = await this.admission.submitIntent(intent, health.positionReconciliation);
    this.observability.record({
      eventType: result.admitted ? 'INTENT_ADMITTED' : 'INTENT_REJECTED',
      correlationId: intent.source.correlationId, intentId: intent.intentId,
      details: { mode: 'controlled-execute', rejectionCode: result.rejectionCode },
    });
    return result;
  }

  async recover(): Promise<Awaited<ReturnType<ContinuousOrderRecoveryService['recoverAll']>>> {
    this.observability.record({ eventType: 'RECOVERY_RUN_STARTED', details: { sessionId: this.sessionId } });
    const result = await this.recovery.recoverAll();
    this.observability.record({ eventType: 'RECOVERY_RUN_COMPLETED', details: { ...result, sessionId: this.sessionId } });
    return result;
  }
}

export function createVal05ContinuousRuntime(options: {
  credentialSource?: Val04B1CredentialSource;
  transport?: Val04B2Transport;
  database?: TransactionalPostgresQueryClient;
  sessionBudget?: Val05SessionBudgetStore;
  sessionId?: string;
  now?: () => string;
} = {}): Val05ContinuousRuntime {
  const now = options.now ?? (() => new Date().toISOString());
  const database = options.database ?? new InMemoryPostgresClient();
  const repository = new PostgresDurableExecutionRepository(database);
  const lifecycle = new DurableCexExecutionLifecycleService(repository, database, now);
  const provider = new ContinuousBinanceTestnetProvider(options.credentialSource, options.transport ?? new Val04B2LiveTransport(), undefined, 5000, now);
  const killSwitch = new ContinuousKillSwitch(now);
  const risk = new ContinuousRiskEnvelopeService({
    environment: 'testnet', allowedSymbols: [VAL_05_SYMBOL], maxOrderNotional: VAL_05_SESSION_ENVELOPE.maxPerOrderNotional,
    maxPositionNotional: VAL_05_SESSION_ENVELOPE.maxPerOrderNotional, maxTotalRunNotional: VAL_05_SESSION_ENVELOPE.maxTotalRunNotional,
    maxOutstandingOrders: VAL_05_SESSION_ENVELOPE.maxActiveExternalOrders, maxMarketDataAgeMs: 5000, maxPriceDeviationFraction: 0.05,
  }, killSwitch);
  const runtime = new ContinuousExecutionRuntime(lifecycle, provider, provider, provider, now);
  const admission = new ContinuousIntentAdmissionService(runtime, risk, killSwitch, { requireDeterministicSymbolLock: true }, now);
  const recovery = new ContinuousOrderRecoveryService(repository, lifecycle, provider, provider, now);
  const positionReconciliation = new ContinuousPositionReconciliationService(provider.providerId, now);
  const observability = new ContinuousObservabilityCollector(now);
  const runner = new Val05ContinuousRunner(provider, admission, recovery, positionReconciliation, killSwitch, observability, options.sessionBudget ?? new InMemoryVal05SessionBudgetStore(), options.sessionId, VAL_05_SESSION_ENVELOPE);
  return { runner, provider, runtime, recovery, positionReconciliation, risk, admission, killSwitch, observability, sessionEnvelope: VAL_05_SESSION_ENVELOPE };
}
