import type { FeatureDependency, StrategyRevision } from '../strategy/types.js';

export interface DatasetReference {
  datasetId: string;
  datasetVersion: string;
  contentDigest: string;
  sourceRef: string;
  venueScope: readonly string[];
  instrumentScope: readonly string[];
  temporalCoverage: { from: string; to: string };
  resolution: string;
  schemaVersion: string;
  qualityStatus: 'verified' | 'degraded' | 'incomplete' | 'unknown';
}

export interface ExperimentReference {
  experimentId: string;
  experimentRevision: string;
  strategyRevisionId: string;
  datasetRefs: readonly DatasetReference[];
  featureDefinitions: readonly FeatureDependency[];
  methodologyRef: string;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'superseded';
  provenanceRef: string;
}

export interface StrategyEvidence {
  evidenceId: string;
  strategyRevision: Pick<StrategyRevision, 'strategy' | 'revision' | 'revisionId'>;
  experimentRefs: readonly ExperimentReference[];
  datasetRefs: readonly DatasetReference[];
  featureDefinitions: readonly FeatureDependency[];
  methodologyRef: string;
  metrics: Readonly<Record<string, unknown>>;
  robustnessFindings: readonly string[];
  executionAssumptions: readonly string[];
  uncertainty: readonly string[];
  weaknesses: readonly string[];
  provenanceRef: string;
  codeVersion: string;
  status: 'candidate' | 'qualified' | 'superseded' | 'invalidated';
  createdAt: string;
  supersedesEvidenceId?: string;
  acsEvidenceRef?: string;
}

export interface PromotionEligibility {
  eligibilityId: string;
  strategyRevisionId: string;
  targetState: import('../strategy/types.js').StrategyLifecycleState;
  decision: import('../strategy/types.js').PromotionEligibilityState;
  evidenceRefs: readonly string[];
  policyVersion: string;
  checks: readonly string[];
  violations: readonly string[];
  decidedAt: string;
  expiresAt?: string;
  authorityRef: string;
}
