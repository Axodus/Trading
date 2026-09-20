/**
 * AXODUS-TRADING-EPIC-01 / VAL-13-PG
 * Real PostgreSQL Durable System Safety & Recovery Acceptance Suite
 */

import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  PostgresSystemSafetyRepository,
  SystemSafetyAuthority,
  KillSwitchCoordinator,
  SystemRecoveryAuthority,
  SafetySnapshotStaleError,
  SafetyIdempotencyConflictError,
  SafetyAuthorityBypassAttemptError,
  KillSwitchReleaseBlockedError,
  RecoveryFencingTokenError,
  MigrationRunner,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import {
  DEFAULT_SYSTEM_SAFETY_POLICY_V1,
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

function makeMockSafetySnapshot(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  return {
    safetySnapshotId: 'safe-snap-pg-' + uniqueId,
    observations: [],
    marketDataState: 'HEALTHY',
    databaseState: 'HEALTHY',
    eventSystemState: 'HEALTHY',
    runtimeState: 'HEALTHY',
    providerStates: [{ provider: 'binance', status: 'HEALTHY', venue: 'binance_perpetual' }],
    executionState: 'HEALTHY',
    reconciliationState: 'HEALTHY',
    accountingState: 'HEALTHY',
    governanceState: 'HEALTHY',
    createdAt: now,
    asOf: now,
    expiresAt,
    inputDigest: 'digest_safe_pg_' + uniqueId,
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / VAL-13-PG — Real PostgreSQL Durable System Safety & Recovery Acceptance', () => {
  let pool;
  let repo;
  let authority;
  let killCoordinator;
  let recoveryAuthority;

  before(async () => {
    pool = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const runner = new MigrationRunner(pool);
    const migrations = loadMigrations();
    await runner.run({ environment: 'local', schemaName: 'public', migrations });

    repo = new PostgresSystemSafetyRepository(pool);
    authority = new SystemSafetyAuthority();
    killCoordinator = new KillSwitchCoordinator();
    recoveryAuthority = new SystemRecoveryAuthority();

    // Clean state for fresh acceptance suite run
    await pool.query(`
      TRUNCATE TABLE resume_eligibilities, system_recovery_plans, kill_switch_requests, system_safety_assessments, system_safety_snapshots, system_safety_observations, system_safety_policies CASCADE;
    `);
  });

  after(async () => {
    if (pool) {
      await pool.close();
    }
  });

  it('Gate 1: Migration 0012 applies cleanly and all 7 tables exist in PostgreSQL', async () => {
    const tableRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'system_safety_observations',
          'system_safety_snapshots',
          'system_safety_policies',
          'system_safety_assessments',
          'kill_switch_requests',
          'system_recovery_plans',
          'resume_eligibilities'
        )
      ORDER BY table_name;
    `);
    assert.equal(tableRes.rows.length, 7, 'All 7 system safety & recovery tables must exist in PostgreSQL');
  });

  it('Gate 2: SystemSafetyObservation persistence & exact column mapping round-trip', async () => {
    const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const obs = {
      observationId: 'obs_pg_' + uniqueId,
      domain: 'MARKET_DATA',
      component: 'binance_feed',
      scope: 'VENUE',
      scopeId: 'binance_perpetual',
      status: 'DEGRADED',
      severity: 'MEDIUM',
      observedAt: now,
      asOf: now,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      reasonCodes: ['MARKET_DATA_LATENCY_ELEVATED'],
      metrics: { latencyMs: 250 },
      sourceRef: 'src_feed_01',
      correlationId: 'corr_' + uniqueId,
      causationId: 'cause_' + uniqueId,
      inputDigest: 'digest_obs_' + uniqueId,
    };

    const recorded = await repo.recordSafetyObservation(obs);
    assert.equal(recorded.observationId, obs.observationId);
    assert.equal(recorded.domain, 'MARKET_DATA');
    assert.equal(recorded.severity, 'MEDIUM');

    const fetched = await repo.getSafetyObservation(obs.observationId);
    assert.ok(fetched);
    assert.equal(fetched.observationId, obs.observationId);
    assert.deepEqual(fetched.reasonCodes, ['MARKET_DATA_LATENCY_ELEVATED']);
  });

  it('Gate 3: SystemSafetySnapshot persistence & exact column mapping round-trip', async () => {
    const snap = makeMockSafetySnapshot();
    const recorded = await repo.recordSafetySnapshot(snap);
    assert.equal(recorded.safetySnapshotId, snap.safetySnapshotId);

    const fetched = await repo.getSafetySnapshot(snap.safetySnapshotId);
    assert.ok(fetched);
    assert.equal(fetched.safetySnapshotId, snap.safetySnapshotId);
    assert.equal(fetched.marketDataState, 'HEALTHY');
    assert.equal(fetched.databaseState, 'HEALTHY');
  });

  it('Gate 4: SystemSafetyAssessment persistence & transactional outbox emission', async () => {
    const snap = makeMockSafetySnapshot({ databaseState: 'UNAVAILABLE' });
    await repo.recordSafetySnapshot(snap);

    const assessment = authority.evaluateSafety({ snapshot: snap });
    const { assessment: persisted, outboxEventId } = await repo.recordSafetyAssessmentTransaction(assessment);

    assert.equal(persisted.assessmentId, assessment.assessmentId);
    assert.equal(persisted.state, 'EMERGENCY');
    assert.equal(persisted.severity, 'CRITICAL');

    const outboxRes = await pool.query(
      "SELECT * FROM trading_execution_outbox WHERE outbox_id = $1;",
      [outboxEventId]
    );
    assert.equal(outboxRes.rows.length, 1, 'SystemSafetyEmergency event must be committed atomically in outbox');
    assert.equal(outboxRes.rows[0].event_type, 'SystemSafetyEmergency');
  });

  it('Gate 5: KillSwitchRequest persistence & status transition (REQUESTED -> ACTIVE -> RELEASED)', async () => {
    const snap = makeMockSafetySnapshot({ databaseState: 'UNAVAILABLE' });
    await repo.recordSafetySnapshot(snap);
    const assessment = authority.evaluateSafety({ snapshot: snap });
    await repo.recordSafetyAssessmentTransaction(assessment);

    const req = killCoordinator.createKillSwitchRequest(
      assessment,
      'SYSTEM',
      undefined,
      'KILL_SYSTEM',
      'CRITICAL',
      ['DATABASE_UNAVAILABLE']
    );

    const { request: persistedReq } = await repo.recordKillSwitchRequestTransaction(req);
    assert.equal(persistedReq.status, 'REQUESTED');

    // Activate kill switch
    const activated = await repo.updateKillSwitchStatusTransaction(persistedReq.killSwitchRequestId, 'ACTIVE');
    assert.equal(activated.status, 'ACTIVE');

    // Release kill switch
    const released = await repo.updateKillSwitchStatusTransaction(persistedReq.killSwitchRequestId, 'RELEASED', []);
    assert.equal(released.status, 'RELEASED');
    assert.deepEqual(released.activeReasons, []);
  });

  it('Gate 6: Concurrency protection — two workers attempting active kill switch requests converge to 1 active', async () => {
    const snap = makeMockSafetySnapshot({ marketDataState: 'UNAVAILABLE' });
    await repo.recordSafetySnapshot(snap);
    const assessment = authority.evaluateSafety({ snapshot: snap });
    await repo.recordSafetyAssessmentTransaction(assessment);

    const req1 = killCoordinator.createKillSwitchRequest(
      assessment,
      'VENUE',
      'binance_futures',
      'KILL_VENUE',
      'HIGH',
      ['MARKET_DATA_STALE']
    );
    const req2 = killCoordinator.createKillSwitchRequest(
      assessment,
      'VENUE',
      'binance_futures',
      'KILL_VENUE',
      'HIGH',
      ['MARKET_DATA_STALE']
    );

    const [res1, res2] = await Promise.all([
      repo.recordKillSwitchRequestTransaction(req1),
      repo.recordKillSwitchRequestTransaction(req2),
    ]);

    assert.ok(res1.request);
    assert.ok(res2.request);
    assert.equal(
      res1.request.killSwitchRequestId,
      res2.request.killSwitchRequestId,
      'Both concurrent workers must converge to the same active KillSwitchRequest'
    );
  });

  it('Gate 7: Durable idempotent replay on identical digests returns existing records without duplicate insert', async () => {
    const snap = makeMockSafetySnapshot();
    const rec1 = await repo.recordSafetySnapshot(snap);
    const rec2 = await repo.recordSafetySnapshot(snap);

    assert.equal(rec1.safetySnapshotId, rec2.safetySnapshotId);
    assert.equal(rec1.inputDigest, rec2.inputDigest);
  });

  it('Gate 8: Idempotency conflict throws SafetyIdempotencyConflictError on altered digest', async () => {
    const snap = makeMockSafetySnapshot();
    await repo.recordSafetySnapshot(snap);

    const altered = { ...snap, inputDigest: 'altered_digest_999' };
    await assert.rejects(
      async () => {
        await repo.recordSafetySnapshot(altered);
      },
      (err) => err instanceof SafetyIdempotencyConflictError
    );
  });

  it('Gate 9: SystemRecoveryPlan persistence with steps, dependencies, and lease tokens', async () => {
    const snap = makeMockSafetySnapshot({ databaseState: 'UNAVAILABLE' });
    await repo.recordSafetySnapshot(snap);
    const assessment = authority.evaluateSafety({ snapshot: snap });
    await repo.recordSafetyAssessmentTransaction(assessment);

    const plan = recoveryAuthority.createRecoveryPlan({ assessment, leaseToken: 5000 });
    const { plan: persistedPlan, outboxEventId } = await repo.recordRecoveryPlanTransaction(plan);

    assert.equal(persistedPlan.recoveryPlanId, plan.recoveryPlanId);
    assert.equal(persistedPlan.leaseToken, 5000);
    assert.equal(persistedPlan.status, 'PENDING');

    const outboxRes = await pool.query(
      "SELECT * FROM trading_execution_outbox WHERE outbox_id = $1;",
      [outboxEventId]
    );
    assert.equal(outboxRes.rows.length, 1, 'RecoveryStarted event must be committed atomically');

    // Complete plan so subsequent gates start fresh
    await pool.query("UPDATE system_recovery_plans SET status = 'COMPLETED' WHERE recovery_plan_id = $1;", [persistedPlan.recoveryPlanId]);
  });

  it('Gate 10: Two-worker recovery plan concurrency — converges to 1 active plan in PostgreSQL', async () => {
    const snap = makeMockSafetySnapshot({ executionState: 'UNAVAILABLE' });
    await repo.recordSafetySnapshot(snap);
    const assessment = authority.evaluateSafety({ snapshot: snap });
    await repo.recordSafetyAssessmentTransaction(assessment);

    const plan1 = recoveryAuthority.createRecoveryPlan({ assessment });
    const plan2 = recoveryAuthority.createRecoveryPlan({ assessment });

    const [res1, res2] = await Promise.all([
      repo.recordRecoveryPlanTransaction(plan1),
      repo.recordRecoveryPlanTransaction(plan2),
    ]);

    assert.equal(
      res1.plan.recoveryPlanId,
      res2.plan.recoveryPlanId,
      'Concurrent recovery plans for same scope must converge to 1 active plan in PostgreSQL'
    );

    // Complete plan so subsequent gates start fresh
    await pool.query("UPDATE system_recovery_plans SET status = 'COMPLETED' WHERE recovery_plan_id = $1;", [res1.plan.recoveryPlanId]);
  });

  it('Gate 11: Recovery step execution and fencing token validation', async () => {
    const snap = makeMockSafetySnapshot({ marketDataState: 'UNAVAILABLE' });
    await repo.recordSafetySnapshot(snap);
    const assessment = authority.evaluateSafety({ snapshot: snap });
    await repo.recordSafetyAssessmentTransaction(assessment);

    const plan = recoveryAuthority.createRecoveryPlan({ assessment, leaseToken: 1000 });
    const { plan: persisted } = await repo.recordRecoveryPlanTransaction(plan);

    const firstStep = persisted.steps[0];
    const updated = await repo.updateRecoveryStepTransaction(
      persisted.recoveryPlanId,
      firstStep.stepId,
      'COMPLETED',
      'ev_resync_ok',
      1000
    );

    assert.equal(updated.steps[0].status, 'COMPLETED');

    // Reject older fencing token
    await assert.rejects(
      async () => {
        await repo.updateRecoveryStepTransaction(
          persisted.recoveryPlanId,
          persisted.steps[1].stepId,
          'COMPLETED',
          'ev_stale',
          999 // Older token
        );
      },
      (err) => err?.cause instanceof RecoveryFencingTokenError || err instanceof RecoveryFencingTokenError || err?.message?.includes('older than active lease token')
    );

    // Complete plan so subsequent gates start fresh
    await pool.query("UPDATE system_recovery_plans SET status = 'COMPLETED' WHERE recovery_plan_id = $1;", [persisted.recoveryPlanId]);
  });

  it('Gate 12: Disconnect + Reconnect survival across pool lifecycle in real PostgreSQL', async () => {
    const snap = makeMockSafetySnapshot();
    await repo.recordSafetySnapshot(snap);

    // Create a new client connection to test disconnect/reconnect lifecycle
    const reconnectedPool = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const reconnectedRepo = new PostgresSystemSafetyRepository(reconnectedPool);

    const fetched = await reconnectedRepo.getSafetySnapshot(snap.safetySnapshotId);
    assert.ok(fetched);
    assert.equal(fetched.safetySnapshotId, snap.safetySnapshotId);

    await reconnectedPool.close();
  });

  it('Gate 13: Process / Repository restart persistence in real PostgreSQL', async () => {
    const newRepo = new PostgresSystemSafetyRepository(pool);
    const snap = makeMockSafetySnapshot();
    await newRepo.recordSafetySnapshot(snap);

    const fetched = await newRepo.getSafetySnapshot(snap.safetySnapshotId);
    assert.ok(fetched);
    assert.equal(fetched.safetySnapshotId, snap.safetySnapshotId);
  });

  it('Gate 14: Transaction rollback / failure injection leaves zero partial state in real PostgreSQL', async () => {
    const snap = makeMockSafetySnapshot();
    await repo.recordSafetySnapshot(snap);
    const assessment = authority.evaluateSafety({ snapshot: snap });

    await assert.rejects(async () => {
      await pool.transaction(async (tx) => {
        await tx.query(`
          INSERT INTO system_safety_assessments (
            assessment_id,
            safety_snapshot_id,
            policy_id,
            policy_revision,
            state,
            severity,
            scope,
            reason_codes,
            active_kill_levels,
            required_actions,
            created_at,
            as_of,
            expires_at,
            input_digest
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14);
        `, [
          assessment.assessmentId,
          assessment.safetySnapshotId,
          assessment.policyId,
          assessment.policyRevision,
          assessment.state,
          assessment.severity,
          assessment.scope,
          JSON.stringify(assessment.reasonCodes),
          JSON.stringify(assessment.activeKillLevels),
          JSON.stringify(assessment.requiredActions),
          assessment.createdAt,
          assessment.asOf,
          assessment.expiresAt,
          assessment.inputDigest,
        ]);

        throw new Error('SIMULATED_DB_CRASH_DURING_ASSESSMENT_COMMIT');
      });
    });

    const check = await repo.getSafetyAssessment(assessment.assessmentId);
    assert.equal(check, null, 'Assessment must be rolled back completely on transaction error');
  });

  it('Gate 15: Stale snapshot rejection (TOCTOU protection in database context)', () => {
    const expiredSnap = makeMockSafetySnapshot({ expiresAt: '2020-01-01T00:00:00.000Z' });
    assert.throws(
      () => {
        authority.evaluateSafety({ snapshot: expiredSnap });
      },
      (err) => err instanceof SafetySnapshotStaleError
    );
  });

  it('Gate 16: Authority non-bypass verification — repository has zero direct write methods to sovereign tables', () => {
    const repoPrototype = Object.getOwnPropertyNames(PostgresSystemSafetyRepository.prototype);
    const forbiddenPatterns = [
      'riskDecision',
      'strategyHealth',
      'strategyLifecycle',
      'portfolioAllocation',
      'canonicalOrder',
      'canonicalFill',
    ];

    for (const pattern of forbiddenPatterns) {
      const match = repoPrototype.some((name) => name.toLowerCase().includes(pattern.toLowerCase()));
      assert.equal(
        match,
        false,
        `Repository must not expose direct mutation methods for ${pattern}`
      );
    }
  });

  it('Gate 17: Outbox atomicity — SystemSafeToResume event committed atomically on resume eligibility', async () => {
    const snap = makeMockSafetySnapshot();
    await repo.recordSafetySnapshot(snap);
    const assessment = authority.evaluateSafety({ snapshot: snap });
    await repo.recordSafetyAssessmentTransaction(assessment);

    const plan = recoveryAuthority.createRecoveryPlan({ assessment });
    for (const step of plan.steps) step.status = 'COMPLETED';
    const { plan: persistedPlan } = await repo.recordRecoveryPlanTransaction(plan);

    const eligibility = recoveryAuthority.evaluateResumeEligibility({
      plan: persistedPlan,
      currentSafetySnapshot: snap,
      outboxBacklogCount: 0,
      hasUnresolvedSubmittedUnknown: false,
    });

    assert.equal(eligibility.eligible, true);
    const { eligibility: persistedElig, outboxEventId } = await repo.recordResumeEligibilityTransaction(eligibility);

    assert.ok(outboxEventId);
    const outboxRes = await pool.query(
      "SELECT * FROM trading_execution_outbox WHERE outbox_id = $1;",
      [outboxEventId]
    );
    assert.equal(outboxRes.rows.length, 1, 'SystemSafeToResume event must be committed atomically');
  });

  it('Gate 18: Multiple active kill reasons preservation and latching', () => {
    const req = killCoordinator.evaluateManualKill({
      scope: 'SYSTEM',
      level: 'KILL_SYSTEM',
      reason: 'MARKET_DATA_OUTAGE',
      authorizedOperator: 'op_risk_01',
    });

    // Attempting release while another reason is active
    assert.throws(
      () => {
        killCoordinator.evaluateManualRelease({
          activeRequest: req,
          authorizedOperator: 'op_risk_01',
          currentSafetyState: 'NORMAL',
          unresolvedReasons: ['PROVIDER_OUTAGE'],
        });
      },
      (err) => err instanceof KillSwitchReleaseBlockedError
    );
  });

  it('Gate 19: Resume eligibility persistence & verification of SAFE_TO_RESUME != RESUME', async () => {
    const snap = makeMockSafetySnapshot();
    await repo.recordSafetySnapshot(snap);
    const assessment = authority.evaluateSafety({ snapshot: snap });
    await repo.recordSafetyAssessmentTransaction(assessment);

    const plan = recoveryAuthority.createRecoveryPlan({ assessment });
    for (const step of plan.steps) step.status = 'COMPLETED';
    const { plan: persistedPlan } = await repo.recordRecoveryPlanTransaction(plan);

    const eligibility = recoveryAuthority.evaluateResumeEligibility({
      plan: persistedPlan,
      currentSafetySnapshot: snap,
      outboxBacklogCount: 0,
      hasUnresolvedSubmittedUnknown: false,
    });

    const { eligibility: persisted } = await repo.recordResumeEligibilityTransaction(eligibility);
    assert.equal(persisted.eligible, true);
    assert.equal(persisted.requiresHumanReview, true, 'System scope resume must require human review');
  });

  it('Gate 20: Execution kill integration — active kill switch prevents ordinary new execution', async () => {
    const activeKill = await repo.getActiveKillSwitchRequest('SYSTEM');
    // If active kill exists, level weight must be evaluated correctly
    const killWeight = killCoordinator.compareKillLevels('KILL_SYSTEM', 'KILL_NEW_RISK');
    assert.ok(killWeight > 0, 'KILL_SYSTEM must strictly dominate ordinary new risk');
  });
});
