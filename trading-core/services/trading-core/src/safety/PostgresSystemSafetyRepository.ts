/**
 * AXODUS-TRADING-EPIC-01 / REQ-13
 * PostgreSQL System Safety & Recovery Repository
 */

import type {
  SystemSafetyObservation,
  SystemSafetySnapshot,
  SystemSafetyAssessment,
  KillSwitchRequest,
  SystemRecoveryPlan,
  ResumeEligibility,
  KillSwitchState,
  SafetyScope,
  RecoveryStep,
} from '../../../../packages/trading-contracts/src/index.js';
import type {
  PostgresQueryClient,
  TransactionalPostgresQueryClient,
  PostgresTransactionClient,
} from '../repositories/postgres/PostgresClient.js';
import {
  SafetyIdempotencyConflictError,
  RecoveryFencingTokenError,
} from './SystemSafetyErrors.js';

interface SafetyObservationRow {
  observation_id: string;
  domain: any;
  component: string;
  scope: any;
  scope_id: string | null;
  status: any;
  severity: any;
  observed_at: string;
  as_of: string;
  expires_at: string | null;
  reason_codes: any;
  metrics: any;
  source_ref: string;
  correlation_id: string | null;
  causation_id: string | null;
  input_digest: string;
  created_at: string;
}

interface SafetySnapshotRow {
  safety_snapshot_id: string;
  observations: any;
  market_data_state: any;
  database_state: any;
  event_system_state: any;
  runtime_state: any;
  provider_states: any;
  execution_state: any;
  reconciliation_state: any;
  accounting_state: any;
  governance_state: any;
  created_at: string;
  as_of: string;
  expires_at: string;
  input_digest: string;
}

interface SafetyAssessmentRow {
  assessment_id: string;
  safety_snapshot_id: string;
  policy_id: string;
  policy_revision: string;
  state: any;
  severity: any;
  scope: any;
  scope_id: string | null;
  reason_codes: any;
  active_kill_levels: any;
  required_actions: any;
  created_at: string;
  as_of: string;
  expires_at: string;
  input_digest: string;
}

interface KillSwitchRequestRow {
  kill_switch_request_id: string;
  assessment_id: string;
  scope: any;
  scope_id: string | null;
  level: any;
  severity: any;
  reason_codes: any;
  active_reasons: any;
  requested_at: string;
  expires_at: string | null;
  status: any;
  is_latched: boolean;
  input_digest: string;
  created_at: string;
}

interface RecoveryPlanRow {
  recovery_plan_id: string;
  trigger_assessment_id: string;
  kill_switch_request_id: string | null;
  scope: any;
  scope_id: string | null;
  steps: any;
  dependencies: any;
  policy_id: string;
  policy_revision: string;
  status: any;
  lease_token: string | null;
  created_at: string;
  completed_at: string | null;
  input_digest: string;
}

interface ResumeEligibilityRow {
  resume_eligibility_id: string;
  recovery_plan_id: string;
  eligible: boolean;
  scope: any;
  scope_id: string | null;
  validated_prerequisites: any;
  failed_prerequisites: any;
  evaluated_at: string;
  expires_at: string;
  requires_human_review: boolean;
  input_digest: string;
}

export class PostgresSystemSafetyRepository {
  constructor(private readonly client: TransactionalPostgresQueryClient & PostgresQueryClient) {}

  // -------------------------------------------------------------
  // OBSERVATIONS
  // -------------------------------------------------------------

