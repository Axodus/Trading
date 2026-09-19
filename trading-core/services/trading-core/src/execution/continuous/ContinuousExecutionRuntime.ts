import type {
  CexConnectorCapabilities,
  CexOrderEvidence,
  CexReconciliationProvider,
  CexSubmissionAttempt,
} from '../../../../../packages/trading-contracts/src/index.js';
import {
  DurableCexExecutionLifecycleService,
  type DurableCexCancellationProvider,
} from '../DurableCexExecutionLifecycleService.js';
import type { DurableSubmissionAttempt } from '../../repositories/postgres/PostgresDurableExecutionRepository.js';
import {
  TradingExternalSafetyPreflightPolicy,
  type ExternalSafetyPreflightConfig,
} from '../../security/TradingExternalSafetyPreflightPolicy.js';
import { ContinuousBinanceProviderRejectedError } from '../providers/binance/ContinuousBinanceTestnetProvider.js';

export interface ContinuousVenueOrderMutationRequest {
  attemptId: string;
  intentId: string;
  correlationId: string;
  providerId: string;
  connector: string;
  market: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: string;
  price?: string;
  executionClientOrderId: string;
}

export interface ContinuousVenueOrderMutationResponse {
  providerOrderId: string;
  providerStatus: string;
  filledQuantity?: string;
  remainingQuantity?: string;
  raw?: unknown;
}

export interface ContinuousVenueMutationProvider {
  readonly providerId: string;
  readonly connector: string;
  readonly capabilities: CexConnectorCapabilities;
  submitOrder(request: ContinuousVenueOrderMutationRequest): Promise<ContinuousVenueOrderMutationResponse>;
}

export interface ContinuousExecutionOptions {
  attemptId: string;
  intentId: string;
  correlationId: string;
  providerId: string;
  connector: string;
  market: string;
  symbol: string;
  instrument: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: string;
  price?: string;
  tenantId?: string;
  runSessionId?: string;
  environment?: string;
  maxOrderNotional?: number;
  maxTotalRunNotional?: number;
  maxOutstandingOrders?: number;
  killSwitchActive?: boolean;
  credentialScopes?: string[];
}

export interface ContinuousExecutionResult {
  attemptId: string;
  executionClientOrderId: string;
  status: 'SUBMITTED' | 'REJECTED' | 'UNKNOWN' | 'PREFLIGHT_REJECTED';
  durableAttempt: DurableSubmissionAttempt;
  providerOrderId?: string;
  reconciliationRequired: boolean;
  error?: string;
  preflightViolationCode?: string;
}

export class ContinuousExecutionRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ContinuousExecutionRuntimeError';
  }
}

export class ContinuousExecutionRuntime {
  private readonly preflightPolicy = new TradingExternalSafetyPreflightPolicy();
  private readonly inFlightExecutions = new Map<string, Promise<ContinuousExecutionResult>>();
  private readonly activeClientOrderIds = new Set<string>();
  private accumulatedNotional = 0;

