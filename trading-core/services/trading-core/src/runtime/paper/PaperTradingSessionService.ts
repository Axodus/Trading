import type {
  ExecutionRequest,
  PaperTradingSessionPolicy,
  PaperTradingSessionRequest,
  PaperTradingSessionState,
  ReconciliationWorkerCandidate,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { ExecutionProviderRegistry } from '../../execution/ExecutionProviderRegistry.js';
import type { ReconciliationWorker } from '../../reconciliation/ReconciliationWorker.js';
import type { RuntimeObservabilityService } from '../../telemetry/RuntimeObservabilityService.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';
import { PaperConnectorConfigValidator } from './PaperConnectorConfigValidator.js';
import { PaperOrderIngestionService } from './PaperOrderIngestionService.js';
import { PaperSessionAuditService } from './PaperSessionAuditService.js';

export interface PaperTradingSessionServiceDependencies {
  registry: ExecutionProviderRegistry;
  eventBus?: TradingEventBus;
  observability?: RuntimeObservabilityService;
  reconciliationWorker?: ReconciliationWorker;
  policy?: PaperTradingSessionPolicy;
  validator?: PaperConnectorConfigValidator;
  orders?: PaperOrderIngestionService;
  audit?: PaperSessionAuditService;
}

export class PaperTradingSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaperTradingSessionError';
  }
}

export class PaperTradingSessionService {
  private readonly sessions = new Map<string, PaperTradingSessionState>();
  private readonly policy: PaperTradingSessionPolicy;
  private readonly validator: PaperConnectorConfigValidator;
  private readonly orders: PaperOrderIngestionService;
  private readonly audit: PaperSessionAuditService;

  constructor(private readonly deps: PaperTradingSessionServiceDependencies) {
    this.policy = deps.policy ?? {
      allowedProviders: ['simulation', 'hummingbot'],
      requireCredentialBinding: false,
      allowHummingbotPaper: true,
      allowSimulation: true,
    };
    this.validator = deps.validator ?? new PaperConnectorConfigValidator();
    this.orders = deps.orders ?? new PaperOrderIngestionService(deps.eventBus);
    this.audit = deps.audit ?? new PaperSessionAuditService(deps.eventBus);
  }

  async requestSession(request: PaperTradingSessionRequest): Promise<PaperTradingSessionState> {
    const now = new Date().toISOString();
    const requested = this.state(request, 'requested', now);
    this.sessions.set(request.id, requested);
    await this.audit.publish(requested, 'PAPER_SESSION_REQUESTED', request.reason);

    const validation = this.validator.validate(request.connectorConfig, this.policy);
    if (!validation.approved) {
      return this.fail(requested, validation.reason ?? 'Paper session rejected.');
    }

    const provider = this.deps.registry.get(request.connectorConfig.providerId);
    if (!provider) {
      return this.fail(requested, `Paper provider not registered: ${request.connectorConfig.providerId}`);
    }
    if (provider.type !== request.connectorConfig.providerType) {
      return this.fail(requested, 'Paper provider type does not match connector config.');
    }

    const approved = this.update(requested, 'approved');
    await this.audit.publish(approved, 'PAPER_SESSION_APPROVED');
    const starting = this.update(approved, 'starting');
    this.sessions.set(starting.id, starting);

    await provider.connect();
    const status = await provider.getStatus();
    if (status.mode !== 'paper' || status.health === 'offline') {
      return this.fail(starting, `Provider is not paper-ready: ${status.health}/${status.mode}`);
    }

    const active = this.update(starting, 'active', { startedAt: new Date().toISOString() });
    this.sessions.set(active.id, active);
    await this.audit.publish(active, 'PAPER_SESSION_STARTED');
    await this.recordObservability(active, status.health === 'degraded' ? 'degraded' : 'healthy');
    return active;
  }