  public async recordSafetyObservation(
    obs: SystemSafetyObservation,
    executor?: PostgresQueryClient
  ): Promise<SystemSafetyObservation> {
    const q = executor ?? this.client;
    const sql = `
      INSERT INTO system_safety_observations (
        observation_id,
        domain,
        component,
        scope,
        scope_id,
        status,
        severity,
        observed_at,
        as_of,
        expires_at,
        reason_codes,
        metrics,
        source_ref,
        correlation_id,
        causation_id,
        input_digest,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15, $16, NOW())
      ON CONFLICT (observation_id) DO NOTHING
      RETURNING *;
    `;

    const res = await q.query<SafetyObservationRow>(sql, [
      obs.observationId,
      obs.domain,
      obs.component,
      obs.scope,
      obs.scopeId ?? null,
      obs.status,
      obs.severity,
      obs.observedAt,
      obs.asOf,
      obs.expiresAt ?? null,
      JSON.stringify(obs.reasonCodes),
      JSON.stringify(obs.metrics),
      obs.sourceRef,
      obs.correlationId ?? null,
      obs.causationId ?? null,
      obs.inputDigest,
    ]);

    if (res.rows.length === 0) {
      const existing = await this.getSafetyObservation(obs.observationId, q);
      if (existing) {
        if (existing.inputDigest !== obs.inputDigest) {
          throw new SafetyIdempotencyConflictError(
            `Idempotency conflict for observation ${obs.observationId}`
          );
        }
        return existing;
      }
    }

    return this.mapSafetyObservationRow(res.rows[0]);
  }

  public async getSafetyObservation(
    observationId: string,
    executor?: PostgresQueryClient
  ): Promise<SystemSafetyObservation | null> {
    const q = executor ?? this.client;
    const res = await q.query<SafetyObservationRow>(
      `SELECT * FROM system_safety_observations WHERE observation_id = $1 LIMIT 1;`,
      [observationId]
    );
    if (res.rows.length === 0) return null;
    return this.mapSafetyObservationRow(res.rows[0]);
  }

  // -------------------------------------------------------------
  // SNAPSHOTS
  // -------------------------------------------------------------

  public async recordSafetySnapshot(
    snap: SystemSafetySnapshot,
    executor?: PostgresQueryClient
  ): Promise<SystemSafetySnapshot> {
    const q = executor ?? this.client;
    const sql = `
      INSERT INTO system_safety_snapshots (
        safety_snapshot_id,
        observations,
        market_data_state,
        database_state,
        event_system_state,
        runtime_state,
        provider_states,
        execution_state,
        reconciliation_state,
        accounting_state,
        governance_state,
        created_at,
        as_of,
        expires_at,
        input_digest
      ) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (safety_snapshot_id) DO NOTHING
      RETURNING *;
    `;

    const res = await q.query<SafetySnapshotRow>(sql, [
      snap.safetySnapshotId,
      JSON.stringify(snap.observations),
      snap.marketDataState,
      snap.databaseState,
      snap.eventSystemState,
      snap.runtimeState,
      JSON.stringify(snap.providerStates),
      snap.executionState,
      snap.reconciliationState,
      snap.accountingState,
      snap.governanceState,
      snap.createdAt,
      snap.asOf,
      snap.expiresAt,
      snap.inputDigest,
    ]);

    if (res.rows.length === 0) {
      const existing = await this.getSafetySnapshot(snap.safetySnapshotId, q);
      if (existing) {
        if (existing.inputDigest !== snap.inputDigest) {
          throw new SafetyIdempotencyConflictError(
            `Idempotency conflict for safety snapshot ${snap.safetySnapshotId}`
          );
        }
        return existing;
      }
    }

    return this.mapSafetySnapshotRow(res.rows[0]);
  }

  public async getSafetySnapshot(
    snapshotId: string,
    executor?: PostgresQueryClient
  ): Promise<SystemSafetySnapshot | null> {
    const q = executor ?? this.client;
    const res = await q.query<SafetySnapshotRow>(
      `SELECT * FROM system_safety_snapshots WHERE safety_snapshot_id = $1 LIMIT 1;`,
      [snapshotId]
    );
    if (res.rows.length === 0) return null;
    return this.mapSafetySnapshotRow(res.rows[0]);
  }

  // -------------------------------------------------------------
  // ASSESSMENTS & TRANSACTIONAL OUTBOX
  // -------------------------------------------------------------

