export type CexExecutionLifecycleState =
  | 'attempt-created'
  | 'submission-in-progress'
  | 'provider-acknowledged'
  | 'failed'
  | 'rejected'
  | 'execution-unknown'
  | 'reconciling'
  | 'reconciled-found'
  | 'reconciled-not-found'
  | 'reconciled-indeterminate'
  | 'cancel-requested'
  | 'cancelled'
  | 'cancellation-rejected'
  | 'cancellation-failed';

export type CexReconciliationOutcome = 'found' | 'not-found' | 'indeterminate';

export interface CexConnectorCapabilities {
  supportsCallerOrderIdentity: boolean;
  supportsExactOrderLookup: boolean;
  supportsDeterministicReconciliation: boolean;
}

export interface CexSubmissionAttempt {
  attemptId: string;
  intentId: string;
  correlationId: string;
  providerId: string;
  connector: string;
  market: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: string;
  price?: string;
  executionClientOrderId: string;
  state: CexExecutionLifecycleState;
  createdAt: string;
  updatedAt: string;
  providerOrderId?: string;
  evidence?: CexOrderEvidence;
  lastFailure?: string;
}

export interface CexOrderEvidence {
  executionClientOrderId: string;
  providerOrderId?: string;
  providerStatus: string;
  filledQuantity?: string;
  remainingQuantity?: string;
  observedAt: string;
  source: 'rest-exact-lookup' | 'rest-submission-response' | 'rest-cancellation-response' | 'operator-review';
  cancellationState?: 'not-requested' | 'requested' | 'cancelled' | 'rejected' | 'unknown';
  fillReferences?: string[];
}

export interface CexReconciliationRequest {
  attemptId: string;
  providerId: string;
  connector: string;
  market: string;
  executionClientOrderId: string;
  requestedAt: string;
}

export type CexReconciliationResult =
  | { outcome: 'found'; evidence: CexOrderEvidence }
  | { outcome: 'not-found'; evidence?: CexOrderEvidence; observedAt: string }
  | { outcome: 'indeterminate'; reason: string; evidence?: CexOrderEvidence; observedAt: string };

export interface CexReconciliationProvider {
  readonly providerId: string;
  readonly connector: string;
  readonly capabilities: CexConnectorCapabilities;
  reconcileByClientOrderId(request: CexReconciliationRequest): Promise<CexReconciliationResult>;
}

export interface CexExecutionAttemptRepository {
  save(attempt: CexSubmissionAttempt): Promise<void>;
  get(attemptId: string): Promise<CexSubmissionAttempt | undefined>;
  listByStates(states: CexExecutionLifecycleState[]): Promise<CexSubmissionAttempt[]>;
}
