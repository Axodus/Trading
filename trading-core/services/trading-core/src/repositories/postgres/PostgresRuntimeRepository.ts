import type { UserRuntimeInstance } from '../../../../../packages/trading-contracts/src/index.js';
import type { RuntimeRepository } from '../interfaces.js';
import type { PostgresQueryClient } from './PostgresClient.js';
import { stableJson } from './PostgresClient.js';

export class PostgresRuntimeRepository implements RuntimeRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async save(runtime: UserRuntimeInstance): Promise<void> {
    await this.client.query(`
      insert into trading_runtime_instances (
        id,
        user_id,
        strategy_product_id,
        provider_id,
        execution_domain,
        status,
        created_at,
        updated_at,
        payload
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      on conflict (id) do update set
        user_id = excluded.user_id,
        strategy_product_id = excluded.strategy_product_id,
        provider_id = excluded.provider_id,
        execution_domain = excluded.execution_domain,
        status = excluded.status,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `, [
      runtime.id,
      runtime.userId,
      runtime.strategyProductId,
      runtime.providerId,
      runtime.executionDomain,
      runtime.status,
      runtime.createdAt,
      runtime.updatedAt,
      stableJson(runtime),
    ]);
  }

  async findById(runtimeInstanceId: string): Promise<UserRuntimeInstance | undefined> {
    const result = await this.client.query<{ payload: UserRuntimeInstance | string }>('select * from trading_runtime_instances where id = $1', [runtimeInstanceId]);
    const row = result.rows[0];
    return row ? (typeof row.payload === 'string' ? JSON.parse(row.payload) as UserRuntimeInstance : row.payload) : undefined;
  }
}
