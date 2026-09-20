import type { TransactionalPostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import { lifecycleHealthCompatibility } from './StrategyHealthPolicy.js';
import type { StrategyOperationalSnapshot } from './StrategyHealthTypes.js';

interface OperationalSnapshotRow {
  strategy_id: string;
  strategy_revision_id: string;
  lifecycle_state: import('../../../../packages/trading-contracts/src/index.js').StrategyLifecycleState;
  lifecycle_version: number | string;
  lifecycle_updated_at: string;
  health_state: import('../../../../packages/trading-contracts/src/index.js').StrategyHealthState;
  health_version: number | string;
  health_effective_at: string;
}

export class StrategyOperationalSnapshotService {
  constructor(private readonly client: TransactionalPostgresQueryClient) {}

  async issue(args: {
    strategyId: string;
    strategyRevisionId: string;
    evaluationTime: string;
    ttlMs: number;
  }): Promise<StrategyOperationalSnapshot> {
    if (!Number.isFinite(Date.parse(args.evaluationTime)) || !Number.isInteger(args.ttlMs) || args.ttlMs <= 0) {
      throw new Error('Snapshot evaluationTime and positive ttlMs are required.');
    }

    return this.client.transaction(async (transaction) => {
      const result = await transaction.query<OperationalSnapshotRow>(`
        SELECT
          lifecycle.strategy_id,
          lifecycle.current_revision_id AS strategy_revision_id,
          lifecycle.current_state AS lifecycle_state,
          lifecycle.lifecycle_version,
          lifecycle.updated_at AS lifecycle_updated_at,
          health.health_state,
          health.health_version,
          health.effective_at AS health_effective_at
        FROM strategy_lifecycle_heads lifecycle
        INNER JOIN strategy_health_heads health
          ON health.strategy_id = lifecycle.strategy_id
          AND health.strategy_revision_id = lifecycle.current_revision_id
        WHERE lifecycle.strategy_id = $1 AND lifecycle.current_revision_id = $2
      `, [args.strategyId, args.strategyRevisionId]);

      const row = result.rows[0];
      if (!row) {
        throw new Error(`No coherent lifecycle/health state exists for ${args.strategyId}/${args.strategyRevisionId}.`);
      }

      const lifecycleVersion = Number(row.lifecycle_version);
      const healthVersion = Number(row.health_version);
      const snapshotVersion = stableHash({
        strategyId: row.strategy_id,
        strategyRevisionId: row.strategy_revision_id,
        lifecycleVersion,
        healthVersion,
      });
      const snapshot: StrategyOperationalSnapshot = {
        snapshotId: `ops-${snapshotVersion}`,
        strategyId: row.strategy_id,
        strategyRevisionId: row.strategy_revision_id,
        lifecycleState: row.lifecycle_state,
        lifecycleVersion,
        healthState: row.health_state,
        healthVersion,
        compatibility: lifecycleHealthCompatibility(row.lifecycle_state, row.health_state),
        effectiveAt: maxIso(row.lifecycle_updated_at, row.health_effective_at),
        expiresAt: new Date(Date.parse(args.evaluationTime) + args.ttlMs).toISOString(),
        snapshotVersion,
      };

      await transaction.query(`
        INSERT INTO strategy_operational_snapshots (
          snapshot_id, strategy_id, strategy_revision_id, lifecycle_state, lifecycle_version,
          health_state, health_version, compatibility, effective_at, expires_at, snapshot_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (snapshot_id) DO NOTHING
      `, [
        snapshot.snapshotId, snapshot.strategyId, snapshot.strategyRevisionId,
        snapshot.lifecycleState, snapshot.lifecycleVersion, snapshot.healthState,
        snapshot.healthVersion, snapshot.compatibility, snapshot.effectiveAt,
        snapshot.expiresAt, snapshot.snapshotVersion,
      ]);
      return snapshot;
    });
  }

  static validateFresh(snapshot: StrategyOperationalSnapshot, evaluationTime: string): void {
    if (!Number.isFinite(Date.parse(evaluationTime))) throw new Error('Valid evaluationTime is required.');
    if (Date.parse(evaluationTime) >= Date.parse(snapshot.expiresAt)) {
      throw new Error(`Operational snapshot ${snapshot.snapshotId} is expired.`);
    }
    if (snapshot.compatibility === 'REJECTED') {
      throw new Error(`Operational snapshot ${snapshot.snapshotId} is not operationally compatible.`);
    }
  }

  static riskDecisionIsCurrent(
    decision: { strategyRevisionId: string; hardLimitEvaluation: Readonly<Record<string, unknown>>; expiresAt: string },
    snapshot: StrategyOperationalSnapshot,
    evaluationTime: string,
  ): boolean {
    if (Date.parse(evaluationTime) >= Date.parse(decision.expiresAt)) return false;
    const binding = decision.hardLimitEvaluation.operationalSnapshot;
    if (!binding || typeof binding !== 'object') return false;
    const value = binding as Record<string, unknown>;
    return decision.strategyRevisionId === snapshot.strategyRevisionId
      && value.snapshotId === snapshot.snapshotId
      && value.snapshotVersion === snapshot.snapshotVersion
      && value.lifecycleVersion === snapshot.lifecycleVersion
      && value.healthVersion === snapshot.healthVersion;
  }
}

function maxIso(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function stableHash(value: unknown): string {
  const canonical = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}
