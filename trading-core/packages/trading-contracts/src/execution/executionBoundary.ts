import type { TradingIntent } from '../governance/types.js';

export type ExecutionIntentSide = 'buy' | 'sell';
export type ExecutionIntentMarketType = 'spot' | 'futures' | 'perpetual';
export type ExecutionIntentOrderType = 'market' | 'limit' | 'stop' | 'take-profit';
export type ExecutionIntentTimeInForce = 'GTC' | 'IOC' | 'FOK' | 'GTX';
export type ExecutionIntentPositionMode = 'one-way' | 'hedge';

export interface ExecutionPriceConstraints {
  limitPrice?: string;
  maxSlippageBps?: number;
  stopPrice?: string;
}

export interface ExecutionTimeConstraints {
  validUntil?: string;
  timeInForce?: ExecutionIntentTimeInForce;
}

export interface ExecutionIntentConstraints {
  orderType: ExecutionIntentOrderType;
  timeInForce?: ExecutionIntentTimeInForce;
  priceConstraints?: ExecutionPriceConstraints;
  timeConstraints?: ExecutionTimeConstraints;
  reduceOnly?: boolean;
  positionMode?: ExecutionIntentPositionMode;
  postOnly?: boolean;
}

export interface ExecutionIntent {
  executionIntentId: string;
  tradingIntentId: string;
  strategyId: string;
  strategyRevisionId: string;
  instrument: string;
  marketType: ExecutionIntentMarketType;
  side: ExecutionIntentSide;
  authorizedCapital: string;
  authorizedQuantity: string;
  authorizedLeverage: string;
  executionCapital: string;
  executionQuantity: string;
  executionLeverage: string;
  venue: string;
  targetAdapterType: string;
  constraints: ExecutionIntentConstraints;
  tradingIntentDigest: string;
  authorizationContextDigest: string;
  executionPolicyRef: string;
  correlationId: string;
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string;
  evidenceRefs: readonly string[];
}

export type ExecutionTranslationDecision =
  | 'AUTHORIZED'
  | 'REDUCED'
  | 'REJECTED'
  | 'STALE'
  | 'UNSUPPORTED'
  | 'CONFLICT';

export type ExecutionTranslationReasonCode =
  | 'EXECUTION_HALT_ACTIVE'
  | 'STRATEGY_HEALTH_SUSPENDED'
  | 'STRATEGY_HEALTH_RETIRED'
  | 'STRATEGY_HEALTH_REVALIDATION_REQUIRED'
  | 'STRATEGY_HEALTH_UNKNOWN'
  | 'STRATEGY_RETIRED'
  | 'TRADING_INTENT_EXPIRED'
  | 'TRADING_INTENT_STALE'
  | 'TRADING_INTENT_ALREADY_CONSUMED'
  | 'STRATEGY_REVISION_MISMATCH'
  | 'INSTRUMENT_MISMATCH'
  | 'SIDE_MUTATION_PROHIBITED'
  | 'CAPITAL_EXPANSION_PROHIBITED'
  | 'QUANTITY_EXPANSION_PROHIBITED'
  | 'LEVERAGE_EXPANSION_PROHIBITED'
  | 'BELOW_PROVIDER_MIN_QUANTITY'
  | 'QUANTITY_STEP_ALIGNMENT_ZERO'
  | 'ADAPTER_CAPABILITY_UNSUPPORTED'
  | 'VENUE_SUBSTITUTION_PROHIBITED'
  | 'MARKET_TYPE_UNSUPPORTED'
  | 'ORDER_TYPE_UNSUPPORTED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_INPUT';

export interface ExecutionAdapterCapabilities {
  adapterType: string;
  supportedVenues: readonly string[];
  supportedMarketTypes: readonly ExecutionIntentMarketType[];
  supportedOrderTypes: readonly ExecutionIntentOrderType[];
  supportedTimeInForce: readonly ExecutionIntentTimeInForce[];
  supportsLeverage: boolean;
  maxLeverage?: string;
  supportsReduceOnly: boolean;
  supportedPositionModes: readonly ExecutionIntentPositionMode[];
  minQuantity: string;
  quantityStep: string;
  priceTick: string;
  minNotional?: string;
  maxNotional?: string;
}