  public async recordSafetyAssessmentTransaction(
    assessment: SystemSafetyAssessment
  ): Promise<{ assessment: SystemSafetyAssessment; outboxEventId: string }> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      // 1. Insert assessment
      const sql = `
        INSERT INTO system_safety_assessments (
          assessment_id,
          safety_snapshot_id,
          policy_id,
          policy_revision,
          state,
          severity,
          scope,
          scope_id,
          reason_codes,
          active_kill_levels,
          required_actions,
          created_at,
          as_of,
          expires_at,
          input_digest
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, $15)
        ON CONFLICT (assessment_id) DO NOTHING
        RETURNING *;
      `;

      const res = await tx.query<SafetyAssessmentRow>(sql, [
        assessment.assessmentId,
        assessment.safetySnapshotId,
        assessment.policyId,
        assessment.policyRevision,
        assessment.state,
        assessment.severity,
        assessment.scope,
        assessment.scopeId ?? null,
        JSON.stringify(assessment.reasonCodes),
        JSON.stringify(assessment.activeKillLevels),
        JSON.stringify(assessment.requiredActions),
        assessment.createdAt,
        assessment.asOf,
        assessment.expiresAt,
        assessment.inputDigest,
      ]);

      let persistedAssessment: SystemSafetyAssessment;
      if (res.rows.length === 0) {
        const existing = await this.getSafetyAssessment(assessment.assessmentId, tx);
        if (existing) {
          if (existing.inputDigest !== assessment.inputDigest) {
            throw new SafetyIdempotencyConflictError(
              `Idempotency conflict for assessment ${assessment.assessmentId}`
            );
          }
          persistedAssessment = existing;
        } else {
          throw new Error(`Failed to insert or find assessment ${assessment.assessmentId}`);
        }
      } else {
        persistedAssessment = this.mapSafetyAssessmentRow(res.rows[0]);
      }

      // 2. Outbox Event
      const eventType =
        persistedAssessment.state === 'EMERGENCY'
          ? 'SystemSafetyEmergency'
          : persistedAssessment.state === 'DEGRADED' || persistedAssessment.state === 'CONTAINED'
          ? 'SystemSafetyDegraded'
          : 'SystemSafetyObserved';

      const outboxId = `evt_safe_ass_${persistedAssessment.assessmentId}`;
      const outboxSql = `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (outbox_id) DO NOTHING;
      `;

      await tx.query(outboxSql, [
        outboxId,
        persistedAssessment.assessmentId,
        1,
        eventType,
        persistedAssessment.assessmentId,
        JSON.stringify(persistedAssessment),
        new Date().toISOString(),
      ]);

