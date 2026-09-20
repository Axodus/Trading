import type { FixedDecimal } from '../foundation/decimal.js';

export type EvidenceStrength = 'INSUFFICIENT' | 'PRELIMINARY' | 'VALIDATED' | 'ROBUST';

export type PerformanceEnvironment =
  | 'BACKTEST'
  | 'PAPER'
  | 'SIMULATED'
  | 'DRY_RUN'
  | 'TESTNET'
  | 'LIMITED_LIVE'
  | 'PRODUCTION';

export interface ExpectedMetrics {
  expectedReturn?: string;
  expectedSharpe?: string;
  expectedMaxDrawdown?: string;
  expectedWinRate?: string;
  expectedProfitFactor?: string;
  expectedTradeFrequencyPerDay?: string;
  expectedHoldingPeriodSec?: number;
  expectedTurnoverPerDay?: string;
  expectedSlippageBps?: string;
  expectedFee?: string;
  expectedFillRatio?: string;
  expectedLatencyMs?: number;
  expectedRejectionRate?: string;
}

export interface ExpectedPerformanceEnvelope {
  envelopeId: string;
  strategyId: string;
  strategyRevisionId: string;
  strategyEvidenceRefs: readonly string[];
  experimentRefs?: readonly string[];
  datasetRefs?: readonly string[];
  policyId: string;
  policyRevision: string;
  environmentApplicability: readonly PerformanceEnvironment[];
  marketRegimeApplicability?: readonly string[];
  evidenceStrength: EvidenceStrength;
  windowSemantics?: string;
  expectedMetrics: ExpectedMetrics;
  createdAt: string;
  validFrom: string;
  validUntil?: string;
  inputDigest: string;
}

export interface PerformanceComparisonPolicy {
  policyId: string;
  policyRevision: string;
  minSampleSize: number;
  minElapsedTimeMs?: number;
  allowedEnvironments: readonly PerformanceEnvironment[];
  requireExactRegimeMatch?: boolean;
  maxAllowedSlippageDeviationBps?: string;
  maxAllowedFeeDeviationBps?: string;
  maxAllowedLatencyDeviationMs?: number;
  minAllowedFillRatio?: string;
  maxAllowedDrawdownDeviationPct?: string;
  maxAllowedReturnDeviationBps?: string;
}

export interface ObservedMetrics {
  tradeCount: number;
  filledQuantity: string;
  realizedGrossPnl: string;
  realizedNetPnl: string;
  canonicalFees: string;
  averageSlippageBps?: string;
  averageLatencyMs?: number;
  fillRatio?: string;
  rejectionRate?: string;
  cancellationRate?: string;
  drawdown?: string;
  winRate?: string;
  tradeFrequencyPerDay?: string;
  turnover?: string;
  holdingPeriodSec?: number;
}

export interface MetricDeviation {
  metricName: string;
  expectedValue?: string;
  observedValue?: string;
  absoluteDeviation?: string;
  relativeDeviationPct?: string;
  status: 'COMPATIBLE' | 'DEVIATED' | 'UNAVAILABLE';
}

export type PerformanceEvaluationQuality =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'INSUFFICIENT_DATA'
  | 'PENDING_RECONCILIATION'
  | 'INVALID';

export interface PerformanceEvaluation {
  evaluationId: string;
  strategyId: string;
  strategyRevisionId: string;
  expectedEnvelopeId: string;
  comparisonPolicyId: string;
  comparisonPolicyRevision: string;
  observationWindowStart: string;
  observationWindowEnd: string;
  feedbackSnapshotRefs: readonly string[];
  diagnosticsRefs: readonly string[];
  pnlAttributionRefs: readonly string[];
  expectedMetrics: ExpectedMetrics;
  observedMetrics: ObservedMetrics;
  deviations: readonly MetricDeviation[];
  sampleSize: number;
  quality: PerformanceEvaluationQuality;
  createdAt: string;
  asOf: string;
  inputDigest: string;
}

export type DriftClassification =
  | 'INSUFFICIENT_DATA'
  | 'NORMAL'
  | 'DEGRADED'
  | 'MATERIAL'
  | 'CRITICAL';

export type DriftDimension =
  | 'ECONOMIC'
  | 'EXECUTION'
  | 'COST'
  | 'LATENCY'
  | 'FILL_QUALITY'
  | 'RISK'
  | 'BEHAVIOR'
  | 'REGIME'
  | 'DATA_QUALITY';

