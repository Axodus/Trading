/**
 * AXODUS-TRADING-EPIC-01 / REQ-12
 * PostgreSQL Strategy Operational Governance Repository
 */

import type {
  StrategyGovernanceSnapshot,
  StrategyGovernanceDecision,
  StrategyInterventionPlan,
  StrategyInterventionRequest,
  AuthorityResponse,
  StrategyInterventionResolution,
} from '../../../../../packages/trading-contracts/src/index.js';
import type {
  PostgresQueryClient,
  TransactionalPostgresQueryClient,
  PostgresTransactionClient,
} from '../../repositories/postgres/PostgresClient.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import { GovernanceIdempotencyConflictError } from './StrategyOperationalGovernanceErrors.js';

interface GovernanceSnapshotRow {
  governance_snapshot_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  lifecycle_state: any;
  lifecycle_version: string;
  health_state: any;
  health_version: string;
  operational_snapshot_id: string;
  drift_assessment_id: string | null;
  drift_classification: any | null;
  revalidation_request_id: string | null;
  revalidation_outcome_ref: string | null;
  revalidation_status: any | null;
  promotion_eligibility_ref: string | null;
  portfolio_context_ref: string | null;
  risk_context_ref: string | null;
  created_at: string;
  as_of: string;
  expires_at: string;
  input_digest: string;
}

interface GovernanceDecisionRow {
  governance_decision_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  governance_snapshot_id: string;
  policy_id: string;
  policy_revision: string;
  classification: any;
  reason_codes: any;
  required_interventions: any;
  created_at: string;
  as_of: string;
  expires_at: string;
  input_digest: string;
}

interface InterventionPlanRow {
  plan_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  governance_decision_id: string;
  dependencies: any;
  status: any;
  created_at: string;
  resolved_at: string | null;
  input_digest: string;
}

interface InterventionRequestRow {
  intervention_request_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  governance_decision_id: string;
  plan_id: string | null;
  target_authority: any;
  intervention_type: any;
  severity: any;
  reason_codes: any;
  evidence_refs: any;
  requested_at: string;
  expires_at: string | null;
  status: any;
  authority_response_ref: string | null;
  input_digest: string;
}

interface InterventionResolutionRow {
  resolution_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  governance_decision_id: string;
  plan_id: string | null;
  status: any;
  resolved_interventions: any;
  pending_interventions: any;
  rejected_interventions: any;
  reasons: any;
  resolved_at: string;
  input_digest: string;
}

export class PostgresStrategyOperationalGovernanceRepository {
  constructor(private readonly client: TransactionalPostgresQueryClient) {}

  public async recordGovernanceSnapshot(
    snapshot: StrategyGovernanceSnapshot,
    overrideClient?: PostgresQueryClient
  ): Promise<StrategyGovernanceSnapshot> {
    const executor = overrideClient ?? this.client;
    const sql = `
      INSERT INTO strategy_governance_snapshots (
        governance_snapshot_id,
        strategy_id,
        strategy_revision_id,
        lifecycle_state,
        lifecycle_version,
        health_state,
        health_version,
        operational_snapshot_id,
        drift_assessment_id,
        drift_classification,
        revalidation_request_id,
        revalidation_outcome_ref,
        revalidation_status,
        promotion_eligibility_ref,
        portfolio_context_ref,
        risk_context_ref,
        created_at,
        as_of,
        expires_at,
        input_digest
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (governance_snapshot_id) DO NOTHING
      RETURNING *;
    `;

    const params = [
      snapshot.governanceSnapshotId,
      snapshot.strategyId,
      snapshot.strategyRevisionId,
      snapshot.lifecycleState,
      snapshot.lifecycleVersion,
      snapshot.healthState,
      snapshot.healthVersion,
      snapshot.operationalSnapshotId,
      snapshot.driftAssessmentId ?? null,
      snapshot.driftClassification ?? null,
      snapshot.revalidationRequestId ?? null,
      snapshot.revalidationOutcomeRef ?? null,
      snapshot.revalidationStatus ?? null,
      snapshot.promotionEligibilityRef ?? null,
      snapshot.portfolioContextRef ?? null,
      snapshot.riskContextRef ?? null,
      snapshot.createdAt,
      snapshot.asOf,
      snapshot.expiresAt,
      snapshot.inputDigest,
    ];

    await executor.query(sql, params);
    return snapshot;
  }

