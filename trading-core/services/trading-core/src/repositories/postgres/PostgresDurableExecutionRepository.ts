import type { CexExecutionLifecycleState, CexOrderEvidence, CexSubmissionAttempt } from '../../../../../packages/trading-contracts/src/execution/lifecycle.js';
import type { PostgresQueryClient } from './PostgresClient.js';
import { stableJson } from './PostgresClient.js';

export interface DurableSubmissionAttempt extends CexSubmissionAttempt {
  version: number;
}

export interface ExecutionOutboxEntry {
  outboxId: string;
  aggregateId: string;
  aggregateVersion: number;
  eventType: string;
  correlationId: string;
  payload: unknown;
  createdAt: string;
}

interface SubmissionAttemptRow {
  attempt_id: string;
  intent_id: string;
  correlation_id: string;
  provider_id: string;
  connector: string;
  market: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit';
  quantity: string;
  price?: string;
  execution_client_order_id: string;
  state: CexExecutionLifecycleState;
  provider_order_id?: string;
  evidence?: CexOrderEvidence | string;
  last_failure?: string;
  version: number | string;
  created_at: string;
  updated_at: string;
}

export class DurableExecutionConcurrencyError extends Error {
  readonly code = 'CONCURRENCY_CONFLICT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'DurableExecutionConcurrencyError';
  }
}

export class PostgresDurableExecutionRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async create(attempt: CexSubmissionAttempt, queryClient: PostgresQueryClient = this.client): Promise<DurableSubmissionAttempt> {
    await queryClient.query(`
      INSERT INTO trading_submission_attempts (
        attempt_id, intent_id, correlation_id, provider_id, connector, market, side,
        order_type, quantity, price, execution_client_order_id, state,
        provider_order_id, evidence, last_failure, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18)
    `, this.parameters(attempt, 0));
    return { ...attempt, version: 0 };
  }

  async get(attemptId: string, queryClient: PostgresQueryClient = this.client): Promise<DurableSubmissionAttempt | undefined> {
    const result = await queryClient.query<SubmissionAttemptRow>(
      'SELECT * FROM trading_submission_attempts WHERE attempt_id = $1',
      [attemptId],
    );
    const row = result.rows[0];
    return row ? this.fromRow(row) : undefined;
  }

  async listRecoveryCandidates(queryClient: PostgresQueryClient = this.client): Promise<DurableSubmissionAttempt[]> {
    const result = await queryClient.query<SubmissionAttemptRow>(
      `SELECT * FROM trading_submission_attempts
       WHERE state NOT IN ('provider-acknowledged', 'failed', 'rejected', 'cancelled', 'cancellation-rejected', 'cancellation-failed')
       ORDER BY updated_at ASC, attempt_id ASC`,
    );
    return result.rows.map((row) => this.fromRow(row));
  }

  async updateWithCas(
    attempt: DurableSubmissionAttempt,
    expectedVersion: number,
    queryClient: PostgresQueryClient = this.client,
  ): Promise<DurableSubmissionAttempt> {
    const result = await queryClient.query(
      `UPDATE trading_submission_attempts SET
        intent_id = $1, correlation_id = $2, provider_id = $3, connector = $4, market = $5,
        side = $6, order_type = $7, quantity = $8, price = $9, execution_client_order_id = $10,
        state = $11, provider_order_id = $12, evidence = $13::jsonb, last_failure = $14,
        version = version + 1, updated_at = $15
       WHERE attempt_id = $16 AND version = $17`,
      [
        attempt.intentId, attempt.correlationId, attempt.providerId, attempt.connector, attempt.market,
        attempt.side, attempt.orderType, attempt.quantity, attempt.price, attempt.executionClientOrderId,
        attempt.state, attempt.providerOrderId, attempt.evidence ? stableJson(attempt.evidence) : null,
        attempt.lastFailure, attempt.updatedAt, attempt.attemptId, expectedVersion,
      ],
    );
    if (result.rowCount === 0 || (result.rowCount === undefined && result.rows.length === 0)) {
      throw new DurableExecutionConcurrencyError(`SubmissionAttempt ${attempt.attemptId} changed since version ${expectedVersion}.`);
    }
    return { ...attempt, version: expectedVersion + 1 };
  }

  async appendOutbox(entry: ExecutionOutboxEntry, queryClient: PostgresQueryClient = this.client): Promise<void> {
    await queryClient.query(`
      INSERT INTO trading_execution_outbox (
        outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `, [entry.outboxId, entry.aggregateId, entry.aggregateVersion, entry.eventType, entry.correlationId, stableJson(entry.payload), entry.createdAt]);
  }

  async persistAttemptAndOutbox(
    attempt: DurableSubmissionAttempt,
    expectedVersion: number,
    entry: ExecutionOutboxEntry,
    queryClient: PostgresQueryClient,
  ): Promise<DurableSubmissionAttempt> {
    const updated = await this.updateWithCas(attempt, expectedVersion, queryClient);
    await this.appendOutbox({ ...entry, aggregateVersion: updated.version }, queryClient);
    return updated;
  }

  private parameters(attempt: CexSubmissionAttempt, version: number): unknown[] {
    return [
      attempt.attemptId, attempt.intentId, attempt.correlationId, attempt.providerId, attempt.connector,
      attempt.market, attempt.side, attempt.orderType, attempt.quantity, attempt.price,
      attempt.executionClientOrderId, attempt.state, attempt.providerOrderId,
      attempt.evidence ? stableJson(attempt.evidence) : null, attempt.lastFailure, version,
      attempt.createdAt, attempt.updatedAt,
    ];
  }

  private fromRow(row: SubmissionAttemptRow): DurableSubmissionAttempt {
    return {
      attemptId: row.attempt_id,
      intentId: row.intent_id,
      correlationId: row.correlation_id,
      providerId: row.provider_id,
      connector: row.connector,
      market: row.market,
      side: row.side,
      orderType: row.order_type,
      quantity: row.quantity,
      ...(row.price ? { price: row.price } : {}),
      executionClientOrderId: row.execution_client_order_id,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.provider_order_id ? { providerOrderId: row.provider_order_id } : {}),
      ...(row.evidence ? { evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence } : {}),
      ...(row.last_failure ? { lastFailure: row.last_failure } : {}),
      version: Number(row.version),
    };
  }
}
