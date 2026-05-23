import type { OperationalHealthScore, StrategyTelemetrySample, TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import { OperationalHealthScoringService } from './OperationalHealthScoringService.js';
import type { TradingEventBus } from './TradingEventBus.js';

export class StrategyTelemetryAggregator {
  private readonly states = new Map<string, OperationalHealthScore>();

  constructor(
    private readonly eventBus?: TradingEventBus,
    private readonly scoring = new OperationalHealthScoringService(),
  ) {}

  async record(sample: StrategyTelemetrySample): Promise<OperationalHealthScore> {
    const health = this.scoring.scoreStrategy(sample);
    this.states.set(this.key(sample.context.tenantId, sample.context.strategyProductId ?? sample.context.strategyId ?? 'strategy:none'), health);
    if (health.state === 'degraded' || health.state === 'critical') {
      await this.eventBus?.publish(this.toStrategyEvent(sample, health));
    }
    return health;
  }

  get(tenantId: string, strategyKey: string): OperationalHealthScore | undefined {
    return this.states.get(this.key(tenantId, strategyKey));
  }

  private toStrategyEvent(sample: StrategyTelemetrySample, health: OperationalHealthScore): TradingEvent {
    return {
      id: `${sample.context.correlationId}:strategy-health-degraded:${health.measuredAt}`,
      type: 'STRATEGY_HEALTH_DEGRADED',
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

  private key(tenantId: string, strategyKey: string): string {
    return `${tenantId}:${strategyKey}`;
  }
}
