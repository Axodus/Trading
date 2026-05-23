import type { ProviderState } from '../../state/StateTypes.js';
import type { ProviderStateRepository } from '../interfaces.js';
import type { PostgresQueryClient } from './PostgresClient.js';
import { stableJson } from './PostgresClient.js';

export class PostgresProviderStateRepository implements ProviderStateRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async save(providerState: ProviderState): Promise<void> {
    await this.client.query(`
      insert into trading_provider_state (
        provider_id,
        status,
        updated_at,
        detail,
        payload
      )
      values ($1, $2, $3, $4, $5::jsonb)
      on conflict (provider_id) do update set
        status = excluded.status,
        updated_at = excluded.updated_at,
        detail = excluded.detail,
        payload = excluded.payload
    `, [
      providerState.providerId,
      providerState.status,
      providerState.updatedAt,
      providerState.detail,
      stableJson(providerState),
    ]);
  }

  async findByProviderId(providerId: string): Promise<ProviderState | undefined> {
    const result = await this.client.query<{ payload: ProviderState | string }>('select * from trading_provider_state where provider_id = $1', [providerId]);
    const row = result.rows[0];
    return row ? (typeof row.payload === 'string' ? JSON.parse(row.payload) as ProviderState : row.payload) : undefined;
  }
}
