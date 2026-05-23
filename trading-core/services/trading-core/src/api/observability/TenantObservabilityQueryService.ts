import type {
  OperationalHealthScore,
  OperationalTelemetrySnapshot,
  ObservabilityQueryContext,
  ProviderHealthReadModel,
  RuntimeHealthReadModel,
  StrategyHealthReadModel,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { ExecutionLatencyTracker } from '../../telemetry/ExecutionLatencyTracker.js';
import type { ProviderObservabilityService } from '../../telemetry/ProviderObservabilityService.js';
import type { RuntimeObservabilityService } from '../../telemetry/RuntimeObservabilityService.js';
import type { StrategyTelemetryAggregator } from '../../telemetry/StrategyTelemetryAggregator.js';
import { ObservabilityAccessGuard } from './ObservabilityAccessGuard.js';

export interface TenantObservabilityQueryDependencies {
  runtimes: RuntimeObservabilityService;
  providers: ProviderObservabilityService;
  strategies: StrategyTelemetryAggregator;
  latency?: ExecutionLatencyTracker;
  accessGuard?: ObservabilityAccessGuard;
}

export class TenantObservabilityQueryService {
  private readonly accessGuard: ObservabilityAccessGuard;

  constructor(private readonly deps: TenantObservabilityQueryDependencies) {
    this.accessGuard = deps.accessGuard ?? new ObservabilityAccessGuard();
  }

  runtimeHealth(context: ObservabilityQueryContext): RuntimeHealthReadModel | undefined {
    if (!context.runtimeInstanceId) {
      return undefined;
    }
    this.accessGuard.assertTenantScope(context, context.tenantId);
    const state = this.deps.runtimes.get(context.tenantId, context.runtimeInstanceId);
    if (!state) {
      return undefined;
    }
    this.accessGuard.assertRuntimeScope(context, state.metrics.runtimeInstanceId);
    return {
      tenantId: state.metrics.tenantId,
      runtimeInstanceId: state.metrics.runtimeInstanceId,
      providerId: state.metrics.providerId,
      strategyProductId: state.metrics.strategyProductId,
      health: state.health,
      metrics: state.metrics,
      advisoryOnly: true,
    };
  }

  providerHealth(context: ObservabilityQueryContext): ProviderHealthReadModel | undefined {
    if (!context.providerId) {
      return undefined;
    }
    this.accessGuard.assertTenantScope(context, context.tenantId);
    const health = this.deps.providers.get(context.tenantId, context.providerId);
    return health ? {
      tenantId: context.tenantId,
      providerId: context.providerId,
      health,
      advisoryOnly: true,
    } : undefined;
  }

  strategyHealth(context: ObservabilityQueryContext): StrategyHealthReadModel | undefined {
    const strategyKey = context.strategyProductId ?? context.strategyId;
    if (!strategyKey) {
      return undefined;
    }
    this.accessGuard.assertTenantScope(context, context.tenantId);
    const health = this.deps.strategies.get(context.tenantId, strategyKey);
    return health ? {
      tenantId: context.tenantId,
      strategyKey,
      health,
      advisoryOnly: true,
    } : undefined;
  }

  snapshot(context: ObservabilityQueryContext): OperationalTelemetrySnapshot {
    const runtimeHealth = this.runtimeHealth(context);
    const providerHealth = this.providerHealth(context);
    const strategyHealth = this.strategyHealth(context);
    const healths = [runtimeHealth?.health, providerHealth?.health, strategyHealth?.health].filter(Boolean) as OperationalHealthScore[];
    const runtimeInstanceId = runtimeHealth?.runtimeInstanceId ?? context.runtimeInstanceId;
    const averageLatencyMs = runtimeInstanceId && this.deps.latency
      ? this.deps.latency.averageLatency(context.tenantId, runtimeInstanceId)
      : 0;

    return {
      tenantId: context.tenantId,
      runtimeHealth,
      providerHealth,
      strategyHealth,
      telemetryIngestionQuality: runtimeHealth?.health,
      executionLatency: runtimeInstanceId ? {
        runtimeInstanceId,
        averageLatencyMs,
      } : undefined,
      degraded: healths.some((health) => health.state === 'degraded'),
      critical: healths.some((health) => health.state === 'critical'),
      advisoryOnly: true,
      generatedAt: new Date().toISOString(),
    };
  }
}
