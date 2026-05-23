import type {
  ObservabilityQueryContext,
  OperationalTelemetrySnapshot,
  TradingEvent,
  TradingRecommendation,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';

export class ObservabilityRecommendationAuditService {
  constructor(private readonly eventBus?: TradingEventBus) {}

  async record(
    context: ObservabilityQueryContext,
    snapshot: OperationalTelemetrySnapshot,
    recommendations: TradingRecommendation[],
  ): Promise<TradingRecommendation[]> {
    if (recommendations.length > 0) {
      await this.eventBus?.publish(this.toEvidenceEvent(context, snapshot, recommendations.length));
    }

    for (const recommendation of recommendations) {
      await this.eventBus?.publish(this.toRecommendationEvent(context, recommendation));
    }

    return recommendations;
  }

  private toEvidenceEvent(
    context: ObservabilityQueryContext,
    snapshot: OperationalTelemetrySnapshot,
    recommendationCount: number,
  ): TradingEvent {
    return {
      id: `${context.correlationId}:trinity-observability-evidence:${snapshot.generatedAt}`,
      type: 'TRINITY_OBSERVABILITY_EVIDENCE_RECORDED',
      occurredAt: snapshot.generatedAt,
      correlationId: context.correlationId,
      source: 'agent',
      daoId: context.daoId,
      federationId: context.federationId,
      userId: context.userId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      runtimeInstanceId: context.runtimeInstanceId,
      payload: {
        tenantId: context.tenantId,
        providerId: context.providerId,
        degraded: snapshot.degraded,
        critical: snapshot.critical,
        recommendationCount,
        advisoryOnly: true,
        authorizedExecution: false,
      },
    };
  }

  private toRecommendationEvent(
    context: ObservabilityQueryContext,
    recommendation: TradingRecommendation,
  ): TradingEvent {
    return {
      id: `${recommendation.id}:created`,
      type: 'TRINITY_OBSERVABILITY_RECOMMENDATION_CREATED',
      occurredAt: recommendation.createdAt,
      correlationId: recommendation.correlationId,
      source: 'agent',
      daoId: context.daoId,
      federationId: context.federationId,
      userId: context.userId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      runtimeInstanceId: context.runtimeInstanceId,
      payload: {
        tenantId: recommendation.tenantId,
        providerId: context.providerId,
        recommendationId: recommendation.id,
        recommendationType: recommendation.recommendationType,
        requiresAcs: recommendation.requiresAcs,
        authorizedExecution: recommendation.authorizedExecution,
        proposedAction: recommendation.proposedAction,
      },
    };
  }
}