  constructor(
    private readonly lifecycleService: DurableCexExecutionLifecycleService,
    private readonly mutationProvider: ContinuousVenueMutationProvider,
    private readonly reconciliationProvider: CexReconciliationProvider,
    private readonly cancellationProvider?: DurableCexCancellationProvider,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async execute(options: ContinuousExecutionOptions): Promise<ContinuousExecutionResult> {
    const existing = this.inFlightExecutions.get(options.attemptId);
    if (existing) {
      return existing;
    }

    const executionPromise = this.executeInternal(options);
    this.inFlightExecutions.set(options.attemptId, executionPromise);

    try {
      return await executionPromise;
    } finally {
      if (this.inFlightExecutions.get(options.attemptId) === executionPromise) {
        this.inFlightExecutions.delete(options.attemptId);
      }
    }
  }

  private async executeInternal(options: ContinuousExecutionOptions): Promise<ContinuousExecutionResult> {
    const existingAttempt = await this.lifecycleService.get(options.attemptId);
    if (existingAttempt) {
      if (existingAttempt.state === 'provider-acknowledged') {
        return {
          attemptId: existingAttempt.attemptId,
          executionClientOrderId: existingAttempt.executionClientOrderId,
          status: 'SUBMITTED',
          durableAttempt: existingAttempt,
          providerOrderId: existingAttempt.providerOrderId,
          reconciliationRequired: true,
        };
      }
      if (this.isTerminal(existingAttempt.state)) {
        return {
          attemptId: existingAttempt.attemptId,
          executionClientOrderId: existingAttempt.executionClientOrderId,
          status: existingAttempt.state === 'reconciled-found' ? 'SUBMITTED' : 'REJECTED',
          durableAttempt: existingAttempt,
          providerOrderId: existingAttempt.providerOrderId,
          reconciliationRequired: false,
        };
      }
      if (existingAttempt.state === 'execution-unknown' || existingAttempt.state === 'reconciling' || existingAttempt.state === 'reconciled-indeterminate') {
        return {
          attemptId: existingAttempt.attemptId,
          executionClientOrderId: existingAttempt.executionClientOrderId,
          status: 'UNKNOWN',
          durableAttempt: existingAttempt,
          reconciliationRequired: true,
          error: existingAttempt.lastFailure ?? 'Attempt in non-terminal unknown state',
        };
      }
    }

    const durableAttempt = await this.lifecycleService.createAttempt({
      attemptId: options.attemptId,
      intentId: options.intentId,
      correlationId: options.correlationId,
      providerId: options.providerId,
      connector: options.connector,
      market: options.market,
      side: options.side,
      orderType: options.orderType,
      quantity: options.quantity,
      price: options.price,
      now: this.now(),
    });

    const executionClientOrderId = durableAttempt.executionClientOrderId;

    const env = (options.environment ?? 'testnet').toLowerCase();
    const tenantId = options.tenantId ?? 'axodus-trading-tenant';
    const runSessionId = options.runSessionId ?? 'continuous-session';
    const numPrice = options.price ? Number(options.price) : 0;
    const numQty = Number(options.quantity);
    const maxOrderNotional = options.maxOrderNotional ?? 250;
    const maxTotalRunNotional = options.maxTotalRunNotional ?? 2500;
    const maxOutstandingOrders = options.maxOutstandingOrders ?? 10;

    const preflightConfig: ExternalSafetyPreflightConfig = {
      environment: env,
      allowedInstruments: [options.instrument],
      maxOrderNotional,
      maxTotalRunNotional,
      maxOutstandingOrders,
      tenantId,
      runSessionId,
      killSwitchActive: options.killSwitchActive ?? false,
    };

    const preflightResult = this.preflightPolicy.evaluate({
      config: preflightConfig,
      order: {
        instrument: options.instrument,
        quantity: numQty,
        price: numPrice,
        clientOrderId: executionClientOrderId,
        tenantId,
        runSessionId,
      },
      currentRunState: {
        accumulatedNotional: this.accumulatedNotional,
        activeOrders: this.activeClientOrderIds,
      },
      credentialScopes: options.credentialScopes,
    });

    if (!preflightResult.passed) {
      const reason = preflightResult.reason ?? preflightResult.violationCode ?? 'Preflight rejected';
      const rejectedAttempt = await this.lifecycleService.markSubmissionInProgress(options.attemptId)
        .then(() => this.lifecycleService.recordRejected(options.attemptId, 'Preflight rejected: ' + reason));

      return {
        attemptId: options.attemptId,
        executionClientOrderId,
        status: 'PREFLIGHT_REJECTED',
        durableAttempt: rejectedAttempt,
        reconciliationRequired: false,
        error: reason,
        preflightViolationCode: preflightResult.violationCode,
      };
    }

    await this.lifecycleService.markSubmissionInProgress(options.attemptId);
    this.activeClientOrderIds.add(executionClientOrderId);

    let mutationResponse: ContinuousVenueOrderMutationResponse;
    try {
      mutationResponse = await this.mutationProvider.submitOrder({
        attemptId: options.attemptId,
        intentId: options.intentId,
        correlationId: options.correlationId,
        providerId: options.providerId,
        connector: options.connector,
        market: options.market,
        symbol: options.symbol,
        side: options.side,
        orderType: options.orderType,
        quantity: options.quantity,
        price: options.price,
        executionClientOrderId,
      });
    } catch (networkError) {
      if (networkError instanceof ContinuousBinanceProviderRejectedError) {
        const rejectedAttempt = await this.lifecycleService.recordRejected(
          options.attemptId,
          `Provider rejected mutation with HTTP ${networkError.status}`,
        );
        this.activeClientOrderIds.delete(executionClientOrderId);
        return {
          attemptId: options.attemptId,
          executionClientOrderId,
          status: 'REJECTED',
          durableAttempt: rejectedAttempt,
          reconciliationRequired: false,
          error: networkError.message,
        };
      }
      const reason = 'Mutation ambiguous / failed: ' + (networkError instanceof Error ? networkError.message : String(networkError));
      this.activeClientOrderIds.delete(executionClientOrderId);
      const unknownAttempt = await this.lifecycleService.recordUnknown(options.attemptId, reason);

      return {
        attemptId: options.attemptId,
        executionClientOrderId,
        status: 'UNKNOWN',
        durableAttempt: unknownAttempt,
        reconciliationRequired: true,
        error: reason,
      };
    }

    const observedAt = this.now();
    const evidence: CexOrderEvidence = {
      executionClientOrderId,
      providerOrderId: mutationResponse.providerOrderId,
      providerStatus: mutationResponse.providerStatus,
      filledQuantity: mutationResponse.filledQuantity ?? '0',
      remainingQuantity: mutationResponse.remainingQuantity ?? options.quantity,
      observedAt,
      source: 'rest-submission-response',
      cancellationState: 'not-requested',
    };

    const acknowledgedAttempt = await this.lifecycleService.recordAcknowledged(options.attemptId, evidence);
    this.accumulatedNotional += numQty * numPrice;

    return {
      attemptId: options.attemptId,
      executionClientOrderId,
      status: 'SUBMITTED',
      durableAttempt: acknowledgedAttempt,
      providerOrderId: mutationResponse.providerOrderId,
      reconciliationRequired: false,
    };
  }

  async reconcile(attemptId: string): Promise<DurableSubmissionAttempt> {
    const attempt = await this.lifecycleService.get(attemptId);
    if (!attempt) {
      throw new ContinuousExecutionRuntimeError('ATTEMPT_NOT_FOUND', 'Attempt ' + attemptId + ' not found');
    }
    const result = await this.lifecycleService.reconcile(attemptId, this.reconciliationProvider);
    if (this.isTerminal(result.state)) {
      this.activeClientOrderIds.delete(result.executionClientOrderId);
    }
    return result;
  }

  async cancel(attemptId: string): Promise<DurableSubmissionAttempt> {
    if (!this.cancellationProvider) {
      throw new ContinuousExecutionRuntimeError('CANCELLATION_UNSUPPORTED', 'Cancellation provider not configured');
    }
    const result = await this.lifecycleService.cancel(attemptId, this.cancellationProvider);
    if (this.isTerminal(result.state)) {
      this.activeClientOrderIds.delete(result.executionClientOrderId);
    }
    return result;
  }

  getActiveClientOrders(): Set<string> {
    return new Set(this.activeClientOrderIds);
  }

  getAccumulatedNotional(): number {
    return this.accumulatedNotional;
  }

  resetRunState(): void {
    this.activeClientOrderIds.clear();
    this.accumulatedNotional = 0;
  }

  private isTerminal(state: string): boolean {
    return [
      'failed',
      'rejected',
      'cancelled',
      'cancellation-rejected',
      'cancellation-failed',
      'reconciled-found',
      'reconciled-not-found',
    ].includes(state);
  }
}
