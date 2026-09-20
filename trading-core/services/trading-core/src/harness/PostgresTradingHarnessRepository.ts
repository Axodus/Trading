/**
 * AXODUS-TRADING-EPIC-01 / REQ-14
 * PostgreSQL Trading Harness Repository
 */

import type {
  TradingHarnessRun,
  HarnessStageTransition,
  HarnessRunEvidencePackage,
  HarnessReadinessReport,
  HarnessRunStatus,
  HarnessStage,
  HarnessEnvironment,
  HarnessMode,
} from '../../../../packages/trading-contracts/src/index.js';
import type {
  PostgresQueryClient,
  TransactionalPostgresQueryClient,
  PostgresTransactionClient,
} from '../repositories/postgres/PostgresClient.js';
import {
  HarnessIdempotencyConflictError,
  HarnessFencingTokenError,
} from './TradingHarnessErrors.js';

interface HarnessRunRow {
  harness_run_id: string;
  environment: string;
  mode: string;
  strategy_id: string;
  strategy_revision_id: string;
  instrument: string;
  venue: string;
  current_stage: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  market_context_ref: string | null;
  opportunity_ref: string | null;
  trade_proposal_ref: string | null;
  portfolio_decision_ref: string | null;
  risk_decision_ref: string | null;
  trading_intent_ref: string | null;
  execution_intent_ref: string | null;
  execution_attempt_ref: string | null;
  canonical_order_ref: string | null;
  execution_result_ref: string | null;
  diagnostics_ref: string | null;
  pnl_attribution_ref: string | null;
  feedback_snapshot_ref: string | null;
  drift_assessment_ref: string | null;
  governance_decision_ref: string | null;
  safety_assessment_ref: string | null;
  recovery_plan_ref: string | null;
  resume_eligibility_ref: string | null;
  correlation_id: string;
  causation_id: string;
  lease_token: string | null;
  failure_reason: string | null;
  input_digest: string;
  created_at: string;
}

interface HarnessTransitionRow {
  transition_id: string;
  harness_run_id: string;
  from_stage: string;
  to_stage: string;
  authority: string;
  artifact_ref: string | null;
  timestamp: string;
  input_digest: string;
  created_at: string;
}

interface HarnessEvidencePackageRow {
  evidence_package_id: string;
  harness_run_id: string;
  strategy_id: string;
  strategy_revision_id: string;
  environment: string;
  timeline: any;
  evidence_refs: any;
  economic_summary: any;
  governance_summary: any;
  safety_summary: any;
  created_at: string;
  input_digest: string;
}

interface HarnessReadinessReportRow {
  report_id: string;
  environment: string;
  overall_status: string;
  dimension_evaluations: any;
  p0_blockers: any;
  p1_findings: any;
  p2_findings: any;
  debt_aud_a03_status: string;
  evaluated_at: string;
  input_digest: string;
  created_at: string;
}

export class PostgresTradingHarnessRepository {
  constructor(private readonly client: TransactionalPostgresQueryClient) {}

  public async createRunTransaction(
    run: TradingHarnessRun
  ): Promise<TradingHarnessRun> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      // 1. Check existing run for idempotency & conflict
      const existing = await tx.query<{ harness_run_id: string; input_digest: string }>(
        'SELECT harness_run_id, input_digest FROM trading_harness_runs WHERE harness_run_id = $1;',
        [run.harnessRunId]
      );
      if (existing.rows.length > 0) {
        if (existing.rows[0].input_digest === run.inputDigest) {
          return run; // Idempotent return
        }
        throw new HarnessIdempotencyConflictError(
          `HarnessRun ${run.harnessRunId} exists with differing input digest`
        );
      }

