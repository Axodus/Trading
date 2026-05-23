import type { OperationalHealthScore, ProviderTelemetrySample, TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import { OperationalHealthScoringService } from './OperationalHealthScoringService.js';
import type { TradingEventBus } from './TradingEventBus.js';

export class ProviderObservabilityService {
  private readonly states = new Map<string, OperationalHealthScore>();

  constructor(
    private readonly eventBus?: TradingEventBus,
    private readonly scoring = new OperationalHealthScoringService(),
  ) {}

  async record(sample: ProviderTelemetrySample): Promise<OperationalHealthScore> {
    const health = this.scoring.scoreProvider(sample);
    this.states.set(this.key(sample.context.tenantId, sample.context.providerId), health);
    if (health.state === 'critical') {
      await this.eventBus?.publish(this.toCriticalEvent(sample, health));
    }
    return health;
  }

  get(tenantId: string, providerId: string): OperationalHealthScore | undefined {
    return this.states.get(this.key(tenantId, providerId));
  }

  private toCriticalEvent(sample: ProviderTelemetrySample, health: OperationalHealthScore): TradingEvent {
    return {
      id: `${sample.context.correlationId}:provider-health-critical:${health.measuredAt}`,
      type: 'PROVIDER_HEALTH_CRITICAL',
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

  private key(tenantId: string, providerId: string): string {
    return `${tenantId}:${providerId}`;
  }
}
