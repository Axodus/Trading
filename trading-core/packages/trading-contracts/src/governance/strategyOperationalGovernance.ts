/**
 * AXODUS-TRADING-EPIC-01 / REQ-12
 * Strategy Operational Governance, Revalidation Resolution & Controlled Intervention
 */

import { StrategyLifecycleState } from '../strategy/types.js';
import { StrategyHealthState } from '../strategy/types.js';
import { DriftClassification } from '../execution/performanceDrift.js';
import { RevalidationRequestStatus } from '../execution/performanceDrift.js';

export type GovernanceClassification =
  | 'CONTINUE'
  | 'OBSERVE'
  | 'RESTRICT'
  | 'REVALIDATE'
  | 'INTERVENE'
  | 'SUSPEND_REQUESTED'
  | 'RETIREMENT_REVIEW'
  | 'BLOCKED';

export type TargetAuthority =
  | 'STRATEGY_HEALTH'
  | 'STRATEGY_LIFECYCLE'
  | 'RISK'
  | 'PORTFOLIO'
  | 'REVALIDATION';

export type InterventionType =
  | 'REASSESS_HEALTH'
  | 'REQUEST_REVALIDATION'
  | 'REQUEST_RISK_RESTRICTION'
  | 'REQUEST_RISK_HALT_REVIEW'
  | 'REQUEST_CAPITAL_REDUCTION'
  | 'REQUEST_CAPITAL_FREEZE'
  | 'REQUEST_LIFECYCLE_REVALIDATION'
  | 'REQUEST_LIFECYCLE_DEMOTION'
  | 'REQUEST_SUSPENSION_REVIEW'
  | 'REQUEST_RETIREMENT_REVIEW';

export type InterventionSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type InterventionRequestStatus =
  | 'REQUESTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'APPLIED'
  | 'REJECTED'
  | 'FAILED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'CANCELLED';

export type InterventionPlanStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PARTIALLY_APPLIED'
  | 'RESOLVED'
  | 'FAILED'
  | 'SUPERSEDED'
  | 'EXPIRED';

export type InterventionResolutionStatus =
  | 'PENDING'
  | 'PARTIALLY_APPLIED'
  | 'RESOLVED'
  | 'FAILED'
  | 'SUPERSEDED'
  | 'EXPIRED';

export type GovernanceRevalidationOutcome = 'PASSED' | 'FAILED' | 'INCONCLUSIVE' | 'PENDING';

export interface StrategyGovernanceSnapshot {
  governanceSnapshotId: string;
  strategyId: string;
  strategyRevisionId: string;
  lifecycleState: StrategyLifecycleState;
  lifecycleVersion: number;
  healthState: StrategyHealthState;
  healthVersion: number;
  operationalSnapshotId: string;
  driftAssessmentId?: string;
  driftClassification?: DriftClassification;
  revalidationRequestId?: string;
  revalidationOutcomeRef?: string;
  revalidationOutcome?: GovernanceRevalidationOutcome;
  revalidationStatus?: RevalidationRequestStatus;
  promotionEligibilityRef?: string;
  portfolioContextRef?: string;
  riskContextRef?: string;
  createdAt: string;
  asOf: string;
  expiresAt: string;
  inputDigest: string;
}

export interface StrategyGovernanceDecision {
  governanceDecisionId: string;
  strategyId: string;
  strategyRevisionId: string;
  governanceSnapshotId: string;
  policyId: string;
  policyRevision: string;
  classification: GovernanceClassification;
  reasonCodes: string[];
  requiredInterventions: InterventionType[];
  createdAt: string;
  asOf: string;
  expiresAt: string;
  inputDigest: string;
}

export interface StrategyInterventionRequest {
  interventionRequestId: string;
  strategyId: string;
  strategyRevisionId: string;
  governanceDecisionId: string;
  planId?: string;
  targetAuthority: TargetAuthority;
  interventionType: InterventionType;
  severity: InterventionSeverity;
  reasonCodes: string[];
  evidenceRefs: string[];
  requestedAt: string;
  expiresAt?: string;
  status: InterventionRequestStatus;
  authorityResponseRef?: string;
  inputDigest: string;
}

export interface StrategyInterventionPlan {
  planId: string;
  strategyId: string;
  strategyRevisionId: string;
  governanceDecisionId: string;
  requests: StrategyInterventionRequest[];
  dependencies: Array<{ requestId: string; dependsOnRequestId: string }>;
  status: InterventionPlanStatus;
  createdAt: string;
  resolvedAt?: string;
  inputDigest: string;
}

export interface AuthorityResponse {
  responseId: string;
  interventionRequestId: string;
  targetAuthority: TargetAuthority;
  status: 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'APPLIED';
  canonicalResultRef?: string;
  reasonCodes?: string[];
  respondedAt: string;
  details?: Record<string, unknown>;
}

export interface StrategyInterventionResolution {
  resolutionId: string;
  strategyId: string;
  strategyRevisionId: string;
  governanceDecisionId: string;
  planId?: string;
  status: InterventionResolutionStatus;
  resolvedInterventions: string[];
  pendingInterventions: string[];
  rejectedInterventions: string[];
  reasons: string[];
  resolvedAt: string;
  inputDigest: string;
}

export interface StrategyOperationalGovernancePolicy {
  policyId: string;
  policyRevision: string;
  name: string;
  defaultValidityMs: number;
  autoInterventionEnabled: boolean;
  humanReviewRequiredSeverities: InterventionSeverity[];
}

export const DEFAULT_STRATEGY_OPERATIONAL_GOVERNANCE_POLICY_V1: StrategyOperationalGovernancePolicy = {
  policyId: 'pol_strat_gov_default_v1',
  policyRevision: 'v1.0.0',
  name: 'Default Canonical Strategy Operational Governance Policy v1',
  defaultValidityMs: 3600000, // 1 hour
  autoInterventionEnabled: true,
  humanReviewRequiredSeverities: ['CRITICAL'],
};
