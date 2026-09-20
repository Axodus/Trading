import type {
  ExecutionIntent,
  ExecutionResultPayload,
  ExecutionTranslationDecision,
  ExecutionTranslationReasonCode,
  ExecutionTranslationRecord,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { PostgresQueryClient } from '../../repositories/postgres/PostgresClient.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import type { ExecutionOutboxEntry } from '../../repositories/postgres/PostgresDurableExecutionRepository.js';

interface ExecutionIntentRow {
  execution_intent_id: string;
  trading_intent_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  instrument: string;
  market_type: ExecutionIntent['marketType'];
  side: ExecutionIntent['side'];
  authorized_capital: string;
  authorized_quantity: string;
  authorized_leverage: string;
  execution_capital: string;
  execution_quantity: string;
  execution_leverage: string;
  venue: string;
  target_adapter_type: string;
  constraints: string | ExecutionIntent['constraints'];
  trading_intent_digest: string;
  authorization_context_digest: string;
  execution_policy_ref: string;
  correlation_id: string;
  idempotency_key: string;
  created_at: string;
  expires_at: string;
  evidence_refs: string | string[];
}

interface ExecutionTranslationRow {
  translation_id: string;
  trading_intent_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  target_adapter_type: string;
  decision: ExecutionTranslationDecision;
  reason_codes: string | ExecutionTranslationReasonCode[];
  execution_intent_id: string | null;
  effective_capital: string;
  effective_quantity: string;
  effective_leverage: string;
  policy_revision: string;
  idempotency_key: string;
  command_hash: string;
  rationale: string | null;
  evaluated_at: string;
  created_at: string;
}

interface ExecutionResultRow {
  execution_result_id: string;
  execution_intent_id: string;
  trading_intent_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  adapter_type: string;
  mode: ExecutionResultPayload['mode'];
  status: ExecutionResultPayload['status'];
  requested_quantity: string;
  accepted_quantity: string;
  simulated_filled_quantity: string | null;
  simulated_average_price: string | null;
  fees: string | { asset: string; amount: string } | null;
  reason_codes: string | string[];
  created_at: string;
  completed_at: string;
}

export class PostgresExecutionBoundaryRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async saveExecutionIntent(intent: ExecutionIntent, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO execution_intents (
        execution_intent_id,
        trading_intent_id,
        strategy_id,
        strategy_revision_id,
        instrument,
        market_type,
        side,
        authorized_capital,
        authorized_quantity,
        authorized_leverage,
        execution_capital,
        execution_quantity,
        execution_leverage,
        venue,
        target_adapter_type,
        constraints,
        trading_intent_digest,
        authorization_context_digest,
        execution_policy_ref,
        correlation_id,
        idempotency_key,
        created_at,
        expires_at,
        evidence_refs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        intent.executionIntentId,
        intent.tradingIntentId,
        intent.strategyId,
        intent.strategyRevisionId,
        intent.instrument,
        intent.marketType,
        intent.side,
        intent.authorizedCapital,
        intent.authorizedQuantity,
        intent.authorizedLeverage,
        intent.executionCapital,
        intent.executionQuantity,
        intent.executionLeverage,
        intent.venue,
        intent.targetAdapterType,
        stableJson(intent.constraints),
        intent.tradingIntentDigest,
        intent.authorizationContextDigest,
        intent.executionPolicyRef,
        intent.correlationId,
        intent.idempotencyKey,
        intent.createdAt,
        intent.expiresAt,
        stableJson(intent.evidenceRefs ?? []),
      ],
    );
  }

  async getExecutionIntent(intentId: string, client: PostgresQueryClient = this.client): Promise<ExecutionIntent | undefined> {
    const result = await client.query<ExecutionIntentRow>(
      'SELECT * FROM execution_intents WHERE execution_intent_id = $1',
      [intentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapExecutionIntentRow(result.rows[0]);
  }

  async findExecutionIntentByTradingIntentId(
    tradingIntentId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<ExecutionIntent | undefined> {
    const result = await client.query<ExecutionIntentRow>(
      'SELECT * FROM execution_intents WHERE trading_intent_id = $1',
      [tradingIntentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapExecutionIntentRow(result.rows[0]);
  }

  async saveTranslation(
    record: ExecutionTranslationRecord,
    client: PostgresQueryClient = this.client,
  ): Promise<void> {
    await client.query(
      `INSERT INTO execution_translations (
        translation_id,
        trading_intent_id,
        strategy_id,
        strategy_revision_id,
        target_adapter_type,
        decision,
        reason_codes,
        execution_intent_id,
        effective_capital,
        effective_quantity,
        effective_leverage,
        policy_revision,
        idempotency_key,
        command_hash,
        rationale,
        evaluated_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        record.translationId,
        record.tradingIntentId,
        record.strategyId,
        record.strategyRevisionId,
        record.targetAdapterType,
        record.decision,
        stableJson(record.reasonCodes ?? []),
        record.executionIntentId ?? null,
        record.effectiveCapital,
        record.effectiveQuantity,
        record.effectiveLeverage,
        record.policyRevision,
        record.idempotencyKey,
        record.commandHash,
        record.rationale ?? null,
        record.evaluatedAt,
        record.createdAt,
      ],
    );
  }

  async findTranslationByIdempotencyKey(
    tradingIntentId: string,
    idempotencyKey: string,
    client: PostgresQueryClient = this.client,
  ): Promise<ExecutionTranslationRecord | undefined> {
    const result = await client.query<ExecutionTranslationRow>(
      'SELECT * FROM execution_translations WHERE trading_intent_id = $1 AND idempotency_key = $2',
      [tradingIntentId, idempotencyKey],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapTranslationRow(result.rows[0]);
  }

  async saveExecutionResult(
    payload: ExecutionResultPayload,
    client: PostgresQueryClient = this.client,
  ): Promise<void> {
    await client.query(
      `INSERT INTO execution_results (
        execution_result_id,
        execution_intent_id,
        trading_intent_id,
        strategy_id,
        strategy_revision_id,
        adapter_type,
        mode,
        status,
        requested_quantity,
        accepted_quantity,
        simulated_filled_quantity,
        simulated_average_price,
        fees,
        reason_codes,
        created_at,
        completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        payload.executionResultId,
        payload.executionIntentId,
        payload.tradingIntentId,
        payload.strategyId,
        payload.strategyRevisionId,
        payload.adapterType,
        payload.mode,
        payload.status,
        payload.requestedQuantity,
        payload.acceptedQuantity,
        payload.simulatedFilledQuantity ?? null,
        payload.simulatedAveragePrice ?? null,
        payload.fees ? stableJson(payload.fees) : null,
        stableJson(payload.reasonCodes ?? []),
        payload.createdAt,
        payload.completedAt,
      ],
    );
  }

  async getExecutionResult(
    resultId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<ExecutionResultPayload | undefined> {
    const result = await client.query<ExecutionResultRow>(
      'SELECT * FROM execution_results WHERE execution_result_id = $1',
      [resultId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapExecutionResultRow(result.rows[0]);
  }

  async findExecutionResultByIntentId(
    executionIntentId: string,
    client: PostgresQueryClient = this.client,
  ): Promise<ExecutionResultPayload | undefined> {
    const result = await client.query<ExecutionResultRow>(
      'SELECT * FROM execution_results WHERE execution_intent_id = $1',
      [executionIntentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapExecutionResultRow(result.rows[0]);
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

  private mapExecutionIntentRow(row: ExecutionIntentRow): ExecutionIntent {
    return {
      executionIntentId: row.execution_intent_id,
      tradingIntentId: row.trading_intent_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      instrument: row.instrument,
      marketType: row.market_type,
      side: row.side,
      authorizedCapital: row.authorized_capital,
      authorizedQuantity: row.authorized_quantity,
      authorizedLeverage: row.authorized_leverage,
      executionCapital: row.execution_capital,
      executionQuantity: row.execution_quantity,
      executionLeverage: row.execution_leverage,
      venue: row.venue,
      targetAdapterType: row.target_adapter_type,
      constraints: typeof row.constraints === 'string' ? JSON.parse(row.constraints) : row.constraints,
      tradingIntentDigest: row.trading_intent_digest,
      authorizationContextDigest: row.authorization_context_digest,
      executionPolicyRef: row.execution_policy_ref,
      correlationId: row.correlation_id,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      evidenceRefs: typeof row.evidence_refs === 'string' ? JSON.parse(row.evidence_refs) : (row.evidence_refs ?? []),
    };
  }

  private mapTranslationRow(row: ExecutionTranslationRow): ExecutionTranslationRecord {
    return {
      translationId: row.translation_id,
      tradingIntentId: row.trading_intent_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      targetAdapterType: row.target_adapter_type,
      decision: row.decision,
      reasonCodes: typeof row.reason_codes === 'string' ? JSON.parse(row.reason_codes) : (row.reason_codes ?? []),
      executionIntentId: row.execution_intent_id ?? undefined,
      effectiveCapital: row.effective_capital,
      effectiveQuantity: row.effective_quantity,
      effectiveLeverage: row.effective_leverage,
      policyRevision: row.policy_revision,
      idempotencyKey: row.idempotency_key,
      commandHash: row.command_hash,
      rationale: row.rationale ?? '',
      evaluatedAt: row.evaluated_at,
      createdAt: row.created_at,
    };
  }

  private mapExecutionResultRow(row: ExecutionResultRow): ExecutionResultPayload {
    return {
      executionResultId: row.execution_result_id,
      executionIntentId: row.execution_intent_id,
      tradingIntentId: row.trading_intent_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      adapterType: row.adapter_type,
      mode: row.mode,
      status: row.status,
      requestedQuantity: row.requested_quantity,
      acceptedQuantity: row.accepted_quantity,
      simulatedFilledQuantity: row.simulated_filled_quantity ?? undefined,
      simulatedAveragePrice: row.simulated_average_price ?? undefined,
      fees: typeof row.fees === 'string' ? JSON.parse(row.fees) : (row.fees ?? undefined),
      reasonCodes: typeof row.reason_codes === 'string' ? JSON.parse(row.reason_codes) : (row.reason_codes ?? []),
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }
}
