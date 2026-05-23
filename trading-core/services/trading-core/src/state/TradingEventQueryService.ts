import type { TradingEvent, TradingEventType } from '../../../../packages/trading-contracts/src/index.js';
import { eventProviderId, InMemoryTradingEventRepository } from './InMemoryTradingEventRepository.js';

export interface TradingEventQuerySource {
  list(): TradingEvent[];
}

export class TradingEventQueryService {
  constructor(private readonly source: TradingEventQuerySource = new InMemoryTradingEventRepository()) {}

  byCorrelationId(correlationId: string): TradingEvent[] {
    return this.ordered(this.source.list().filter((event) => event.correlationId === correlationId));
  }

  byUserId(userId: string): TradingEvent[] {
    return this.ordered(this.source.list().filter((event) => event.userId === userId));
  }

  byDaoId(daoId: string): TradingEvent[] {
    return this.ordered(this.source.list().filter((event) => event.daoId === daoId));
  }

  byRuntimeInstanceId(runtimeInstanceId: string): TradingEvent[] {
    return this.ordered(this.source.list().filter((event) => event.runtimeInstanceId === runtimeInstanceId));
  }

  byStrategyProductId(strategyProductId: string): TradingEvent[] {
    return this.ordered(this.source.list().filter((event) => event.strategyProductId === strategyProductId));
  }

  byProviderId(providerId: string): TradingEvent[] {
    return this.ordered(this.source.list().filter((event) => eventProviderId(event) === providerId));
  }

  byType(type: TradingEventType): TradingEvent[] {
    return this.ordered(this.source.list().filter((event) => event.type === type));
  }

  private ordered(events: TradingEvent[]): TradingEvent[] {
    return [...events].sort((left, right) => {
      const timeOrder = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
      if (timeOrder !== 0) {
        return timeOrder;
      }
      return left.id.localeCompare(right.id);
    });
  }
}