      // 2. Insert run
      await tx.query(
        `
        INSERT INTO trading_harness_runs (
          harness_run_id,
          environment,
          mode,
          strategy_id,
          strategy_revision_id,
          instrument,
          venue,
          current_stage,
          status,
          started_at,
          completed_at,
          market_context_ref,
          opportunity_ref,
          trade_proposal_ref,
          portfolio_decision_ref,
          risk_decision_ref,
          trading_intent_ref,
          execution_intent_ref,
          execution_attempt_ref,
          canonical_order_ref,
          execution_result_ref,
          diagnostics_ref,
          pnl_attribution_ref,
          feedback_snapshot_ref,
          drift_assessment_ref,
          governance_decision_ref,
          safety_assessment_ref,
          recovery_plan_ref,
          resume_eligibility_ref,
          correlation_id,
          causation_id,
          lease_token,
          failure_reason,
          input_digest
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34
        );
        `,
        [
          run.harnessRunId,
          run.environment,
          run.mode,
          run.strategyId,
          run.strategyRevisionId,
          run.instrument,
          run.venue,
          run.currentStage,
          run.status,
          run.startedAt,
          run.completedAt ?? null,
          run.marketContextRef ?? null,
          run.opportunityRef ?? null,
          run.tradeProposalRef ?? null,
          run.portfolioDecisionRef ?? null,
          run.riskDecisionRef ?? null,
          run.tradingIntentRef ?? null,
          run.executionIntentRef ?? null,
          run.executionAttemptRef ?? null,
          run.canonicalOrderRef ?? null,
          run.executionResultRef ?? null,
          run.diagnosticsRef ?? null,
          run.pnlAttributionRef ?? null,
          run.feedbackSnapshotRef ?? null,
          run.driftAssessmentRef ?? null,
          run.governanceDecisionRef ?? null,
          run.safetyAssessmentRef ?? null,
          run.recoveryPlanRef ?? null,
          run.resumeEligibilityRef ?? null,
          run.correlationId,
          run.causationId,
          run.leaseToken ? run.leaseToken.toString() : null,
          run.failureReason ?? null,
          run.inputDigest,
        ]
      );

      // 3. Outbox event
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
      await tx.query(eventSql, [
        `evt_run_created_${run.harnessRunId}`,
        run.harnessRunId,
        1,
        'TradingHarnessRunCreated',
        run.correlationId,
        JSON.stringify({
          harnessRunId: run.harnessRunId,
          environment: run.environment,
          strategyId: run.strategyId,
          strategyRevisionId: run.strategyRevisionId,
          instrument: run.instrument,
          venue: run.venue,
          currentStage: run.currentStage,
          status: run.status,
        }),
        run.startedAt,
      ]);

