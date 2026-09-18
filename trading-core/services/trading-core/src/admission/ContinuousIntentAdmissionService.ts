import type {
  ContinuousExecutionOptions,
  ContinuousExecutionResult,
  ContinuousExecutionRuntime,
} from '../execution/continuous/ContinuousExecutionRuntime.js';
import type { ContinuousKillSwitch } from '../execution/continuous/ContinuousKillSwitch.js';
import type { ContinuousRiskEnvelopeService, ContinuousMarketDataQuote } from '../execution/continuous/ContinuousRiskEnvelopeService.js';
import type { ContinuousPositionReconciliationResult } from '../execution/continuous/ContinuousPositionReconciliationService.js';
import type { DurableSubmissionAttempt } from '../repositories/postgres/PostgresDurableExecutionRepository.js';

export type IntentSourceType = 'strategy' | 'agent' | 'trinity' | 'manual-operator' | 'simulation-engine';

export interface ContinuousTradingIntent {
  intentId: string;
  source: {
    type: IntentSourceType;
    id: string;
    correlationId: string;
  };
  market: string;
  symbol: string;
  instrument: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: string;
  price?: string;
  providerId: string;
  connector: string;
  environment?: string;
  tenantId?: string;
  runSessionId?: string;
  quote?: ContinuousMarketDataQuote;
  credentialScopes?: string[];
  createdAt: string;
}

export type AdmissionRejectionCode =
  | 'INVALID_INTENT_STRUCTURE'
  | 'KILL_SWITCH_ACTIVE'
  | 'RISK_REJECTED'
  | 'SYMBOL_CONCURRENCY_LOCKED'
  | 'ACTIVE_OPPOSITE_EXPOSURE_LOCKED'
  | 'ACTIVE_EXECUTION_COLLISION'
  | 'DUPLICATE_INTENT'
  | 'POSITION_DIVERGENCE_UNRESOLVED'
  | 'RUNTIME_EXECUTION_ERROR';

export interface AdmissionEvaluationResult {
  admitted: boolean;
  intentId: string;
  rejectionCode?: AdmissionRejectionCode;
  reason?: string;
  executionResult?: ContinuousExecutionResult;
  durableAttempt?: DurableSubmissionAttempt;
}

export interface ContinuousIntentAdmissionServiceOptions {
  requireDeterministicSymbolLock?: boolean;
}

export class ContinuousIntentAdmissionService {
  private readonly processedIntents = new Map<string, AdmissionEvaluationResult>();
  private readonly symbolLocks = new Map<string, string>();
  private readonly intentMutex = new Map<string, Promise<AdmissionEvaluationResult>>();