export interface MetricAssessment {
  metricName: string;
  dimension: DriftDimension;
  expected?: string;
  observed?: string;
  deviation?: string;
  threshold?: string;
  severity: 'NONE' | 'DEGRADED' | 'MATERIAL' | 'CRITICAL' | 'UNAVAILABLE';
  provenance: string;
}

export interface DriftPersistenceState {
  consecutiveDegradedWindows: number;
  consecutiveNormalWindows: number;
  previousClassification?: DriftClassification;
  isTriggered: boolean;
}

export interface DriftPolicy {
  policyId: string;
  policyRevision: string;
  minSampleSize: number;
  persistenceWindowsRequired: number;
  recoveryWindowsRequired: number;
  economicDriftThresholdBps?: string;
  slippageDriftThresholdBps?: string;
  feeDriftThresholdBps?: string;
  latencyDriftThresholdMs?: number;
  fillRatioDriftThreshold?: string;
  criticalDrawdownThresholdPct?: string;
}

export interface PerformanceDriftAssessment {
  assessmentId: string;
  strategyId: string;
  strategyRevisionId: string;
  performanceEvaluationId: string;
  driftPolicyId: string;
  driftPolicyRevision: string;
  classification: DriftClassification;
  metricAssessments: readonly MetricAssessment[];
  driftDimensions: readonly DriftDimension[];
  sampleSize: number;
  persistenceState: DriftPersistenceState;
  quality: PerformanceEvaluationQuality;
  createdAt: string;
  asOf: string;
  inputDigest: string;
}

export type RevalidationScope =
  | 'FULL_STRATEGY'
  | 'EXECUTION_ASSUMPTIONS'
  | 'COST_MODEL'
  | 'SLIPPAGE_MODEL'
  | 'REGIME_ROBUSTNESS'
  | 'PARAMETER_ROBUSTNESS'
  | 'OOS_REVALIDATION'
  | 'WALK_FORWARD_REVALIDATION'
  | 'DATA_QUALITY';

export type RevalidationRequestStatus =
  | 'REQUESTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SUPERSEDED'
  | 'CANCELLED';

export interface RevalidationRequestPolicy {
  policyId: string;
  policyRevision: string;
  allowedTriggers: readonly DriftClassification[];
  defaultScope: RevalidationScope;
}

export interface RevalidationRequest {
  revalidationRequestId: string;
  strategyId: string;
  strategyRevisionId: string;
  triggerAssessmentId: string;
  triggerClassification: DriftClassification;
  requestedValidationScope: RevalidationScope;
  evidenceRefs: readonly string[];
  requestedAt: string;
  requestPolicyId: string;
  requestPolicyRevision: string;
  status: RevalidationRequestStatus;
  inputDigest: string;
  resultRef?: string;
  updatedAt?: string;
}

export const DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1: PerformanceComparisonPolicy = {
  policyId: 'DEFAULT_PERFORMANCE_COMPARISON_POLICY',
  policyRevision: 'DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1',
  minSampleSize: 3,
  allowedEnvironments: ['SIMULATED', 'DRY_RUN', 'TESTNET', 'PAPER', 'LIMITED_LIVE', 'PRODUCTION'],
  maxAllowedSlippageDeviationBps: '25.000000000000',
  maxAllowedFeeDeviationBps: '15.000000000000',
  maxAllowedLatencyDeviationMs: 1000,
  minAllowedFillRatio: '0.800000000000',
  maxAllowedDrawdownDeviationPct: '10.000000000000',
  maxAllowedReturnDeviationBps: '100.000000000000',
};

export const DEFAULT_DRIFT_POLICY_V1: DriftPolicy = {
  policyId: 'DEFAULT_DRIFT_POLICY',
  policyRevision: 'DEFAULT_DRIFT_POLICY_V1',
  minSampleSize: 3,
  persistenceWindowsRequired: 2,
  recoveryWindowsRequired: 2,
  economicDriftThresholdBps: '50.000000000000',
  slippageDriftThresholdBps: '20.000000000000',
  feeDriftThresholdBps: '10.000000000000',
  latencyDriftThresholdMs: 500,
  fillRatioDriftThreshold: '0.150000000000',
  criticalDrawdownThresholdPct: '20.000000000000',
};

export const DEFAULT_REVALIDATION_REQUEST_POLICY_V1: RevalidationRequestPolicy = {
  policyId: 'DEFAULT_REVALIDATION_REQUEST_POLICY',
  policyRevision: 'DEFAULT_REVALIDATION_REQUEST_POLICY_V1',
  allowedTriggers: ['MATERIAL', 'CRITICAL'],
  defaultScope: 'FULL_STRATEGY',
};
