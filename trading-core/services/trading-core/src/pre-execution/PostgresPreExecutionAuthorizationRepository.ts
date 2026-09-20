import type { TradingIntent } from '../../../../packages/trading-contracts/src/index.js';
import type { PostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import type { ExecutionOutboxEntry } from '../repositories/postgres/PostgresDurableExecutionRepository.js';
import type {
  PreExecutionAuthorizationRecord,
  PreExecutionAuthorizationDecision,
  PreExecutionReasonCode,
} from './PreExecutionTypes.js';

interface TradingIntentRow {
  intent_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  market_state_id: string;
  opportunity_id: string;
  proposal_id: string;
  portfolio_decision_id: string;
  risk_decision_id: string;
  eligibility_id: string;
  instrument: string;
  venue: string | null;
  action: TradingIntent['action'];
  approved_quantity: string;
  approved_capital: string;
  approved_leverage: string | null;
  price_constraints: string | Record<string, unknown> | null;
  time_constraints: string | Record<string, unknown> | null;
  execution_policy_ref: string;
  correlation_id: string;
  idempotency_key: string;
  created_at: string;
  expires_at: string;
  evidence_refs: string | string[];
}

interface PreExecutionAuthorizationRow {
  authorization_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  proposal_id: string;
  portfolio_decision_id: string;
  risk_decision_id: string;
  snapshot_id: string;
  decision: PreExecutionAuthorizationDecision;
  reason_codes: string | PreExecutionReasonCode[];
  intent_id: string | null;
  effective_capital: string;
  effective_leverage: string;
  idempotency_key: string;
  command_hash: string;
  rationale: string | null;
  decided_at: string;
  created_at: string;
}

export class PostgresPreExecutionAuthorizationRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async saveTradingIntent(intent: TradingIntent, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO trading_intents (
        intent_id,
        strategy_id,
        strategy_revision_id,
        market_state_id,
        opportunity_id,
        proposal_id,
        portfolio_decision_id,
        risk_decision_id,
        eligibility_id,
        instrument,
        venue,
        action,
        approved_quantity,
        approved_capital,
        approved_leverage,
        price_constraints,
        time_constraints,
        execution_policy_ref,
        correlation_id,
        idempotency_key,
        created_at,
        expires_at,
        evidence_refs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        intent.intentId,
        intent.strategyId,
        intent.strategyRevisionId,
        intent.marketStateId,
        intent.opportunityId,
        intent.proposalId,
        intent.portfolioDecisionId,
        intent.riskDecisionId,
        intent.eligibilityId,
        intent.instrument,
        intent.venue ?? null,
        intent.action,
        intent.approvedQuantity,
        intent.approvedCapital,
        intent.approvedLeverage ?? null,
        intent.priceConstraints ? stableJson(intent.priceConstraints) : null,
        intent.timeConstraints ? stableJson(intent.timeConstraints) : null,
        intent.executionPolicyRef,
        intent.correlationId,
        intent.idempotencyKey,
        intent.createdAt,
        intent.expiresAt,
        stableJson(intent.evidenceRefs ?? []),
      ],
    );
  }

  async getTradingIntent(intentId: string, client: PostgresQueryClient = this.client): Promise<TradingIntent | undefined> {
    const result = await client.query<TradingIntentRow>(
      'SELECT * FROM trading_intents WHERE intent_id = $1',
      [intentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapIntentRow(result.rows[0]);
  }

  async findTradingIntentByRiskDecisionId(
    riskDecisionId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<TradingIntent | undefined> {
    const result = await client.query<TradingIntentRow>(
      'SELECT * FROM trading_intents WHERE risk_decision_id = $1',
      [riskDecisionId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapIntentRow(result.rows[0]);
  }

  async saveAuthorization(
    record: PreExecutionAuthorizationRecord,
    client: PostgresQueryClient = this.client,
  ): Promise<void> {
    await client.query(
      `INSERT INTO pre_execution_authorizations (
        authorization_id,
        strategy_id,
        strategy_revision_id,
        proposal_id,
        portfolio_decision_id,
        risk_decision_id,
        snapshot_id,
        decision,
        reason_codes,
        intent_id,
        effective_capital,
        effective_leverage,
        idempotency_key,
        command_hash,
        rationale,
        decided_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        record.authorizationId,
        record.strategyId,
        record.strategyRevisionId,
        record.proposalId,
        record.portfolioDecisionId,
        record.riskDecisionId,
        record.snapshotId,
        record.decision,
        stableJson(record.reasonCodes ?? []),
        record.intentId ?? null,
        record.effectiveCapital,
        record.effectiveLeverage,
        record.idempotencyKey,
        record.commandHash,
        record.rationale ?? null,
        record.decidedAt,
        record.createdAt,
      ],
    );
  }

  async findAuthorizationByIdempotencyKey(
    strategyId: string,
    idempotencyKey: string,
    client: PostgresQueryClient = this.client,
  ): Promise<PreExecutionAuthorizationRecord | undefined> {
    const result = await client.query<PreExecutionAuthorizationRow>(
      'SELECT * FROM pre_execution_authorizations WHERE strategy_id = $1 AND idempotency_key = $2',
      [strategyId, idempotencyKey],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapAuthorizationRow(result.rows[0]);
  }

  async findAuthorizationByRiskDecisionId(
    riskDecisionId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<PreExecutionAuthorizationRecord | undefined> {
    const result = await client.query<PreExecutionAuthorizationRow>(
      'SELECT * FROM pre_execution_authorizations WHERE risk_decision_id = $1',
      [riskDecisionId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapAuthorizationRow(result.rows[0]);
  }

  async appendOutbox(entry: ExecutionOutboxEntry, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO trading_execution_outbox (
        outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.outboxId,
        entry.aggregateId,
        entry.aggregateVersion,
        entry.eventType,
        entry.correlationId ?? null,
        stableJson(entry.payload),
        entry.createdAt,
      ],
    );
  }

  private mapIntentRow(row: TradingIntentRow): TradingIntent {
    return {
      intentId: row.intent_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      marketStateId: row.market_state_id,
      opportunityId: row.opportunity_id,
      proposalId: row.proposal_id,
      portfolioDecisionId: row.portfolio_decision_id,
      riskDecisionId: row.risk_decision_id,
      eligibilityId: row.eligibility_id,
      instrument: row.instrument,
      venue: row.venue ?? undefined,
      action: row.action,
      approvedQuantity: row.approved_quantity,
      approvedCapital: row.approved_capital,
      approvedLeverage: row.approved_leverage ?? undefined,
      priceConstraints: typeof row.price_constraints === 'string' ? JSON.parse(row.price_constraints) : (row.price_constraints ?? undefined),
      timeConstraints: typeof row.time_constraints === 'string' ? JSON.parse(row.time_constraints) : (row.time_constraints ?? undefined),
      executionPolicyRef: row.execution_policy_ref,
      correlationId: row.correlation_id,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      evidenceRefs: typeof row.evidence_refs === 'string' ? JSON.parse(row.evidence_refs) : (row.evidence_refs ?? []),
    };
  }

  private mapAuthorizationRow(row: PreExecutionAuthorizationRow): PreExecutionAuthorizationRecord {
    return {
      authorizationId: row.authorization_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      proposalId: row.proposal_id,
      portfolioDecisionId: row.portfolio_decision_id,
      riskDecisionId: row.risk_decision_id,
      snapshotId: row.snapshot_id,
      decision: row.decision,
      reasonCodes: typeof row.reason_codes === 'string' ? JSON.parse(row.reason_codes) : (row.reason_codes ?? []),
      intentId: row.intent_id ?? undefined,
      effectiveCapital: row.effective_capital,
      effectiveLeverage: row.effective_leverage,
      idempotencyKey: row.idempotency_key,
      commandHash: row.command_hash,
      rationale: row.rationale ?? '',
      decidedAt: row.decided_at,
      createdAt: row.created_at,
    };
  }
}
