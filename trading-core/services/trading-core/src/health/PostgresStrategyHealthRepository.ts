import type { StrategyHealthState } from '../../../../packages/trading-contracts/src/index.js';
import type { PostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import { StrategyHealthConcurrencyError } from './StrategyHealthErrors.js';
import type {
  StrategyHealthHead,
  StrategyHealthPolicy,
  StrategyHealthTransitionRecord,
} from './StrategyHealthTypes.js';

interface HealthHeadRow {
  strategy_id: string;
  strategy_revision_id: string;
  health_state: StrategyHealthState;
  health_version: number | string;
  effective_at: string;
  evaluation_policy_revision: string;
  reason_codes: readonly string[] | string;
  evidence_refs: readonly string[] | string;
  previous_health_version?: number | string;
  last_transition_id?: string;
}

interface HealthTransitionRow {
  transition_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  previous_health: StrategyHealthState;
  new_health: StrategyHealthState;
  previous_version: number | string;
  new_version: number | string;
  policy_revision: string;
  reason_codes: readonly string[] | string;
  evidence_refs: readonly string[] | string;
  authorization_refs: readonly string[] | string;
  decision: 'ACCEPTED' | 'REJECTED' | 'CONFLICT';
  idempotency_key: string;
  command_hash: string;
  actor_type: StrategyHealthTransitionRecord['actorType'];
  actor_id: string;
  decided_at: string;
  created_at: string;
}

interface HealthPolicyRow {
  policy_revision: string;
  name: string;
  rules: StrategyHealthPolicy['allowedTransitions'] | string;
  created_at: string;
}

/** Generic domain-event outbox envelope; it carries no execution semantics. */
interface StrategyHealthOutboxEntry {
  outboxId: string;
  aggregateId: string;
  aggregateVersion: number;
  eventType: string;
  correlationId: string;
  payload: unknown;
  createdAt: string;
}

export class PostgresStrategyHealthRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async initializeHead(
    strategyId: string,
    strategyRevisionId: string,
    policyRevision: string,
    effectiveAt: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyHealthHead> {
    await client.query(`
      INSERT INTO strategy_health_heads (
        strategy_id, strategy_revision_id, health_state, health_version, effective_at,
        evaluation_policy_revision, reason_codes, evidence_refs
      ) VALUES ($1, $2, 'UNKNOWN', 0, $3, $4, '[]'::jsonb, '[]'::jsonb)
      ON CONFLICT (strategy_id, strategy_revision_id) DO NOTHING
    `, [strategyId, strategyRevisionId, effectiveAt, policyRevision]);
    const head = await this.getHead(strategyId, strategyRevisionId, client);
    if (!head) throw new Error(`Failed to initialize StrategyHealthHead for ${strategyId}/${strategyRevisionId}`);
    return head;
  }

  async getHead(
    strategyId: string,
    strategyRevisionId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyHealthHead | undefined> {
    const result = await client.query<HealthHeadRow>(
      'SELECT * FROM strategy_health_heads WHERE strategy_id = $1 AND strategy_revision_id = $2',
      [strategyId, strategyRevisionId],
    );
    const row = result.rows[0];
    return row ? this.headFromRow(row) : undefined;
  }

  async updateHeadWithCas(
    head: StrategyHealthHead,
    expectedVersion: number,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyHealthHead> {
    const result = await client.query(`
      UPDATE strategy_health_heads SET
        health_state = $1, health_version = health_version + 1, effective_at = $2,
        evaluation_policy_revision = $3, reason_codes = $4::jsonb, evidence_refs = $5::jsonb,
        previous_health_version = $6, last_transition_id = $7
      WHERE strategy_id = $8 AND strategy_revision_id = $9 AND health_version = $10
    `, [
      head.healthState, head.effectiveAt, head.evaluationPolicyRevision,
      stableJson(head.reasonCodes), stableJson(head.evidenceRefs),
      expectedVersion, head.lastTransitionId ?? null, head.strategyId, head.strategyRevisionId, expectedVersion,
    ]);
    if (result.rowCount === 0 || (result.rowCount === undefined && result.rows.length === 0)) {
      throw new StrategyHealthConcurrencyError(
        `StrategyHealth ${head.strategyId}/${head.strategyRevisionId} changed since version ${expectedVersion}.`,
      );
    }
    return { ...head, healthVersion: expectedVersion + 1, previousHealthVersion: expectedVersion };
  }

  async recordTransition(
    record: StrategyHealthTransitionRecord,
    client: PostgresQueryClient = this.client,
  ): Promise<void> {
    await client.query(`
      INSERT INTO strategy_health_transitions (
        transition_id, strategy_id, strategy_revision_id, previous_health, new_health,
        previous_version, new_version, policy_revision, reason_codes, evidence_refs,
        authorization_refs, decision, idempotency_key, command_hash, actor_type, actor_id,
        decided_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb,
        $12, $13, $14, $15, $16, $17, $18)
    `, [
      record.transitionId, record.strategyId, record.strategyRevisionId,
      record.previousHealth, record.newHealth, record.previousVersion, record.newVersion,
      record.policyRevision, stableJson(record.reasonCodes), stableJson(record.evidenceRefs),
      stableJson(record.authorizationRefs), record.decision, record.idempotencyKey,
      record.commandHash, record.actorType, record.actorId, record.decidedAt, record.createdAt,
    ]);
  }

  async listTransitions(
    strategyId: string,
    strategyRevisionId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyHealthTransitionRecord[]> {
    const result = await client.query<HealthTransitionRow>(`
      SELECT * FROM strategy_health_transitions
      WHERE strategy_id = $1 AND strategy_revision_id = $2
      ORDER BY new_version ASC, created_at ASC
    `, [strategyId, strategyRevisionId]);
    return result.rows.map((row) => this.transitionFromRow(row));
  }

  async findTransitionByIdempotencyKey(
    strategyId: string,
    strategyRevisionId: string,
    idempotencyKey: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyHealthTransitionRecord | undefined> {
    const result = await client.query<HealthTransitionRow>(
      'SELECT * FROM strategy_health_transitions WHERE strategy_id = $1 AND strategy_revision_id = $2 AND idempotency_key = $3',
      [strategyId, strategyRevisionId, idempotencyKey],
    );
    const row = result.rows[0];
    return row ? this.transitionFromRow(row) : undefined;
  }

  async savePolicy(policy: StrategyHealthPolicy, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(`
      INSERT INTO strategy_health_policies (policy_revision, name, rules, created_at)
      VALUES ($1, $2, $3::jsonb, $4)
      ON CONFLICT (policy_revision) DO UPDATE SET name = EXCLUDED.name, rules = EXCLUDED.rules
    `, [policy.policyRevision, policy.name, stableJson(policy.allowedTransitions), policy.createdAt]);
  }

  async getPolicy(policyRevision: string, client: PostgresQueryClient = this.client): Promise<StrategyHealthPolicy | undefined> {
    const result = await client.query<HealthPolicyRow>(
      'SELECT * FROM strategy_health_policies WHERE policy_revision = $1',
      [policyRevision],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      policyRevision: row.policy_revision,
      name: row.name,
      allowedTransitions: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
      createdAt: row.created_at,
    };
  }

  async appendOutbox(entry: StrategyHealthOutboxEntry, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(`
      INSERT INTO trading_execution_outbox (
        outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `, [
      entry.outboxId, entry.aggregateId, entry.aggregateVersion, entry.eventType,
      entry.correlationId, stableJson(entry.payload), entry.createdAt,
    ]);
  }

  private headFromRow(row: HealthHeadRow): StrategyHealthHead {
    const reasons = typeof row.reason_codes === 'string' ? JSON.parse(row.reason_codes) : row.reason_codes;
    const evidenceRefs = typeof row.evidence_refs === 'string' ? JSON.parse(row.evidence_refs) : row.evidence_refs;
    return {
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      state: row.health_state,
      healthState: row.health_state,
      healthVersion: Number(row.health_version),
      observedAt: row.effective_at,
      effectiveAt: row.effective_at,
      evaluationPolicyRevision: row.evaluation_policy_revision,
      reasonCodes: reasons ?? [],
      evidenceRefs: evidenceRefs ?? [],
      expectedEvidenceRefs: [],
      observedEvidenceRefs: evidenceRefs ?? [],
      divergenceRefs: [],
      rationale: (reasons ?? []).join(', ') || 'Canonical strategy health state',
      ...(row.previous_health_version !== undefined ? { previousHealthVersion: Number(row.previous_health_version) } : {}),
      ...(row.last_transition_id ? { lastTransitionId: row.last_transition_id } : {}),
    };
  }

  private transitionFromRow(row: HealthTransitionRow): StrategyHealthTransitionRecord {
    const parse = (value: readonly string[] | string): readonly string[] => typeof value === 'string' ? JSON.parse(value) : value;
    return {
      transitionId: row.transition_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      previousHealth: row.previous_health,
      newHealth: row.new_health,
      previousVersion: Number(row.previous_version),
      newVersion: Number(row.new_version),
      policyRevision: row.policy_revision,
      reasonCodes: parse(row.reason_codes),
      evidenceRefs: parse(row.evidence_refs),
      authorizationRefs: parse(row.authorization_refs),
      decision: row.decision,
      idempotencyKey: row.idempotency_key,
      commandHash: row.command_hash,
      actorType: row.actor_type,
      actorId: row.actor_id,
      decidedAt: row.decided_at,
      createdAt: row.created_at,
    };
  }
}