  async ingestOrder(sessionId: string, request: ExecutionRequest) {
    const session = this.requireSession(sessionId);
    if (session.status !== 'active') {
      throw new PaperTradingSessionError(`Paper session is not active: ${session.status}`);
    }
    const provider = this.deps.registry.get(session.providerId);
    if (!provider) {
      throw new PaperTradingSessionError(`Paper provider not registered: ${session.providerId}`);
    }
    return this.orders.ingest(session, provider, request);
  }

  async pause(sessionId: string, reason?: string): Promise<PaperTradingSessionState> {
    const paused = this.update(this.requireSession(sessionId), 'paused');
    await this.audit.publish(paused, 'PAPER_SESSION_PAUSED', reason);
    return paused;
  }

  async complete(sessionId: string): Promise<PaperTradingSessionState> {
    const completed = this.update(this.requireSession(sessionId), 'completed', { completedAt: new Date().toISOString() });
    await this.audit.publish(completed, 'PAPER_SESSION_COMPLETED');
    return completed;
  }

  async dryRunReconciliation(sessionId: string, candidate: ReconciliationWorkerCandidate) {
    const session = this.requireSession(sessionId);
    const result = await this.deps.reconciliationWorker?.run({
      correlationId: session.correlationId,
      tenantId: session.tenantId,
    });
    await this.deps.eventBus?.publish({
      id: `${session.id}:paper-reconciliation-dry-run`,
      type: 'PAPER_RECONCILIATION_DRY_RUN_COMPLETED',
      occurredAt: new Date().toISOString(),
      correlationId: session.correlationId,
      source: 'core',
      daoId: session.context.daoId,
      userId: session.context.userId,
      strategyId: session.context.strategyId,
      strategyProductId: session.context.strategyProductId,
      runtimeInstanceId: session.context.runtimeInstanceId,
      payload: {
        sessionId,
        tenantId: session.tenantId,
        providerId: session.providerId,
        candidateId: candidate.id,
        proposalsCreated: result?.proposalsCreated ?? 0,
        mutatesSovereignState: false,
        autoHealing: false,
      },
    });
    return result;
  }

  get(sessionId: string): PaperTradingSessionState | undefined {
    const session = this.sessions.get(sessionId);
    return session ? JSON.parse(JSON.stringify(session)) as PaperTradingSessionState : undefined;
  }

  private async fail(session: PaperTradingSessionState, reason: string): Promise<PaperTradingSessionState> {
    const failed = this.update(session, 'failed', { failureReason: reason });
    await this.audit.publish(failed, 'PAPER_SESSION_FAILED', reason);
    return failed;
  }

  private state(request: PaperTradingSessionRequest, status: PaperTradingSessionState['status'], now: string): PaperTradingSessionState {
    return {
      id: request.id,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      context: request.context,
      providerId: request.connectorConfig.providerId,
      status,
      updatedAt: now,
    };
  }

  private update(session: PaperTradingSessionState, status: PaperTradingSessionState['status'], extra: Partial<PaperTradingSessionState> = {}): PaperTradingSessionState {
    const next = {
      ...session,
      ...extra,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(next.id, next);
    return next;
  }

  private requireSession(sessionId: string): PaperTradingSessionState {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new PaperTradingSessionError(`Paper session not found: ${sessionId}`);
    }
    return session;
  }

  private async recordObservability(session: PaperTradingSessionState, status: 'healthy' | 'degraded'): Promise<void> {
    if (!session.context.runtimeInstanceId) {
      return;
    }
    await this.deps.observability?.record({
      context: {
        tenantId: session.tenantId,
        correlationId: session.correlationId,
        executionDomain: session.context.executionDomain,
        userId: session.context.userId,
        daoId: session.context.daoId,
        federationId: session.context.federationId,
        runtimeInstanceId: session.context.runtimeInstanceId,
        providerId: session.providerId,
        strategyId: session.context.strategyId,
        strategyProductId: session.context.strategyProductId,
      },
      status,
      uptimeMs: 1,
      measuredAt: new Date().toISOString(),
    });
  }
}