  public async getGovernanceSnapshot(
    governanceSnapshotId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<StrategyGovernanceSnapshot | null> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<GovernanceSnapshotRow>(
      'SELECT * FROM strategy_governance_snapshots WHERE governance_snapshot_id = $1;',
      [governanceSnapshotId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      governanceSnapshotId: r.governance_snapshot_id,
      strategyId: r.strategy_id,
      strategyRevisionId: r.strategy_revision_id,
      lifecycleState: r.lifecycle_state,
      lifecycleVersion: Number(r.lifecycle_version),
      healthState: r.health_state,
      healthVersion: Number(r.health_version),
      operationalSnapshotId: r.operational_snapshot_id,
      driftAssessmentId: r.drift_assessment_id ?? undefined,
      driftClassification: r.drift_classification ?? undefined,
      revalidationRequestId: r.revalidation_request_id ?? undefined,
      revalidationOutcomeRef: r.revalidation_outcome_ref ?? undefined,
      revalidationStatus: r.revalidation_status ?? undefined,
      promotionEligibilityRef: r.promotion_eligibility_ref ?? undefined,
      portfolioContextRef: r.portfolio_context_ref ?? undefined,
      riskContextRef: r.risk_context_ref ?? undefined,
      createdAt: new Date(r.created_at).toISOString(),
      asOf: new Date(r.as_of).toISOString(),
      expiresAt: new Date(r.expires_at).toISOString(),
      inputDigest: r.input_digest,
    };
  }

  public async recordGovernanceDecisionTransaction(
    decision: StrategyGovernanceDecision,
    plan?: StrategyInterventionPlan
  ): Promise<StrategyGovernanceDecision> {
    try {
      return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      // 1. Check existing decision for idempotency & conflict
      const existing = await tx.query<{ governance_decision_id: string; input_digest: string }>(
        'SELECT governance_decision_id, input_digest FROM strategy_governance_decisions WHERE governance_decision_id = $1;',
        [decision.governanceDecisionId]
      );
      if (existing.rows.length > 0) {
        if (existing.rows[0].input_digest === decision.inputDigest) {
          return decision; // Idempotent return
        }
        throw new GovernanceIdempotencyConflictError(
          `Decision ${decision.governanceDecisionId} exists with differing digest`
        );
      }

      // 2. Insert decision
      await tx.query(
        `
        INSERT INTO strategy_governance_decisions (
          governance_decision_id,
          strategy_id,
          strategy_revision_id,
          governance_snapshot_id,
          policy_id,
          policy_revision,
          classification,
          reason_codes,
          required_interventions,
          created_at,
          as_of,
          expires_at,
          input_digest
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
        `,
        [
          decision.governanceDecisionId,
          decision.strategyId,
          decision.strategyRevisionId,
          decision.governanceSnapshotId,
          decision.policyId,
          decision.policyRevision,
          decision.classification,
          JSON.stringify(decision.reasonCodes),
          JSON.stringify(decision.requiredInterventions),
          decision.createdAt,
          decision.asOf,
          decision.expiresAt,
          decision.inputDigest,
        ]
      );

      // 3. Insert plan if present
      if (plan) {
        await tx.query(
          `
          INSERT INTO strategy_intervention_plans (
            plan_id,
            strategy_id,
            strategy_revision_id,
            governance_decision_id,
            dependencies,
            status,
            created_at,
            resolved_at,
            input_digest
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (plan_id) DO NOTHING;
          `,
          [
            plan.planId,
            plan.strategyId,
            plan.strategyRevisionId,
            plan.governanceDecisionId,
            JSON.stringify(plan.dependencies),
            plan.status,
            plan.createdAt,
            plan.resolvedAt ?? null,
            plan.inputDigest,
          ]
        );

        // 4. Insert individual requests
        for (const req of plan.requests) {
          await this.insertInterventionRequestInternal(req, tx);
        }
      }

      // 5. Emit Outbox event
      const eventSql = `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING;
      `;
      const eventPayload = {
        governanceDecisionId: decision.governanceDecisionId,
        strategyId: decision.strategyId,
        strategyRevisionId: decision.strategyRevisionId,
        classification: decision.classification,
        requiredInterventions: decision.requiredInterventions,
        planId: plan?.planId ?? null,
      };
      await tx.query(eventSql, [
        `evt_gov_dec_${decision.governanceDecisionId}`,
        decision.strategyId,
        1,
        'StrategyGovernanceEvaluated',
        decision.governanceDecisionId,
        JSON.stringify(eventPayload),
        decision.createdAt,
      ]);

      if (plan) {
        for (const req of plan.requests) {
          await tx.query(eventSql, [
            "evt_gov_req_" + req.interventionRequestId,
            req.strategyId,
            1,
            'StrategyInterventionRequested',
            req.governanceDecisionId,
            JSON.stringify(req),
            req.requestedAt,
          ]);
        }
      }

      return decision;
      });
    } catch (error: any) {
      if (error?.cause instanceof GovernanceIdempotencyConflictError) throw error.cause;
      throw error;
    }
  }

  public async recordInterventionRequestTransaction(
    request: StrategyInterventionRequest
  ): Promise<StrategyInterventionRequest> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      const recorded = await this.insertInterventionRequestInternal(request, tx);

      // Outbox event
      const eventSql = `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING;
      `;
      await tx.query(eventSql, [
        `evt_gov_req_${recorded.interventionRequestId}`,
        recorded.strategyId,
        1,
        'StrategyInterventionRequested',
        recorded.governanceDecisionId,
        JSON.stringify(recorded),
        recorded.requestedAt,
      ]);

      return recorded;
    });
  }

  private async insertInterventionRequestInternal(
    req: StrategyInterventionRequest,
    client: PostgresQueryClient
  ): Promise<StrategyInterventionRequest> {
    // Check if active duplicate already exists for concurrency safety
    const checkSql = `
      SELECT * FROM strategy_intervention_requests
      WHERE strategy_id = $1
        AND strategy_revision_id = $2
        AND target_authority = $3
        AND intervention_type = $4
        AND status IN ('REQUESTED', 'ACKNOWLEDGED', 'IN_PROGRESS')
      LIMIT 1;
    `;
    const existing = await client.query<InterventionRequestRow>(checkSql, [
      req.strategyId,
      req.strategyRevisionId,
      req.targetAuthority,
      req.interventionType,
    ]);
    if (existing.rows.length > 0) {
      const r = existing.rows[0];
      return {
        interventionRequestId: r.intervention_request_id,
        strategyId: r.strategy_id,
        strategyRevisionId: r.strategy_revision_id,
        governanceDecisionId: r.governance_decision_id,
        planId: r.plan_id ?? undefined,
        targetAuthority: r.target_authority,
        interventionType: r.intervention_type,
        severity: r.severity,
        reasonCodes: r.reason_codes,
        evidenceRefs: r.evidence_refs,
        requestedAt: new Date(r.requested_at).toISOString(),
        expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : undefined,
        status: r.status,
        authorityResponseRef: r.authority_response_ref ?? undefined,
        inputDigest: r.input_digest,
      };
    }

    const insertSql = `
      INSERT INTO strategy_intervention_requests (
        intervention_request_id,
        strategy_id,
        strategy_revision_id,
        governance_decision_id,
        plan_id,
        target_authority,
        intervention_type,
        severity,
        reason_codes,
        evidence_refs,
        requested_at,
        expires_at,
        status,
        authority_response_ref,
        input_digest
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (strategy_id, strategy_revision_id, target_authority, intervention_type)
      WHERE status IN ('REQUESTED', 'ACKNOWLEDGED', 'IN_PROGRESS')
      DO NOTHING
      RETURNING *;
    `;

    const res = await client.query(insertSql, [
      req.interventionRequestId,
      req.strategyId,
      req.strategyRevisionId,
      req.governanceDecisionId,
      req.planId ?? null,
      req.targetAuthority,
      req.interventionType,
      req.severity,
      JSON.stringify(req.reasonCodes),
      JSON.stringify(req.evidenceRefs),
      req.requestedAt,
      req.expiresAt ?? null,
      req.status,
      req.authorityResponseRef ?? null,
      req.inputDigest,
    ]);

    if (res.rows.length === 0) {
      // Conflict hit by concurrent insert, fetch existing
      const reFetch = await client.query<InterventionRequestRow>(checkSql, [
        req.strategyId,
        req.strategyRevisionId,
        req.targetAuthority,
        req.interventionType,
      ]);
      const r = reFetch.rows[0];
      return {
        interventionRequestId: r.intervention_request_id,
        strategyId: r.strategy_id,
        strategyRevisionId: r.strategy_revision_id,
        governanceDecisionId: r.governance_decision_id,
        planId: r.plan_id ?? undefined,
        targetAuthority: r.target_authority,
        interventionType: r.intervention_type,
        severity: r.severity,
        reasonCodes: r.reason_codes,
        evidenceRefs: r.evidence_refs,
        requestedAt: new Date(r.requested_at).toISOString(),
        expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : undefined,
        status: r.status,
        authorityResponseRef: r.authority_response_ref ?? undefined,
        inputDigest: r.input_digest,
      };
    }

    return req;
  }

  public async recordAuthorityResponseTransaction(
    response: AuthorityResponse
  ): Promise<AuthorityResponse> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      // 1. Insert response
      await tx.query(
        `
        INSERT INTO strategy_intervention_responses (
          response_id,
          intervention_request_id,
          target_authority,
          status,
          canonical_result_ref,
          reason_codes,
          responded_at,
          details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (response_id) DO NOTHING;
        `,
        [
          response.responseId,
          response.interventionRequestId,
          response.targetAuthority,
          response.status,
          response.canonicalResultRef ?? null,
          JSON.stringify(response.reasonCodes ?? []),
          response.respondedAt,
          JSON.stringify(response.details ?? {}),
        ]
      );

      // 2. Update request status
      const requestStatus = response.status === 'ACCEPTED' || response.status === 'APPLIED' ? 'APPLIED' : response.status;
      await tx.query(
        `
        UPDATE strategy_intervention_requests
        SET status = $1, authority_response_ref = $2
        WHERE intervention_request_id = $3;
        `,
        [requestStatus, response.canonicalResultRef ?? response.responseId, response.interventionRequestId]
      );

      // 3. Outbox event
      const eventType = response.status === 'REJECTED' ? 'StrategyInterventionRejected' : 'StrategyInterventionApplied';
      await tx.query(
        `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING;
        `,
        [
          `evt_resp_${response.responseId}`,
          response.interventionRequestId,
          1,
          eventType,
          response.interventionRequestId,
          JSON.stringify(response),
          response.respondedAt,
        ]
      );

      return response;
    });
  }

  public async recordInterventionResolutionTransaction(
    resolution: StrategyInterventionResolution
  ): Promise<StrategyInterventionResolution> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      // 1. Insert resolution
      await tx.query(
        `
        INSERT INTO strategy_intervention_resolutions (
          resolution_id,
          strategy_id,
          strategy_revision_id,
          governance_decision_id,
          plan_id,
          status,
          resolved_interventions,
          pending_interventions,
          rejected_interventions,
          reasons,
          resolved_at,
          input_digest
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (resolution_id) DO NOTHING;
        `,
        [
          resolution.resolutionId,
          resolution.strategyId,
          resolution.strategyRevisionId,
          resolution.governanceDecisionId,
          resolution.planId ?? null,
          resolution.status,
          JSON.stringify(resolution.resolvedInterventions),
          JSON.stringify(resolution.pendingInterventions),
          JSON.stringify(resolution.rejectedInterventions),
          JSON.stringify(resolution.reasons),
          resolution.resolvedAt,
          resolution.inputDigest,
        ]
      );

      // 2. Update plan if linked
      if (resolution.planId) {
        await tx.query(
          `
          UPDATE strategy_intervention_plans
          SET status = $1, resolved_at = $2
          WHERE plan_id = $3;
          `,
          [resolution.status, resolution.resolvedAt, resolution.planId]
        );
      }

      // 3. Outbox event
      await tx.query(
        `
        INSERT INTO trading_execution_outbox (
          outbox_id,
          aggregate_id,
          aggregate_version,
          event_type,
          correlation_id,
          payload,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING;
        `,
        [
          `evt_res_${resolution.resolutionId}`,
          resolution.strategyId,
          1,
          'StrategyInterventionResolved',
          resolution.governanceDecisionId,
          JSON.stringify(resolution),
          resolution.resolvedAt,
        ]
      );

      return resolution;
    });
  }

  public async getGovernanceDecision(
    governanceDecisionId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<StrategyGovernanceDecision | null> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<GovernanceDecisionRow>(
      'SELECT * FROM strategy_governance_decisions WHERE governance_decision_id = $1;',
      [governanceDecisionId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      governanceDecisionId: r.governance_decision_id,
      strategyId: r.strategy_id,
      strategyRevisionId: r.strategy_revision_id,
      governanceSnapshotId: r.governance_snapshot_id,
      policyId: r.policy_id,
      policyRevision: r.policy_revision,
      classification: r.classification,
      reasonCodes: r.reason_codes,
      requiredInterventions: r.required_interventions,
      createdAt: new Date(r.created_at).toISOString(),
      asOf: new Date(r.as_of).toISOString(),
      expiresAt: new Date(r.expires_at).toISOString(),
      inputDigest: r.input_digest,
    };
  }

  public async getInterventionRequest(
    interventionRequestId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<StrategyInterventionRequest | null> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<InterventionRequestRow>(
      'SELECT * FROM strategy_intervention_requests WHERE intervention_request_id = $1;',
      [interventionRequestId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      interventionRequestId: r.intervention_request_id,
      strategyId: r.strategy_id,
      strategyRevisionId: r.strategy_revision_id,
      governanceDecisionId: r.governance_decision_id,
      planId: r.plan_id ?? undefined,
      targetAuthority: r.target_authority,
      interventionType: r.intervention_type,
      severity: r.severity,
      reasonCodes: r.reason_codes,
      evidenceRefs: r.evidence_refs,
      requestedAt: new Date(r.requested_at).toISOString(),
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : undefined,
      status: r.status,
      authorityResponseRef: r.authority_response_ref ?? undefined,
      inputDigest: r.input_digest,
    };
  }

  public async getInterventionPlan(
    planId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<StrategyInterventionPlan | null> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<InterventionPlanRow>(
      'SELECT * FROM strategy_intervention_plans WHERE plan_id = $1;',
      [planId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const reqsRes = await executor.query<InterventionRequestRow>(
      'SELECT * FROM strategy_intervention_requests WHERE plan_id = $1;',
      [planId]
    );
    const requests: StrategyInterventionRequest[] = reqsRes.rows.map((row) => ({
      interventionRequestId: row.intervention_request_id,
      strategyId: row.strategy_id,
      strategyRevisionId: row.strategy_revision_id,
      governanceDecisionId: row.governance_decision_id,
      planId: row.plan_id ?? undefined,
      targetAuthority: row.target_authority,
      interventionType: row.intervention_type,
      severity: row.severity,
      reasonCodes: row.reason_codes,
      evidenceRefs: row.evidence_refs,
      requestedAt: new Date(row.requested_at).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      status: row.status,
      authorityResponseRef: row.authority_response_ref ?? undefined,
      inputDigest: row.input_digest,
    }));

    return {
      planId: r.plan_id,
      strategyId: r.strategy_id,
      strategyRevisionId: r.strategy_revision_id,
      governanceDecisionId: r.governance_decision_id,
      requests,
      dependencies: r.dependencies,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : undefined,
      inputDigest: r.input_digest,
    };
  }

  public async getInterventionResolution(
    resolutionId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<StrategyInterventionResolution | null> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<InterventionResolutionRow>(
      'SELECT * FROM strategy_intervention_resolutions WHERE resolution_id = $1;',
      [resolutionId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      resolutionId: r.resolution_id,
      strategyId: r.strategy_id,
      strategyRevisionId: r.strategy_revision_id,
      governanceDecisionId: r.governance_decision_id,
      planId: r.plan_id ?? undefined,
      status: r.status,
      resolvedInterventions: r.resolved_interventions,
      pendingInterventions: r.pending_interventions,
      rejectedInterventions: r.rejected_interventions,
      reasons: r.reasons,
      resolvedAt: new Date(r.resolved_at).toISOString(),
      inputDigest: r.input_digest,
    };
  }
}