      return run;
    });
  }

  public async recordStageTransitionTransaction(
    transition: HarnessStageTransition,
    updates?: Partial<TradingHarnessRun>,
    expectedLeaseToken?: number
  ): Promise<HarnessStageTransition> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      // 1. Verify run exists & check lease fencing if provided
      const runRes = await tx.query<{ harness_run_id: string; lease_token: string | null }>(
        'SELECT harness_run_id, lease_token FROM trading_harness_runs WHERE harness_run_id = $1;',
        [transition.harnessRunId]
      );
      if (runRes.rows.length === 0) {
        throw new Error(`TradingHarnessRun ${transition.harnessRunId} not found`);
      }

      if (expectedLeaseToken !== undefined) {
        const currentLease = runRes.rows[0].lease_token ? Number(runRes.rows[0].lease_token) : 0;
        if (expectedLeaseToken < currentLease) {
          throw new HarnessFencingTokenError(
            `Fencing token ${expectedLeaseToken} rejected: current lease token is ${currentLease}`
          );
        }
      }

      // 2. Insert transition
      await tx.query(
        `
        INSERT INTO harness_stage_transitions (
          transition_id,
          harness_run_id,
          from_stage,
          to_stage,
          authority,
          artifact_ref,
          timestamp,
          input_digest
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (transition_id) DO NOTHING;
        `,
        [
          transition.transitionId,
          transition.harnessRunId,
          transition.fromStage,
          transition.toStage,
          transition.authority,
          transition.artifactRef ?? null,
          transition.timestamp,
          transition.inputDigest,
        ]
      );

      // 3. Update run state if updates provided
      if (updates) {
        const setClauses: string[] = ['current_stage = $2'];
        const params: any[] = [transition.harnessRunId, transition.toStage];
        let pIdx = 3;

        if (updates.status !== undefined) {
          setClauses.push(`status = $${pIdx++}`);
          params.push(updates.status);
        }
        if (updates.completedAt !== undefined) {
          setClauses.push(`completed_at = $${pIdx++}`);
          params.push(updates.completedAt);
        }
        if (updates.marketContextRef !== undefined) {
          setClauses.push(`market_context_ref = $${pIdx++}`);
          params.push(updates.marketContextRef);
        }
        if (updates.opportunityRef !== undefined) {
          setClauses.push(`opportunity_ref = $${pIdx++}`);
          params.push(updates.opportunityRef);
        }
        if (updates.tradeProposalRef !== undefined) {
          setClauses.push(`trade_proposal_ref = $${pIdx++}`);
          params.push(updates.tradeProposalRef);
        }
        if (updates.portfolioDecisionRef !== undefined) {
          setClauses.push(`portfolio_decision_ref = $${pIdx++}`);
          params.push(updates.portfolioDecisionRef);
        }
        if (updates.riskDecisionRef !== undefined) {
          setClauses.push(`risk_decision_ref = $${pIdx++}`);
          params.push(updates.riskDecisionRef);
        }
        if (updates.tradingIntentRef !== undefined) {
          setClauses.push(`trading_intent_ref = $${pIdx++}`);
          params.push(updates.tradingIntentRef);
        }
        if (updates.executionIntentRef !== undefined) {
          setClauses.push(`execution_intent_ref = $${pIdx++}`);
          params.push(updates.executionIntentRef);
        }
        if (updates.executionAttemptRef !== undefined) {
          setClauses.push(`execution_attempt_ref = $${pIdx++}`);
          params.push(updates.executionAttemptRef);
        }
        if (updates.canonicalOrderRef !== undefined) {
          setClauses.push(`canonical_order_ref = $${pIdx++}`);
          params.push(updates.canonicalOrderRef);
        }
        if (updates.executionResultRef !== undefined) {
          setClauses.push(`execution_result_ref = $${pIdx++}`);
          params.push(updates.executionResultRef);
        }
        if (updates.diagnosticsRef !== undefined) {
          setClauses.push(`diagnostics_ref = $${pIdx++}`);
          params.push(updates.diagnosticsRef);
        }
        if (updates.pnlAttributionRef !== undefined) {
          setClauses.push(`pnl_attribution_ref = $${pIdx++}`);
          params.push(updates.pnlAttributionRef);
        }
        if (updates.feedbackSnapshotRef !== undefined) {
          setClauses.push(`feedback_snapshot_ref = $${pIdx++}`);
          params.push(updates.feedbackSnapshotRef);
        }
        if (updates.driftAssessmentRef !== undefined) {
          setClauses.push(`drift_assessment_ref = $${pIdx++}`);
          params.push(updates.driftAssessmentRef);
        }
        if (updates.governanceDecisionRef !== undefined) {
          setClauses.push(`governance_decision_ref = $${pIdx++}`);
          params.push(updates.governanceDecisionRef);
        }
        if (updates.safetyAssessmentRef !== undefined) {
          setClauses.push(`safety_assessment_ref = $${pIdx++}`);
          params.push(updates.safetyAssessmentRef);
        }
        if (updates.recoveryPlanRef !== undefined) {
          setClauses.push(`recovery_plan_ref = $${pIdx++}`);
          params.push(updates.recoveryPlanRef);
        }
        if (updates.resumeEligibilityRef !== undefined) {
          setClauses.push(`resume_eligibility_ref = $${pIdx++}`);
          params.push(updates.resumeEligibilityRef);
        }
        if (updates.failureReason !== undefined) {
          setClauses.push(`failure_reason = $${pIdx++}`);
          params.push(updates.failureReason);
        }
        if (updates.leaseToken !== undefined) {
          setClauses.push(`lease_token = $${pIdx++}`);
          params.push(updates.leaseToken.toString());
        }

        const updateSql = `
          UPDATE trading_harness_runs
          SET ${setClauses.join(', ')}
          WHERE harness_run_id = $1;
        `;
        await tx.query(updateSql, params);
      }

      // 4. Outbox event
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
      await tx.query(eventSql, [
        `evt_trans_${transition.transitionId}`,
        transition.harnessRunId,
        1,
        'HarnessStageTransitioned',
        transition.harnessRunId,
        JSON.stringify(transition),
        transition.timestamp,
      ]);

      return transition;
    });
  }

  public async recordEvidencePackageTransaction(
    pkg: HarnessRunEvidencePackage
  ): Promise<HarnessRunEvidencePackage> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      await tx.query(
        `
        INSERT INTO harness_evidence_packages (
          evidence_package_id,
          harness_run_id,
          strategy_id,
          strategy_revision_id,
          environment,
          timeline,
          evidence_refs,
          economic_summary,
          governance_summary,
          safety_summary,
          created_at,
          input_digest
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (evidence_package_id) DO NOTHING;
        `,
        [
          pkg.evidencePackageId,
          pkg.harnessRunId,
          pkg.strategyId,
          pkg.strategyRevisionId,
          pkg.environment,
          JSON.stringify(pkg.timeline),
          JSON.stringify(pkg.evidenceRefs),
          JSON.stringify(pkg.economicSummary ?? {}),
          JSON.stringify(pkg.governanceSummary ?? {}),
          JSON.stringify(pkg.safetySummary ?? {}),
          pkg.createdAt,
          pkg.inputDigest,
        ]
      );

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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING;
      `;
      await tx.query(eventSql, [
        `evt_ev_pkg_${pkg.evidencePackageId}`,
        pkg.harnessRunId,
        1,
        'HarnessEvidencePackageCreated',
        pkg.harnessRunId,
        JSON.stringify({
          evidencePackageId: pkg.evidencePackageId,
          harnessRunId: pkg.harnessRunId,
          strategyId: pkg.strategyId,
          strategyRevisionId: pkg.strategyRevisionId,
          environment: pkg.environment,
        }),
        pkg.createdAt,
      ]);

      return pkg;
    });
  }

  public async recordReadinessReportTransaction(
    report: HarnessReadinessReport
  ): Promise<HarnessReadinessReport> {
    return await this.client.transaction(async (tx: PostgresTransactionClient) => {
      await tx.query(
        `
        INSERT INTO harness_readiness_assessments (
          report_id,
          environment,
          overall_status,
          dimension_evaluations,
          p0_blockers,
          p1_findings,
          p2_findings,
          debt_aud_a03_status,
          evaluated_at,
          input_digest
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (report_id) DO NOTHING;
        `,
        [
          report.reportId,
          report.environment,
          report.overallStatus,
          JSON.stringify(report.dimensionEvaluations),
          JSON.stringify(report.p0Blockers),
          JSON.stringify(report.p1Findings),
          JSON.stringify(report.p2Findings),
          report.debtAudA03Status,
          report.evaluatedAt,
          report.inputDigest,
        ]
      );

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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING;
      `;
      await tx.query(eventSql, [
        `evt_readiness_${report.reportId}`,
        report.reportId,
        1,
        'HarnessReadinessReportCreated',
        report.reportId,
        JSON.stringify({
          reportId: report.reportId,
          overallStatus: report.overallStatus,
          evaluatedAt: report.evaluatedAt,
        }),
        report.evaluatedAt,
      ]);

      return report;
    });
  }

  public async getRun(
    harnessRunId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<TradingHarnessRun | null> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<HarnessRunRow>(
      'SELECT * FROM trading_harness_runs WHERE harness_run_id = $1;',
      [harnessRunId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      harnessRunId: r.harness_run_id,
      environment: r.environment as HarnessEnvironment,
      mode: r.mode as HarnessMode,
      strategyId: r.strategy_id,
      strategyRevisionId: r.strategy_revision_id,
      instrument: r.instrument,
      venue: r.venue,
      currentStage: r.current_stage as HarnessStage,
      status: r.status as HarnessRunStatus,
      startedAt: new Date(r.started_at).toISOString(),
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
      marketContextRef: r.market_context_ref ?? undefined,
      opportunityRef: r.opportunity_ref ?? undefined,
      tradeProposalRef: r.trade_proposal_ref ?? undefined,
      portfolioDecisionRef: r.portfolio_decision_ref ?? undefined,
      riskDecisionRef: r.risk_decision_ref ?? undefined,
      tradingIntentRef: r.trading_intent_ref ?? undefined,
      executionIntentRef: r.execution_intent_ref ?? undefined,
      executionAttemptRef: r.execution_attempt_ref ?? undefined,
      canonicalOrderRef: r.canonical_order_ref ?? undefined,
      executionResultRef: r.execution_result_ref ?? undefined,
      diagnosticsRef: r.diagnostics_ref ?? undefined,
      pnlAttributionRef: r.pnl_attribution_ref ?? undefined,
      feedbackSnapshotRef: r.feedback_snapshot_ref ?? undefined,
      driftAssessmentRef: r.drift_assessment_ref ?? undefined,
      governanceDecisionRef: r.governance_decision_ref ?? undefined,
      safetyAssessmentRef: r.safety_assessment_ref ?? undefined,
      recoveryPlanRef: r.recovery_plan_ref ?? undefined,
      resumeEligibilityRef: r.resume_eligibility_ref ?? undefined,
      correlationId: r.correlation_id,
      causationId: r.causation_id,
      leaseToken: r.lease_token ? Number(r.lease_token) : undefined,
      failureReason: r.failure_reason ?? undefined,
      inputDigest: r.input_digest,
    };
  }

  public async getTransitions(
    harnessRunId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<HarnessStageTransition[]> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<HarnessTransitionRow>(
      'SELECT * FROM harness_stage_transitions WHERE harness_run_id = $1 ORDER BY timestamp ASC;',
      [harnessRunId]
    );
    return res.rows.map((r) => ({
      transitionId: r.transition_id,
      harnessRunId: r.harness_run_id,
      fromStage: r.from_stage as HarnessStage,
      toStage: r.to_stage as HarnessStage,
      authority: r.authority,
      artifactRef: r.artifact_ref ?? undefined,
      timestamp: new Date(r.timestamp).toISOString(),
      inputDigest: r.input_digest,
    }));
  }

  public async getEvidencePackage(
    evidencePackageId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<HarnessRunEvidencePackage | null> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<HarnessEvidencePackageRow>(
      'SELECT * FROM harness_evidence_packages WHERE evidence_package_id = $1;',
      [evidencePackageId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      evidencePackageId: r.evidence_package_id,
      harnessRunId: r.harness_run_id,
      strategyId: r.strategy_id,
      strategyRevisionId: r.strategy_revision_id,
      environment: r.environment as HarnessEnvironment,
      timeline: r.timeline,
      evidenceRefs: r.evidence_refs,
      economicSummary: r.economic_summary,
      governanceSummary: r.governance_summary,
      safetySummary: r.safety_summary,
      createdAt: new Date(r.created_at).toISOString(),
      inputDigest: r.input_digest,
    };
  }

  public async getReadinessReport(
    reportId: string,
    overrideClient?: PostgresQueryClient
  ): Promise<HarnessReadinessReport | null> {
    const executor = overrideClient ?? this.client;
    const res = await executor.query<HarnessReadinessReportRow>(
      'SELECT * FROM harness_readiness_assessments WHERE report_id = $1;',
      [reportId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      reportId: r.report_id,
      environment: r.environment as any,
      overallStatus: r.overall_status as any,
      dimensionEvaluations: r.dimension_evaluations,
      p0Blockers: r.p0_blockers,
      p1Findings: r.p1_findings,
      p2Findings: r.p2_findings,
      debtAudA03Status: r.debt_aud_a03_status as any,
      evaluatedAt: new Date(r.evaluated_at).toISOString(),
      inputDigest: r.input_digest,
    };
  }
}
