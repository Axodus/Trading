import type { ExecutionLatencySample, OperationalHealthScore, TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from './TradingEventBus.js';

export class ExecutionLatencyTracker {
  private readonly latencyByTenantRuntime = new Map<string, number[]>();

  constructor(private readonly eventBus?: TradingEventBus) {}

  async record(sample: ExecutionLatencySample): Promise<OperationalHealthScore> {
    const threshold = sample.thresholdMs ?? 1000;
    const key = this.key(sample.context.tenantId, sample.context.runtimeInstanceId ?? 'runtime:none');
    const values = this.latencyByTenantRuntime.get(key) ?? [];
    values.push(sample.latencyMs);
    this.latencyByTenantRuntime.set(key, values);

    const score: OperationalHealthScore = {
      state: sample.latencyMs >= threshold * 2 ? 'critical' : sample.latencyMs >= threshold ? 'degraded' : 'healthy',
      score: sample.latencyMs >= threshold * 2 ? 0.25 : sample.latencyMs >= threshold ? 0.55 : 1,
      reasons: sample.latencyMs >= threshold ? [`execution latency ${sample.latencyMs}ms exceeded ${threshold}ms threshold`] : [],
      measuredAt: sample.measuredAt ?? new Date().toISOString(),
    };

    if (sample.latencyMs >= threshold) {
      await this.eventBus?.publish(this.toLatencyEvent(sample, threshold, score));
    }
    return score;
  }

  averageLatency(tenantId: string, runtimeInstanceId: string): number {
    const values = this.latencyByTenantRuntime.get(this.key(tenantId, runtimeInstanceId)) ?? [];
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private toLatencyEvent(sample: ExecutionLatencySample, threshold: number, score: OperationalHealthScore): TradingEvent {
    return {
      id: `${sample.context.correlationId}:execution-latency-spike:${sample.measuredAt ?? Date.now()}`,
      type: 'EXECUTION_LATENCY_SPIKE',
      occurredAt: score.measuredAt,
      correlationId: sample.context.correlationId,
      source: 'telemetry',
      daoId: sample.context.daoId,
      federationId: sample.context.federationId,
      userId: sample.context.userId,
      strategyId: sample.context.strategyId,
      strategyProductId: sample.context.strategyProductId,
      runtimeInstanceId: sample.context.runtimeInstanceId,
      payload: {
        tenantId: sample.context.tenantId,
        providerId: sample.context.providerId,
        latencyMs: sample.latencyMs,
        thresholdMs: threshold,
        health: score,
      },
    };
  }

  private key(tenantId: string, runtimeInstanceId: string): string {
    return `${tenantId}:${runtimeInstanceId}`;
  }
}
