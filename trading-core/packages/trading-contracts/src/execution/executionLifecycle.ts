import type { ExecutionIntent } from './executionBoundary.js';

export type ExecutionEnvironment = 'SIMULATED' | 'DRY_RUN' | 'TESTNET';

export type ExecutionAttemptStatus =
  | 'RESERVED'
  | 'SUBMITTING'
  | 'SUBMITTED_UNKNOWN'
  | 'ACKNOWLEDGED'
  | 'REJECTED'
  | 'FAILED_PRE_SUBMISSION'
  | 'COMPLETED';

export interface ExecutionAttempt {
  attemptId: string;
  executionIntentId: string;
  tradingIntentId: string;
  strategyId: string;
  strategyRevisionId: string;
  adapterType: string;
  venue: string;
  environment: ExecutionEnvironment;
  attemptNumber: number;
  idempotencyKey: string;
  clientOrderId: string;
  providerOrderId?: string;
  status: ExecutionAttemptStatus;
  createdAt: string;
  expiresAt: string;
  error?: string;
}

export type CanonicalOrderState =
  | 'PENDING_SUBMISSION'
  | 'SUBMITTED_UNKNOWN'
  | 'ACKNOWLEDGED'
  | 'OPEN'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCEL_PENDING'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED'
  | 'UNKNOWN';

export interface CanonicalOrder {
  canonicalOrderId: string;
  executionIntentId: string;
  executionAttemptId: string;
  tradingIntentId: string;
  strategyId: string;
  strategyRevisionId: string;
  provider: string;
  venue: string;
  instrument: string;
  side: 'buy' | 'sell';
  orderType: string;
  authorizedQuantity: string;
  executionQuantity: string;
  cumulativeFilledQuantity: string;
  remainingQuantity: string;
  weightedAveragePrice?: string;
  state: CanonicalOrderState;
  orderVersion: number;
  clientOrderId: string;
  providerOrderId?: string;
  lastObservationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalOrderEvent {
  eventId: string;
  canonicalOrderId: string;
  orderVersion: number;
  previousState: CanonicalOrderState;
  newState: CanonicalOrderState;
  observationId?: string;
  rationale: string;
  timestamp: string;
}

export interface CanonicalFill {
  canonicalFillId: string;
  canonicalOrderId: string;
  executionIntentId: string;
  provider: string;
  providerTradeId: string;
  instrument: string;
  side: 'buy' | 'sell';
  fillQuantity: string;
  fillPrice: string;
  fee?: string;
  feeAsset?: string;
  providerTimestamp: string;
  observedAt: string;
}

export type ProviderObservationType =
  | 'SUBMISSION_ACK'
  | 'SUBMISSION_REJECT'
  | 'ORDER_STATUS'
  | 'FILL'
  | 'PARTIAL_FILL'
  | 'CANCEL_ACK'
  | 'EXPIRE'
  | 'ERROR'
  | 'SNAPSHOT';

export type ProviderObservationSource =
  | 'rest-submission'
  | 'rest-query'
  | 'rest-cancellation'
  | 'ws-order'
  | 'ws-trade'
  | 'snapshot'
  | 'operator';

export interface ProviderObservation {
  observationId: string;
  observationType: ProviderObservationType;
  provider: string;
  venue: string;
  clientOrderId?: string;
  providerOrderId?: string;
  providerTradeId?: string;
  providerStatus?: string;
  observedQuantity?: string;
  observedPrice?: string;
  observedFee?: string;
  observedFeeAsset?: string;
  source: ProviderObservationSource;
  sequenceNumber?: number;
  observedAt: string;
  providerTimestamp?: string;
  rawPayloadDigest: string;
}

export type ReconciliationDecision =
  | 'MATCHED'
  | 'UPDATED'
  | 'RECONCILIATION_REQUIRED'
  | 'INVARIANT_VIOLATION'
  | 'ORPHAN_DETECTED'
  | 'NO_OP';

export interface ReconciliationRecord {
  reconciliationId: string;
  canonicalOrderId?: string;
  clientOrderId?: string;
  providerOrderId?: string;
  decision: ReconciliationDecision;
  previousState?: CanonicalOrderState;
  newState?: CanonicalOrderState;
  reconciliationVersion: number;
  reasonCodes: readonly string[];
  discrepancyDetails?: string;
  evaluatedAt: string;
}

export interface ExecutionRetryPolicy {
  policyRevision: string;
  maxAttempts: number;
  requireReconciliationBeforeRetry: boolean;
  backoffBaseMs: number;
  maxBackoffMs: number;
}

export const DEFAULT_EXECUTION_RETRY_POLICY_V1: ExecutionRetryPolicy = {
  policyRevision: 'DEFAULT_EXECUTION_RETRY_POLICY_V1',
  maxAttempts: 3,
  requireReconciliationBeforeRetry: true,
  backoffBaseMs: 500,
  maxBackoffMs: 5000,
};

export interface ReconciliationPolicy {
  policyRevision: string;
  maxReconciliationAttempts: number;
  pollIntervalMs: number;
  stalenessThresholdMs: number;
}

export const DEFAULT_RECONCILIATION_POLICY_V1: ReconciliationPolicy = {
  policyRevision: 'DEFAULT_RECONCILIATION_POLICY_V1',
  maxReconciliationAttempts: 5,
  pollIntervalMs: 1000,
  stalenessThresholdMs: 30000,
};

export interface CancellationCommand {
  commandId: string;
  canonicalOrderId: string;
  reason: string;
  requestedBy: 'operator' | 'timeout' | 'halt' | 'suspension' | 'risk';
  requestedAt: string;
}

export interface ExecutionLifecycleResult {
  executionResultId: string;
  executionIntentId: string;
  canonicalOrderId: string;
  terminalState: CanonicalOrderState;
  cumulativeFilledQuantity: string;
  weightedAveragePrice?: string;
  fees: readonly { asset: string; amount: string }[];
  reconciled: boolean;
  evidenceRefs: readonly string[];
}

