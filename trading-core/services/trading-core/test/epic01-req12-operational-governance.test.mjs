/**
 * AXODUS-TRADING-EPIC-01 / REQ-12
 * Strategy Operational Governance, Revalidation Resolution & Controlled Intervention Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STRATEGY_OPERATIONAL_GOVERNANCE_POLICY_V1,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import {
  StrategyOperationalGovernanceAuthority,
  InterventionResolutionAuthority,
  GovernanceSnapshotStaleError,
  GovernanceRevisionMismatchError,
  InterventionDependencyCycleError,
  GovernanceAuthorityBypassAttemptError,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

describe('AXODUS-TRADING-EPIC-01 / REQ-12 — Strategy Operational Governance', () => {
  const authority = new StrategyOperationalGovernanceAuthority();
  const resolutionAuthority = new InterventionResolutionAuthority();

  const baseSnapshot = {
    governanceSnapshotId: 'gov_snap_001',
    strategyId: 'strat_alpha',
    strategyRevisionId: 'strat_alpha:r1',
    lifecycleState: 'PRODUCTION',
    lifecycleVersion: 10,
    healthState: 'HEALTHY',
    healthVersion: 5,
    operationalSnapshotId: 'op_snap_100',
    driftClassification: 'NORMAL',
    revalidationStatus: 'COMPLETED',
    revalidationOutcome: 'PASSED',
    createdAt: '2026-09-20T12:00:00.000Z',
    asOf: '2026-09-20T12:00:00.000Z',
    expiresAt: '2026-09-20T13:00:00.000Z',
    inputDigest: 'digest_123',
  };

  describe('1. Exact StrategyRevision Binding & TOCTOU Snapshot Freshness', () => {
    it('evaluates successfully when snapshot is fresh and revision matches', () => {
      const decision = authority.evaluateGovernance({
        snapshot: baseSnapshot,
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'CONTINUE');
      assert.equal(decision.strategyId, 'strat_alpha');
      assert.equal(decision.strategyRevisionId, 'strat_alpha:r1');
      assert.deepEqual(decision.requiredInterventions, []);
    });

    it('strictly throws GovernanceSnapshotStaleError on lifecycleVersion mismatch', () => {
      assert.throws(
        () =>
          authority.evaluateGovernance({
            snapshot: baseSnapshot,
            currentLifecycleVersion: 11, // stale!
            currentHealthVersion: 5,
            currentOperationalSnapshotId: 'op_snap_100',
            evaluationTime: '2026-09-20T12:30:00.000Z',
          }),
        GovernanceSnapshotStaleError
      );
    });

    it('strictly throws GovernanceSnapshotStaleError on healthVersion mismatch', () => {
      assert.throws(
        () =>
          authority.evaluateGovernance({
            snapshot: baseSnapshot,
            currentLifecycleVersion: 10,
            currentHealthVersion: 6, // stale!
            currentOperationalSnapshotId: 'op_snap_100',
            evaluationTime: '2026-09-20T12:30:00.000Z',
          }),
        GovernanceSnapshotStaleError
      );
    });

    it('strictly throws GovernanceSnapshotStaleError on operationalSnapshotId mismatch', () => {
      assert.throws(
        () =>
          authority.evaluateGovernance({
            snapshot: baseSnapshot,
            currentLifecycleVersion: 10,
            currentHealthVersion: 5,
            currentOperationalSnapshotId: 'op_snap_101', // stale!
            evaluationTime: '2026-09-20T12:30:00.000Z',
          }),
        GovernanceSnapshotStaleError
      );
    });

    it('strictly throws GovernanceSnapshotStaleError when snapshot is expired', () => {
      assert.throws(
        () =>
          authority.evaluateGovernance({
            snapshot: baseSnapshot,
            currentLifecycleVersion: 10,
            currentHealthVersion: 5,
            currentOperationalSnapshotId: 'op_snap_100',
            evaluationTime: '2026-09-20T14:00:00.000Z', // past expiresAt 13:00!
          }),
        GovernanceSnapshotStaleError
      );
    });
  });

  describe('2. Operational Governance Decision Matrix', () => {
    it('classifies as OBSERVE when drift is DEGRADED and health is HEALTHY', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          driftClassification: 'DEGRADED',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'OBSERVE');
      assert.ok(decision.requiredInterventions.includes('REQUEST_RISK_RESTRICTION'));
    });

    it('classifies as REVALIDATE when drift is MATERIAL', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          driftClassification: 'MATERIAL',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'REVALIDATE');
      assert.ok(decision.requiredInterventions.includes('REQUEST_REVALIDATION'));
      assert.ok(decision.requiredInterventions.includes('REQUEST_RISK_RESTRICTION'));
    });

    it('classifies as INTERVENE when drift is CRITICAL', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          driftClassification: 'CRITICAL',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'INTERVENE');
      assert.ok(decision.requiredInterventions.includes('REQUEST_SUSPENSION_REVIEW'));
      assert.ok(decision.requiredInterventions.includes('REQUEST_RISK_HALT_REVIEW'));
      assert.ok(decision.requiredInterventions.includes('REQUEST_CAPITAL_FREEZE'));
    });

    it('classifies as INTERVENE when revalidation fails', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          revalidationOutcome: 'FAILED',
          revalidationStatus: 'FAILED',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'INTERVENE');
      assert.ok(decision.requiredInterventions.includes('REQUEST_LIFECYCLE_DEMOTION'));
      assert.ok(decision.requiredInterventions.includes('REQUEST_CAPITAL_FREEZE'));
      assert.ok(decision.requiredInterventions.includes('REASSESS_HEALTH'));
    });

    it('classifies as BLOCKED when revalidation is INCONCLUSIVE (fail-closed)', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          revalidationOutcome: 'INCONCLUSIVE',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'BLOCKED');
      assert.ok(decision.requiredInterventions.includes('REQUEST_REVALIDATION'));
    });

    it('classifies as SUSPEND_REQUESTED when strategy health is SUSPENDED', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          healthState: 'SUSPENDED',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'SUSPEND_REQUESTED');
      assert.ok(decision.requiredInterventions.includes('REQUEST_SUSPENSION_REVIEW'));
    });

    it('classifies as RETIREMENT_REVIEW when lifecycle or health is RETIRED', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          lifecycleState: 'RETIRED',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'RETIREMENT_REVIEW');
      assert.ok(decision.requiredInterventions.includes('REQUEST_RETIREMENT_REVIEW'));
    });

    it('classifies as OBSERVE when drift is INSUFFICIENT_DATA (never unrestricted CONTINUE)', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          driftClassification: 'INSUFFICIENT_DATA',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decision.classification, 'OBSERVE');
      assert.ok(decision.reasonCodes.includes('INSUFFICIENT_DATA_OBSERVE'));
    });
  });

  describe('3. Intervention Plan & Dependency Cycle Detection', () => {
    it('creates an intervention plan with valid linear dependencies', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          driftClassification: 'MATERIAL',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      const req1 = authority.createInterventionRequest(
        decision,
        'REVALIDATION',
        'REQUEST_REVALIDATION',
        'HIGH',
        ['MATERIAL_DRIFT'],
        ['ev_001']
      );

      const req2 = authority.createInterventionRequest(
        decision,
        'RISK',
        'REQUEST_RISK_RESTRICTION',
        'HIGH',
        ['MATERIAL_DRIFT'],
        ['ev_001']
      );

      const plan = authority.createInterventionPlan(
        decision,
        [req1, req2],
        [{ requestId: req2.interventionRequestId, dependsOnRequestId: req1.interventionRequestId }]
      );

      assert.equal(plan.status, 'PENDING');
      assert.equal(plan.requests.length, 2);
    });

    it('strictly throws InterventionDependencyCycleError when circular dependency is present', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          driftClassification: 'MATERIAL',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      const req1 = authority.createInterventionRequest(
        decision,
        'REVALIDATION',
        'REQUEST_REVALIDATION',
        'HIGH',
        ['MATERIAL_DRIFT'],
        ['ev_001']
      );

      const req2 = authority.createInterventionRequest(
        decision,
        'RISK',
        'REQUEST_RISK_RESTRICTION',
        'HIGH',
        ['MATERIAL_DRIFT'],
        ['ev_001']
      );

      assert.throws(
        () =>
          authority.createInterventionPlan(decision, [req1, req2], [
            { requestId: req1.interventionRequestId, dependsOnRequestId: req2.interventionRequestId },
            { requestId: req2.interventionRequestId, dependsOnRequestId: req1.interventionRequestId }, // Cycle!
          ]),
        InterventionDependencyCycleError
      );
    });
  });

  describe('4. Intervention Resolution Authority', () => {
    it('evaluates plan resolution as RESOLVED when all requests are APPLIED', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          driftClassification: 'MATERIAL',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      const req1 = authority.createInterventionRequest(
        decision,
        'REVALIDATION',
        'REQUEST_REVALIDATION',
        'HIGH',
        ['MATERIAL_DRIFT'],
        ['ev_001']
      );

      const plan = authority.createInterventionPlan(decision, [req1]);

      const responses = [
        {
          responseId: 'resp_001',
          interventionRequestId: req1.interventionRequestId,
          targetAuthority: 'REVALIDATION',
          status: 'APPLIED',
          canonicalResultRef: 'ev_quant_rev_pass_01',
          respondedAt: '2026-09-20T12:45:00.000Z',
        },
      ];

      const resolution = resolutionAuthority.resolvePlan(plan, responses);
      assert.equal(resolution.status, 'RESOLVED');
      assert.equal(resolution.resolvedInterventions.length, 1);
      assert.equal(resolution.pendingInterventions.length, 0);
    });

    it('evaluates plan resolution as PARTIALLY_APPLIED when some requests are applied and others pending', () => {
      const decision = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          driftClassification: 'MATERIAL',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      const req1 = authority.createInterventionRequest(
        decision,
        'REVALIDATION',
        'REQUEST_REVALIDATION',
        'HIGH',
        ['MATERIAL_DRIFT'],
        ['ev_001']
      );
      const req2 = authority.createInterventionRequest(
        decision,
        'RISK',
        'REQUEST_RISK_RESTRICTION',
        'HIGH',
        ['MATERIAL_DRIFT'],
        ['ev_001']
      );

      const plan = authority.createInterventionPlan(decision, [req1, req2]);

      const responses = [
        {
          responseId: 'resp_001',
          interventionRequestId: req1.interventionRequestId,
          targetAuthority: 'REVALIDATION',
          status: 'APPLIED',
          canonicalResultRef: 'ev_quant_rev_pass_01',
          respondedAt: '2026-09-20T12:45:00.000Z',
        },
      ];

      const resolution = resolutionAuthority.resolvePlan(plan, responses);
      assert.equal(resolution.status, 'PARTIALLY_APPLIED');
      assert.equal(resolution.resolvedInterventions.length, 1);
      assert.equal(resolution.pendingInterventions.length, 1);
    });
  });

  describe('5. Sovereignty Matrix & Non-Bypass Enforcement', () => {
    it('strictly throws GovernanceAuthorityBypassAttemptError on attempt to directly mutate sovereign tables', () => {
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
  });

  describe('6. Property & Metamorphic Invariants', () => {
    it('Property: Strategy & Revision Isolation — evaluation remains bound strictly to revision in snapshot', () => {
      const decisionR1 = authority.evaluateGovernance({
        snapshot: baseSnapshot,
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      const decisionR2 = authority.evaluateGovernance({
        snapshot: {
          ...baseSnapshot,
          strategyRevisionId: 'strat_alpha:r2',
        },
        currentLifecycleVersion: 10,
        currentHealthVersion: 5,
        currentOperationalSnapshotId: 'op_snap_100',
        evaluationTime: '2026-09-20T12:30:00.000Z',
      });

      assert.equal(decisionR1.strategyRevisionId, 'strat_alpha:r1');
      assert.equal(decisionR2.strategyRevisionId, 'strat_alpha:r2');
      assert.notEqual(decisionR1.inputDigest, decisionR2.inputDigest);
    });
  });
});
