import type { OrderRecord, OrderRepository } from '../interfaces.js';
import type { PostgresQueryClient } from './PostgresClient.js';

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async save(order: OrderRecord): Promise<void> {
    await this.client.query(`
      insert into trading_orders (
        provider_order_id,
        request_id,
        provider_id,
        market,
        status,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6)
      on conflict (provider_order_id) do update set
        request_id = excluded.request_id,
        provider_id = excluded.provider_id,
        market = excluded.market,
        status = excluded.status,
        created_at = excluded.created_at
    `, [
      order.providerOrderId,
      order.requestId,
      order.providerId,
      order.market,
      order.status,
      order.createdAt,
    ]);
  }

  async findByProviderOrderId(providerOrderId: string): Promise<OrderRecord | undefined> {
    const result = await this.client.query<OrderRecord | {
      provider_order_id: string;
      request_id: string;
      provider_id: string;
      market: string;
      status: OrderRecord['status'];
      created_at: string;
    }>('select * from trading_orders where provider_order_id = $1', [providerOrderId]);
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    if ('providerOrderId' in row) {
      return row;
    }
    return {
      providerOrderId: row.provider_order_id,
      requestId: row.request_id,
      providerId: row.provider_id,
      market: row.market,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