export interface ExecutionPolicy {
  policyRevision: string;
  allowedAdapters: readonly string[];
  allowDryRunOnly: boolean;
  defaultTimeInForce: ExecutionIntentTimeInForce;
  defaultOrderType: ExecutionIntentOrderType;
  maxExecutionTimeoutMs: number;
  roundingMode: 'down';
  createdAt: string;
}

export const DEFAULT_EXECUTION_POLICY_V1: ExecutionPolicy = {
  policyRevision: 'DEFAULT_EXECUTION_POLICY_V1',
  allowedAdapters: ['dry_run', 'hummingbot_dry_run', 'condor_dry_run', 'simulated'],
  allowDryRunOnly: true,
  defaultTimeInForce: 'GTC',
  defaultOrderType: 'limit',
  maxExecutionTimeoutMs: 30000,
  roundingMode: 'down',
  createdAt: '2026-09-20T00:00:00.000Z',
};

export interface ExecutionTranslationCommand {
  commandId: string;
  tradingIntent: TradingIntent;
  targetAdapterType: string;
  adapterCapabilities: ExecutionAdapterCapabilities;
  policy?: ExecutionPolicy;
  evaluationTime: string;
  idempotencyKey: string;
  correlationId?: string;
  killSwitchActive?: boolean;
  operationalHealthState?: string;
  operationalLifecycleState?: string;
}

export interface ExecutionTranslationResult {
  translationId: string;
  tradingIntentId: string;
  decision: ExecutionTranslationDecision;
  reasonCodes: readonly ExecutionTranslationReasonCode[];
  executionIntent?: ExecutionIntent;
  effectiveCapital: string;
  effectiveQuantity: string;
  effectiveLeverage: string;
  policyRevision: string;
  evaluatedAt: string;
  eventRef?: string;
  rationale: string;
}

export interface ExecutionTranslationRecord {
  translationId: string;
  tradingIntentId: string;
  strategyId: string;
  strategyRevisionId: string;
  targetAdapterType: string;
  decision: ExecutionTranslationDecision;
  reasonCodes: readonly ExecutionTranslationReasonCode[];
  executionIntentId?: string;
  effectiveCapital: string;
  effectiveQuantity: string;
  effectiveLeverage: string;
  policyRevision: string;
  idempotencyKey: string;
  commandHash: string;
  rationale: string;
  evaluatedAt: string;
  createdAt: string;
}

export type DryRunExecutionMode = 'DRY_RUN' | 'SIMULATED';

export type ExecutionResultStatus =
  | 'TRANSLATED'
  | 'DRY_RUN_ACCEPTED'
  | 'SIMULATED_FILL'
  | 'REJECTED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ExecutionAttemptRecord {
  attemptId: string;
  executionIntentId: string;
  attemptNumber: number;
  adapterType: string;
  mode: DryRunExecutionMode;
  status: ExecutionResultStatus;
  requestedQuantity: string;
  acceptedQuantity: string;
  simulatedFilledQuantity?: string;
  simulatedAveragePrice?: string;
  fees?: { asset: string; amount: string };
  reasonCodes: readonly string[];
  createdAt: string;
  completedAt?: string;
}

export interface ExecutionResultPayload {
  executionResultId: string;
  executionIntentId: string;
  tradingIntentId: string;
  strategyId: string;
  strategyRevisionId: string;
  adapterType: string;
  mode: DryRunExecutionMode;
  status: ExecutionResultStatus;
  requestedQuantity: string;
  acceptedQuantity: string;
  simulatedFilledQuantity?: string;
  simulatedAveragePrice?: string;
  fees?: { asset: string; amount: string };
  reasonCodes: readonly string[];
  createdAt: string;
  completedAt: string;
  eventRef?: string;
}
