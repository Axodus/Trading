/**
 * AXODUS-TRADING-EPIC-01 / REQ-13
 * Autonomous Operational Safety, Recovery & Kill-Switch Coordination
 */

export type SafetyDomain =
  | 'MARKET_DATA'
  | 'DATABASE'
  | 'EVENT_SYSTEM'
  | 'RUNTIME'
  | 'WORKER'
  | 'PROVIDER'
  | 'VENUE'
  | 'EXECUTION'
  | 'RECONCILIATION'
  | 'ACCOUNTING'
  | 'GOVERNANCE'
  | 'CLOCK'
  | 'DEPENDENCY';

export type SafetyScope =
  | 'STRATEGY'
  | 'INSTRUMENT'
  | 'VENUE'
  | 'PROVIDER'
  | 'EXECUTION_ADAPTER'
  | 'WORKER'
  | 'SERVICE'
  | 'SYSTEM';

export type SafetyObservationStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'UNKNOWN'
  | 'INVALID';

export type SafetySeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type SystemSafetyState =
  | 'NORMAL'
  | 'DEGRADED'
  | 'CONTAINED'
  | 'RECOVERY_REQUIRED'
  | 'RECOVERING'
  | 'SAFE_TO_RESUME'
  | 'EMERGENCY';

export type KillSwitchLevel =
  | 'KILL_NONE'
  | 'KILL_NEW_RISK'
  | 'KILL_STRATEGY'
  | 'KILL_INSTRUMENT'
  | 'KILL_VENUE'
  | 'KILL_PROVIDER'
  | 'KILL_EXECUTION'
  | 'KILL_SYSTEM';

export type KillSwitchState =
  | 'REQUESTED'
  | 'ACTIVATING'
  | 'ACTIVE'
  | 'PARTIALLY_ACTIVE'
  | 'FAILED'
  | 'RELEASING'
  | 'RELEASED'
  | 'SUPERSEDED';

export type RecoveryStepType =
  | 'RESTORE_DATABASE'
  | 'RESTORE_EVENT_FLOW'
  | 'RESTORE_MARKET_DATA'
  | 'RESYNC_MARKET_DATA'
  | 'RESTORE_PROVIDER_CONNECTIVITY'
  | 'RECONCILE_OPEN_ORDERS'
  | 'RECONCILE_FILLS'
  | 'RECONCILE_POSITIONS'
  | 'REBUILD_ACCOUNTING'
  | 'VALIDATE_GOVERNANCE_STATE'
  | 'VALIDATE_RISK_STATE'
  | 'VALIDATE_PORTFOLIO_STATE'
  | 'VALIDATE_OPERATIONAL_SNAPSHOTS'
  | 'STABILITY_WINDOW'
  | 'READY_FOR_RESUME';

export type RecoveryPlanStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SUPERSEDED';

export interface SystemSafetyObservation {
  observationId: string;
  domain: SafetyDomain;
  component: string;
  scope: SafetyScope;
  scopeId?: string;
  status: SafetyObservationStatus;
  severity: SafetySeverity;
  observedAt: string;
  asOf: string;
  expiresAt?: string;
  reasonCodes: string[];
  metrics: Record<string, unknown>;
  sourceRef: string;
  correlationId?: string;
  causationId?: string;
  inputDigest: string;
}

export interface SystemSafetySnapshot {
  safetySnapshotId: string;
  observations: SystemSafetyObservation[];
  marketDataState: SafetyObservationStatus;
  databaseState: SafetyObservationStatus;
  eventSystemState: SafetyObservationStatus;
  runtimeState: SafetyObservationStatus;
  providerStates: Array<{ provider: string; status: SafetyObservationStatus; venue?: string }>;
  executionState: SafetyObservationStatus;
  reconciliationState: SafetyObservationStatus;
  accountingState: SafetyObservationStatus;
  governanceState: SafetyObservationStatus;
  createdAt: string;
  asOf: string;
  expiresAt: string;
  inputDigest: string;
}

export interface SystemSafetyPolicy {
  policyId: string;
  policyRevision: string;
  name: string;
  criticalDomains: SafetyDomain[];
  freshnessThresholdMs: Record<string, number>;
  stabilityWindowMs: number;
  autoContainmentEnabled: boolean;
  manualReleaseRequiredScopes: SafetyScope[];
}

export interface SystemSafetyAssessment {
  assessmentId: string;
  safetySnapshotId: string;
  policyId: string;
  policyRevision: string;
  state: SystemSafetyState;
  severity: SafetySeverity;
  scope: SafetyScope;
  scopeId?: string;
  reasonCodes: string[];
  activeKillLevels: KillSwitchLevel[];
  requiredActions: string[];
  createdAt: string;
  asOf: string;
  expiresAt: string;
  inputDigest: string;
}

export interface KillSwitchRequest {
  killSwitchRequestId: string;
  assessmentId: string;
  scope: SafetyScope;
  scopeId?: string;
  level: KillSwitchLevel;
  severity: SafetySeverity;
  reasonCodes: string[];
  activeReasons: string[];
  requestedAt: string;
  expiresAt?: string;
  status: KillSwitchState;
  isLatched: boolean;
  inputDigest: string;
}

export interface RecoveryStep {
  stepId: string;
  type: RecoveryStepType;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  resultRef?: string;
  completedAt?: string;
  error?: string;
}

export interface SystemRecoveryPlan {
  recoveryPlanId: string;
  triggerAssessmentId: string;
  killSwitchRequestId?: string;
  scope: SafetyScope;
  scopeId?: string;
  steps: RecoveryStep[];
  dependencies: Array<{ stepId: string; dependsOnStepId: string }>;
  policyId: string;
  policyRevision: string;
  status: RecoveryPlanStatus;
  leaseToken?: number;
  createdAt: string;
  completedAt?: string;
  inputDigest: string;
}

export interface ResumeEligibility {
  resumeEligibilityId: string;
  recoveryPlanId: string;
  eligible: boolean;
  scope: SafetyScope;
  scopeId?: string;
  validatedPrerequisites: string[];
  failedPrerequisites: string[];
  evaluatedAt: string;
  expiresAt: string;
  requiresHumanReview: boolean;
  inputDigest: string;
}

export interface ResumeRequest {
  resumeRequestId: string;
  recoveryPlanId: string;
  resumeEligibilityId: string;
  scope: SafetyScope;
  scopeId?: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
}

export const DEFAULT_SYSTEM_SAFETY_POLICY_V1: SystemSafetyPolicy = {
  policyId: 'pol_sys_safety_default_v1',
  policyRevision: 'v1.0.0',
  name: 'Default Canonical System Safety Policy v1',
  criticalDomains: [
    'DATABASE',
    'MARKET_DATA',
    'EVENT_SYSTEM',
    'EXECUTION',
    'RECONCILIATION',
    'ACCOUNTING',
    'GOVERNANCE',
  ],
  freshnessThresholdMs: {
    MARKET_DATA: 5000,
    DATABASE: 10000,
    EVENT_SYSTEM: 10000,
    RUNTIME: 15000,
    WORKER: 15000,
    PROVIDER: 10000,
    VENUE: 10000,
    EXECUTION: 10000,
    RECONCILIATION: 10000,
    ACCOUNTING: 30000,
    GOVERNANCE: 60000,
    CLOCK: 5000,
    DEPENDENCY: 30000,
  },
  stabilityWindowMs: 5000,
  autoContainmentEnabled: true,
  manualReleaseRequiredScopes: ['SYSTEM', 'EXECUTION_ADAPTER', 'VENUE'],
};

