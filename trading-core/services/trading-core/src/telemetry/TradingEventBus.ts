import type { TradingEvent, TradingEventType } from '../../../../packages/trading-contracts/src/index.js';

export interface EventBusRepository {
  append(event: TradingEvent): void;
  list(): TradingEvent[];
}

export type TradingEventSubscriber = (event: TradingEvent) => void | Promise<void>;

export interface TradingEventDispatchError {
  event: TradingEvent;
  error: unknown;
}

export class InMemoryEventBusRepository implements EventBusRepository {
  private readonly events: TradingEvent[] = [];

  append(event: TradingEvent): void {
    this.events.push(event);
  }

  list(): TradingEvent[] {
    return [...this.events];
  }
}

export class TradingEventBus {
  private readonly subscribers: TradingEventSubscriber[] = [];
  private readonly dispatchErrors: TradingEventDispatchError[] = [];

  constructor(private readonly repository: EventBusRepository = new InMemoryEventBusRepository()) {}

  subscribe(subscriber: TradingEventSubscriber): () => void {
    this.subscribers.push(subscriber);
    return () => {
      const index = this.subscribers.indexOf(subscriber);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async publish<TType extends TradingEventType, TPayload>(event: TradingEvent<TType, TPayload>): Promise<void> {
    this.repository.append(event);
    for (const subscriber of [...this.subscribers]) {
      try {
        await subscriber(event);
      } catch (error) {
        this.dispatchErrors.push({ event, error });
      }
    }
  }

  getByCorrelationId(correlationId: string): TradingEvent[] {
    return this.repository.list().filter((event) => event.correlationId === correlationId);
  }

  list(): TradingEvent[] {
    return this.repository.list();
  }

  getDispatchErrors(): TradingEventDispatchError[] {
    return [...this.dispatchErrors];
  }
}
