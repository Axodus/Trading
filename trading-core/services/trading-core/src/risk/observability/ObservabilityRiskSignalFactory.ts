import type {
  ObservabilityQueryContext,
  ObservabilityRiskSignal,
  ObservabilityRiskSignalType,
  OperationalHealthScore,
} from '../../../../../packages/trading-contracts/src/index.js';

export function createObservabilityRiskSignal(
  context: ObservabilityQueryContext,
  signalType: ObservabilityRiskSignalType,
  source: ObservabilityRiskSignal['source'],
  health: OperationalHealthScore,
  extra: Partial<Pick<ObservabilityRiskSignal, 'providerId' | 'runtimeInstanceId' | 'strategyId' | 'strategyProductId'>> & {
    averageLatencyMs?: number;
  } = {},
): ObservabilityRiskSignal {
  const createdAt = new Date().toISOString();
  return {
    id: `observability-risk-signal:${signalType}:${context.correlationId}:${source}`,
    correlationId: context.correlationId,
    tenantId: context.tenantId,
    signalType,
    severity: severityFor(health.state),
    source,
    providerId: extra.providerId ?? context.providerId,
    runtimeInstanceId: extra.runtimeInstanceId ?? context.runtimeInstanceId,
    strategyId: extra.strategyId ?? context.strategyId,
    strategyProductId: extra.strategyProductId ?? context.strategyProductId,
    userId: context.userId,
    daoId: context.daoId,
    evidence: {
      state: health.state,
      score: health.score,
      reasons: [...health.reasons],
      averageLatencyMs: extra.averageLatencyMs,
      measuredAt: health.measuredAt,
    },
    createdAt,
  };
}

export function createLatencyRiskSignal(
  context: ObservabilityQueryContext,
  averageLatencyMs: number,
): ObservabilityRiskSignal {
  const createdAt = new Date().toISOString();
  return {
    id: `observability-risk-signal:execution-latency-spike:${context.correlationId}:execution-latency`,
    correlationId: context.correlationId,
    tenantId: context.tenantId,
    signalType: 'execution-latency-spike',
    severity: averageLatencyMs >= 2000 ? 'critical' : 'high',
    source: 'execution-latency',
    providerId: context.providerId,
    runtimeInstanceId: context.runtimeInstanceId,
    strategyId: context.strategyId,
    strategyProductId: context.strategyProductId,
    userId: context.userId,
    daoId: context.daoId,
    evidence: {
      averageLatencyMs,
      reasons: [`average execution latency ${averageLatencyMs}ms exceeded operational threshold`],
      measuredAt: createdAt,
    },
    createdAt,
  };
}

function severityFor(state: OperationalHealthScore['state']): ObservabilityRiskSignal['severity'] {
  if (state === 'critical') {
    return 'critical';
  }
  if (state === 'degraded') {
    return 'high';
  }
  if (state === 'suspended') {
    return 'critical';
  }
  return 'info';
}
