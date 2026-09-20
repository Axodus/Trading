import type {
  ExpectedPerformanceEnvelope,
  PerformanceEvaluation,
  PerformanceDriftAssessment,
  RevalidationRequest,
  RevalidationRequestStatus,
  MetricDeviation,
  MetricAssessment,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TransactionalPostgresQueryClient } from '../../repositories/postgres/PostgresClient.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import type { ExecutionOutboxEntry } from '../../repositories/postgres/PostgresDurableExecutionRepository.js';
import {
  PerformanceIdempotencyConflictError,
  RevalidationRequestConflictError,
} from './PerformanceDriftErrors.js';

interface ExpectedEnvelopeRow {
  envelope_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  strategy_evidence_refs: any;
  experiment_refs: any;
  dataset_refs: any;
  policy_id: string;
  policy_revision: string;
  environment_applicability: any;
  market_regime_applicability: any;
  evidence_strength: ExpectedPerformanceEnvelope['evidenceStrength'];
  window_semantics: string | null;
  expected_metrics: any;
  created_at: string;
  valid_from: string;
  valid_until: string | null;
  input_digest: string;
}

interface PerformanceEvaluationRow {
  evaluation_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  expected_envelope_id: string;
  comparison_policy_id: string;
  comparison_policy_revision: string;
  observation_window_start: string;
  observation_window_end: string;
  feedback_snapshot_refs: any;
  diagnostics_refs: any;
  pnl_attribution_refs: any;
  expected_metrics: any;
  observed_metrics: any;
  sample_size: number;
  quality: PerformanceEvaluation['quality'];
  created_at: string;
  as_of: string;
  input_digest: string;
}

interface MetricDeviationRow {
  deviation_id: string;
  evaluation_id: string;
  metric_name: string;
  expected_value: string | null;
  observed_value: string | null;
  absolute_deviation: string | null;
  relative_deviation_pct: string | null;
  status: MetricDeviation['status'];
}

interface PerformanceDriftAssessmentRow {
  assessment_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  performance_evaluation_id: string;
  drift_policy_id: string;
  drift_policy_revision: string;
  classification: PerformanceDriftAssessment['classification'];
  drift_dimensions: any;
  sample_size: number;
  persistence_state: any;
  quality: PerformanceDriftAssessment['quality'];
  created_at: string;
  as_of: string;
  input_digest: string;
}

interface MetricAssessmentRow {
  metric_assessment_id: string;
  assessment_id: string;
  metric_name: string;
  dimension: MetricAssessment['dimension'];
  expected: string | null;
  observed: string | null;
  deviation: string | null;
  threshold: string | null;
  severity: MetricAssessment['severity'];
  provenance: string;
}

interface RevalidationRequestRow {
  revalidation_request_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  trigger_assessment_id: string;
  trigger_classification: RevalidationRequest['triggerClassification'];
  requested_validation_scope: RevalidationRequest['requestedValidationScope'];
  evidence_refs: any;
  requested_at: string;
  request_policy_id: string;
  request_policy_revision: string;
  status: RevalidationRequestStatus;
  input_digest: string;
  result_ref: string | null;
  updated_at: string;
}

export class PostgresPerformanceDriftRepository {
  constructor(private readonly client: TransactionalPostgresQueryClient) {}

