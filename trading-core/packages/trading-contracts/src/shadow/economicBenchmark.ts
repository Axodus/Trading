import type { FixedDecimal } from '../foundation/decimal.js';
import type {
  ShadowDecisionAnswer,
  ShadowDecisionObservation,
  ShadowJsonValue,
  ShadowProviderStatus,
} from './decisionProvider.js';

export type BenchmarkTaskClassV1 =
  | 'STATE_SUFFICIENCY'
  | 'ESCALATION_PREFILTER'
  | 'PROPOSAL_CONTRADICTION';

export type BenchmarkDatasetKindV1 =
  | 'NATURAL_WORKLOAD'
  | 'DIAGNOSTIC_CHALLENGE';

export type BenchmarkGroundTruthSufficiency = 'SUFFICIENT' | 'INSUFFICIENT';
export type BenchmarkGroundTruthEscalation = 'REQUIRED' | 'NOT_REQUIRED';
export type BenchmarkGroundTruthContradiction = 'CONTRADICTION_PRESENT' | 'NO_CONTRADICTION';

export interface BenchmarkGroundTruthV1 {
  readonly groundTruthId: string;
  readonly taskClass: BenchmarkTaskClassV1;
  readonly expectedSufficiency?: BenchmarkGroundTruthSufficiency;
  readonly expectedEscalation?: BenchmarkGroundTruthEscalation;
  readonly expectedContradiction?: BenchmarkGroundTruthContradiction;
  readonly isCriticalSafetyCase: boolean;
  readonly rationale: string;
}

export interface BenchmarkCasePayloadV1 {
  readonly caseId: string;
  readonly taskClass: BenchmarkTaskClassV1;
  readonly datasetKind: BenchmarkDatasetKindV1;
  readonly title: string;
  readonly marketState: Readonly<Record<string, ShadowJsonValue>>;
  readonly tradeProposal?: Readonly<Record<string, ShadowJsonValue>>;
  readonly deterministicIndicators?: Readonly<Record<string, ShadowJsonValue>>;
  readonly inputDigest: string;
}

export interface BenchmarkCaseV1 {
  readonly caseId: string;
  readonly taskClass: BenchmarkTaskClassV1;
  readonly datasetKind: BenchmarkDatasetKindV1;
  readonly payload: BenchmarkCasePayloadV1;
  readonly groundTruth: BenchmarkGroundTruthV1;
  readonly caseVersion: string;
}

export interface ProviderPricingSnapshotV1 {
  readonly providerId: string;
  readonly modelId: string;
  readonly pricingVersion: string;
  readonly snapshotDate: string;
  readonly inputPricePerMillionTokensUsd: string;
  readonly outputPricePerMillionTokensUsd: string;
  readonly fixedPerRequestSurchargeUsd?: string;
  readonly structuredOutputsSupported: boolean;
  readonly isReferenceProvider: boolean;
}

export interface ProviderTaskDecisionV1 {
  readonly stateSufficient?: boolean;
  readonly escalationRequired?: boolean;
  readonly contradictionDetected?: boolean;
  readonly confidence?: number;
  readonly abstained: boolean;
  readonly rawAnswers: readonly ShadowDecisionAnswer[];
}

export interface ProviderCaseResultV1 {
  readonly caseId: string;
  readonly taskClass: BenchmarkTaskClassV1;
  readonly datasetKind: BenchmarkDatasetKindV1;
  readonly providerId: string;
  readonly modelId: string;
  readonly status: ShadowProviderStatus;
  readonly decision: ProviderTaskDecisionV1;
  readonly isSchemaCompliant: boolean;
  readonly isUsefulDecision: boolean;
  readonly isCorrect: boolean;
  readonly isCriticalFalseSafe: boolean;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: string;
  readonly evaluatedAt: string;
}

export interface QualityFloorThresholdsV1 {
  readonly maxCriticalFalseSafeRate: number;
  readonly maxSchemaFailureRate: number;
  readonly minUsefulDecisionRate: number;
}

export interface ProviderBenchmarkEvaluationV1 {
  readonly providerId: string;
  readonly modelId: string;
  readonly datasetKind: BenchmarkDatasetKindV1;
  readonly totalCases: number;
  readonly successfulCases: number;
  readonly failedCases: number;
  readonly schemaCompliantCount: number;
  readonly abstentionCount: number;
  readonly correctCount: number;
  readonly usefulDecisionCount: number;
  readonly criticalFalseSafeCount: number;
  readonly usefulDecisionRate: number;
  readonly criticalFalseSafeRate: number;
  readonly schemaComplianceRate: number;
  readonly qualityFloorPassed: boolean;
  readonly totalCostUsd: string;
  readonly qualityAdjustedCostPerThousandUsd: string;
  readonly fullAccuracyCostPerThousandUsd: string;
  readonly informationCostQualityRatio: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
}

export interface BenchmarkCostMetricsV1 {
  readonly totalCostUsd: string;
  readonly qualityAdjustedCostPerThousandUsd: string;
  readonly fullAccuracyCostPerThousandUsd: string;
  readonly informationCostQualityRatio: number;
}

export interface EscalationPolicyV1 {
  readonly policyId: string;
  readonly escalateOnAbstain: boolean;
  readonly escalateConfidenceThreshold?: number;
  readonly escalateOnStateInsufficient?: boolean;
  readonly escalateOnAnomalyDetected?: boolean;
}

export interface EscalationEvaluationV1 {
  readonly escalationPolicyId: string;
  readonly tier1ProviderId: string;
  readonly tier2ProviderId: string;
  readonly datasetKind: BenchmarkDatasetKindV1;
  readonly totalCases: number;
  readonly tier1HandledCount: number;
  readonly escalatedCount: number;
  readonly escalationRate: number;
  readonly combinedCorrectCount: number;
  readonly combinedUsefulCount: number;
  readonly combinedCriticalFalseSafeCount: number;
  readonly combinedUsefulRate: number;
  readonly combinedCriticalFalseSafeRate: number;
  readonly totalCostUsd: string;
  readonly costReductionVsReferencePercent: number;
  readonly qualityFloorPassed: boolean;
}

export interface PairedComparisonV1 {
  readonly baselineProviderId: string;
  readonly candidateProviderId: string;
  readonly datasetKind: BenchmarkDatasetKindV1;
  readonly totalPairedCases: number;
  readonly candidateUsefulDecisions: number;
  readonly baselineUsefulDecisions: number;
  readonly bothUseful: number;
  readonly candidateOnlyUseful: number;
  readonly baselineOnlyUseful: number;
  readonly neitherUseful: number;
  readonly mcNemarChiSquared: number;
  readonly mcNemarPValueApprox: number;
  readonly statisticallyEquivalentOrSuperior: boolean;
  readonly candidateCostPerThousandUsd: string;
  readonly baselineCostPerThousandUsd: string;
  readonly costReductionRatio: number;
}

export interface EconomicBenchmarkEvaluationV1 {
  readonly evaluationId: string;
  readonly evaluationVersion: string;
  readonly evaluatedAt: string;
  readonly datasetKind: BenchmarkDatasetKindV1;
  readonly providerEvaluations: readonly ProviderBenchmarkEvaluationV1[];
  readonly pairedComparisons: readonly PairedComparisonV1[];
  readonly escalationEvaluations: readonly EscalationEvaluationV1[];
  readonly economicConclusion:
    | 'ECONOMIC_ADVANTAGE_CONFIRMED'
    | 'DISQUALIFIED_BY_QUALITY_FLOOR'
    | 'NO_LLM_JUSTIFIED'
    | 'INSUFFICIENT_EVIDENCE';
}
