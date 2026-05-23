import type { TradingEvent, TradingEventType } from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventRepository } from '../interfaces.js';
import type { EventBusRepository } from '../../telemetry/TradingEventBus.js';
import { eventProviderId } from '../../state/InMemoryTradingEventRepository.js';
import type { PostgresQueryClient } from './PostgresClient.js';
import { stableJson } from './PostgresClient.js';

interface TradingEventRow {
  id: string;
  type: TradingEventType;
  occurred_at: string;
  correlation_id: string;
  source: TradingEvent['source'];
  dao_id?: string;
  federation_id?: string;
  user_id?: string;
  strategy_id?: string;
  strategy_product_id?: string;
  runtime_instance_id?: string;
  provider_id?: string;
  tenant_id?: string;
  payload: unknown;
}

export class PostgresTradingEventRepository implements TradingEventRepository, EventBusRepository {
  private readonly cache: TradingEvent[] = [];

  constructor(private readonly client: PostgresQueryClient) {}

  async append(event: TradingEvent): Promise<void> {
    const providerId = eventProviderId(event);
    await this.client.query(`
      insert into trading_events (
        id,
        type,
        occurred_at,
        correlation_id,
        source,
        dao_id,
        federation_id,
        user_id,
        strategy_id,
        strategy_product_id,
        runtime_instance_id,
        provider_id,
        tenant_id,
        payload
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
    `, [
      event.id,
      event.type,
      event.occurredAt,
      event.correlationId,
      event.source,
      event.daoId,
      event.federationId,
      event.userId,
      event.strategyId,
      event.strategyProductId,
      event.runtimeInstanceId,
      providerId,
      this.tenantId(event),
      stableJson(event.payload),
    ]);
    this.cache.push({ ...event, payload: JSON.parse(stableJson(event.payload)) });
  }

  list(): TradingEvent[] {
    return this.ordered([...this.cache]);
  }

  async listByCorrelationId(correlationId: string): Promise<TradingEvent[]> {
    return this.queryByColumn('correlation_id', correlationId);
  }

  async replayByCorrelationId(correlationId: string): Promise<TradingEvent[]> {
    return this.listByCorrelationId(correlationId);
  }

  async replayByRuntimeInstanceId(runtimeInstanceId: string): Promise<TradingEvent[]> {
    return this.queryByColumn('runtime_instance_id', runtimeInstanceId);
  }

  async replayByStrategyProductId(strategyProductId: string): Promise<TradingEvent[]> {
    return this.queryByColumn('strategy_product_id', strategyProductId);
  }

  async replayByProviderId(providerId: string): Promise<TradingEvent[]> {
    return this.queryByColumn('provider_id', providerId);
  }

  async replayByTenantId(tenantId: string): Promise<TradingEvent[]> {
    const result = await this.client.query<TradingEventRow>('select * from trading_events where tenant_id = $1 order by occurred_at asc, id asc', [tenantId]);
    return this.ordered(result.rows.map((row) => this.fromRow(row)));
  }

  async queryByType(type: TradingEventType): Promise<TradingEvent[]> {
    return this.queryByColumn('type', type);
  }

  private async queryByColumn(column: string, value: string): Promise<TradingEvent[]> {
    const result = await this.client.query<TradingEventRow>(`select * from trading_events where ${column} = $1 order by occurred_at asc, id asc`, [value]);
    return this.ordered(result.rows.map((row) => this.fromRow(row)));
  }

  private fromRow(row: TradingEventRow): TradingEvent {
    return {
      id: row.id,
      type: row.type,
      occurredAt: row.occurred_at,
      correlationId: row.correlation_id,
      source: row.source,
      daoId: row.dao_id,
      federationId: row.federation_id,
      userId: row.user_id,
      strategyId: row.strategy_id,
      strategyProductId: row.strategy_product_id,
      runtimeInstanceId: row.runtime_instance_id,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    };
  }

  private ordered(events: TradingEvent[]): TradingEvent[] {
    return events.sort((left, right) => {
      const timeOrder = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
      return timeOrder || left.id.localeCompare(right.id);
    });
  }

  private tenantId(event: TradingEvent): string | undefined {
    if (event.daoId) {
      return event.daoId;
    }
    const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {};
    const tenantId = payload.tenantId;
    return typeof tenantId === 'string' ? tenantId : event.userId;
  }
}