  public async saveExpectedPerformanceEnvelope(
    envelope: ExpectedPerformanceEnvelope,
    outboxEntry?: ExecutionOutboxEntry
  ): Promise<void> {
    try {
      await this.client.transaction(async (tx) => {
        const existing = await tx.query<ExpectedEnvelopeRow>(
          'SELECT * FROM expected_performance_envelopes WHERE envelope_id = $1 LIMIT 1',
          [envelope.envelopeId]
        );

        if (existing.rows.length > 0) {
          if (existing.rows[0].input_digest === envelope.inputDigest) {
            return; // Idempotent
          }
          throw new PerformanceIdempotencyConflictError(
            `Expected performance envelope ${envelope.envelopeId} already exists with differing digest`,
            { existingDigest: existing.rows[0].input_digest, newDigest: envelope.inputDigest }
          );
        }

        await tx.query(
          `INSERT INTO expected_performance_envelopes (
            envelope_id, strategy_id, strategy_revision_id, strategy_evidence_refs,
            experiment_refs, dataset_refs, policy_id, policy_revision,
            environment_applicability, market_regime_applicability, evidence_strength,
            window_semantics, expected_metrics, created_at, valid_from, valid_until, input_digest
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            envelope.envelopeId,
            envelope.strategyId,
            envelope.strategyRevisionId,
            stableJson(envelope.strategyEvidenceRefs),
            envelope.experimentRefs ? stableJson(envelope.experimentRefs) : null,
            envelope.datasetRefs ? stableJson(envelope.datasetRefs) : null,
            envelope.policyId,
            envelope.policyRevision,
            stableJson(envelope.environmentApplicability),
            envelope.marketRegimeApplicability ? stableJson(envelope.marketRegimeApplicability) : null,
            envelope.evidenceStrength,
            envelope.windowSemantics ?? null,
            stableJson(envelope.expectedMetrics),
            envelope.createdAt,
            envelope.validFrom,
            envelope.validUntil ?? null,
            envelope.inputDigest,
          ]
        );

        if (outboxEntry) {
          await tx.query(
            `INSERT INTO trading_execution_outbox (
              outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              outboxEntry.outboxId,
              outboxEntry.aggregateId,
              outboxEntry.aggregateVersion,
              outboxEntry.eventType,
              outboxEntry.correlationId ?? null,
              stableJson(outboxEntry.payload),
              outboxEntry.createdAt,
            ]
          );
        }
      });
    } catch (error: any) {
      if (error?.cause instanceof PerformanceIdempotencyConflictError) throw error.cause;
      throw error;
    }
  }

  public async getExpectedPerformanceEnvelope(envelopeId: string): Promise<ExpectedPerformanceEnvelope | null> {
    const res = await this.client.query<ExpectedEnvelopeRow>(
      'SELECT * FROM expected_performance_envelopes WHERE envelope_id = $1 LIMIT 1',
      [envelopeId]
    );
    if (res.rows.length === 0) return null;
    return this.mapExpectedEnvelopeRow(res.rows[0]);
  }

  public async getLatestExpectedEnvelopeByStrategy(
    strategyId: string,
    strategyRevisionId: string
  ): Promise<ExpectedPerformanceEnvelope | null> {
    const res = await this.client.query<ExpectedEnvelopeRow>(
      'SELECT * FROM expected_performance_envelopes WHERE strategy_id = $1 AND strategy_revision_id = $2 ORDER BY created_at DESC LIMIT 1',
      [strategyId, strategyRevisionId]
    );
    if (res.rows.length === 0) return null;
    return this.mapExpectedEnvelopeRow(res.rows[0]);
  }

  public async savePerformanceEvaluation(
    evaluation: PerformanceEvaluation,
    outboxEntry?: ExecutionOutboxEntry
  ): Promise<void> {
    try {
      await this.client.transaction(async (tx) => {
        const existing = await tx.query<PerformanceEvaluationRow>(
          'SELECT * FROM performance_evaluations WHERE evaluation_id = $1 LIMIT 1',
          [evaluation.evaluationId]
        );

        if (existing.rows.length > 0) {
          if (existing.rows[0].input_digest === evaluation.inputDigest) {
            return;
          }
          throw new PerformanceIdempotencyConflictError(
            `Performance evaluation ${evaluation.evaluationId} already exists with differing digest`,
            { existingDigest: existing.rows[0].input_digest, newDigest: evaluation.inputDigest }
          );
        }

        await tx.query(
          `INSERT INTO performance_evaluations (
            evaluation_id, strategy_id, strategy_revision_id, expected_envelope_id,
            comparison_policy_id, comparison_policy_revision, observation_window_start,
            observation_window_end, feedback_snapshot_refs, diagnostics_refs,
            pnl_attribution_refs, expected_metrics, observed_metrics, sample_size,
            quality, created_at, as_of, input_digest
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            evaluation.evaluationId,
            evaluation.strategyId,
            evaluation.strategyRevisionId,
            evaluation.expectedEnvelopeId,
            evaluation.comparisonPolicyId,
            evaluation.comparisonPolicyRevision,
            evaluation.observationWindowStart,
            evaluation.observationWindowEnd,
            stableJson(evaluation.feedbackSnapshotRefs),
            stableJson(evaluation.diagnosticsRefs),
            stableJson(evaluation.pnlAttributionRefs),
            stableJson(evaluation.expectedMetrics),
            stableJson(evaluation.observedMetrics),
            evaluation.sampleSize,
            evaluation.quality,
            evaluation.createdAt,
            evaluation.asOf,
            evaluation.inputDigest,
          ]
        );

        for (let i = 0; i < evaluation.deviations.length; i++) {
          const dev = evaluation.deviations[i];
          await tx.query(
            `INSERT INTO performance_metric_deviations (
              deviation_id, evaluation_id, metric_name, expected_value,
              observed_value, absolute_deviation, relative_deviation_pct, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              `dev-${evaluation.evaluationId}-${i}`,
              evaluation.evaluationId,
              dev.metricName,
              dev.expectedValue ?? null,
              dev.observedValue ?? null,
              dev.absoluteDeviation ?? null,
              dev.relativeDeviationPct ?? null,
              dev.status,
            ]
          );
        }

        if (outboxEntry) {
          await tx.query(
            `INSERT INTO trading_execution_outbox (
              outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              outboxEntry.outboxId,
              outboxEntry.aggregateId,
              outboxEntry.aggregateVersion,
              outboxEntry.eventType,
              outboxEntry.correlationId ?? null,
              stableJson(outboxEntry.payload),
              outboxEntry.createdAt,
            ]
          );
        }
      });
    } catch (error: any) {
      if (error?.cause instanceof PerformanceIdempotencyConflictError) throw error.cause;
      throw error;
    }
  }

  public async getPerformanceEvaluation(evaluationId: string): Promise<PerformanceEvaluation | null> {
    const res = await this.client.query<PerformanceEvaluationRow>(
      'SELECT * FROM performance_evaluations WHERE evaluation_id = $1 LIMIT 1',
      [evaluationId]
    );
    if (res.rows.length === 0) return null;
    const devRes = await this.client.query<MetricDeviationRow>(
      'SELECT * FROM performance_metric_deviations WHERE evaluation_id = $1 ORDER BY deviation_id ASC',
      [evaluationId]
    );
    return this.mapPerformanceEvaluationRow(res.rows[0], devRes.rows);
  }

  public async savePerformanceDriftAssessment(
    assessment: PerformanceDriftAssessment,
    outboxEntry?: ExecutionOutboxEntry
  ): Promise<void> {
    try {
      await this.client.transaction(async (tx) => {
        const existing = await tx.query<PerformanceDriftAssessmentRow>(
          'SELECT * FROM performance_drift_assessments WHERE assessment_id = $1 LIMIT 1',
          [assessment.assessmentId]
        );

        if (existing.rows.length > 0) {
          if (existing.rows[0].input_digest === assessment.inputDigest) {
            return;
          }
          throw new PerformanceIdempotencyConflictError(
            `Performance drift assessment ${assessment.assessmentId} already exists with differing digest`,
            { existingDigest: existing.rows[0].input_digest, newDigest: assessment.inputDigest }
          );
        }

        await tx.query(
          `INSERT INTO performance_drift_assessments (
            assessment_id, strategy_id, strategy_revision_id, performance_evaluation_id,
            drift_policy_id, drift_policy_revision, classification, drift_dimensions,
            sample_size, persistence_state, quality, created_at, as_of, input_digest
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            assessment.assessmentId,
            assessment.strategyId,
            assessment.strategyRevisionId,
            assessment.performanceEvaluationId,
            assessment.driftPolicyId,
            assessment.driftPolicyRevision,
            assessment.classification,
            stableJson(assessment.driftDimensions),
            assessment.sampleSize,
            stableJson(assessment.persistenceState),
            assessment.quality,
            assessment.createdAt,
            assessment.asOf,
            assessment.inputDigest,
          ]
        );

        for (let i = 0; i < assessment.metricAssessments.length; i++) {
          const ma = assessment.metricAssessments[i];
          await tx.query(
            `INSERT INTO performance_metric_assessments (
              metric_assessment_id, assessment_id, metric_name, dimension,
              expected, observed, deviation, threshold, severity, provenance
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              `ma-${assessment.assessmentId}-${i}`,
              assessment.assessmentId,
              ma.metricName,
              ma.dimension,
              ma.expected ?? null,
              ma.observed ?? null,
              ma.deviation ?? null,
              ma.threshold ?? null,
              ma.severity,
              ma.provenance,
            ]
          );
        }

        if (outboxEntry) {
          await tx.query(
            `INSERT INTO trading_execution_outbox (
              outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              outboxEntry.outboxId,
              outboxEntry.aggregateId,
              outboxEntry.aggregateVersion,
              outboxEntry.eventType,
              outboxEntry.correlationId ?? null,
              stableJson(outboxEntry.payload),
              outboxEntry.createdAt,
            ]
          );
        }
      });
    } catch (error: any) {
      if (error?.cause instanceof PerformanceIdempotencyConflictError) throw error.cause;
      throw error;
    }
  }

  public async getPerformanceDriftAssessment(assessmentId: string): Promise<PerformanceDriftAssessment | null> {
    const res = await this.client.query<PerformanceDriftAssessmentRow>(
      'SELECT * FROM performance_drift_assessments WHERE assessment_id = $1 LIMIT 1',
      [assessmentId]
    );
    if (res.rows.length === 0) return null;
    const maRes = await this.client.query<MetricAssessmentRow>(
      'SELECT * FROM performance_metric_assessments WHERE assessment_id = $1 ORDER BY metric_assessment_id ASC',
      [assessmentId]
    );
    return this.mapPerformanceDriftAssessmentRow(res.rows[0], maRes.rows);
  }

  public async getLatestDriftAssessmentByStrategy(
    strategyId: string,
    strategyRevisionId: string
  ): Promise<PerformanceDriftAssessment | null> {
    const res = await this.client.query<PerformanceDriftAssessmentRow>(
      'SELECT * FROM performance_drift_assessments WHERE strategy_id = $1 AND strategy_revision_id = $2 ORDER BY created_at DESC LIMIT 1',
      [strategyId, strategyRevisionId]
    );
    if (res.rows.length === 0) return null;
    const maRes = await this.client.query<MetricAssessmentRow>(
      'SELECT * FROM performance_metric_assessments WHERE assessment_id = $1 ORDER BY metric_assessment_id ASC',
      [res.rows[0].assessment_id]
    );
    return this.mapPerformanceDriftAssessmentRow(res.rows[0], maRes.rows);
  }

  public async saveRevalidationRequest(
    request: RevalidationRequest,
    outboxEntry?: ExecutionOutboxEntry
  ): Promise<void> {
    try {
      await this.client.transaction(async (tx) => {
        // 1. Exact trigger duplicate check
        const existing = await tx.query<RevalidationRequestRow>(
          'SELECT * FROM revalidation_requests WHERE trigger_assessment_id = $1 LIMIT 1',
          [request.triggerAssessmentId]
        );

        if (existing.rows.length > 0) {
          if (existing.rows[0].input_digest === request.inputDigest) {
            return; // Idempotent success
          }
          throw new PerformanceIdempotencyConflictError(
            `Revalidation request for trigger assessment ${request.triggerAssessmentId} already exists with differing digest`,
            { existingDigest: existing.rows[0].input_digest, newDigest: request.inputDigest }
          );
        }

        // 2. Active Revalidation Concurrency Check (at most ONE active revalidation request per revision)
        const active = await tx.query<RevalidationRequestRow>(
          `SELECT * FROM revalidation_requests
           WHERE strategy_id = $1 AND strategy_revision_id = $2 AND status IN ('REQUESTED', 'ACKNOWLEDGED', 'IN_PROGRESS')
           LIMIT 1`,
          [request.strategyId, request.strategyRevisionId]
        );

        if (active.rows.length > 0) {
          throw new RevalidationRequestConflictError(
            `An active revalidation request ${active.rows[0].revalidation_request_id} is already in progress for strategy ${request.strategyRevisionId}`,
            { activeRequestId: active.rows[0].revalidation_request_id, activeStatus: active.rows[0].status }
          );
        }

        await tx.query(
          `INSERT INTO revalidation_requests (
            revalidation_request_id, strategy_id, strategy_revision_id, trigger_assessment_id,
            trigger_classification, requested_validation_scope, evidence_refs, requested_at,
            request_policy_id, request_policy_revision, status, input_digest, result_ref, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            request.revalidationRequestId,
            request.strategyId,
            request.strategyRevisionId,
            request.triggerAssessmentId,
            request.triggerClassification,
            request.requestedValidationScope,
            stableJson(request.evidenceRefs),
            request.requestedAt,
            request.requestPolicyId,
            request.requestPolicyRevision,
            request.status,
            request.inputDigest,
            request.resultRef ?? null,
            request.updatedAt ?? request.requestedAt,
          ]
        );

        await tx.query(
          `INSERT INTO revalidation_request_events (
            event_id, revalidation_request_id, event_type, from_status, to_status, reason, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `rrev-${request.revalidationRequestId}-0`,
            request.revalidationRequestId,
            'RevalidationRequested',
            null,
            request.status,
            `Triggered by ${request.triggerClassification} drift assessment ${request.triggerAssessmentId}`,
            request.requestedAt,
          ]
        );

        if (outboxEntry) {
          await tx.query(
            `INSERT INTO trading_execution_outbox (
              outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              outboxEntry.outboxId,
              outboxEntry.aggregateId,
              outboxEntry.aggregateVersion,
              outboxEntry.eventType,
              outboxEntry.correlationId ?? null,
              stableJson(outboxEntry.payload),
              outboxEntry.createdAt,
            ]
          );
        }
      });
    } catch (error: any) {
      if (error?.cause instanceof PerformanceIdempotencyConflictError) throw error.cause;
      if (error?.cause instanceof RevalidationRequestConflictError) throw error.cause;
      throw error;
    }
  }

  public async getRevalidationRequest(requestId: string): Promise<RevalidationRequest | null> {
    const res = await this.client.query<RevalidationRequestRow>(
      'SELECT * FROM revalidation_requests WHERE revalidation_request_id = $1 LIMIT 1',
      [requestId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRevalidationRequestRow(res.rows[0]);
  }

  public async getActiveRevalidationRequest(
    strategyId: string,
    strategyRevisionId: string
  ): Promise<RevalidationRequest | null> {
    const res = await this.client.query<RevalidationRequestRow>(
      `SELECT * FROM revalidation_requests
       WHERE strategy_id = $1 AND strategy_revision_id = $2 AND status IN ('REQUESTED', 'ACKNOWLEDGED', 'IN_PROGRESS')
       ORDER BY requested_at DESC LIMIT 1`,
      [strategyId, strategyRevisionId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRevalidationRequestRow(res.rows[0]);
  }

  public async updateRevalidationRequestStatus(
    requestId: string,
    fromStatus: RevalidationRequestStatus,
    toStatus: RevalidationRequestStatus,
    reason?: string,
    resultRef?: string,
    outboxEntry?: ExecutionOutboxEntry
  ): Promise<void> {
    await this.client.transaction(async (tx) => {
      const existing = await tx.query<RevalidationRequestRow>(
        'SELECT * FROM revalidation_requests WHERE revalidation_request_id = $1 LIMIT 1',
        [requestId]
      );

      if (existing.rows.length === 0) {
        throw new Error(`Revalidation request ${requestId} not found`);
      }

      const row = existing.rows[0];
      if (row.status !== fromStatus) {
        throw new Error(`Cannot transition revalidation request ${requestId} from ${row.status} (expected ${fromStatus}) to ${toStatus}`);
      }

      const now = new Date().toISOString();
      await tx.query(
        'UPDATE revalidation_requests SET status = $1, result_ref = COALESCE($2, result_ref), updated_at = $3 WHERE revalidation_request_id = $4',
        [toStatus, resultRef ?? null, now, requestId]
      );

      await tx.query(
        `INSERT INTO revalidation_request_events (
          event_id, revalidation_request_id, event_type, from_status, to_status, reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `rrev-${requestId}-${Date.now()}`,
          requestId,
          `RevalidationStatusUpdatedTo_${toStatus}`,
          fromStatus,
          toStatus,
          reason ?? null,
          now,
        ]
      );

      if (outboxEntry) {
        await tx.query(
          `INSERT INTO trading_execution_outbox (
            outbox_id, aggregate_id, aggregate_version, event_type, correlation_id, payload, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            outboxEntry.outboxId,
            outboxEntry.aggregateId,
            outboxEntry.aggregateVersion,
            outboxEntry.eventType,
            outboxEntry.correlationId ?? null,
            stableJson(outboxEntry.payload),
            outboxEntry.createdAt,
          ]
        );
      }
    });
  }

  private mapExpectedEnvelopeRow(row: ExpectedEnvelopeRow): ExpectedPerformanceEnvelope {
    return {
      envelopeId: row.envelope_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      strategyEvidenceRefs: typeof row.strategy_evidence_refs === 'string' ? JSON.parse(row.strategy_evidence_refs) : row.strategy_evidence_refs,
      experimentRefs: row.experiment_refs ? (typeof row.experiment_refs === 'string' ? JSON.parse(row.experiment_refs) : row.experiment_refs) : undefined,
      datasetRefs: row.dataset_refs ? (typeof row.dataset_refs === 'string' ? JSON.parse(row.dataset_refs) : row.dataset_refs) : undefined,
      policyId: row.policy_id,
      policyRevision: row.policy_revision,
      environmentApplicability: typeof row.environment_applicability === 'string' ? JSON.parse(row.environment_applicability) : row.environment_applicability,
      marketRegimeApplicability: row.market_regime_applicability ? (typeof row.market_regime_applicability === 'string' ? JSON.parse(row.market_regime_applicability) : row.market_regime_applicability) : undefined,
      evidenceStrength: row.evidence_strength,
      windowSemantics: row.window_semantics ?? undefined,
      expectedMetrics: typeof row.expected_metrics === 'string' ? JSON.parse(row.expected_metrics) : row.expected_metrics,
      createdAt: row.created_at,
      validFrom: row.valid_from,
      validUntil: row.valid_until ?? undefined,
      inputDigest: row.input_digest,
    };
  }

  private mapPerformanceEvaluationRow(row: PerformanceEvaluationRow, devRows: MetricDeviationRow[]): PerformanceEvaluation {
    return {
      evaluationId: row.evaluation_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      expectedEnvelopeId: row.expected_envelope_id,
      comparisonPolicyId: row.comparison_policy_id,
      comparisonPolicyRevision: row.comparison_policy_revision,
      observationWindowStart: row.observation_window_start,
      observationWindowEnd: row.observation_window_end,
      feedbackSnapshotRefs: typeof row.feedback_snapshot_refs === 'string' ? JSON.parse(row.feedback_snapshot_refs) : row.feedback_snapshot_refs,
      diagnosticsRefs: typeof row.diagnostics_refs === 'string' ? JSON.parse(row.diagnostics_refs) : row.diagnostics_refs,
      pnlAttributionRefs: typeof row.pnl_attribution_refs === 'string' ? JSON.parse(row.pnl_attribution_refs) : row.pnl_attribution_refs,
      expectedMetrics: typeof row.expected_metrics === 'string' ? JSON.parse(row.expected_metrics) : row.expected_metrics,
      observedMetrics: typeof row.observed_metrics === 'string' ? JSON.parse(row.observed_metrics) : row.observed_metrics,
      deviations: devRows.map((d) => ({
        metricName: d.metric_name,
        expectedValue: d.expected_value ?? undefined,
        observedValue: d.observed_value ?? undefined,
        absoluteDeviation: d.absolute_deviation ?? undefined,
        relativeDeviationPct: d.relative_deviation_pct ?? undefined,
        status: d.status,
      })),
      sampleSize: row.sample_size,
      quality: row.quality,
      createdAt: row.created_at,
      asOf: row.as_of,
      inputDigest: row.input_digest,
    };
  }

  private mapPerformanceDriftAssessmentRow(row: PerformanceDriftAssessmentRow, maRows: MetricAssessmentRow[]): PerformanceDriftAssessment {
    return {
      assessmentId: row.assessment_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      performanceEvaluationId: row.performance_evaluation_id,
      driftPolicyId: row.drift_policy_id,
      driftPolicyRevision: row.drift_policy_revision,
      classification: row.classification,
      driftDimensions: typeof row.drift_dimensions === 'string' ? JSON.parse(row.drift_dimensions) : row.drift_dimensions,
      sampleSize: row.sample_size,
      persistenceState: typeof row.persistence_state === 'string' ? JSON.parse(row.persistence_state) : row.persistence_state,
      quality: row.quality,
      metricAssessments: maRows.map((ma) => ({
        metricName: ma.metric_name,
        dimension: ma.dimension,
        expected: ma.expected ?? undefined,
        observed: ma.observed ?? undefined,
        deviation: ma.deviation ?? undefined,
        threshold: ma.threshold ?? undefined,
        severity: ma.severity,
        provenance: ma.provenance,
      })),
      createdAt: row.created_at,
      asOf: row.as_of,
      inputDigest: row.input_digest,
    };
  }

  private mapRevalidationRequestRow(row: RevalidationRequestRow): RevalidationRequest {
    return {
      revalidationRequestId: row.revalidation_request_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      triggerAssessmentId: row.trigger_assessment_id,
      triggerClassification: row.trigger_classification,
      requestedValidationScope: row.requested_validation_scope,
      evidenceRefs: typeof row.evidence_refs === 'string' ? JSON.parse(row.evidence_refs) : row.evidence_refs,
      requestedAt: row.requested_at,
      requestPolicyId: row.request_policy_id,
      requestPolicyRevision: row.request_policy_revision,
      status: row.status,
      inputDigest: row.input_digest,
      resultRef: row.result_ref ?? undefined,
      updatedAt: row.updated_at,
    };
  }
}
