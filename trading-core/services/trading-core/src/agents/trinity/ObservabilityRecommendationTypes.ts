import type {
  ObservabilityQueryContext,
  OperationalHealthScore,
  TradingExecutionContext,
  TradingRecommendation,
  TradingRecommendationType,
} from '../../../../../packages/trading-contracts/src/index.js';

export interface ObservabilityEvidence {
  evidenceType: 'runtime-health' | 'provider-health' | 'strategy-health' | 'execution-latency' | 'telemetry-ingestion';
  state?: OperationalHealthScore['state'];
  score?: number;
  reasons?: string[];
  measuredAt?: string;
  runtimeInstanceId?: string;
  providerId?: string;
  strategyKey?: string;
  averageLatencyMs?: number;
}

export function observabilityExecutionContext(context: ObservabilityQueryContext): TradingExecutionContext {
  return {
    executionDomain: context.executionDomain ?? (context.daoId ? 'treasury' : 'user'),
    daoId: context.daoId,
    federationId: context.federationId,
    userId: context.userId,
    strategyProductId: context.strategyProductId,
    runtimeInstanceId: context.runtimeInstanceId,
    providerId: context.providerId ?? 'provider:unknown',
    strategyId: context.strategyId,
  };
}

export function createObservabilityRecommendation(
  context: ObservabilityQueryContext,
  recommendationType: TradingRecommendationType,
  confidence: number,
  rationale: string,
  evidence: ObservabilityEvidence,
  createdAt = new Date().toISOString(),
): TradingRecommendation {
  return {
    id: `trinity-observability-${recommendationType}-${context.correlationId}-${evidence.evidenceType}`,
    correlationId: context.correlationId,
    tenantId: context.tenantId,
    producedByAgent: 'trinity',
    context: observabilityExecutionContext(context),
    recommendationType,
    confidence,
    rationale,
    createdAt,
    requiresAcs: true,
    authorizedExecution: false,
    proposedAction: {
      approvalPath: 'ACS -> Trading Core -> Governance/Product/Compliance/Risk -> Runtime/Provider',
      advisoryOnly: true,
      observabilityEvidence: evidence,
    },
  };
}

export function healthEvidence(
  evidenceType: ObservabilityEvidence['evidenceType'],
  health: OperationalHealthScore,
  extra: Omit<ObservabilityEvidence, 'evidenceType' | 'state' | 'score' | 'reasons' | 'measuredAt'> = {},
): ObservabilityEvidence {
  return {
    evidenceType,
    state: health.state,
    score: health.score,
    reasons: [...health.reasons],
    measuredAt: health.measuredAt,
    ...extra,
  };
}