  constructor(
    private readonly runtime: ContinuousExecutionRuntime,
    private readonly riskService: ContinuousRiskEnvelopeService,
    private readonly killSwitch: ContinuousKillSwitch,
    private readonly options: ContinuousIntentAdmissionServiceOptions = {},
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async submitIntent(
    intent: ContinuousTradingIntent,
    positionReconciliation?: ContinuousPositionReconciliationResult,
  ): Promise<AdmissionEvaluationResult> {
    const existing = this.processedIntents.get(intent.intentId);
    if (existing) {
      return existing;
    }

    const inFlight = this.intentMutex.get(intent.intentId);
    if (inFlight) {
      return inFlight;
    }

    const admissionPromise = this.processIntentInternal(intent, positionReconciliation);
    this.intentMutex.set(intent.intentId, admissionPromise);

    try {
      const result = await admissionPromise;
      this.processedIntents.set(intent.intentId, result);
      return result;
    } finally {
      if (this.intentMutex.get(intent.intentId) === admissionPromise) {
        this.intentMutex.delete(intent.intentId);
      }
    }
  }

  private async processIntentInternal(
    intent: ContinuousTradingIntent,
    positionReconciliation?: ContinuousPositionReconciliationResult,
  ): Promise<AdmissionEvaluationResult> {
    if (!intent.intentId || !intent.symbol || !intent.side || !intent.quantity || !intent.providerId) {
      return {
        admitted: false,
        intentId: intent.intentId,
        rejectionCode: 'INVALID_INTENT_STRUCTURE',
        reason: 'Intent is missing required fields (intentId, symbol, side, quantity, providerId).',
      };
    }

    const numQty = Number(intent.quantity);
    const numPrice = intent.price ? Number(intent.price) : 0;
    if (isNaN(numQty) || numQty <= 0) {
      return {
        admitted: false,
        intentId: intent.intentId,
        rejectionCode: 'INVALID_INTENT_STRUCTURE',
        reason: 'Invalid quantity: ' + intent.quantity,
      };
    }

    if (this.killSwitch.isActive()) {
      const state = this.killSwitch.getState();
      return {
        admitted: false,
        intentId: intent.intentId,
        rejectionCode: 'KILL_SWITCH_ACTIVE',
        reason: 'Execution blocked by active Kill Switch (' + (state.reason ?? 'UNKNOWN') + '): ' + (state.details ?? 'No details'),
      };
    }

    const symbolKey = intent.symbol.toUpperCase();
    const currentLock = this.symbolLocks.get(symbolKey);
    if (currentLock && currentLock !== intent.intentId) {
      return {
        admitted: false,
        intentId: intent.intentId,
        rejectionCode: 'SYMBOL_CONCURRENCY_LOCKED',
        reason: 'Symbol ' + symbolKey + ' currently locked by active intent ' + currentLock,
      };
    }

    const activeOrders = this.runtime.getActiveClientOrders();
    if (activeOrders.size > 0 && this.options.requireDeterministicSymbolLock) {
      return {
        admitted: false,
        intentId: intent.intentId,
        rejectionCode: 'ACTIVE_EXECUTION_COLLISION',
        reason: 'Active execution already outstanding in runtime (' + activeOrders.size + ' active). Concurrency gate requires clean state.',
      };
    }

    const riskResult = this.riskService.evaluate({
      symbol: intent.symbol,
      side: intent.side,
      orderType: intent.orderType,
      quantity: numQty,
      price: numPrice,
      quote: intent.quote,
      activeOrdersCount: activeOrders.size,
      accumulatedNotional: this.runtime.getAccumulatedNotional(),
      currentPositionNotional: 0,
      positionReconciliationResult: positionReconciliation,
    });

    if (!riskResult.approved) {
      return {
        admitted: false,
        intentId: intent.intentId,
        rejectionCode: riskResult.violationCode === 'POSITION_DIVERGENCE_UNRESOLVED' ? 'POSITION_DIVERGENCE_UNRESOLVED' : 'RISK_REJECTED',
        reason: riskResult.reason ?? 'Risk envelope rejected intent: ' + riskResult.violationCode,
      };
    }

    this.symbolLocks.set(symbolKey, intent.intentId);

    try {
      const riskConfig = this.riskService.getConfig();
      const executionResult = await this.runtime.execute({
        attemptId: intent.intentId,
        intentId: intent.intentId,
        correlationId: intent.source.correlationId,
        providerId: intent.providerId,
        connector: intent.connector,
        market: intent.market,
        symbol: intent.symbol,
        instrument: intent.instrument,
        side: intent.side,
        orderType: intent.orderType,
        quantity: intent.quantity,
        price: intent.price,
        tenantId: intent.tenantId,
        runSessionId: intent.runSessionId,
        environment: intent.environment ?? riskConfig.environment,
        credentialScopes: intent.credentialScopes,
        maxOrderNotional: riskConfig.maxOrderNotional,
        maxTotalRunNotional: riskConfig.maxTotalRunNotional,
        maxOutstandingOrders: riskConfig.maxOutstandingOrders,
      });

      return {
        admitted: executionResult.status === 'SUBMITTED' || executionResult.status === 'UNKNOWN',
        intentId: intent.intentId,
        executionResult,
        durableAttempt: executionResult.durableAttempt,
        reason: executionResult.error,
        rejectionCode: executionResult.status === 'PREFLIGHT_REJECTED' ? 'RISK_REJECTED' : undefined,
      };
    } finally {
      if (this.symbolLocks.get(symbolKey) === intent.intentId) {
        this.symbolLocks.delete(symbolKey);
      }
    }
  }

  getProcessedIntentsCount(): number {
    return this.processedIntents.size;
  }

  getActiveSymbolLocks(): Map<string, string> {
    return new Map(this.symbolLocks);
  }
}
