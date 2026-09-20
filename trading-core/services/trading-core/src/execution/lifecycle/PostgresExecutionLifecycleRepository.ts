import type {
  ExecutionAttempt,
  ExecutionAttemptStatus,
  CanonicalOrder,
  CanonicalOrderEvent,
  CanonicalFill,
  ProviderObservation,
  ReconciliationRecord,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { PostgresQueryClient } from '../../repositories/postgres/PostgresClient.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import type { ExecutionOutboxEntry } from '../../repositories/postgres/PostgresDurableExecutionRepository.js';

interface ExecutionAttemptRow {
  attempt_id: string;
  execution_intent_id: string;
  trading_intent_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  adapter_type: string;
  venue: string;
  environment: ExecutionAttempt['environment'];
  attempt_number: number;
  idempotency_key: string;
  client_order_id: string;
  provider_order_id: string | null;
  status: ExecutionAttemptStatus;
  created_at: string;
  expires_at: string;
  error: string | null;
}

interface CanonicalOrderRow {
  canonical_order_id: string;
  execution_intent_id: string;
  execution_attempt_id: string;
  trading_intent_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  provider: string;
  venue: string;
  instrument: string;
  side: CanonicalOrder['side'];
  order_type: string;
  authorized_quantity: string;
  execution_quantity: string;
  cumulative_filled_quantity: string;
  remaining_quantity: string;
  weighted_average_price: string | null;
  state: CanonicalOrder['state'];
  order_version: number;
  client_order_id: string;
  provider_order_id: string | null;
  last_observation_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CanonicalOrderEventRow {
  event_id: string;
  canonical_order_id: string;
  order_version: number;
  previous_state: CanonicalOrder['state'];
  new_state: CanonicalOrder['state'];
  observation_id: string | null;
  rationale: string;
  timestamp: string;
}

interface CanonicalFillRow {
  canonical_fill_id: string;
  canonical_order_id: string;
  execution_intent_id: string;
  provider: string;
  provider_trade_id: string;
  instrument: string;
  side: CanonicalFill['side'];
  fill_quantity: string;
  fill_price: string;
  fee: string | null;
  fee_asset: string | null;
  provider_timestamp: string;
  observed_at: string;
}

interface ProviderObservationRow {
  observation_id: string;
  observation_type: ProviderObservation['observationType'];
  provider: string;
  venue: string;
  client_order_id: string | null;
  provider_order_id: string | null;
  provider_trade_id: string | null;
  provider_status: string | null;
  observed_quantity: string | null;
  observed_price: string | null;
  observed_fee: string | null;
  observed_fee_asset: string | null;
  source: ProviderObservation['source'];
  sequence_number: string | null;
  observed_at: string;
  provider_timestamp: string | null;
  raw_payload_digest: string;
}

interface ReconciliationRecordRow {
  reconciliation_id: string;
  canonical_order_id: string | null;
  client_order_id: string | null;
  provider_order_id: string | null;
  decision: ReconciliationRecord['decision'];
  previous_state: CanonicalOrder['state'] | null;
  new_state: CanonicalOrder['state'] | null;
  reconciliation_version: number;
  reason_codes: string | string[];
  discrepancy_details: string | null;
  evaluated_at: string;
}

export class PostgresExecutionLifecycleRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async saveAttempt(attempt: ExecutionAttempt, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO execution_attempts (
        attempt_id,
        execution_intent_id,
        trading_intent_id,
        strategy_id,
        strategy_revision_id,
        adapter_type,
        venue,
        environment,
        attempt_number,
        idempotency_key,
        client_order_id,
        provider_order_id,
        status,
        created_at,
        expires_at,
        error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        attempt.attemptId,
        attempt.executionIntentId,
        attempt.tradingIntentId,
        attempt.strategyId,
        attempt.strategyRevisionId,
        attempt.adapterType,
        attempt.venue,
        attempt.environment,
        attempt.attemptNumber,
        attempt.idempotencyKey,
        attempt.clientOrderId,
        attempt.providerOrderId ?? null,
        attempt.status,
        attempt.createdAt,
        attempt.expiresAt,
        attempt.error ?? null,
      ],
    );
  }

  async updateAttemptStatus(
    attemptId: string,
    status: ExecutionAttemptStatus,
    providerOrderId?: string,
    error?: string,
    client: PostgresQueryClient = this.client,
  ): Promise<void> {
    await client.query(
      `UPDATE execution_attempts
       SET status = $2,
           provider_order_id = COALESCE($3, provider_order_id),
           error = COALESCE($4, error)
       WHERE attempt_id = $1`,
      [attemptId, status, providerOrderId ?? null, error ?? null],
    );
  }

  async getAttempt(attemptId: string, client: PostgresQueryClient = this.client): Promise<ExecutionAttempt | undefined> {
    const res = await client.query<ExecutionAttemptRow>(
      'SELECT * FROM execution_attempts WHERE attempt_id = $1',
      [attemptId],
    );
    if (res.rows.length === 0) return undefined;
    return this.mapAttemptRow(res.rows[0]);
  }

  async getAttemptByClientOrderId(clientOrderId: string, client: PostgresQueryClient = this.client): Promise<ExecutionAttempt | undefined> {
    const res = await client.query<ExecutionAttemptRow>(
      'SELECT * FROM execution_attempts WHERE client_order_id = $1',
      [clientOrderId],
    );
    if (res.rows.length === 0) return undefined;
    return this.mapAttemptRow(res.rows[0]);
  }

  async findAttemptByIdempotencyKey(
    executionIntentId: string,
    idempotencyKey: string,
    client: PostgresQueryClient = this.client,
  ): Promise<ExecutionAttempt | undefined> {
    const res = await client.query<ExecutionAttemptRow>(
      'SELECT * FROM execution_attempts WHERE execution_intent_id = $1 AND idempotency_key = $2',
      [executionIntentId, idempotencyKey],
    );
    if (res.rows.length === 0) return undefined;
    return this.mapAttemptRow(res.rows[0]);
  }

  async saveCanonicalOrder(order: CanonicalOrder, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO canonical_orders (
        canonical_order_id,
        execution_intent_id,
        execution_attempt_id,
        trading_intent_id,
        strategy_id,
        strategy_revision_id,
        provider,
        venue,
        instrument,
        side,
        order_type,
        authorized_quantity,
        execution_quantity,
        cumulative_filled_quantity,
        remaining_quantity,
        weighted_average_price,
        state,
        order_version,
        client_order_id,
        provider_order_id,
        last_observation_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        order.canonicalOrderId,
        order.executionIntentId,
        order.executionAttemptId,
        order.tradingIntentId,
        order.strategyId,
        order.strategyRevisionId,
        order.provider,
        order.venue,
        order.instrument,
        order.side,
        order.orderType,
        order.authorizedQuantity,
        order.executionQuantity,
        order.cumulativeFilledQuantity,
        order.remainingQuantity,
        order.weightedAveragePrice ?? null,
        order.state,
        order.orderVersion,
        order.clientOrderId,
        order.providerOrderId ?? null,
        order.lastObservationId ?? null,
        order.createdAt,
        order.updatedAt,
      ],
    );
  }

  async updateCanonicalOrder(order: CanonicalOrder, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `UPDATE canonical_orders
       SET cumulative_filled_quantity = $2,
           remaining_quantity = $3,
           weighted_average_price = $4,
           state = $5,
           order_version = $6,
           provider_order_id = COALESCE($7, provider_order_id),
           last_observation_id = COALESCE($8, last_observation_id),
           updated_at = $9
       WHERE canonical_order_id = $1 AND order_version = $10`,
      [
        order.canonicalOrderId,
        order.cumulativeFilledQuantity,
        order.remainingQuantity,
        order.weightedAveragePrice ?? null,
        order.state,
        order.orderVersion,
        order.providerOrderId ?? null,
        order.lastObservationId ?? null,
        order.updatedAt,
        order.orderVersion - 1,
      ],
    );
  }

  async getCanonicalOrder(orderId: string, client: PostgresQueryClient = this.client): Promise<CanonicalOrder | undefined> {
    const res = await client.query<CanonicalOrderRow>(
      'SELECT * FROM canonical_orders WHERE canonical_order_id = $1',
      [orderId],
    );
    if (res.rows.length === 0) return undefined;
    return this.mapOrderRow(res.rows[0]);
  }

  async getCanonicalOrderByIntentId(executionIntentId: string, client: PostgresQueryClient = this.client): Promise<CanonicalOrder | undefined> {
    const res = await client.query<CanonicalOrderRow>(
      'SELECT * FROM canonical_orders WHERE execution_intent_id = $1',
      [executionIntentId],
    );
    if (res.rows.length === 0) return undefined;
    return this.mapOrderRow(res.rows[0]);
  }

  async getCanonicalOrderByClientOrderId(clientOrderId: string, client: PostgresQueryClient = this.client): Promise<CanonicalOrder | undefined> {
    const res = await client.query<CanonicalOrderRow>(
      'SELECT * FROM canonical_orders WHERE client_order_id = $1',
      [clientOrderId],
    );
    if (res.rows.length === 0) return undefined;
    return this.mapOrderRow(res.rows[0]);
  }

  async listNonTerminalOrders(client: PostgresQueryClient = this.client): Promise<CanonicalOrder[]> {
    const terminalStates = ['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED'];
    const res = await client.query<CanonicalOrderRow>(
      `SELECT * FROM canonical_orders WHERE state NOT IN (${terminalStates.map((_, i) => `$${i + 1}`).join(', ')}) ORDER BY created_at ASC`,
      terminalStates,
    );
    return res.rows.map((r) => this.mapOrderRow(r));
  }

  async saveOrderEvent(event: CanonicalOrderEvent, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO canonical_order_events (
        event_id,
        canonical_order_id,
        order_version,
        previous_state,
        new_state,
        observation_id,
        rationale,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.eventId,
        event.canonicalOrderId,
        event.orderVersion,
        event.previousState,
        event.newState,
        event.observationId ?? null,
        event.rationale,
        event.timestamp,
      ],
    );
  }

  async listOrderEvents(orderId: string, client: PostgresQueryClient = this.client): Promise<CanonicalOrderEvent[]> {
    const res = await client.query<CanonicalOrderEventRow>(
      'SELECT * FROM canonical_order_events WHERE canonical_order_id = $1 ORDER BY order_version ASC',
      [orderId],
    );
    return res.rows.map((r) => this.mapOrderEventRow(r));
  }

  async saveFill(fill: CanonicalFill, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO canonical_fills (
        canonical_fill_id,
        canonical_order_id,
        execution_intent_id,
        provider,
        provider_trade_id,
        instrument,
        side,
        fill_quantity,
        fill_price,
        fee,
        fee_asset,
        provider_timestamp,
        observed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        fill.canonicalFillId,
        fill.canonicalOrderId,
        fill.executionIntentId,
        fill.provider,
        fill.providerTradeId,
        fill.instrument,
        fill.side,
        fill.fillQuantity,
        fill.fillPrice,
        fill.fee ?? null,
        fill.feeAsset ?? null,
        fill.providerTimestamp,
        fill.observedAt,
      ],
    );
  }

  async listFillsForOrder(orderId: string, client: PostgresQueryClient = this.client): Promise<CanonicalFill[]> {
    const res = await client.query<CanonicalFillRow>(
      'SELECT * FROM canonical_fills WHERE canonical_order_id = $1 ORDER BY provider_timestamp ASC',
      [orderId],
    );
    return res.rows.map((r) => this.mapFillRow(r));
  }

  async saveObservation(observation: ProviderObservation, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO provider_observations (
        observation_id,
        observation_type,
        provider,
        venue,
        client_order_id,
        provider_order_id,
        provider_trade_id,
        provider_status,
        observed_quantity,
        observed_price,
        observed_fee,
        observed_fee_asset,
        source,
        sequence_number,
        observed_at,
        provider_timestamp,
        raw_payload_digest
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        observation.observationId,
        observation.observationType,
        observation.provider,
        observation.venue,
        observation.clientOrderId ?? null,
        observation.providerOrderId ?? null,
        observation.providerTradeId ?? null,
        observation.providerStatus ?? null,
        observation.observedQuantity ?? null,
        observation.observedPrice ?? null,
        observation.observedFee ?? null,
        observation.observedFeeAsset ?? null,
        observation.source,
        observation.sequenceNumber ? observation.sequenceNumber.toString() : null,
        observation.observedAt,
        observation.providerTimestamp ?? null,
        observation.rawPayloadDigest,
      ],
    );
  }

  async findObservationByDigest(
    provider: string,
    digest: string,
    client: PostgresQueryClient = this.client,
  ): Promise<ProviderObservation | undefined> {
    const res = await client.query<ProviderObservationRow>(
      'SELECT * FROM provider_observations WHERE provider = $1 AND raw_payload_digest = $2',
      [provider, digest],
    );
    if (res.rows.length === 0) return undefined;
    return this.mapObservationRow(res.rows[0]);
  }

  async saveReconciliationRecord(record: ReconciliationRecord, client: PostgresQueryClient = this.client): Promise<void> {
    await client.query(
      `INSERT INTO reconciliation_records (
        reconciliation_id,
        canonical_order_id,
        client_order_id,
        provider_order_id,
        decision,
        previous_state,
        new_state,
        reconciliation_version,
        reason_codes,
        discrepancy_details,
        evaluated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        record.reconciliationId,
        record.canonicalOrderId ?? null,
        record.clientOrderId ?? null,
        record.providerOrderId ?? null,
        record.decision,
        record.previousState ?? null,
        record.newState ?? null,
        record.reconciliationVersion,
        stableJson(record.reasonCodes ?? []),
        record.discrepancyDetails ?? null,
        record.evaluatedAt,
      ],
    );
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

  private mapAttemptRow(row: ExecutionAttemptRow): ExecutionAttempt {
    return {
      attemptId: row.attempt_id,
      executionIntentId: row.execution_intent_id,
      tradingIntentId: row.trading_intent_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      adapterType: row.adapter_type,
      venue: row.venue,
      environment: row.environment,
      attemptNumber: row.attempt_number,
      idempotencyKey: row.idempotency_key,
      clientOrderId: row.client_order_id,
      providerOrderId: row.provider_order_id ?? undefined,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      error: row.error ?? undefined,
    };
  }

  private mapOrderRow(row: CanonicalOrderRow): CanonicalOrder {
    return {
      canonicalOrderId: row.canonical_order_id,
      executionIntentId: row.execution_intent_id,
      executionAttemptId: row.execution_attempt_id,
      tradingIntentId: row.trading_intent_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      provider: row.provider,
      venue: row.venue,
      instrument: row.instrument,
      side: row.side,
      orderType: row.order_type,
      authorizedQuantity: row.authorized_quantity,
      executionQuantity: row.execution_quantity,
      cumulativeFilledQuantity: row.cumulative_filled_quantity,
      remainingQuantity: row.remaining_quantity,
      weightedAveragePrice: row.weighted_average_price ?? undefined,
      state: row.state,
      orderVersion: row.order_version,
      clientOrderId: row.client_order_id,
      providerOrderId: row.provider_order_id ?? undefined,
      lastObservationId: row.last_observation_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapOrderEventRow(row: CanonicalOrderEventRow): CanonicalOrderEvent {
    return {
      eventId: row.event_id,
      canonicalOrderId: row.canonical_order_id,
      orderVersion: row.order_version,
      previousState: row.previous_state,
      newState: row.new_state,
      observationId: row.observation_id ?? undefined,
      rationale: row.rationale,
      timestamp: row.timestamp,
    };
  }

  private mapFillRow(row: CanonicalFillRow): CanonicalFill {
    return {
      canonicalFillId: row.canonical_fill_id,
      canonicalOrderId: row.canonical_order_id,
      executionIntentId: row.execution_intent_id,
      provider: row.provider,
      providerTradeId: row.provider_trade_id,
      instrument: row.instrument,
      side: row.side,
      fillQuantity: row.fill_quantity,
      fillPrice: row.fill_price,
      fee: row.fee ?? undefined,
      feeAsset: row.fee_asset ?? undefined,
      providerTimestamp: row.provider_timestamp,
      observedAt: row.observed_at,
    };
  }

  private mapObservationRow(row: ProviderObservationRow): ProviderObservation {
    return {
      observationId: row.observation_id,
      observationType: row.observation_type,
      provider: row.provider,
      venue: row.venue,
      clientOrderId: row.client_order_id ?? undefined,
      providerOrderId: row.provider_order_id ?? undefined,
      providerTradeId: row.provider_trade_id ?? undefined,
      providerStatus: row.provider_status ?? undefined,
      observedQuantity: row.observed_quantity ?? undefined,
      observedPrice: row.observed_price ?? undefined,
      observedFee: row.observed_fee ?? undefined,
      observedFeeAsset: row.observed_fee_asset ?? undefined,
      source: row.source,
      sequenceNumber: row.sequence_number ? Number(row.sequence_number) : undefined,
      observedAt: row.observed_at,
      providerTimestamp: row.provider_timestamp ?? undefined,
      rawPayloadDigest: row.raw_payload_digest,
    };
  }
}

