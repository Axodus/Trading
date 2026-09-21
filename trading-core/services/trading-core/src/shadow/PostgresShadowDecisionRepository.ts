import type { ShadowDecisionEvaluation, ShadowDecisionObservation, ShadowDecisionSnapshot } from '../../../../packages/trading-contracts/src/index.js';
import type { PostgresTransactionClient, TransactionalPostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import { ShadowDecisionConflictError } from './ShadowDecisionErrors.js';
import type { ShadowDecisionRepository } from './ShadowDecisionRepository.js';

export class PostgresShadowDecisionRepository implements ShadowDecisionRepository {
  constructor(private readonly client: TransactionalPostgresQueryClient) {}

  async saveSnapshot(snapshot: ShadowDecisionSnapshot): Promise<void> {
    await this.transaction(async (tx) => {
      if (await this.replayed(tx, 'shadow_decision_snapshots', 'snapshot_id', snapshot.snapshotId, snapshot.inputDigest)) return;
      await tx.query(`INSERT INTO shadow_decision_snapshots (
        snapshot_id, correlation_id, captured_at, environment, strategy_id, strategy_revision_id, instrument,
        market_state_ref, market_state_digest, opportunity_ref, opportunity_digest, trade_proposal_ref,
        trade_proposal_digest, experiment_identity, question_set_identity, requested_provider, requested_model,
        provider_state, input_digest
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [
        snapshot.snapshotId, snapshot.correlationId, snapshot.capturedAt, snapshot.environment, snapshot.strategyId,
        snapshot.strategyRevisionId, snapshot.instrument, snapshot.marketStateRef, snapshot.marketStateDigest,
        snapshot.opportunityRef, snapshot.opportunityDigest, snapshot.tradeProposalRef, snapshot.tradeProposalDigest,
        stableJson(snapshot.experiment), stableJson(snapshot.questionSet), snapshot.requestedProvider,
        snapshot.requestedModel, stableJson(snapshot.providerState), snapshot.inputDigest,
      ]);
      await this.outbox(tx, snapshot.snapshotId, snapshot.correlationId, 'ShadowDecisionSnapshotCaptured', snapshot, snapshot.capturedAt);
    });
  }

  async saveObservation(observation: ShadowDecisionObservation): Promise<void> {
    await this.transaction(async (tx) => {
      if (await this.replayed(tx, 'shadow_decision_observations', 'observation_id', observation.observationId, observation.inputDigest)) return;
      const request = await tx.query<{ observation_id: string; input_digest: string }>(
        'SELECT observation_id, input_digest FROM shadow_decision_observations WHERE request_id = $1 LIMIT 1', [observation.requestId]
      );
      if (request.rows.length > 0) {
        if (request.rows[0].input_digest === observation.inputDigest) return;
        throw new ShadowDecisionConflictError(`Request ${observation.requestId} produced conflicting observations`);
      }
      await tx.query(`INSERT INTO shadow_decision_observations (
        observation_id, request_id, snapshot_id, correlation_id, provider, requested_model, resolved_model, status,
        answers, attempt_count, attempts, total_provider_wall_time_ms, usage, observed_at, failure_code, input_digest
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [
        observation.observationId, observation.requestId, observation.snapshotId, observation.correlationId,
        observation.provider, observation.requestedModel, observation.resolvedModel ?? null, observation.status,
        stableJson(observation.answers), observation.attemptCount, stableJson(observation.attempts),
        observation.totalProviderWallTimeMs, observation.usage ? stableJson(observation.usage) : null,
        observation.observedAt, observation.failureCode ?? null, observation.inputDigest,
      ]);
      await this.outbox(tx, observation.observationId, observation.correlationId, 'ShadowDecisionObserved', observation, observation.observedAt);
    });
  }

  async saveEvaluation(evaluation: ShadowDecisionEvaluation): Promise<void> {
    await this.transaction(async (tx) => {
      if (await this.replayed(tx, 'shadow_decision_evaluations', 'evaluation_id', evaluation.evaluationId, evaluation.inputDigest)) return;
      await tx.query(`INSERT INTO shadow_decision_evaluations (
        evaluation_id, observation_id, snapshot_id, label_policy_identity, baseline_decision_ref,
        portfolio_decision_ref, risk_decision_ref, execution_result_ref, outcome_ref,
        counterfactual_provenance, scorable, evaluated_at, input_digest
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
        evaluation.evaluationId, evaluation.observationId, evaluation.snapshotId, stableJson(evaluation.labelPolicy),
        evaluation.baselineDecisionRef, evaluation.portfolioDecisionRef ?? null, evaluation.riskDecisionRef ?? null,
        evaluation.executionResultRef ?? null, evaluation.outcomeRef ?? null, evaluation.counterfactualProvenance,
        evaluation.scorable, evaluation.evaluatedAt, evaluation.inputDigest,
      ]);
      await this.outbox(tx, evaluation.evaluationId, evaluation.observationId, 'ShadowDecisionEvaluated', evaluation, evaluation.evaluatedAt);
    });
  }

  private async replayed(tx: PostgresTransactionClient, table: string, idColumn: string, id: string, digest: string): Promise<boolean> {
    const existing = await tx.query<{ input_digest: string }>(`SELECT input_digest FROM ${table} WHERE ${idColumn} = $1 LIMIT 1`, [id]);
    if (existing.rows.length === 0) return false;
    if (existing.rows[0].input_digest === digest) return true;
    throw new ShadowDecisionConflictError(`${id} exists with a different digest`);
  }

  private async transaction(callback: (tx: PostgresTransactionClient) => Promise<void>): Promise<void> {
    try {
      await this.client.transaction(callback);
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      if (cause instanceof ShadowDecisionConflictError) throw cause;
      throw error;
    }
  }

  private async outbox(tx: PostgresTransactionClient, aggregateId: string, correlationId: string, eventType: string, payload: unknown, createdAt: string): Promise<void> {
    await tx.query(`INSERT INTO trading_execution_outbox (
      outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (aggregate_id, aggregate_version, event_type) DO NOTHING`, [
      `shadow-outbox:${eventType}:${aggregateId}`, aggregateId, 1, eventType, correlationId, stableJson(payload), createdAt,
    ]);
  }
}
