/**
 * AXODUS-TRADING-EPIC-01 / REQ-13
 * System Safety & Recovery Authority Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SYSTEM_SAFETY_POLICY_V1,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import {
  SystemSafetyAuthority,
  KillSwitchCoordinator,
  SystemRecoveryAuthority,
  SafetySnapshotStaleError,
  SafetyAuthorityBypassAttemptError,
  UnauthorizedSafetyActionError,
  KillSwitchReleaseBlockedError,
  RecoveryDependencyCycleError,
  RecoveryFencingTokenError,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

describe('AXODUS-TRADING-EPIC-01 / REQ-13 — System Safety & Recovery', () => {
  const safetyAuthority = new SystemSafetyAuthority();
  const killCoordinator = new KillSwitchCoordinator();
  const recoveryAuthority = new SystemRecoveryAuthority();

  const makeHealthySnapshot = (overrides = {}) => ({
    safetySnapshotId: 'safe_snap_001',
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
    createdAt: '2026-09-20T12:00:00.000Z',
    asOf: '2026-09-20T12:00:00.000Z',
    expiresAt: '2026-09-20T13:00:00.000Z',
    inputDigest: 'digest_safe_001',
    ...overrides,
  });

  describe('1. System Safety Evaluation & TOCTOU Freshness', () => {
    it('evaluates successfully as NORMAL when all critical domains are HEALTHY', () => {
      const snap = makeHealthySnapshot();
      const assessment = safetyAuthority.evaluateSafety({
        snapshot: snap,
        evaluationTime: '2026-09-20T12:15:00.000Z',
      });

      assert.equal(assessment.state, 'NORMAL');
      assert.equal(assessment.severity, 'INFO');
      assert.deepEqual(assessment.activeKillLevels, ['KILL_NONE']);
      assert.ok(assessment.reasonCodes.includes('SYSTEM_ALL_DOMAINS_HEALTHY'));
    });

    it('strictly throws SafetySnapshotStaleError when snapshot is expired', () => {
      const snap = makeHealthySnapshot({ expiresAt: '2026-09-20T12:00:00.000Z' });
      assert.throws(
        () => {
          safetyAuthority.evaluateSafety({
            snapshot: snap,
            evaluationTime: '2026-09-20T12:01:00.000Z',
          });
        },
        (err) => err instanceof SafetySnapshotStaleError
      );
    });

    it('evaluates database failure as EMERGENCY with KILL_SYSTEM level', () => {
      const snap = makeHealthySnapshot({ databaseState: 'UNAVAILABLE' });
      const assessment = safetyAuthority.evaluateSafety({
        snapshot: snap,
        evaluationTime: '2026-09-20T12:15:00.000Z',
      });

      assert.equal(assessment.state, 'EMERGENCY');
      assert.equal(assessment.severity, 'CRITICAL');
      assert.ok(assessment.activeKillLevels.includes('KILL_SYSTEM'));
      assert.ok(assessment.reasonCodes.includes('DATABASE_UNAVAILABLE'));
      assert.ok(assessment.requiredActions.includes('RESTORE_DATABASE'));
    });

    it('evaluates market data outage as CONTAINED with KILL_NEW_RISK level', () => {
      const snap = makeHealthySnapshot({ marketDataState: 'UNAVAILABLE' });
      const assessment = safetyAuthority.evaluateSafety({
        snapshot: snap,
        evaluationTime: '2026-09-20T12:15:00.000Z',
      });

      assert.equal(assessment.state, 'CONTAINED');
      assert.equal(assessment.severity, 'HIGH');
      assert.ok(assessment.activeKillLevels.includes('KILL_NEW_RISK'));
      assert.ok(assessment.reasonCodes.includes('MARKET_DATA_STALE'));
      assert.ok(assessment.requiredActions.includes('RESYNC_MARKET_DATA'));
    });

    it('evaluates execution ambiguity as EMERGENCY with KILL_EXECUTION level', () => {
      const snap = makeHealthySnapshot({ executionState: 'UNAVAILABLE' });
      const assessment = safetyAuthority.evaluateSafety({
        snapshot: snap,
        evaluationTime: '2026-09-20T12:15:00.000Z',
      });

      assert.equal(assessment.state, 'EMERGENCY');
      assert.equal(assessment.severity, 'CRITICAL');
      assert.ok(assessment.activeKillLevels.includes('KILL_EXECUTION'));
      assert.ok(assessment.reasonCodes.includes('EXECUTION_STATE_AMBIGUOUS'));
      assert.ok(assessment.requiredActions.includes('RECONCILE_OPEN_ORDERS'));
    });

    it('fails closed when a critical dependency status is UNKNOWN (never NORMAL)', () => {
      const snap = makeHealthySnapshot({ databaseState: 'UNKNOWN' });
      const assessment = safetyAuthority.evaluateSafety({
        snapshot: snap,
        evaluationTime: '2026-09-20T12:15:00.000Z',
      });

      assert.equal(assessment.state, 'CONTAINED');
      assert.ok(assessment.reasonCodes.includes('CRITICAL_DEPENDENCY_UNKNOWN_DATABASE'));
      assert.notEqual(assessment.state, 'NORMAL');
    });

    it('evaluates provider-specific failure with scoped VENUE containment', () => {
      const snap = makeHealthySnapshot({
        providerStates: [{ provider: 'binance', status: 'UNAVAILABLE', venue: 'binance_perpetual' }],
      });
      const assessment = safetyAuthority.evaluateSafety({
        snapshot: snap,
        evaluationTime: '2026-09-20T12:15:00.000Z',
      });

      assert.equal(assessment.state, 'CONTAINED');
      assert.equal(assessment.scope, 'VENUE');
      assert.equal(assessment.scopeId, 'binance_perpetual');
      assert.ok(assessment.reasonCodes.includes('PROVIDER_UNAVAILABLE_BINANCE'));
      assert.ok(assessment.activeKillLevels.includes('KILL_VENUE'));
    });
  });

  describe('2. Kill-Switch Coordination & Precedence', () => {
    it('compares kill switch levels deterministically by precedence weight', () => {
      assert.ok(killCoordinator.compareKillLevels('KILL_SYSTEM', 'KILL_EXECUTION') > 0);
      assert.ok(killCoordinator.compareKillLevels('KILL_EXECUTION', 'KILL_VENUE') > 0);
      assert.ok(killCoordinator.compareKillLevels('KILL_VENUE', 'KILL_PROVIDER') > 0);
      assert.ok(killCoordinator.compareKillLevels('KILL_PROVIDER', 'KILL_INSTRUMENT') > 0);
      assert.ok(killCoordinator.compareKillLevels('KILL_INSTRUMENT', 'KILL_STRATEGY') > 0);
      assert.ok(killCoordinator.compareKillLevels('KILL_STRATEGY', 'KILL_NEW_RISK') > 0);
      assert.ok(killCoordinator.compareKillLevels('KILL_NEW_RISK', 'KILL_NONE') > 0);
      assert.equal(killCoordinator.compareKillLevels('KILL_SYSTEM', 'KILL_SYSTEM'), 0);
    });

    it('creates an immutable latched KillSwitchRequest from an assessment', () => {
      const snap = makeHealthySnapshot({ databaseState: 'UNAVAILABLE' });
      const assessment = safetyAuthority.evaluateSafety({ snapshot: snap });

      const req = killCoordinator.createKillSwitchRequest(
        assessment,
        assessment.scope,
        assessment.scopeId,
        'KILL_SYSTEM',
        'CRITICAL',
        ['DATABASE_UNAVAILABLE']
      );

      assert.equal(req.status, 'REQUESTED');
      assert.equal(req.isLatched, true);
      assert.equal(req.level, 'KILL_SYSTEM');
      assert.deepEqual(req.activeReasons, ['DATABASE_UNAVAILABLE']);
    });

    it('evaluates manual emergency kill command for authorized operator', () => {
      const req = killCoordinator.evaluateManualKill({
        scope: 'SYSTEM',
        level: 'KILL_SYSTEM',
        reason: 'MANUAL_PANIC_TRIGGER',
        authorizedOperator: 'op_risk_chief_01',
      });

      assert.equal(req.status, 'ACTIVE');
      assert.equal(req.level, 'KILL_SYSTEM');
      assert.ok(req.reasonCodes.includes('MANUAL_EMERGENCY_KILL'));
    });

    it('strictly rejects unauthorized manual kill attempts', () => {
      assert.throws(
        () => {
          killCoordinator.evaluateManualKill({
            scope: 'SYSTEM',
            level: 'KILL_SYSTEM',
            reason: 'UNAUTHORIZED_CALL',
            authorizedOperator: 'untrusted_guest_99',
          });
        },
        (err) => err instanceof UnauthorizedSafetyActionError
      );
    });

    it('blocks manual release when unresolved reasons remain', () => {
      const req = killCoordinator.evaluateManualKill({
        scope: 'SYSTEM',
        level: 'KILL_SYSTEM',
        reason: 'MANUAL_PANIC_TRIGGER',
        authorizedOperator: 'op_risk_chief_01',
      });

      assert.throws(
        () => {
          killCoordinator.evaluateManualRelease({
            activeRequest: req,
            authorizedOperator: 'op_risk_chief_01',
            currentSafetyState: 'NORMAL',
            unresolvedReasons: ['DATABASE_UNAVAILABLE'],
          });
        },
        (err) => err instanceof KillSwitchReleaseBlockedError
      );
    });

    it('blocks manual release when current safety state is not NORMAL or SAFE_TO_RESUME', () => {
      const req = killCoordinator.evaluateManualKill({
        scope: 'SYSTEM',
        level: 'KILL_SYSTEM',
        reason: 'MANUAL_PANIC_TRIGGER',
        authorizedOperator: 'op_risk_chief_01',
      });

      assert.throws(
        () => {
          killCoordinator.evaluateManualRelease({
            activeRequest: req,
            authorizedOperator: 'op_risk_chief_01',
            currentSafetyState: 'EMERGENCY',
            unresolvedReasons: [],
          });
        },
        (err) => err instanceof KillSwitchReleaseBlockedError
      );
    });

    it('allows manual release when authorized and all conditions are resolved', () => {
      const req = killCoordinator.evaluateManualKill({
        scope: 'SYSTEM',
        level: 'KILL_SYSTEM',
        reason: 'MANUAL_PANIC_TRIGGER',
        authorizedOperator: 'op_risk_chief_01',
      });

      const allowed = killCoordinator.evaluateManualRelease({
        activeRequest: req,
        authorizedOperator: 'op_risk_chief_01',
        currentSafetyState: 'SAFE_TO_RESUME',
        unresolvedReasons: [],
      });

      assert.equal(allowed, true);
    });
  });

  describe('3. System Recovery Authority & Plan DAG', () => {
    it('constructs a valid recovery plan for database recovery', () => {
      const snap = makeHealthySnapshot({ databaseState: 'UNAVAILABLE' });
      const assessment = safetyAuthority.evaluateSafety({ snapshot: snap });
      const plan = recoveryAuthority.createRecoveryPlan({ assessment });

      assert.equal(plan.status, 'PENDING');
      assert.ok(plan.steps.some((s) => s.type === 'RESTORE_DATABASE'));
      assert.ok(plan.steps.some((s) => s.type === 'RECONCILE_OPEN_ORDERS'));
      assert.ok(plan.steps.some((s) => s.type === 'VALIDATE_RISK_STATE'));
      assert.ok(plan.steps.some((s) => s.type === 'READY_FOR_RESUME'));
    });

    it('constructs a valid recovery plan for execution ambiguity', () => {
      const snap = makeHealthySnapshot({ executionState: 'UNAVAILABLE' });
      const assessment = safetyAuthority.evaluateSafety({ snapshot: snap });
      const plan = recoveryAuthority.createRecoveryPlan({ assessment });

      assert.ok(plan.steps.some((s) => s.type === 'RESTORE_PROVIDER_CONNECTIVITY'));
      assert.ok(plan.steps.some((s) => s.type === 'RECONCILE_OPEN_ORDERS'));
      assert.ok(plan.steps.some((s) => s.type === 'RECONCILE_FILLS'));
      assert.ok(plan.steps.some((s) => s.type === 'RECONCILE_POSITIONS'));
      assert.ok(plan.steps.some((s) => s.type === 'REBUILD_ACCOUNTING'));
    });

    it('strictly throws RecoveryFencingTokenError when incoming lease token is older than active lease', () => {
      assert.throws(
        () => {
          recoveryAuthority.validateFencingToken(100, 99);
        },
        (err) => err instanceof RecoveryFencingTokenError
      );
    });

    it('accepts newer or equal lease token', () => {
      assert.doesNotThrow(() => {
        recoveryAuthority.validateFencingToken(100, 101);
      });
    });
  });

  describe('4. Resume Eligibility Evaluation', () => {
    it('evaluates eligible = true when all prerequisites pass', () => {
      const snap = makeHealthySnapshot();
      const assessment = safetyAuthority.evaluateSafety({ snapshot: snap });
      const plan = recoveryAuthority.createRecoveryPlan({ assessment });

      // Mark all steps COMPLETED
      for (const step of plan.steps) {
        step.status = 'COMPLETED';
      }

      const eligibility = recoveryAuthority.evaluateResumeEligibility({
        plan,
        currentSafetySnapshot: snap,
        outboxBacklogCount: 0,
        hasUnresolvedSubmittedUnknown: false,
      });

      assert.equal(eligibility.eligible, true);
      assert.equal(eligibility.failedPrerequisites.length, 0);
      assert.ok(eligibility.validatedPrerequisites.includes('ALL_RECOVERY_STEPS_COMPLETED'));
      assert.ok(eligibility.validatedPrerequisites.includes('NO_UNRESOLVED_SUBMITTED_UNKNOWN'));
    });

    it('evaluates eligible = false when incomplete steps remain', () => {
      const snap = makeHealthySnapshot();
      const assessment = safetyAuthority.evaluateSafety({ snapshot: snap });
      const plan = recoveryAuthority.createRecoveryPlan({ assessment });

      // Leave steps as PENDING
      const eligibility = recoveryAuthority.evaluateResumeEligibility({
        plan,
        currentSafetySnapshot: snap,
        outboxBacklogCount: 0,
        hasUnresolvedSubmittedUnknown: false,
      });

      assert.equal(eligibility.eligible, false);
      assert.ok(eligibility.failedPrerequisites.some((f) => f.includes('INCOMPLETE_RECOVERY_STEPS')));
    });

    it('evaluates eligible = false when unresolved SUBMITTED_UNKNOWN exists', () => {
      const snap = makeHealthySnapshot();
      const assessment = safetyAuthority.evaluateSafety({ snapshot: snap });
      const plan = recoveryAuthority.createRecoveryPlan({ assessment });
      for (const step of plan.steps) step.status = 'COMPLETED';

      const eligibility = recoveryAuthority.evaluateResumeEligibility({
        plan,
        currentSafetySnapshot: snap,
        outboxBacklogCount: 0,
        hasUnresolvedSubmittedUnknown: true,
      });

      assert.equal(eligibility.eligible, false);
      assert.ok(eligibility.failedPrerequisites.includes('UNRESOLVED_SUBMITTED_UNKNOWN_PRESENT'));
    });

    it('evaluates eligible = false when outbox backlog exceeds threshold', () => {
      const snap = makeHealthySnapshot();
      const assessment = safetyAuthority.evaluateSafety({ snapshot: snap });
      const plan = recoveryAuthority.createRecoveryPlan({ assessment });
      for (const step of plan.steps) step.status = 'COMPLETED';

      const eligibility = recoveryAuthority.evaluateResumeEligibility({
        plan,
        currentSafetySnapshot: snap,
        outboxBacklogCount: 500, // Exceeds threshold (100)
        hasUnresolvedSubmittedUnknown: false,
      });

      assert.equal(eligibility.eligible, false);
      assert.ok(eligibility.failedPrerequisites.some((f) => f.includes('OUTBOX_BACKLOG_EXCEEDED')));
    });

    it('evaluates eligible = false when market data is stale', () => {
      const snap = makeHealthySnapshot({ marketDataState: 'UNAVAILABLE' });
      const assessment = safetyAuthority.evaluateSafety({ snapshot: makeHealthySnapshot() });
      const plan = recoveryAuthority.createRecoveryPlan({ assessment });
      for (const step of plan.steps) step.status = 'COMPLETED';

      const eligibility = recoveryAuthority.evaluateResumeEligibility({
        plan,
        currentSafetySnapshot: snap,
        outboxBacklogCount: 0,
        hasUnresolvedSubmittedUnknown: false,
      });

      assert.equal(eligibility.eligible, false);
      assert.ok(eligibility.failedPrerequisites.some((f) => f.includes('MARKET_DATA_NOT_HEALTHY')));
    });
  });

  describe('5. Sovereignty Matrix & Non-Bypass Enforcement', () => {
    it('strictly throws SafetyAuthorityBypassAttemptError on attempt to write directly to sovereign domain tables', () => {
      const forbiddenTargets = [
        'risk_decisions',
        'strategy_health_heads',
        'strategy_lifecycle_heads',
        'portfolio_allocations',
        'canonical_orders',
        'canonical_fills',
      ];

      for (const target of forbiddenTargets) {
        assert.throws(
          () => {
            safetyAuthority.assertNoDirectAuthorityMutation(target);
          },
          (err) => err instanceof SafetyAuthorityBypassAttemptError
        );
      }
    });
  });
});

