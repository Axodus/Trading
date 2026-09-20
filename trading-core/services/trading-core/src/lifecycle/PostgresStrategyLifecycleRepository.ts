import type {
  StrategyLifecycleHead,
  StrategyLifecyclePolicy,
  StrategyLifecycleTransitionRecord,
  StrategyLifecycleState,
  AuthorizationRef,
  StrategyLifecycleReasonCode,
  StrategyLifecycleDecision,
} from '../../../../packages/trading-contracts/src/strategy/lifecycle.js';
import type { PostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import { StrategyLifecycleConcurrencyError } from './StrategyLifecycleErrors.js';
import type { ExecutionOutboxEntry } from '../repositories/postgres/PostgresDurableExecutionRepository.js';

interface LifecycleHeadRow {
  strategy_id: string;
  current_revision_id: string;
  current_state: StrategyLifecycleState;
  lifecycle_version: number | string;
  updated_at: string;
  last_transition_id?: string;
}

interface LifecycleTransitionRow {
  transition_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  from_state: StrategyLifecycleState;
  to_state: StrategyLifecycleState;
  previous_version: number | string;
  new_version: number | string;
  policy_revision: string;
  eligibility_ref?: string;
  authorization_refs: AuthorizationRef[] | string;
  decision: StrategyLifecycleDecision;
  reason_codes: StrategyLifecycleReasonCode[] | string;
  idempotency_key: string;
  command_hash: string;
  rationale?: string;
  requested_at: string;
  decided_at: string;
  created_at: string;
}

interface LifecyclePolicyRow {
  policy_revision: string;
  name: string;
  description?: string;
  rules: string | unknown;
  default_max_eligibility_age_ms?: number | string;
  created_at: string;
}

export class PostgresStrategyLifecycleRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async getHead(strategyId: string, client: PostgresQueryClient = this.client): Promise<StrategyLifecycleHead | undefined> {
    const result = await client.query<LifecycleHeadRow>(
      'SELECT * FROM strategy_lifecycle_heads WHERE strategy_id = $1',
      [strategyId],
    );
    const row = result.rows[0];
    return row ? this.headFromRow(row) : undefined;
  }

  async initializeHead(
    strategyId: string,
    revisionId: string,
    initialState: StrategyLifecycleState = 'IDEA',
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyLifecycleHead> {
    const now = new Date().toISOString();
    await client.query(`
      INSERT INTO strategy_lifecycle_heads (
        strategy_id, current_revision_id, current_state, lifecycle_version, updated_at
      ) VALUES ($1, $2, $3, 0, $4)
      ON CONFLICT (strategy_id) DO NOTHING
    `, [strategyId, revisionId, initialState, now]);

    const head = await this.getHead(strategyId, client);
    if (!head) {
      throw new Error(`Failed to initialize StrategyLifecycleHead for ${strategyId}`);
    }
    return head;
  }

  async updateHeadWithCas(
    strategyId: string,
    newRevisionId: string,
    newState: StrategyLifecycleState,
    expectedVersion: number,
    lastTransitionId: string,
    updatedAt: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyLifecycleHead> {
    const result = await client.query(`
      UPDATE strategy_lifecycle_heads SET
        current_revision_id = $1,
        current_state = $2,
        lifecycle_version = lifecycle_version + 1,
        updated_at = $3,
        last_transition_id = $4
      WHERE strategy_id = $5 AND lifecycle_version = $6
    `, [newRevisionId, newState, updatedAt, lastTransitionId, strategyId, expectedVersion]);

    if (result.rowCount === 0 || (result.rowCount === undefined && result.rows.length === 0)) {
      throw new StrategyLifecycleConcurrencyError(
        `Strategy ${strategyId} lifecycle head changed since expected version ${expectedVersion}.`,
      );
    }

    return {
      strategyId,
      strategyRevisionId: newRevisionId,
      lifecycleState: newState,
      lifecycleVersion: expectedVersion + 1,
      updatedAt,
      lastTransitionId,
    };
  }

  async recordTransition(
    record: StrategyLifecycleTransitionRecord,
    client: PostgresQueryClient = this.client,
  ): Promise<void> {
    await client.query(`
      INSERT INTO strategy_lifecycle_transitions (
        transition_id, strategy_id, strategy_revision_id, from_state, to_state,
        previous_version, new_version, policy_revision, eligibility_ref,
        authorization_refs, decision, reason_codes, idempotency_key, command_hash,
        rationale, requested_at, decided_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::jsonb, $13, $14, $15, $16, $17, $18)
    `, [
      record.transitionId,
      record.strategyId,
      record.strategyRevisionId,
      record.fromState,
      record.toState,
      record.previousVersion,
      record.newVersion,
      record.policyRevision,
      record.eligibilityRef ?? null,
      stableJson(record.authorizationRefs ?? []),
      record.decision,
      stableJson(record.reasonCodes ?? []),
      record.idempotencyKey,
      record.commandHash,
      record.rationale ?? null,
      record.requestedAt,
      record.decidedAt,
      record.createdAt,
    ]);
  }

  async getTransitionById(
    transitionId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyLifecycleTransitionRecord | undefined> {
    const result = await client.query<LifecycleTransitionRow>(
      'SELECT * FROM strategy_lifecycle_transitions WHERE transition_id = $1',
      [transitionId],
    );
    const row = result.rows[0];
    return row ? this.transitionFromRow(row) : undefined;
  }

  async listTransitions(
    strategyId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyLifecycleTransitionRecord[]> {
    const result = await client.query<LifecycleTransitionRow>(`
      SELECT * FROM strategy_lifecycle_transitions
      WHERE strategy_id = $1
      ORDER BY new_version ASC, created_at ASC
    `, [strategyId]);
    return result.rows.map((row) => this.transitionFromRow(row));
  }

  async findTransitionByIdempotencyKey(
    strategyId: string,
    idempotencyKey: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyLifecycleTransitionRecord | undefined> {
    const result = await client.query<LifecycleTransitionRow>(`
      SELECT * FROM strategy_lifecycle_transitions
      WHERE strategy_id = $1 AND idempotency_key = $2
    `, [strategyId, idempotencyKey]);
    const row = result.rows[0];
    return row ? this.transitionFromRow(row) : undefined;
  }

  async savePolicy(
    policy: StrategyLifecyclePolicy,
    client: PostgresQueryClient = this.client,
  ): Promise<void> {
    await client.query(`
      INSERT INTO strategy_lifecycle_policies (
        policy_revision, name, description, rules, default_max_eligibility_age_ms, created_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      ON CONFLICT (policy_revision) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        rules = EXCLUDED.rules,
        default_max_eligibility_age_ms = EXCLUDED.default_max_eligibility_age_ms
    `, [
      policy.policyRevision,
      policy.name,
      policy.description ?? null,
      stableJson(policy.allowedTransitions),
      policy.defaultMaxEligibilityAgeMs ?? null,
      policy.createdAt,
    ]);
  }

  async getPolicy(
    policyRevision: string,
    client: PostgresQueryClient = this.client,
  ): Promise<StrategyLifecyclePolicy | undefined> {
    const result = await client.query<LifecyclePolicyRow>(
      'SELECT * FROM strategy_lifecycle_policies WHERE policy_revision = $1',
      [policyRevision],
    );
    const row = result.rows[0];
    return row ? this.policyFromRow(row) : undefined;
  }

  async appendOutbox(
    entry: ExecutionOutboxEntry,
    client: PostgresQueryClient = this.client,
  ): Promise<void> {
    await client.query(`
      INSERT INTO trading_execution_outbox (
        outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `, [
      entry.outboxId,
      entry.aggregateId,
      entry.aggregateVersion,
      entry.eventType,
      entry.correlationId,
      stableJson(entry.payload),
      entry.createdAt,
    ]);
  }

  private headFromRow(row: LifecycleHeadRow): StrategyLifecycleHead {
    return {
      strategyId: row.strategy_id,
      strategyRevisionId: row.current_revision_id,
      lifecycleState: row.current_state,
      lifecycleVersion: Number(row.lifecycle_version),
      updatedAt: row.updated_at,
      ...(row.last_transition_id ? { lastTransitionId: row.last_transition_id } : {}),
    };
  }

  private transitionFromRow(row: LifecycleTransitionRow): StrategyLifecycleTransitionRecord {
    const rawAuths = row.authorization_refs;
    const auths: AuthorizationRef[] = typeof rawAuths === 'string' ? JSON.parse(rawAuths) : rawAuths;
    const rawReasons = row.reason_codes;
    const reasons: StrategyLifecycleReasonCode[] = typeof rawReasons === 'string' ? JSON.parse(rawReasons) : rawReasons;

    return {
      transitionId: row.transition_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      fromState: row.from_state,
      toState: row.to_state,
      previousVersion: Number(row.previous_version),
      newVersion: Number(row.new_version),
      policyRevision: row.policy_revision,
      ...(row.eligibility_ref ? { eligibilityRef: row.eligibility_ref } : {}),
      authorizationRefs: auths ?? [],
      decision: row.decision,
      reasonCodes: reasons ?? [],
      idempotencyKey: row.idempotency_key,
      commandHash: row.command_hash,
      ...(row.rationale ? { rationale: row.rationale } : {}),
      requestedAt: row.requested_at,
      decidedAt: row.decided_at,
      createdAt: row.created_at,
    };
  }

  private policyFromRow(row: LifecyclePolicyRow): StrategyLifecyclePolicy {
    const rules = typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules;
    return {
      policyRevision: row.policy_revision,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      allowedTransitions: rules,
      ...(row.default_max_eligibility_age_ms ? { defaultMaxEligibilityAgeMs: Number(row.default_max_eligibility_age_ms) } : {}),
      createdAt: row.created_at,
    };
  }
}
