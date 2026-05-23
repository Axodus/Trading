import type {
  TradingApiRequest,
  TradingApiResponse,
  TradingEvent,
  TradingTelemetrySnapshot,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventQueryService } from '../state/TradingEventQueryService.js';

export class TradingTelemetryApi {
  constructor(private readonly eventQuery: TradingEventQueryService) {}

  summarize(request: TradingApiRequest): TradingApiResponse<TradingTelemetrySnapshot> {
    const events = this.eventsFor(request);
    const eventCounts: TradingTelemetrySnapshot['eventCounts'] = {};
    for (const event of events) {
      eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
    }

    return {
      ok: true,
      correlationId: request.correlationId,
      data: {
        context: { ...request.context },
        totalEvents: events.length,
        eventCounts,
        latestEventAt: events.at(-1)?.occurredAt,
        recommendationCount: events.filter((event) => event.type === 'TRINITY_RECOMMENDATION_CREATED').length,
        runtimeEventCount: events.filter((event) => event.runtimeInstanceId === request.context.runtimeInstanceId).length,
      },
    };
  }

  private eventsFor(request: TradingApiRequest): TradingEvent[] {
    if (request.context.runtimeInstanceId) {
      return this.eventQuery.byRuntimeInstanceId(request.context.runtimeInstanceId);
    }
    if (request.context.userId) {
      return this.eventQuery.byUserId(request.context.userId);
    }
    if (request.context.daoId) {
      return this.eventQuery.byDaoId(request.context.daoId);
    }
    return this.eventQuery.byCorrelationId(request.correlationId);
  }
}
