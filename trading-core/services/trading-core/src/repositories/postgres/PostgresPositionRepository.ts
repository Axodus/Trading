import type { PositionSnapshot } from '../../../../../packages/trading-contracts/src/index.js';
import type { PositionRepository } from '../interfaces.js';
import type { PostgresQueryClient } from './PostgresClient.js';
import { stableJson } from './PostgresClient.js';

export class PostgresPositionRepository implements PositionRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async save(snapshot: PositionSnapshot): Promise<void> {
    await this.client.query(`
      insert into trading_positions (
        owner_id,
        provider_id,
        captured_at,
        snapshot
      )
      values ($1, $2, $3, $4::jsonb)
    `, [
      snapshot.providerId,
      snapshot.providerId,
      snapshot.capturedAt,
      stableJson(snapshot),
    ]);
  }

  async getLatest(ownerId: string): Promise<PositionSnapshot | undefined> {
    const result = await this.client.query<{ snapshot: PositionSnapshot | string }>('select * from trading_positions where owner_id = $1 order by captured_at desc limit 1', [ownerId]);
    const row = result.rows[0];
    return row ? (typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) as PositionSnapshot : row.snapshot) : undefined;
  }
}
