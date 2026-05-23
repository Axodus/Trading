import type { RuntimeOperationalMetrics, RuntimeTelemetrySample } from '../../../../packages/trading-contracts/src/index.js';

export class RuntimeMetricsCollector {
  private readonly metrics = new Map<string, RuntimeOperationalMetrics>();

  record(sample: RuntimeTelemetrySample): RuntimeOperationalMetrics {
    const key = this.key(sample.context.tenantId, sample.context.runtimeInstanceId);
    const current = this.metrics.get(key);
    const updatedAt = sample.measuredAt ?? new Date().toISOString();
    const next: RuntimeOperationalMetrics = {
      tenantId: sample.context.tenantId,
      runtimeInstanceId: sample.context.runtimeInstanceId,
      providerId: sample.context.providerId,
      strategyProductId: sample.context.strategyProductId,
      uptimeMs: sample.uptimeMs ?? current?.uptimeMs ?? 0,
      restartCount: sample.restartCount ?? current?.restartCount ?? 0,
      recoveryCount: sample.recoveryCount ?? current?.recoveryCount ?? 0,
      degradedPeriods: sample.degradedPeriods ?? current?.degradedPeriods ?? 0,
      failedExecutions: sample.failedExecutions ?? current?.failedExecutions ?? 0,
      averageLatencyMs: sample.averageLatencyMs ?? current?.averageLatencyMs ?? 0,
      executionDriftFrequency: sample.executionDriftFrequency ?? current?.executionDriftFrequency ?? 0,
      updatedAt,
    };
    this.metrics.set(key, next);
    return next;
  }

  get(tenantId: string, runtimeInstanceId: string): RuntimeOperationalMetrics | undefined {
    return this.metrics.get(this.key(tenantId, runtimeInstanceId));
  }

  listByTenant(tenantId: string): RuntimeOperationalMetrics[] {
    return [...this.metrics.values()].filter((metric) => metric.tenantId === tenantId);
  }

  private key(tenantId: string, runtimeInstanceId: string): string {
    return `${tenantId}:${runtimeInstanceId}`;
  }
}
