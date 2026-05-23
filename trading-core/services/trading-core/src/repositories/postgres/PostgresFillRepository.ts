import type { ExecutionFill } from '../../../../../packages/trading-contracts/src/index.js';
import type { FillRepository } from '../interfaces.js';
import type { PostgresQueryClient } from './PostgresClient.js';
import { stableJson } from './PostgresClient.js';

export class PostgresFillRepository implements FillRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async save(fill: ExecutionFill): Promise<void> {
    await this.client.query(`
      insert into trading_fills (
        fill_id,
        provider_order_id,
        market,
        side,
        quantity,
        price,
        fee,
        filled_at,
        payload
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb)
      on conflict (fill_id) do update set
        provider_order_id = excluded.provider_order_id,
        market = excluded.market,
        side = excluded.side,
        quantity = excluded.quantity,
        price = excluded.price,
        fee = excluded.fee,
        filled_at = excluded.filled_at,
        payload = excluded.payload
    `, [
      fill.fillId,
      fill.providerOrderId,
      fill.market,
      fill.side,
      fill.quantity,
      fill.price,
      stableJson(fill.fee),
      fill.filledAt,
      stableJson(fill),
    ]);
  }

  async listByProviderOrderId(providerOrderId: string): Promise<ExecutionFill[]> {
    const result = await this.client.query<{ payload: ExecutionFill | string }>('select * from trading_fills where provider_order_id = $1 order by filled_at asc, fill_id asc', [providerOrderId]);
    return result.rows.map((row) => typeof row.payload === 'string' ? JSON.parse(row.payload) as ExecutionFill : row.payload);
  }
}
