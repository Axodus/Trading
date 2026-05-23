export interface RiskCheckRequest {
  requestId: string;
  asset: string;
  venue: string;
  strategyId?: string;
  notional?: string;
  leverage?: string;
}

export interface RiskCheckResult {
  requestId: string;
  status: 'approved' | 'rejected' | 'review-required';
  violations: string[];
}

export type ObservabilityRiskSignalType =
  | 'provider-critical'
  | 'provider-degraded'
  | 'runtime-critical'
  | 'runtime-degraded'
  | 'strategy-degraded'
  | 'execution-latency-spike'
  | 'telemetry-ingestion-degraded'
  | 'repeated-runtime-recovery'
  | 'repeated-reconciliation-drift';

export type ObservabilityRiskDecisionType =
  | 'allow'
  | 'warn'
  | 'require-review'
  | 'recommend-block'
  | 'require-recovery'
  | 'require-simulation'
  | 'require-backtest'
  | 'require-controlled-resume-approval';

export interface ObservabilityRiskSignal {
  id: string;
  correlationId: string;
  tenantId: string;
  signalType: ObservabilityRiskSignalType;
  severity: 'info' | 'warning' | 'high' | 'critical';
  source:
    | 'provider-health'
    | 'runtime-health'
    | 'strategy-health'
    | 'execution-latency'
    | 'telemetry-ingestion'
    | 'reconciliation';
  providerId?: string;
  runtimeInstanceId?: string;
  strategyId?: string;
  strategyProductId?: string;
  userId?: string;
  daoId?: string;
  evidence: {
    state?: string;
    score?: number;
    reasons?: string[];
    averageLatencyMs?: number;
    measuredAt?: string;
  };
  createdAt: string;
}

export interface ObservabilityRiskPolicy {
  providerCriticalDecision: Extract<ObservabilityRiskDecisionType, 'recommend-block'>;
  providerDegradedDecision: Extract<ObservabilityRiskDecisionType, 'require-review' | 'warn'>;
  runtimeCriticalDecision: Extract<ObservabilityRiskDecisionType, 'require-recovery'>;
  runtimeDegradedDecision: Extract<ObservabilityRiskDecisionType, 'require-review' | 'warn'>;
  strategyDegradedDecision: Extract<ObservabilityRiskDecisionType, 'require-simulation' | 'require-backtest'>;
  latencySpikeDecision: Extract<ObservabilityRiskDecisionType, 'require-review' | 'warn'>;
  telemetryDegradedDecision: Extract<ObservabilityRiskDecisionType, 'require-review' | 'warn'>;
  controlledResumeRequiredAfterCritical: boolean;
}

export interface ObservabilityRiskDecision {
  id: string;
  correlationId: string;
  tenantId: string;
  decision: ObservabilityRiskDecisionType;
  status: 'allowed' | 'warning' | 'proposal' | 'review-required';
  reason: string;
  signal: ObservabilityRiskSignal;
  requiresAcs: boolean;
  requiresGovernance: boolean;
  authorizedExecution: false;
  mutatesRuntime: false;
  mutatesProvider: false;
  mutatesStrategy: false;
  approvalPath: 'ACS -> Trading Core -> Governance/Product/Compliance/Risk -> Runtime/Provider';
  createdAt: string;
}

export type PaperRiskSignalType =
  | 'paper-fill-quality-degraded'
  | 'paper-execution-latency-high'
  | 'paper-slippage-high'
  | 'paper-runtime-degraded'
  | 'paper-provider-degraded'
  | 'paper-strategy-degraded'
  | 'paper-reconciliation-unresolved'
  | 'paper-telemetry-ingestion-degraded';

export type PaperRiskDecisionType =
  | 'allow-continue-paper'
  | 'require-simulation-retry'
  | 'require-backtest'
  | 'recommend-pause'
  | 'require-telemetry-review'
  | 'require-reconciliation-review'
  | 'require-controlled-resume-approval'
  | 'reject-controlled-resume-eligibility';

export interface PaperRiskSignal {
  id: string;
  correlationId: string;
  tenantId: string;
  signalType: PaperRiskSignalType;
  severity: 'info' | 'warning' | 'high' | 'critical';
  providerId?: string;
  runtimeInstanceId?: string;
  strategyId?: string;
  strategyProductId?: string;
  userId?: string;
  daoId?: string;
  evidence: {
    fillCount?: number;
    averageLatencyMs?: number;
    slippageBps?: number;
    healthState?: string;
    unresolvedReconciliationProposals?: number;
    reasons: string[];
  };
  createdAt: string;
}

export interface PaperRiskDecision {
  id: string;
  correlationId: string;
  tenantId: string;
  decision: PaperRiskDecisionType;
  status: 'allowed' | 'review-required' | 'retry-required' | 'rejected';
  reason: string;
  signal?: PaperRiskSignal;
  requiresAcs: boolean;
  requiresRiskReview: boolean;
  authorizedExecution: false;
  controlledResumeEligible: boolean;
  mutatesRuntime: false;
  mutatesProvider: false;
  mutatesStrategy: false;
  createdAt: string;
}

export interface PaperRiskEvaluationInput {
  correlationId: string;
  tenantId: string;
  executionDomain: 'treasury' | 'user';
  userId?: string;
  daoId?: string;
  federationId?: string;
  runtimeInstanceId?: string;
  providerId: string;
  strategyId?: string;
  strategyProductId?: string;
  fills?: Array<{
    price: string;
    quantity: string;
    filledAt: string;
  }>;
  expectedPrice?: string;
  averageLatencyMs?: number;
  runtimeHealth?: {
    state: 'healthy' | 'degraded' | 'critical' | 'suspended' | 'offline' | string;
  };
  providerHealth?: {
    state: 'healthy' | 'degraded' | 'critical' | 'suspended' | 'offline' | string;
  };
  strategyHealth?: {
    state: 'healthy' | 'degraded' | 'critical' | 'suspended' | 'offline' | string;
  };
  telemetryIngestionQuality?: {
    state: 'healthy' | 'degraded' | 'critical' | 'suspended' | 'offline' | string;
  };
  unresolvedReconciliationProposals?: number;
}
