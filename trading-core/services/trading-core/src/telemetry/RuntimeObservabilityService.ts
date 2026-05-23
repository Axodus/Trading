import type {
  OperationalHealthScore,
  RuntimeOperationalMetrics,
  RuntimeTelemetrySample,
  TradingEvent,
} from '../../../../packages/trading-contracts/src/index.js';
import { OperationalHealthScoringService } from './OperationalHealthScoringService.js';
import { RuntimeMetricsCollector } from './RuntimeMetricsCollector.js';
import type { TradingEventBus } from './TradingEventBus.js';

export interface RuntimeObservabilityState {
  health: OperationalHealthScore;
  metrics: RuntimeOperationalMetrics;
}

export class RuntimeObservabilityService {
  private readonly states = new Map<string, RuntimeObservabilityState>();

  constructor(
    private readonly eventBus?: TradingEventBus,
    private readonly metrics = new RuntimeMetricsCollector(),
    private readonly scoring = new OperationalHealthScoringService(),
  ) {}

  async record(sample: RuntimeTelemetrySample): Promise<RuntimeObservabilityState> {
    const metrics = this.metrics.record(sample);
    const health = this.scoring.scoreRuntime(sample);
    const state = { health, metrics };
    this.states.set(this.key(sample.context.tenantId, sample.context.runtimeInstanceId), state);

    if (health.state === 'degraded' || health.state === 'critical') {
      await this.eventBus?.publish(this.toRuntimeHealthEvent(sample, health));
    }
    return state;
  }

  get(tenantId: string, runtimeInstanceId: string): RuntimeObservabilityState | undefined {
    return this.states.get(this.key(tenantId, runtimeInstanceId));
  }

  listByTenant(tenantId: string): RuntimeObservabilityState[] {
    return [...this.states.entries()]
      .filter(([key]) => key.startsWith(`${tenantId}:`))
      .map(([, state]) => state);
  }

  private toRuntimeHealthEvent(sample: RuntimeTelemetrySample, health: OperationalHealthScore): TradingEvent {
    return {
      id: `${sample.context.correlationId}:runtime-health:${health.state}:${health.measuredAt}`,
      type: health.state === 'critical' ? 'RUNTIME_HEALTH_CRITICAL' : 'RUNTIME_HEALTH_DEGRADED',
      occurredAt: health.measuredAt,
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
        health,
      },
    };
  }

  private key(tenantId: string, runtimeInstanceId: string): string {
    return `${tenantId}:${runtimeInstanceId}`;
  }
}
