import type { TradingEvent, TradingEventType } from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventRepository } from '../repositories/interfaces.js';
import type { EventBusRepository } from '../telemetry/TradingEventBus.js';
import { readString, toRecord } from './StateContext.js';

export class InMemoryTradingEventRepository implements TradingEventRepository, EventBusRepository {
  private readonly events: TradingEvent[] = [];

  append(event: TradingEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  list(): TradingEvent[] {
    return [...this.events];
  }

  async listByCorrelationId(correlationId: string): Promise<TradingEvent[]> {
    return this.queryByCorrelationId(correlationId);
  }

  queryByCorrelationId(correlationId: string): TradingEvent[] {
    return this.events.filter((event) => event.correlationId === correlationId);
  }

  queryByUserId(userId: string): TradingEvent[] {
    return this.events.filter((event) => event.userId === userId);
  }

  queryByDaoId(daoId: string): TradingEvent[] {
    return this.events.filter((event) => event.daoId === daoId);
  }

  queryByRuntimeInstanceId(runtimeInstanceId: string): TradingEvent[] {
    return this.events.filter((event) => event.runtimeInstanceId === runtimeInstanceId);
  }

  queryByStrategyProductId(strategyProductId: string): TradingEvent[] {
    return this.events.filter((event) => event.strategyProductId === strategyProductId);
  }

  queryByProviderId(providerId: string): TradingEvent[] {
    return this.events.filter((event) => eventProviderId(event) === providerId);
  }

  queryByType(type: TradingEventType): TradingEvent[] {
    return this.events.filter((event) => event.type === type);
  }
}

export function eventProviderId(event: TradingEvent): string | undefined {
  const payload = toRecord(event.payload);
  const provider = toRecord(payload.provider);
  const result = toRecord(payload.result);
  return readString(payload.providerId) ?? readString(provider.providerId) ?? readString(result.providerId);
}
