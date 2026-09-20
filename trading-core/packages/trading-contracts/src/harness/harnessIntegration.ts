/**
 * AXODUS-TRADING-EPIC-01 / REQ-14
 * Autonomous Trading Harness Integration, End-to-End Paper/Testnet Control Loop & Readiness Gate Contracts
 */

export type HarnessEnvironment = 'PAPER' | 'TESTNET';

export type HarnessMode =
  | 'AUTONOMOUS_CYCLE'
  | 'FAULTHANDLER_EVALUATION'
  | 'RECONCILIATION_CYCLE'
  | 'RECOVERY_CYCLE';

export type HarnessStage =
  | 'MARKET_INGESTION'
  | 'MARKET_STATE'
  | 'OPPORTUNITY'
  | 'STRATEGY_PROPOSAL'
  | 'PORTFOLIO'
  | 'RISK'
  | 'TRADING_INTENT'
  | 'EXECUTION_INTENT'
  | 'EXECUTION'
  | 'RECONCILIATION'
  | 'DIAGNOSTICS'
  | 'PNL_ATTRIBUTION'
  | 'PERFORMANCE'
  | 'DRIFT'
  | 'GOVERNANCE'
  | 'SAFETY'
  | 'RECOVERY'
  | 'COMPLETE';

export type HarnessRunStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'WAITING'
  | 'RECONCILING'
  | 'CONTAINED'
  | 'RECOVERING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED'
  | 'SUPERSEDED';

export interface TradingHarnessRun {
  harnessRunId: string;
  environment: HarnessEnvironment;
  mode: HarnessMode;
  strategyId: string;
  strategyRevisionId: string;
  instrument: string;
  venue: string;
  currentStage: HarnessStage;
  status: HarnessRunStatus;
  startedAt: string;
  completedAt?: string;
  marketContextRef?: string;
  opportunityRef?: string;
  tradeProposalRef?: string;
  portfolioDecisionRef?: string;
  riskDecisionRef?: string;
  tradingIntentRef?: string;
  executionIntentRef?: string;
  executionAttemptRef?: string;
  canonicalOrderRef?: string;
  executionResultRef?: string;
  diagnosticsRef?: string;
  pnlAttributionRef?: string;
  feedbackSnapshotRef?: string;
  driftAssessmentRef?: string;
  governanceDecisionRef?: string;
  safetyAssessmentRef?: string;
  recoveryPlanRef?: string;
  resumeEligibilityRef?: string;
  correlationId: string;
  causationId: string;
  leaseToken?: number;
  failureReason?: string;
  inputDigest: string;
}

export interface HarnessStageTransition {
  transitionId: string;
  harnessRunId: string;
  fromStage: HarnessStage;
  toStage: HarnessStage;
  authority: string;
  artifactRef?: string;
  timestamp: string;
  inputDigest: string;
}

export interface HarnessRunEvidencePackage {
  evidencePackageId: string;
  harnessRunId: string;
  strategyId: string;
  strategyRevisionId: string;
  environment: HarnessEnvironment;
  timeline: Array<{
    stage: HarnessStage;
    timestamp: string;
    authority: string;
    artifactRef?: string;
  }>;
  evidenceRefs: string[];
  economicSummary?: {
    realizedGrossPnl?: string;
    realizedNetPnl?: string;
    fees?: string;
    currency?: string;
  };
  governanceSummary?: {
    driftClassification?: string;
    governanceClassification?: string;
  };
  safetySummary?: {
    safetyState: string;
    activeKillLevel: string;
  };
  createdAt: string;
  inputDigest: string;
}

export type ReadinessDimension =
  | 'ARCHITECTURE_CONFORMANCE'
  | 'CONTRACT_CONFORMANCE'
  | 'PERSISTENCE_DURABILITY'
  | 'EXECUTION_CONTROL'
  | 'RECONCILIATION'
  | 'ECONOMIC_ACCOUNTING'
  | 'QUANT_FEEDBACK'
  | 'GOVERNANCE_CONTROL'
  | 'SYSTEM_SAFETY'
  | 'RECOVERY'
  | 'OBSERVABILITY'
  | 'TESTNET_PROVIDER';

export type DimensionReadinessStatus = 'PASS' | 'PASS_WITH_REMEDIATION' | 'FAIL' | 'NOT_APPLICABLE';

export interface HarnessReadinessReport {
  reportId: string;
  environment: 'PAPER_TESTNET_ONLY';
  overallStatus: 'PASS' | 'PASS_WITH_REMEDIATION' | 'FAIL';
  dimensionEvaluations: Record<ReadinessDimension, { status: DimensionReadinessStatus; notes: string }>;
  p0Blockers: string[];
  p1Findings: string[];
  p2Findings: string[];
  debtAudA03Status: 'OPEN / PARTIALLY REMEDIATED - BLOCKING FOR REAL CAPITAL';
  evaluatedAt: string;
  inputDigest: string;
}
