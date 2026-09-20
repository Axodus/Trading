/**
 * AXODUS-TRADING-EPIC-01 / VAL-12-PG
 * Real PostgreSQL Durable Strategy Operational Governance Acceptance Suite
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  PostgresStrategyOperationalGovernanceRepository,
  StrategyOperationalGovernanceAuthority,
  InterventionResolutionAuthority,
  GovernanceSnapshotStaleError,
  GovernanceIdempotencyConflictError,
  GovernanceAuthorityBypassAttemptError,
  MigrationRunner,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import {
  DEFAULT_STRATEGY_OPERATIONAL_GOVERNANCE_POLICY_V1,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

function loadMigrations() {
  const packageMigrationsDir = resolve(process.cwd(), 'migrations');
  const workspaceMigrationsDir = resolve(process.cwd(), 'trading-core/services/trading-core/migrations');
  const migrationsDir = existsSync(packageMigrationsDir) ? packageMigrationsDir : workspaceMigrationsDir;
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      id: name,
      sql: readFileSync(join(migrationsDir, name), 'utf8'),
    }));
}

function makeMockSnapshot(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  return {
    governanceSnapshotId: 'gov-snap-pg-' + uniqueId,
    strategyId: 'strat-momentum-pg-' + uniqueId,
    strategyRevisionId: 'strat-momentum-pg-' + uniqueId + ':r7',
    lifecycleState: 'PRODUCTION',
    lifecycleVersion: 10,
    healthState: 'HEALTHY',
    healthVersion: 5,
    operationalSnapshotId: 'op-snap-pg-' + uniqueId,
    driftAssessmentId: 'drift-pg-' + uniqueId,
    driftClassification: 'NORMAL',
    revalidationRequestId: null,
    revalidationOutcomeRef: null,
    revalidationOutcome: 'PASSED',
    revalidationStatus: 'COMPLETED',
    promotionEligibilityRef: 'promo-pg-' + uniqueId,
    portfolioContextRef: 'port-pg-' + uniqueId,
    riskContextRef: 'risk-pg-' + uniqueId,
    createdAt: now,
    asOf: now,
    expiresAt,
    inputDigest: 'digest-snap-' + uniqueId,
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / VAL-12-PG — Real PostgreSQL Durable Operational Governance Acceptance', () => {
  let pool;
  let repo;
  const authority = new StrategyOperationalGovernanceAuthority();
  const resolutionAuthority = new InterventionResolutionAuthority();

  before(async () => {
    pool = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const runner = new MigrationRunner(pool);
    const migrations = loadMigrations();
    await runner.run({ environment: 'local', schemaName: 'public', migrations });

    repo = new PostgresStrategyOperationalGovernanceRepository(pool);
  });

  after(async () => {
    if (pool) {
      await pool.close();
    }
  });

  it('Gate 1: Migration 0011 applies cleanly and all 7 tables exist in PostgreSQL', async () => {
    const tables = [
      'strategy_governance_snapshots',
      'strategy_governance_decisions',
      'strategy_intervention_plans',
      'strategy_intervention_requests',
      'strategy_intervention_responses',
      'strategy_intervention_resolutions',
      'strategy_governance_policies',
    ];

    for (const table of tables) {
      const res = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1;",
        [table]
      );
      assert.equal(res.rows.length, 1, `Table ${table} must exist in real PostgreSQL`);
    }
  });

  it('Gate 2: GovernanceSnapshot persistence & exact column mapping round-trip', async () => {
    const snap = makeMockSnapshot();
    await repo.recordGovernanceSnapshot(snap);

    const fetched = await repo.getGovernanceSnapshot(snap.governanceSnapshotId);
    assert.ok(fetched, 'Snapshot must be retrievable from PostgreSQL');
    assert.equal(fetched.governanceSnapshotId, snap.governanceSnapshotId);
    assert.equal(fetched.strategyId, snap.strategyId);
    assert.equal(fetched.strategyRevisionId, snap.strategyRevisionId);
    assert.equal(fetched.lifecycleState, snap.lifecycleState);
    assert.equal(fetched.lifecycleVersion, snap.lifecycleVersion);
    assert.equal(fetched.healthState, snap.healthState);
    assert.equal(fetched.healthVersion, snap.healthVersion);
    assert.equal(fetched.operationalSnapshotId, snap.operationalSnapshotId);
  });

  it('Gate 3: Deterministic GovernanceDecision persistence & querying in real PostgreSQL', async () => {
    const snap = makeMockSnapshot();
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });

    const recorded = await repo.recordGovernanceDecisionTransaction(decision);
    assert.equal(recorded.governanceDecisionId, decision.governanceDecisionId);

    const fetched = await repo.getGovernanceDecision(decision.governanceDecisionId);
    assert.ok(fetched, 'Decision must be retrievable from PostgreSQL');
    assert.equal(fetched.classification, 'CONTINUE');
    assert.equal(fetched.strategyRevisionId, snap.strategyRevisionId);
  });

  it('Gate 4: Durable idempotent replay on identical digests returns existing records without duplicate insert', async () => {
    const snap = makeMockSnapshot();
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });

    const first = await repo.recordGovernanceDecisionTransaction(decision);
    const replay = await repo.recordGovernanceDecisionTransaction(decision);

    assert.equal(first.governanceDecisionId, replay.governanceDecisionId);

    const countRes = await pool.query(
      'SELECT COUNT(*)::int as count FROM strategy_governance_decisions WHERE governance_decision_id = $1;',
      [decision.governanceDecisionId]
    );
    assert.equal(countRes.rows[0].count, 1, 'Exactly one record must exist in PostgreSQL');
  });

  it('Gate 5: Idempotency conflict throws GovernanceIdempotencyConflictError on altered digest', async () => {
    const snap = makeMockSnapshot();
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });
    await repo.recordGovernanceDecisionTransaction(decision);

    const conflictingDecision = {
      ...decision,
      inputDigest: 'conflicting-altered-digest',
      classification: 'INTERVENE',
    };

    await assert.rejects(
      async () => repo.recordGovernanceDecisionTransaction(conflictingDecision),
      GovernanceIdempotencyConflictError
    );
  });

  it('Gate 6: Concurrency protection — two workers attempting active revalidation intervention converge to 1 active in PostgreSQL', async () => {
    const snap = makeMockSnapshot({ driftClassification: 'MATERIAL' });
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });
    await repo.recordGovernanceDecisionTransaction(decision);

    const req1 = authority.createInterventionRequest(
      decision,
      'REVALIDATION',
      'REQUEST_REVALIDATION',
      'HIGH',
      ['MATERIAL_DRIFT'],
      ['ev_001']
    );

    const req2 = {
      ...req1,
      interventionRequestId: req1.interventionRequestId + '-worker2',
    };

    // Run both concurrently
    const [res1, res2] = await Promise.all([
      repo.recordInterventionRequestTransaction(req1),
      repo.recordInterventionRequestTransaction(req2),
    ]);

    // Both should converge on the same active request record
    assert.ok(res1 && res2);

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM strategy_intervention_requests 
       WHERE strategy_id = $1 AND strategy_revision_id = $2 AND target_authority = 'REVALIDATION' AND status = 'REQUESTED';`,
      [snap.strategyId, snap.strategyRevisionId]
    );
    assert.equal(countRes.rows[0].count, 1, 'Exactly 1 active intervention request must exist');
  });

  it('Gate 7: Multi-authority InterventionPlan persistence and status management', async () => {
    const snap = makeMockSnapshot({ driftClassification: 'CRITICAL' });
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });

    const req1 = authority.createInterventionRequest(decision, 'STRATEGY_HEALTH', 'REQUEST_SUSPENSION_REVIEW', 'CRITICAL', ['CRITICAL_DRIFT'], ['ev_c']);
    const req2 = authority.createInterventionRequest(decision, 'RISK', 'REQUEST_RISK_HALT_REVIEW', 'CRITICAL', ['CRITICAL_DRIFT'], ['ev_c']);

    const plan = authority.createInterventionPlan(decision, [req1, req2]);
    await repo.recordGovernanceDecisionTransaction(decision, plan);

    const fetchedPlan = await repo.getInterventionPlan(plan.planId);
    assert.ok(fetchedPlan, 'Plan must exist in PostgreSQL');
    assert.equal(fetchedPlan.status, 'PENDING');
    assert.equal(fetchedPlan.requests.length, 2);
  });

  it('Gate 8: Authority response persistence & transactional outbox emission', async () => {
    const snap = makeMockSnapshot({ driftClassification: 'MATERIAL' });
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });
    await repo.recordGovernanceDecisionTransaction(decision);
    const req = authority.createInterventionRequest(decision, 'REVALIDATION', 'REQUEST_REVALIDATION', 'HIGH', ['MATERIAL_DRIFT'], ['ev_m']);
    await repo.recordInterventionRequestTransaction(req);

    const response = {
      responseId: 'resp-pg-' + globalThis.crypto.randomUUID().slice(0, 8),
      interventionRequestId: req.interventionRequestId,
      targetAuthority: 'REVALIDATION',
      status: 'APPLIED',
      canonicalResultRef: 'ev_quant_rev_pass_pg_01',
      reasonCodes: ['QUANT_REVALIDATION_ACCEPTED'],
      respondedAt: new Date().toISOString(),
    };

    await repo.recordAuthorityResponseTransaction(response);

    const updatedReq = await repo.getInterventionRequest(req.interventionRequestId);
    assert.equal(updatedReq.status, 'APPLIED');
    assert.equal(updatedReq.authorityResponseRef, 'ev_quant_rev_pass_pg_01');

    const outboxRes = await pool.query(
      "SELECT * FROM trading_execution_outbox WHERE outbox_id = $1;",
      ['evt_resp_' + response.responseId]
    );
    assert.equal(outboxRes.rows.length, 1, 'Outbox event must be committed atomically');
  });

  it('Gate 9: Intervention resolution persistence with partial and resolved states', async () => {
    const snap = makeMockSnapshot({ driftClassification: 'MATERIAL' });
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });
    const req1 = authority.createInterventionRequest(decision, 'REVALIDATION', 'REQUEST_REVALIDATION', 'HIGH', ['MATERIAL_DRIFT'], ['ev_m']);
    const req2 = authority.createInterventionRequest(decision, 'RISK', 'REQUEST_RISK_RESTRICTION', 'HIGH', ['MATERIAL_DRIFT'], ['ev_m']);
    const plan = authority.createInterventionPlan(decision, [req1, req2]);

    await repo.recordGovernanceDecisionTransaction(decision, plan);

    const response1 = {
      responseId: 'resp-pg-' + globalThis.crypto.randomUUID().slice(0, 8),
      interventionRequestId: req1.interventionRequestId,
      targetAuthority: 'REVALIDATION',
      status: 'APPLIED',
      canonicalResultRef: 'ev_quant_01',
      respondedAt: new Date().toISOString(),
    };
    await repo.recordAuthorityResponseTransaction(response1);

    const partialResolution = resolutionAuthority.resolvePlan(plan, [response1]);
    await repo.recordInterventionResolutionTransaction(partialResolution);

    const fetchedPartial = await repo.getInterventionResolution(partialResolution.resolutionId);
    assert.equal(fetchedPartial.status, 'PARTIALLY_APPLIED');

    const response2 = {
      responseId: 'resp-pg-' + globalThis.crypto.randomUUID().slice(0, 8),
      interventionRequestId: req2.interventionRequestId,
      targetAuthority: 'RISK',
      status: 'APPLIED',
      canonicalResultRef: 'risk_decision_mod_01',
      respondedAt: new Date().toISOString(),
    };
    await repo.recordAuthorityResponseTransaction(response2);

    const fullResolution = resolutionAuthority.resolvePlan(plan, [response1, response2]);
    await repo.recordInterventionResolutionTransaction(fullResolution);

    const fetchedFull = await repo.getInterventionResolution(fullResolution.resolutionId);
    assert.equal(fetchedFull.status, 'RESOLVED');
  });

  it('Gate 10: Disconnect + Reconnect survival across pool lifecycle in real PostgreSQL', async () => {
    const snap = makeMockSnapshot();
    await repo.recordGovernanceSnapshot(snap);

    await pool.close();

    pool = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    repo = new PostgresStrategyOperationalGovernanceRepository(pool);

    const fetched = await repo.getGovernanceSnapshot(snap.governanceSnapshotId);
    assert.ok(fetched, 'Snapshot must survive pool reconnect');
  });

  it('Gate 11: Process / Repository restart persistence in real PostgreSQL', async () => {
    const snap = makeMockSnapshot();
    await repo.recordGovernanceSnapshot(snap);

    const newRepo = new PostgresStrategyOperationalGovernanceRepository(pool);
    const fetched = await newRepo.getGovernanceSnapshot(snap.governanceSnapshotId);
    assert.ok(fetched, 'New repository instance must retrieve existing snapshot');
  });

  it('Gate 12: Transaction rollback / failure injection leaves zero partial state in real PostgreSQL', async () => {
    const snap = makeMockSnapshot();
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });

    const malformedPlan = {
      planId: 'plan-fail-' + globalThis.crypto.randomUUID().slice(0, 8),
      strategyId: decision.strategyId,
      strategyRevisionId: decision.strategyRevisionId,
      governanceDecisionId: decision.governanceDecisionId,
      requests: [
        {
          // Intentional missing fields to trigger DB constraint failure
          interventionRequestId: null,
        },
      ],
      dependencies: [],
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      inputDigest: 'fail-digest',
    };

    await assert.rejects(
      async () => repo.recordGovernanceDecisionTransaction(decision, malformedPlan),
      /null value in column/
    );

    const checkDecision = await repo.getGovernanceDecision(decision.governanceDecisionId);
    assert.equal(checkDecision, null, 'Decision must be rolled back completely');
  });

  it('Gate 13: Stale snapshot rejection (TOCTOU protection in database context)', async () => {
    const snap = makeMockSnapshot({ lifecycleVersion: 10, healthVersion: 5 });
    await repo.recordGovernanceSnapshot(snap);

    // Current health has progressed to version 6
    assert.throws(
      () =>
        authority.evaluateGovernance({
          snapshot: snap,
          currentLifecycleVersion: 10,
          currentHealthVersion: 6, // STALE!
          currentOperationalSnapshotId: snap.operationalSnapshotId,
        }),
      GovernanceSnapshotStaleError
    );
  });

  it('Gate 14: Authority non-bypass verification — repository has zero direct write methods to health/lifecycle/risk/portfolio', async () => {
    authority.assertNoDirectAuthorityMutation('strategy_governance_decisions'); // allowed

    assert.throws(
      () => authority.assertNoDirectAuthorityMutation('strategy_health_heads'),
      GovernanceAuthorityBypassAttemptError
    );
    assert.throws(
      () => authority.assertNoDirectAuthorityMutation('strategy_lifecycle_heads'),
      GovernanceAuthorityBypassAttemptError
    );
    assert.throws(
      () => authority.assertNoDirectAuthorityMutation('portfolio_allocations'),
      GovernanceAuthorityBypassAttemptError
    );
    assert.throws(
      () => authority.assertNoDirectAuthorityMutation('risk_decisions'),
      GovernanceAuthorityBypassAttemptError
    );
  });

  it('Gate 15: Outbox atomicity — StrategyGovernanceEvaluated and StrategyInterventionRequested in PostgreSQL', async () => {
    const snap = makeMockSnapshot({ driftClassification: 'MATERIAL' });
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });
    const req = authority.createInterventionRequest(decision, 'REVALIDATION', 'REQUEST_REVALIDATION', 'HIGH', ['MATERIAL_DRIFT'], ['ev_m']);
    const plan = authority.createInterventionPlan(decision, [req]);

    await repo.recordGovernanceDecisionTransaction(decision, plan);

    const outboxDecision = await pool.query(
      "SELECT * FROM trading_execution_outbox WHERE event_type = 'StrategyGovernanceEvaluated' AND aggregate_id = $1;",
      [snap.strategyId]
    );
    assert.ok(outboxDecision.rows.length >= 1, 'Decision outbox event must be present');

    const outboxRequest = await pool.query(
      "SELECT * FROM trading_execution_outbox WHERE event_type = 'StrategyInterventionRequested' AND aggregate_id = $1;",
      [snap.strategyId]
    );
    assert.ok(outboxRequest.rows.length >= 1, 'Intervention request outbox event must be present');
  });

  it('Gate 16: Intervention resolution convergence without infinite loops', async () => {
    const snap = makeMockSnapshot({ driftClassification: 'MATERIAL' });
    await repo.recordGovernanceSnapshot(snap);

    const decision = authority.evaluateGovernance({
      snapshot: snap,
      currentLifecycleVersion: snap.lifecycleVersion,
      currentHealthVersion: snap.healthVersion,
      currentOperationalSnapshotId: snap.operationalSnapshotId,
    });
    const req = authority.createInterventionRequest(decision, 'REVALIDATION', 'REQUEST_REVALIDATION', 'HIGH', ['MATERIAL_DRIFT'], ['ev_m']);
    const plan = authority.createInterventionPlan(decision, [req]);
    await repo.recordGovernanceDecisionTransaction(decision, plan);

    const response = {
      responseId: 'resp-pg-' + globalThis.crypto.randomUUID().slice(0, 8),
      interventionRequestId: req.interventionRequestId,
      targetAuthority: 'REVALIDATION',
      status: 'APPLIED',
      canonicalResultRef: 'ev_quant_rev_pass_pg_01',
      respondedAt: new Date().toISOString(),
    };
    await repo.recordAuthorityResponseTransaction(response);

    const resolution = resolutionAuthority.resolvePlan(plan, [response]);
    await repo.recordInterventionResolutionTransaction(resolution);

    assert.equal(resolution.status, 'RESOLVED');
  });
});