      return { assessment: persistedAssessment, outboxEventId: outboxId };
    });
  }

  public async getSafetyAssessment(
    assessmentId: string,
    executor?: PostgresQueryClient
  ): Promise<SystemSafetyAssessment | null> {
    const q = executor ?? this.client;
    const res = await q.query<SafetyAssessmentRow>(
      `SELECT * FROM system_safety_assessments WHERE assessment_id = $1 LIMIT 1;`,
      [assessmentId]
    );
    if (res.rows.length === 0) return null;
    return this.mapSafetyAssessmentRow(res.rows[0]);
  }

  // -------------------------------------------------------------
  // KILL SWITCH REQUESTS
  // -------------------------------------------------------------

  public async recordKillSwitchRequestTransaction(
    req: KillSwitchRequest
  ): Promise<{ request: KillSwitchRequest; outboxEventId: string }> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      // Check if an active request already exists for this scope & level
      const activeRes = await tx.query<KillSwitchRequestRow>(
        `
        SELECT * FROM kill_switch_requests
        WHERE scope = $1
          AND COALESCE(scope_id, '__GLOBAL__') = $2
          AND level = $3
          AND status IN ('REQUESTED', 'ACTIVATING', 'ACTIVE')
        LIMIT 1;
        `,
        [req.scope, req.scopeId ?? '__GLOBAL__', req.level]
      );

      if (activeRes.rows.length > 0) {
        const existing = this.mapKillSwitchRequestRow(activeRes.rows[0]);
        return { request: existing, outboxEventId: `evt_kill_req_${existing.killSwitchRequestId}` };
      }

      const sql = `
        INSERT INTO kill_switch_requests (
          kill_switch_request_id,
          assessment_id,
          scope,
          scope_id,
          level,
          severity,
          reason_codes,
          active_reasons,
          requested_at,
          expires_at,
          status,
          is_latched,
          input_digest,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (scope, (COALESCE(scope_id, '__GLOBAL__')), level)
        WHERE status IN ('REQUESTED', 'ACTIVATING', 'ACTIVE')
        DO NOTHING
        RETURNING *;
      `;

      const res = await tx.query<KillSwitchRequestRow>(sql, [
        req.killSwitchRequestId,
        req.assessmentId,
        req.scope,
        req.scopeId ?? null,
        req.level,
        req.severity,
        JSON.stringify(req.reasonCodes),
        JSON.stringify(req.activeReasons),
        req.requestedAt,
        req.expiresAt ?? null,
        req.status,
        req.isLatched,
        req.inputDigest,
      ]);

      let persistedReq: KillSwitchRequest;
      if (res.rows.length === 0) {
        const activeRes2 = await tx.query<KillSwitchRequestRow>(
          `
          SELECT * FROM kill_switch_requests
          WHERE scope = $1
            AND COALESCE(scope_id, '__GLOBAL__') = $2
            AND level = $3
            AND status IN ('REQUESTED', 'ACTIVATING', 'ACTIVE')
          LIMIT 1;
          `,
          [req.scope, req.scopeId ?? '__GLOBAL__', req.level]
        );
        if (activeRes2.rows.length > 0) {
          persistedReq = this.mapKillSwitchRequestRow(activeRes2.rows[0]);
        } else {
          const existing = await this.getKillSwitchRequest(req.killSwitchRequestId, tx);
          if (!existing) throw new Error(`Failed to insert or find kill switch request ${req.killSwitchRequestId}`);
          persistedReq = existing;
        }
      } else {
        persistedReq = this.mapKillSwitchRequestRow(res.rows[0]);
      }

      const outboxId = `evt_kill_req_${persistedReq.killSwitchRequestId}`;
      const outboxSql = `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (outbox_id) DO NOTHING;
      `;

      await tx.query(outboxSql, [
        outboxId,
        persistedReq.killSwitchRequestId,
        1,
        'KillSwitchRequested',
        persistedReq.assessmentId,
        JSON.stringify(persistedReq),
        new Date().toISOString(),
      ]);

      return { request: persistedReq, outboxEventId: outboxId };
    });
  }

  public async updateKillSwitchStatusTransaction(
    requestId: string,
    status: KillSwitchState,
    activeReasons?: string[]
  ): Promise<KillSwitchRequest> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      let updateSql = `UPDATE kill_switch_requests SET status = $1`;
      const params: any[] = [status];
      let pIndex = 2;

      if (activeReasons !== undefined) {
        updateSql += `, active_reasons = $${pIndex++}::jsonb`;
        params.push(JSON.stringify(activeReasons));
      }

      updateSql += ` WHERE kill_switch_request_id = $${pIndex} RETURNING *;`;
      params.push(requestId);

      const res = await tx.query<KillSwitchRequestRow>(updateSql, params);
      if (res.rows.length === 0) {
        throw new Error(`Kill switch request ${requestId} not found for status update`);
      }

      const updated = this.mapKillSwitchRequestRow(res.rows[0]);
      const eventType = status === 'ACTIVE' ? 'KillSwitchActivated' : status === 'RELEASED' ? 'KillSwitchReleased' : 'KillSwitchStateUpdated';

      const outboxId = `evt_kill_status_${requestId}_${status}_${Date.now()}`;
      const outboxSql = `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (outbox_id) DO NOTHING;
      `;

      await tx.query(outboxSql, [
        outboxId,
        updated.killSwitchRequestId,
        Date.now(),
        eventType,
        updated.assessmentId,
        JSON.stringify(updated),
        new Date().toISOString(),
      ]);

      return updated;
    });
  }

  public async getKillSwitchRequest(
    requestId: string,
    executor?: PostgresQueryClient
  ): Promise<KillSwitchRequest | null> {
    const q = executor ?? this.client;
    const res = await q.query<KillSwitchRequestRow>(
      `SELECT * FROM kill_switch_requests WHERE kill_switch_request_id = $1 LIMIT 1;`,
      [requestId]
    );
    if (res.rows.length === 0) return null;
    return this.mapKillSwitchRequestRow(res.rows[0]);
  }

  public async getActiveKillSwitchRequest(
    scope: SafetyScope,
    scopeId?: string,
    executor?: PostgresQueryClient
  ): Promise<KillSwitchRequest | null> {
    const q = executor ?? this.client;
    const res = await q.query<KillSwitchRequestRow>(
      `
      SELECT * FROM kill_switch_requests
      WHERE scope = $1
        AND COALESCE(scope_id, '__GLOBAL__') = $2
        AND status IN ('REQUESTED', 'ACTIVATING', 'ACTIVE')
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [scope, scopeId ?? '__GLOBAL__']
    );
    if (res.rows.length === 0) return null;
    return this.mapKillSwitchRequestRow(res.rows[0]);
  }

  // -------------------------------------------------------------
  // RECOVERY PLANS
  // -------------------------------------------------------------

  public async recordRecoveryPlanTransaction(
    plan: SystemRecoveryPlan
  ): Promise<{ plan: SystemRecoveryPlan; outboxEventId: string }> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      // Check if an active recovery plan already exists for this scope
      const activeRes = await tx.query<RecoveryPlanRow>(
        `
        SELECT * FROM system_recovery_plans
        WHERE scope = $1
          AND COALESCE(scope_id, '__GLOBAL__') = $2
          AND status IN ('PENDING', 'IN_PROGRESS')
        LIMIT 1;
        `,
        [plan.scope, plan.scopeId ?? '__GLOBAL__']
      );

      if (activeRes.rows.length > 0) {
        const existing = this.mapRecoveryPlanRow(activeRes.rows[0]);
        return { plan: existing, outboxEventId: `evt_rec_plan_${existing.recoveryPlanId}` };
      }

      const sql = `
        INSERT INTO system_recovery_plans (
          recovery_plan_id,
          trigger_assessment_id,
          kill_switch_request_id,
          scope,
          scope_id,
          steps,
          dependencies,
          policy_id,
          policy_revision,
          status,
          lease_token,
          created_at,
          completed_at,
          input_digest
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (scope, (COALESCE(scope_id, '__GLOBAL__')))
        WHERE status IN ('PENDING', 'IN_PROGRESS')
        DO NOTHING
        RETURNING *;
      `;

      const res = await tx.query<RecoveryPlanRow>(sql, [
        plan.recoveryPlanId,
        plan.triggerAssessmentId,
        plan.killSwitchRequestId ?? null,
        plan.scope,
        plan.scopeId ?? null,
        JSON.stringify(plan.steps),
        JSON.stringify(plan.dependencies),
        plan.policyId,
        plan.policyRevision,
        plan.status,
        plan.leaseToken ? plan.leaseToken.toString() : null,
        plan.createdAt,
        plan.completedAt ?? null,
        plan.inputDigest,
      ]);

      let persistedPlan: SystemRecoveryPlan;
      if (res.rows.length === 0) {
        const activeRes2 = await tx.query<RecoveryPlanRow>(
          `
          SELECT * FROM system_recovery_plans
          WHERE scope = $1
            AND COALESCE(scope_id, '__GLOBAL__') = $2
            AND status IN ('PENDING', 'IN_PROGRESS')
          LIMIT 1;
          `,
          [plan.scope, plan.scopeId ?? '__GLOBAL__']
        );
        if (activeRes2.rows.length > 0) {
          persistedPlan = this.mapRecoveryPlanRow(activeRes2.rows[0]);
        } else {
          const existing = await this.getRecoveryPlan(plan.recoveryPlanId, tx);
          if (!existing) throw new Error(`Failed to insert or find recovery plan ${plan.recoveryPlanId}`);
          persistedPlan = existing;
        }
      } else {
        persistedPlan = this.mapRecoveryPlanRow(res.rows[0]);
      }

      const outboxId = `evt_rec_plan_${persistedPlan.recoveryPlanId}`;
      const outboxSql = `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (outbox_id) DO NOTHING;
      `;

      await tx.query(outboxSql, [
        outboxId,
        persistedPlan.recoveryPlanId,
        1,
        'RecoveryStarted',
        persistedPlan.triggerAssessmentId,
        JSON.stringify(persistedPlan),
        new Date().toISOString(),
      ]);

      return { plan: persistedPlan, outboxEventId: outboxId };
    });
  }

  public async updateRecoveryStepTransaction(
    planId: string,
    stepId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
    resultRef?: string,
    incomingLeaseToken?: number
  ): Promise<SystemRecoveryPlan> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      const plan = await this.getRecoveryPlan(planId, tx);
      if (!plan) throw new Error(`Recovery plan ${planId} not found`);

      // Fencing check
      if (incomingLeaseToken !== undefined && plan.leaseToken !== undefined) {
        if (incomingLeaseToken < plan.leaseToken) {
          throw new RecoveryFencingTokenError(
            `Incoming lease token ${incomingLeaseToken} is older than active lease token ${plan.leaseToken}`
          );
        }
      }

      const step = plan.steps.find((s: RecoveryStep) => s.stepId === stepId);
      if (!step) throw new Error(`Step ${stepId} not found in plan ${planId}`);

      step.status = status;
      if (resultRef) step.resultRef = resultRef;
      if (status === 'COMPLETED') step.completedAt = new Date().toISOString();

      // Check if all steps completed
      const allCompleted = plan.steps.every((s: RecoveryStep) => s.status === 'COMPLETED');
      const planStatus = allCompleted ? 'COMPLETED' : 'IN_PROGRESS';
      const completedAt = allCompleted ? new Date().toISOString() : undefined;

      const updateSql = `
        UPDATE system_recovery_plans
        SET steps = $1::jsonb,
            status = $2,
            completed_at = $3,
            lease_token = $4
        WHERE recovery_plan_id = $5
        RETURNING *;
      `;

      const res = await tx.query<RecoveryPlanRow>(updateSql, [
        JSON.stringify(plan.steps),
        planStatus,
        completedAt ?? null,
        incomingLeaseToken ? incomingLeaseToken.toString() : plan.leaseToken ? plan.leaseToken.toString() : null,
        planId,
      ]);

      const updatedPlan = this.mapRecoveryPlanRow(res.rows[0]);

      // Outbox Event
      const eventType = status === 'COMPLETED' ? 'RecoveryStepCompleted' : 'RecoveryStepFailed';
      const outboxId = `evt_rec_step_${planId}_${stepId}_${status}_${Date.now()}`;
      const outboxSql = `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (outbox_id) DO NOTHING;
      `;

      await tx.query(outboxSql, [
        outboxId,
        planId,
        Date.now(),
        eventType,
        plan.triggerAssessmentId,
        JSON.stringify({ planId, stepId, status, resultRef }),
        new Date().toISOString(),
      ]);

      return updatedPlan;
    });
  }

  public async getRecoveryPlan(
    planId: string,
    executor?: PostgresQueryClient
  ): Promise<SystemRecoveryPlan | null> {
    const q = executor ?? this.client;
    const res = await q.query<RecoveryPlanRow>(
      `SELECT * FROM system_recovery_plans WHERE recovery_plan_id = $1 LIMIT 1;`,
      [planId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRecoveryPlanRow(res.rows[0]);
  }

  public async getActiveRecoveryPlan(
    scope: SafetyScope,
    scopeId?: string,
    executor?: PostgresQueryClient
  ): Promise<SystemRecoveryPlan | null> {
    const q = executor ?? this.client;
    const res = await q.query<RecoveryPlanRow>(
      `
      SELECT * FROM system_recovery_plans
      WHERE scope = $1
        AND COALESCE(scope_id, '__GLOBAL__') = $2
        AND status IN ('PENDING', 'IN_PROGRESS')
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [scope, scopeId ?? '__GLOBAL__']
    );
    if (res.rows.length === 0) return null;
    return this.mapRecoveryPlanRow(res.rows[0]);
  }

  // -------------------------------------------------------------
  // RESUME ELIGIBILITY
  // -------------------------------------------------------------

  public async recordResumeEligibilityTransaction(
    elig: ResumeEligibility
  ): Promise<{ eligibility: ResumeEligibility; outboxEventId?: string }> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      const sql = `
        INSERT INTO resume_eligibilities (
          resume_eligibility_id,
          recovery_plan_id,
          eligible,
          scope,
          scope_id,
          validated_prerequisites,
          failed_prerequisites,
          evaluated_at,
          expires_at,
          requires_human_review,
          input_digest
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
        ON CONFLICT (resume_eligibility_id) DO NOTHING
        RETURNING *;
      `;

      const res = await tx.query<ResumeEligibilityRow>(sql, [
        elig.resumeEligibilityId,
        elig.recoveryPlanId,
        elig.eligible,
        elig.scope,
        elig.scopeId ?? null,
        JSON.stringify(elig.validatedPrerequisites),
        JSON.stringify(elig.failedPrerequisites),
        elig.evaluatedAt,
        elig.expiresAt,
        elig.requiresHumanReview,
        elig.inputDigest,
      ]);

      let persistedElig: ResumeEligibility;
      if (res.rows.length === 0) {
        const existing = await this.getResumeEligibility(elig.resumeEligibilityId, tx);
        if (!existing) throw new Error(`Failed to insert or find resume eligibility ${elig.resumeEligibilityId}`);
        persistedElig = existing;
      } else {
        persistedElig = this.mapResumeEligibilityRow(res.rows[0]);
      }

      let outboxEventId: string | undefined;
      if (persistedElig.eligible) {
        outboxEventId = `evt_res_elig_${persistedElig.resumeEligibilityId}`;
        const outboxSql = `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        ON CONFLICT (outbox_id) DO NOTHING;
      `;

      await tx.query(outboxSql, [
        outboxEventId,
        persistedElig.resumeEligibilityId,
        1,
        'SystemSafeToResume',
        persistedElig.recoveryPlanId,
        JSON.stringify(persistedElig),
        new Date().toISOString(),
      ]);
      }

      return { eligibility: persistedElig, outboxEventId };
    });
  }

  public async getResumeEligibility(
    eligibilityId: string,
    executor?: PostgresQueryClient
  ): Promise<ResumeEligibility | null> {
    const q = executor ?? this.client;
    const res = await q.query<ResumeEligibilityRow>(
      `SELECT * FROM resume_eligibilities WHERE resume_eligibility_id = $1 LIMIT 1;`,
      [eligibilityId]
    );
    if (res.rows.length === 0) return null;
    return this.mapResumeEligibilityRow(res.rows[0]);
  }

  // -------------------------------------------------------------
  // ROW MAPPERS
  // -------------------------------------------------------------

  private mapSafetyObservationRow(row: SafetyObservationRow): SystemSafetyObservation {
    return {
      observationId: row.observation_id,
      domain: row.domain,
      component: row.component,
      scope: row.scope,
      scopeId: row.scope_id ?? undefined,
      status: row.status,
      severity: row.severity,
      observedAt: new Date(row.observed_at).toISOString(),
      asOf: new Date(row.as_of).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      reasonCodes: typeof row.reason_codes === 'string' ? JSON.parse(row.reason_codes) : row.reason_codes,
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
      sourceRef: row.source_ref,
      correlationId: row.correlation_id ?? undefined,
      causationId: row.causation_id ?? undefined,
      inputDigest: row.input_digest,
    };
  }

  private mapSafetySnapshotRow(row: SafetySnapshotRow): SystemSafetySnapshot {
    return {
      safetySnapshotId: row.safety_snapshot_id,
      observations: typeof row.observations === 'string' ? JSON.parse(row.observations) : row.observations,
      marketDataState: row.market_data_state,
      databaseState: row.database_state,
      eventSystemState: row.event_system_state,
      runtimeState: row.runtime_state,
      providerStates: typeof row.provider_states === 'string' ? JSON.parse(row.provider_states) : row.provider_states,
      executionState: row.execution_state,
      reconciliationState: row.reconciliation_state,
      accountingState: row.accounting_state,
      governanceState: row.governance_state,
      createdAt: new Date(row.created_at).toISOString(),
      asOf: new Date(row.as_of).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      inputDigest: row.input_digest,
    };
  }

  private mapSafetyAssessmentRow(row: SafetyAssessmentRow): SystemSafetyAssessment {
    return {
      assessmentId: row.assessment_id,
      safetySnapshotId: row.safety_snapshot_id,
      policyId: row.policy_id,
      policyRevision: row.policy_revision,
      state: row.state,
      severity: row.severity,
      scope: row.scope,
      scopeId: row.scope_id ?? undefined,
      reasonCodes: typeof row.reason_codes === 'string' ? JSON.parse(row.reason_codes) : row.reason_codes,
      activeKillLevels: typeof row.active_kill_levels === 'string' ? JSON.parse(row.active_kill_levels) : row.active_kill_levels,
      requiredActions: typeof row.required_actions === 'string' ? JSON.parse(row.required_actions) : row.required_actions,
      createdAt: new Date(row.created_at).toISOString(),
      asOf: new Date(row.as_of).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      inputDigest: row.input_digest,
    };
  }

  private mapKillSwitchRequestRow(row: KillSwitchRequestRow): KillSwitchRequest {
    return {
      killSwitchRequestId: row.kill_switch_request_id,
      assessmentId: row.assessment_id,
      scope: row.scope,
      scopeId: row.scope_id ?? undefined,
      level: row.level,
      severity: row.severity,
      reasonCodes: typeof row.reason_codes === 'string' ? JSON.parse(row.reason_codes) : row.reason_codes,
      activeReasons: typeof row.active_reasons === 'string' ? JSON.parse(row.active_reasons) : row.active_reasons,
      requestedAt: new Date(row.requested_at).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      status: row.status,
      isLatched: row.is_latched,
      inputDigest: row.input_digest,
    };
  }

  private mapRecoveryPlanRow(row: RecoveryPlanRow): SystemRecoveryPlan {
    return {
      recoveryPlanId: row.recovery_plan_id,
      triggerAssessmentId: row.trigger_assessment_id,
      killSwitchRequestId: row.kill_switch_request_id ?? undefined,
      scope: row.scope,
      scopeId: row.scope_id ?? undefined,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      dependencies: typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : row.dependencies,
      policyId: row.policy_id,
      policyRevision: row.policy_revision,
      status: row.status,
      leaseToken: row.lease_token ? parseInt(row.lease_token, 10) : undefined,
      createdAt: new Date(row.created_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
      inputDigest: row.input_digest,
    };
  }

  private mapResumeEligibilityRow(row: ResumeEligibilityRow): ResumeEligibility {
    return {
      resumeEligibilityId: row.resume_eligibility_id,
      recoveryPlanId: row.recovery_plan_id,
      eligible: row.eligible,
      scope: row.scope,
      scopeId: row.scope_id ?? undefined,
      validatedPrerequisites: typeof row.validated_prerequisites === 'string' ? JSON.parse(row.validated_prerequisites) : row.validated_prerequisites,
      failedPrerequisites: typeof row.failed_prerequisites === 'string' ? JSON.parse(row.failed_prerequisites) : row.failed_prerequisites,
      evaluatedAt: new Date(row.evaluated_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      requiresHumanReview: row.requires_human_review,
      inputDigest: row.input_digest,
    };
  }
}
