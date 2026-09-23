import type { PostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import {
  type DurableTradingSafetyStateV1,
  ProtectionRepositoryUnavailableError,
} from './DurablePositionProtectionContracts.js';

export interface TradingSafetyStateRow {
  environment: string;
  autonomous_entry_kill_active: boolean;
  reason: string | null;
  generation: string | number;
  activated_at: string | null;
  activated_by: string | null;
  updated_at: string;
}

export class PostgresTradingSafetyStateRepository {
  constructor(
    private readonly client: PostgresQueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /**
   * Retrieve the durable safety state for an environment.
   * If no row exists, returns a default non-killed state with generation 0.
   */
  async getSafetyState(
    environment: string,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurableTradingSafetyStateV1> {
    try {
      const res = await queryClient.query<TradingSafetyStateRow>(
        `SELECT * FROM trading_safety_state WHERE environment = $1`,
        [environment],
      );

      if (res.rows.length === 0) {
        return {
          environment,
          autonomousEntryKillActive: false,
          generation: 0,
          updatedAt: this.now(),
        };
      }

      const row = res.rows[0];
      return {
        environment: row.environment,
        autonomousEntryKillActive: Boolean(row.autonomous_entry_kill_active),
        reason: row.reason ?? undefined,
        generation: Number(row.generation),
        activatedAt: row.activated_at ?? undefined,
        activatedBy: row.activated_by ?? undefined,
        updatedAt: row.updated_at,
      };
    } catch (err: unknown) {
      throw new ProtectionRepositoryUnavailableError(
        `Failed to retrieve safety state for ${environment}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Activate durable kill state. Monotonically increments generation.
   * Survives restart, blocks autonomous risk admission.
   */
  async activateKillState(
    params: {
      environment: string;
      reason: string;
      activatedBy: string;
    },
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurableTradingSafetyStateV1> {
    const nowIso = this.now();
    try {
      const existing = await this.getSafetyState(params.environment, queryClient);
      const nextGen = existing.generation + 1;

      await queryClient.query(
        `INSERT INTO trading_safety_state (
          environment, autonomous_entry_kill_active, reason, generation,
          activated_at, activated_by, updated_at
        ) VALUES ($1, TRUE, $2, $3, $4, $5, $4)
        ON CONFLICT (environment) DO UPDATE SET
          autonomous_entry_kill_active = TRUE,
          reason = EXCLUDED.reason,
          generation = trading_safety_state.generation + 1,
          activated_at = EXCLUDED.activated_at,
          activated_by = EXCLUDED.activated_by,
          updated_at = EXCLUDED.updated_at`,
        [
          params.environment,
          params.reason,
          nextGen,
          nowIso,
          params.activatedBy,
        ],
      );

      return this.getSafetyState(params.environment, queryClient);
    } catch (err: unknown) {
      throw new ProtectionRepositoryUnavailableError(
        `Failed to activate durable kill state: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Explicitly reset durable kill state with authorized transition.
   * Increments generation.
   */
  async resetKillState(
    params: {
      environment: string;
      resetBy: string;
      reason?: string;
    },
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurableTradingSafetyStateV1> {
    const nowIso = this.now();
    try {
      const existing = await this.getSafetyState(params.environment, queryClient);
      const nextGen = existing.generation + 1;

      await queryClient.query(
        `INSERT INTO trading_safety_state (
          environment, autonomous_entry_kill_active, reason, generation,
          activated_at, activated_by, updated_at
        ) VALUES ($1, FALSE, NULL, $2, NULL, NULL, $3)
        ON CONFLICT (environment) DO UPDATE SET
          autonomous_entry_kill_active = FALSE,
          reason = NULL,
          generation = trading_safety_state.generation + 1,
          activated_at = NULL,
          activated_by = NULL,
          updated_at = EXCLUDED.updated_at`,
        [params.environment, nextGen, nowIso],
      );

      return this.getSafetyState(params.environment, queryClient);
    } catch (err: unknown) {
      throw new ProtectionRepositoryUnavailableError(
        `Failed to reset durable kill state: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
