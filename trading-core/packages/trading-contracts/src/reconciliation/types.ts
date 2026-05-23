import type { BalanceSnapshot, ExecutionFill, ExecutionProviderStatus, ExecutionResult, PositionSnapshot } from '../execution/types.js';
import type { TradingExecutionContext } from '../runtime/types.js';

export type ReconciliationState =
  | 'synchronized'
  | 'stale'
  | 'divergent'
  | 'degraded'
  | 'orphaned'
  | 'reconciliation-required';

export type ReconciliationFindingType =
  | 'provider-state-drift'
  | 'order-divergence'
  | 'fill-divergence'
  | 'position-divergence'
  | 'runtime-drift'
  | 'stale-execution-state'
  | 'orphan-runtime';

export type ReconciliationProposalReviewState =
  | 'created'
  | 'pending-review'
  | 'under-risk-review'
  | 'under-governance-review'
  | 'approved-for-remediation'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'expired';

export type ReconciliationCandidateType =
  | 'stale-runtime'
  | 'provider-drift'
  | 'orphan-runtime'
  | 'order-divergence'
  | 'position-divergence';

export interface ReconciliationContext extends TradingExecutionContext {
  correlationId: string;
}

export interface ProviderOrderSnapshot {
  providerOrderId: string;
  requestId?: string;
  market: string;
  status: ExecutionResult['status'] | 'filled' | 'cancelled';
  updatedAt: string;
}

export interface ProviderRuntimeSnapshot {
  runtimeInstanceId: string;
  status: 'active' | 'paused' | 'suspended' | 'degraded' | 'offline' | 'unknown';
  updatedAt: string;
}

export interface ProviderSideEffectSnapshot {
  providerStatus: ExecutionProviderStatus;
  orders?: ProviderOrderSnapshot[];
  fills?: ExecutionFill[];
  positions?: PositionSnapshot;
  balances?: BalanceSnapshot;
  runtimes?: ProviderRuntimeSnapshot[];
  capturedAt: string;
}

export interface SovereignReconciliationSnapshot {
  providerStatus?: ExecutionProviderStatus;
  orders?: ProviderOrderSnapshot[];
  fills?: ExecutionFill[];
  positions?: PositionSnapshot;
  runtimes?: ProviderRuntimeSnapshot[];
  capturedAt: string;
}

export interface ReconciliationFinding {
  type: ReconciliationFindingType;
  state: ReconciliationState;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  providerId: string;
  runtimeInstanceId?: string;
  providerOrderId?: string;
  market?: string;
  expected?: unknown;
  observed?: unknown;
}

export interface ReconciliationProposal {
  id: string;
  correlationId: string;
  context: ReconciliationContext;
  state: ReconciliationState;
  reviewState: ReconciliationProposalReviewState;
  findings: ReconciliationFinding[];
  recommendedActions: Array<
    | 'record-audit'
    | 'request-provider-health-review'
    | 'request-runtime-recovery'
    | 'request-order-review'
    | 'request-position-review'
    | 'degrade-runtime'
  >;
  mutatesSovereignState: false;
  createdAt: string;
}

export interface ReconciliationRequest {
  context: ReconciliationContext;
  sovereignSnapshot: SovereignReconciliationSnapshot;
  providerSnapshot: ProviderSideEffectSnapshot;
  staleAfterMs?: number;
  now?: string;
}

export interface ReconciliationWorkerCandidate {
  id: string;
  tenantId: string;
  candidateType: ReconciliationCandidateType;
  request: ReconciliationRequest;
  discoveredAt: string;
  reason: string;
}

export interface ReconciliationWorkerRunResult {
  id: string;
  correlationId: string;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  candidatesScanned: number;
  proposalsCreated: number;
  proposals: ReconciliationProposal[];
  errors: string[];
}

export type ReconciliationRemediationRequestType =
  | 'runtime-recovery-request'
  | 'provider-resync-request'
  | 'order-review-request'
  | 'position-review-request'
  | 'reconciliation-retry-request'
  | 'manual-operator-review-request';

export interface ReconciliationReviewPolicy {
  requireRiskApproval: boolean;
  requireGovernanceForTreasury: boolean;
  requireTreasuryPolicyForTreasury: boolean;
  allowUserRuntimeRemediation: boolean;
}

export interface AcsReconciliationReviewCommand {
  id: string;
  correlationId: string;
  tenantId?: string;
  proposalId: string;
  requestedBy: 'acs' | 'governance' | 'risk' | 'reconciliation-worker' | string;
  decisionIntent: 'approve-remediation' | 'reject';
  riskApproved?: boolean;
  governanceApproved?: boolean;
  treasuryPolicyApproved?: boolean;
  reason?: string;
}

export interface ReconciliationRemediationRequest {
  id: string;
  proposalId: string;
  correlationId: string;
  tenantId: string;
  context: ReconciliationContext;
  requestType: ReconciliationRemediationRequestType;
  status: 'requested' | 'blocked';
  reason?: string;
  autoHealing: false;
  mutatesProvider: false;
  mutatesSovereignState: false;
  createdAt: string;
}

export interface ReconciliationApprovalDecision {
  id: string;
  commandId: string;
  proposalId: string;
  correlationId: string;
  tenantId?: string;
  approved: boolean;
  reviewState: ReconciliationProposalReviewState;
  blockedBy?: 'tenant-context' | 'proposal-not-found' | 'tenant-mismatch' | 'risk' | 'governance' | 'treasury-policy' | 'worker-self-approval' | 'operator-rejection';
  reason?: string;
  remediationRequest?: ReconciliationRemediationRequest;
  autoHealing: false;
  createdAt: string;
}
