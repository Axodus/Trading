/**
 * AXODUS-TRADING-EPIC-01 / REQ-14
 * Autonomous Trading Harness Integration Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TradingHarnessCoordinator,
  HarnessEnvironmentProhibitedError,
  HarnessRevisionMismatchError,
  HarnessStaleStateError,
  HarnessAuthorityBypassAttemptError,
  HarnessKillSwitchActiveError,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

describe('AXODUS-TRADING-EPIC-01 / REQ-14 — Trading Harness Integration', () => {
  const coordinator = new TradingHarnessCoordinator();

  const makeMockDependencies = (overrides = {}) => {
    const now = '2026-09-20T12:00:00.000Z';
    return {
      marketObservation: { observationId: 'obs_001', instrument: 'BTCUSDT', venue: 'binance_perpetual' },
      marketState: {
        marketStateId: 'ms_001',
        instrument: 'BTCUSDT',
        timeframe: '1m',
        marketTime: now,
        observedAt: now,
        constructedAt: now,
        validityContext: 'paper',
        freshness: 'current',
        schemaVersion: '1.0.0',
        features: [],
        sourceRefs: ['obs_001'],
        completeness: 'complete',
        validationRefs: [],
      },
      opportunity: {
        opportunityId: 'opp_001',
        instrument: 'BTCUSDT',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        timeframe: '1m',
        marketStateId: 'ms_001',
        qualification: 'qualified',
        expectedCharacteristics: {},
        evidenceRefs: ['ms_001'],
        createdAt: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
      },
      tradeProposal: {
        proposalId: 'prop_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        strategyRevision: { strategy: 'strat_alpha', revision: '1.0.0', revisionId: 'rev_001' },
        opportunity: { opportunityId: 'opp_001', marketStateId: 'ms_001', instrument: 'BTCUSDT', venue: 'binance_perpetual', timeframe: '1m' },
        marketState: { marketStateId: 'ms_001', schemaVersion: '1.0.0', validityContext: 'paper' },
        action: 'buy',
        sizing: { requestedQuantity: '0.010000000000', requestedCapital: '500.000000000000' },
        expectedReturn: {},
        expectedRisk: {},
        liquidityAssumptions: {},
        duration: {},
        costAssumptions: {},
        eligibility: { eligibilityId: 'el_001', strategyRevisionId: 'rev_001', decision: 'ELIGIBLE', policyVersion: '1.0.0' },
        correlationId: 'corr_001',
        idempotencyKey: 'idem_prop_001',
        createdAt: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
        evidenceRefs: [],
      },
      portfolioDecision: {
        portfolioDecisionId: 'port_dec_001',
        proposalIds: ['prop_001'],
        outcome: 'APPROVED',
        requestedCapital: '500.000000000000',
        approvedCapital: '500.000000000000',
        currentExposure: {},
        correlatedExposure: {},
        concentration: {},
        leverage: {},
        liquidity: {},
        duration: {},
        drawdown: {},
        executionCost: {},
        modifications: {},
        rationale: 'Portfolio approved',
        evidenceRefs: ['prop_001'],
        createdAt: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
      },
      riskDecision: {
        riskDecisionId: 'risk_dec_001',
        proposalId: 'prop_001',
        portfolioDecisionId: 'port_dec_001',
        marketStateId: 'ms_001',
        strategyRevisionId: 'rev_001',
        outcome: 'ALLOW',
        policyVersion: '1.0.0',
        hardLimitEvaluation: {},
        killSwitch: { active: false },
        modifications: {},
        rationale: 'Risk approved within hard limits',
        evidenceRefs: ['port_dec_001'],
        decidedAt: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
      },
      tradingIntent: {
        intentId: 'intent_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        marketStateId: 'ms_001',
        opportunityId: 'opp_001',
        proposalId: 'prop_001',
        portfolioDecisionId: 'port_dec_001',
        riskDecisionId: 'risk_dec_001',
        eligibilityId: 'el_001',
        instrument: 'BTCUSDT',
        venue: 'binance_perpetual',
        action: 'buy',
        approvedQuantity: '0.010000000000',
        approvedCapital: '500.000000000000',
        executionPolicyRef: 'exec_pol_v1',
        correlationId: 'corr_001',
        idempotencyKey: 'idem_intent_001',
        createdAt: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
        evidenceRefs: [],
      },
      executionIntent: {
        executionIntentId: 'exec_intent_001',
        tradingIntentId: 'intent_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        instrument: 'BTCUSDT',
        marketType: 'futures',
        side: 'buy',
        authorizedCapital: '500.000000000000',
        authorizedQuantity: '0.010000000000',
        authorizedLeverage: '1.000000000000',
        executionCapital: '500.000000000000',
        executionQuantity: '0.010000000000',
        executionLeverage: '1.000000000000',
        venue: 'binance_perpetual',
        targetAdapterType: 'simulated',
        constraints: { orderType: 'limit' },
        tradingIntentDigest: 'digest_intent_001',
        authorizationContextDigest: 'digest_auth_001',
        executionPolicyRef: 'DEFAULT_EXECUTION_POLICY_V1',
        correlationId: 'corr_001',
        idempotencyKey: 'idem_exec_001',
        createdAt: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
        evidenceRefs: [],
      },
      executionAttempt: {
        attemptId: 'attempt_001',
        executionIntentId: 'exec_intent_001',
        tradingIntentId: 'intent_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        adapterType: 'simulated',
        venue: 'binance_perpetual',
        environment: 'SIMULATED',
        attemptNumber: 1,
        idempotencyKey: 'idem_attempt_001',
        clientOrderId: 'ax_client_ord_001',
        status: 'COMPLETED',
        createdAt: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
      },
      canonicalOrder: {
        canonicalOrderId: 'ord_001',
        executionIntentId: 'exec_intent_001',
        executionAttemptId: 'attempt_001',
        tradingIntentId: 'intent_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        provider: 'binance',
        venue: 'binance_perpetual',
        instrument: 'BTCUSDT',
        side: 'buy',
        orderType: 'limit',
        authorizedQuantity: '0.010000000000',
        executionQuantity: '0.010000000000',
        cumulativeFilledQuantity: '0.010000000000',
        remainingQuantity: '0.000000000000',
        weightedAveragePrice: '50000.000000000000',
        state: 'FILLED',
        orderVersion: 2,
        clientOrderId: 'ax_client_ord_001',
        createdAt: now,
        updatedAt: now,
      },
      executionResult: {
        executionResultId: 'exec_res_001',
        executionIntentId: 'exec_intent_001',
        tradingIntentId: 'intent_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        adapterType: 'simulated',
        mode: 'SIMULATED',
        status: 'SIMULATED_FILL',
        requestedQuantity: '0.010000000000',
        acceptedQuantity: '0.010000000000',
        simulatedFilledQuantity: '0.010000000000',
        simulatedAveragePrice: '50000.000000000000',
        fees: { asset: 'USDT', amount: '0.200000000000' },
        reasonCodes: [],
        createdAt: now,
        completedAt: now,
      },
      diagnostics: {
        diagnosticsId: 'diag_001',
        executionResultId: 'exec_res_001',
        executionIntentId: 'exec_intent_001',
        canonicalOrderId: 'ord_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        venue: 'binance_perpetual',
        instrument: 'BTCUSDT',
        environment: 'SIMULATED',
        side: 'buy',
        authorizedQuantity: '0.010000000000',
        filledQuantity: '0.010000000000',
        remainingQuantity: '0.000000000000',
        fillRatio: '1.000000000000',
        realizedExecutionPrice: '50000.000000000000',
        referencePrice: '50000.000000000000',
        slippageBps: '0.000000000000',
        slippageAmount: '0.000000000000',
        fees: [{ asset: 'USDT', amount: '0.200000000000', source: 'fill' }],
        accountingCurrency: 'USDT',
        normalizedFeesTotal: '0.200000000000',
        timing: {},
        quality: 'COMPLETE',
        policyId: 'DEFAULT_EXECUTION_DIAGNOSTICS_POLICY',
        policyRevision: 'DEFAULT_EXECUTION_DIAGNOSTICS_POLICY_V1',
        inputDigest: 'digest_diag_001',
        createdAt: now,
        asOf: now,
      },
      pnlAttribution: {
        pnlAttributionId: 'pnl_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        executionIntentId: 'exec_intent_001',
        executionResultId: 'exec_res_001',
        canonicalOrderId: 'ord_001',
        venue: 'binance_perpetual',
        instrument: 'BTCUSDT',
        environment: 'SIMULATED',
        accountingCurrency: 'USDT',
        positionSide: 'long',
        realizedGrossPnl: '10.000000000000',
        canonicalFees: '0.200000000000',
        canonicalFinancingCosts: '0.000000000000',
        canonicalOtherCosts: '0.000000000000',
        realizedNetPnl: '9.800000000000',
        realizedQuantity: '0.010000000000',
        isPositionClosed: true,
        remainingOpenQuantity: '0.000000000000',
        costBasisRemaining: '0.000000000000',
        components: [],
        quality: 'COMPLETE',
        policyId: 'DEFAULT_PNL_ATTRIBUTION_POLICY',
        policyRevision: 'DEFAULT_PNL_ATTRIBUTION_POLICY_V1',
        inputDigest: 'digest_pnl_001',
        createdAt: now,
        asOf: now,
      },
      feedbackSnapshot: {
        feedbackSnapshotId: 'feed_snap_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        venue: 'binance_perpetual',
        instrument: 'BTCUSDT',
        environment: 'SIMULATED',
        windowStart: '2026-09-20T11:00:00.000Z',
        windowEnd: now,
        asOf: now,
        diagnosticsRefs: ['diag_001'],
        pnlAttributionRefs: ['pnl_001'],
        quality: 'COMPLETE',
        createdAt: now,
        inputDigest: 'digest_feed_001',
      },
      performanceEvaluation: {
        evaluationId: 'perf_eval_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        expectedEnvelopeId: 'env_001',
        comparisonPolicyId: 'DEFAULT_PERFORMANCE_COMPARISON_POLICY',
        comparisonPolicyRevision: 'DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1',
        observationWindowStart: '2026-09-20T11:00:00.000Z',
        observationWindowEnd: now,
        asOf: now,
        feedbackSnapshotRefs: ['feed_snap_001'],
        diagnosticsRefs: ['diag_001'],
        pnlAttributionRefs: ['pnl_001'],
        expectedMetrics: {},
        observedMetrics: {},
        deviations: {},
        sampleSize: { tradeCount: 1, observationCount: 1 },
        quality: 'COMPLETE',
        createdAt: now,
        inputDigest: 'digest_eval_001',
      },
      driftAssessment: {
        assessmentId: 'drift_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        performanceEvaluationId: 'perf_eval_001',
        driftPolicyId: 'DEFAULT_DRIFT_POLICY',
        driftPolicyRevision: 'DEFAULT_DRIFT_POLICY_V1',
        classification: 'NORMAL',
        metricAssessments: [],
        driftDimensions: [],
        sampleSize: { tradeCount: 1 },
        persistenceState: { consecutiveDegradedWindows: 0, windowsMonitored: 1 },
        quality: 'COMPLETE',
        createdAt: now,
        asOf: now,
        inputDigest: 'digest_drift_001',
      },
      governanceDecision: {
        governanceDecisionId: 'gov_dec_001',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        governanceSnapshotId: 'gov_snap_001',
        policyId: 'DEFAULT_STRATEGY_GOVERNANCE_POLICY',
        policyRevision: 'DEFAULT_STRATEGY_GOVERNANCE_POLICY_V1',
        classification: 'CONTINUE',
        reasonCodes: ['GOVERNANCE_ALL_CONDITIONS_NORMAL'],
        requiredInterventions: [],
        createdAt: now,
        asOf: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
        inputDigest: 'digest_gov_001',
      },
      safetyAssessment: {
        assessmentId: 'safe_assess_001',
        safetySnapshotId: 'safe_snap_001',
        policyId: 'DEFAULT_SYSTEM_SAFETY_POLICY',
        policyRevision: 'DEFAULT_SYSTEM_SAFETY_POLICY_V1',
        state: 'NORMAL',
        severity: 'INFO',
        scope: 'SYSTEM',
        reasonCodes: ['SYSTEM_ALL_DOMAINS_HEALTHY'],
        requiredActions: [],
        activeKillLevels: ['KILL_NONE'],
        createdAt: now,
        asOf: now,
        expiresAt: '2026-09-20T13:00:00.000Z',
        inputDigest: 'digest_safety_001',
      },
      ...overrides,
    };
  };

  describe('1. Environment Gating & Gating Invariants', () => {
    it('executes successfully under PAPER environment', async () => {
      const deps = makeMockDependencies();
      const res = await coordinator.runAutonomousControlCycle({
        harnessRunId: 'run_paper_001',
        environment: 'PAPER',
        mode: 'AUTONOMOUS_CYCLE',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        instrument: 'BTCUSDT',
        venue: 'binance_perpetual',
        correlationId: 'corr_001',
        causationId: 'caus_001',
        asOf: '2026-09-20T12:00:00.000Z',
        dependencies: deps,
      });

      assert.equal(res.run.status, 'COMPLETED');
      assert.equal(res.run.currentStage, 'COMPLETE');
      assert.equal(res.transitions.length, 16);
      assert.equal(res.evidencePackage.timeline.length, 16);
      assert.equal(res.evidencePackage.economicSummary?.realizedNetPnl, '9.800000000000');
    });

    it('rejects MAINNET environment with HarnessEnvironmentProhibitedError', async () => {
      const deps = makeMockDependencies();
      await assert.rejects(
        () =>
          coordinator.runAutonomousControlCycle({
            harnessRunId: 'run_mainnet_fail',
            environment: 'MAINNET',
            mode: 'AUTONOMOUS_CYCLE',
            strategyId: 'strat_alpha',
            strategyRevisionId: 'rev_001',
            instrument: 'BTCUSDT',
            venue: 'binance_perpetual',
            correlationId: 'corr_001',
            causationId: 'caus_001',
            asOf: '2026-09-20T12:00:00.000Z',
            dependencies: deps,
          }),
        HarnessEnvironmentProhibitedError
      );
    });

    it('rejects PRODUCTION environment with HarnessEnvironmentProhibitedError', async () => {
      const deps = makeMockDependencies();
      await assert.rejects(
        () =>
          coordinator.runAutonomousControlCycle({
            harnessRunId: 'run_prod_fail',
            environment: 'PRODUCTION',
            mode: 'AUTONOMOUS_CYCLE',
            strategyId: 'strat_alpha',
            strategyRevisionId: 'rev_001',
            instrument: 'BTCUSDT',
            venue: 'binance_perpetual',
            correlationId: 'corr_001',
            causationId: 'caus_001',
            asOf: '2026-09-20T12:00:00.000Z',
            dependencies: deps,
          }),
        HarnessEnvironmentProhibitedError
      );
    });
  });

  describe('2. Safety Preflight & KillSwitch Enforcement', () => {
    it('blocks ordinary risk-increasing execution when KILL_SYSTEM is active', async () => {
      const deps = makeMockDependencies();
      await assert.rejects(
        () =>
          coordinator.runAutonomousControlCycle({
            harnessRunId: 'run_kill_sys',
            environment: 'PAPER',
            mode: 'AUTONOMOUS_CYCLE',
            strategyId: 'strat_alpha',
            strategyRevisionId: 'rev_001',
            instrument: 'BTCUSDT',
            venue: 'binance_perpetual',
            correlationId: 'corr_001',
            causationId: 'caus_001',
            asOf: '2026-09-20T12:00:00.000Z',
            dependencies: deps,
            activeKillSwitchLevel: 'KILL_SYSTEM',
          }),
        HarnessKillSwitchActiveError
      );
    });

    it('blocks execution when KILL_EXECUTION is active', async () => {
      const deps = makeMockDependencies();
      await assert.rejects(
        () =>
          coordinator.runAutonomousControlCycle({
            harnessRunId: 'run_kill_exec',
            environment: 'PAPER',
            mode: 'AUTONOMOUS_CYCLE',
            strategyId: 'strat_alpha',
            strategyRevisionId: 'rev_001',
            instrument: 'BTCUSDT',
            venue: 'binance_perpetual',
            correlationId: 'corr_001',
            causationId: 'caus_001',
            asOf: '2026-09-20T12:00:00.000Z',
            dependencies: deps,
            activeKillSwitchLevel: 'KILL_EXECUTION',
          }),
        HarnessKillSwitchActiveError
      );
    });
  });

  describe('3. StrategyRevision & TOCTOU Verification', () => {
    it('rejects cross-revision proposal with HarnessRevisionMismatchError', async () => {
      const deps = makeMockDependencies({
        tradeProposal: {
          ...makeMockDependencies().tradeProposal,
          strategyRevisionId: 'rev_999_incompatible',
        },
      });

      await assert.rejects(
        () =>
          coordinator.runAutonomousControlCycle({
            harnessRunId: 'run_rev_mismatch',
            environment: 'PAPER',
            mode: 'AUTONOMOUS_CYCLE',
            strategyId: 'strat_alpha',
            strategyRevisionId: 'rev_001',
            instrument: 'BTCUSDT',
            venue: 'binance_perpetual',
            correlationId: 'corr_001',
            causationId: 'caus_001',
            asOf: '2026-09-20T12:00:00.000Z',
            dependencies: deps,
          }),
        HarnessRevisionMismatchError
      );
    });

    it('rejects stale MarketState with HarnessStaleStateError', async () => {
      const deps = makeMockDependencies({
        marketState: {
          ...makeMockDependencies().marketState,
          observedAt: '2026-09-20T11:00:00.000Z', // 1 hour old vs asOf
        },
      });

      await assert.rejects(
        () =>
          coordinator.runAutonomousControlCycle({
            harnessRunId: 'run_stale_market',
            environment: 'PAPER',
            mode: 'AUTONOMOUS_CYCLE',
            strategyId: 'strat_alpha',
            strategyRevisionId: 'rev_001',
            instrument: 'BTCUSDT',
            venue: 'binance_perpetual',
            correlationId: 'corr_001',
            causationId: 'caus_001',
            asOf: '2026-09-20T12:00:00.000Z',
            dependencies: deps,
          }),
        HarnessStaleStateError
      );
    });
  });

  describe('4. Risk Decision Handling & Monotonicity', () => {
    it('handles Risk REJECT cleanly: terminates with zero downstream intent/order', async () => {
      const deps = makeMockDependencies({
        riskDecision: {
          ...makeMockDependencies().riskDecision,
          outcome: 'REJECT',
        },
      });

      const res = await coordinator.runAutonomousControlCycle({
        harnessRunId: 'run_risk_reject',
        environment: 'PAPER',
        mode: 'AUTONOMOUS_CYCLE',
        strategyId: 'strat_alpha',
        strategyRevisionId: 'rev_001',
        instrument: 'BTCUSDT',
        venue: 'binance_perpetual',
        correlationId: 'corr_001',
        causationId: 'caus_001',
        asOf: '2026-09-20T12:00:00.000Z',
        dependencies: deps,
      });

      assert.equal(res.run.status, 'COMPLETED');
      assert.equal(res.run.failureReason, 'RISK_REJECTED');
      assert.equal(res.run.tradingIntentRef, undefined);
      assert.equal(res.run.executionIntentRef, undefined);
      assert.equal(res.run.canonicalOrderRef, undefined);
    });

    it('rejects quantity enlargement on Risk MODIFY with HarnessAuthorityBypassAttemptError', async () => {
      const deps = makeMockDependencies({
        riskDecision: {
          ...makeMockDependencies().riskDecision,
          outcome: 'MODIFY',
        },
        portfolioDecision: {
          ...makeMockDependencies().portfolioDecision,
          approvedCapital: '1000.000000000000', // larger than requested 500
        },
      });

      await assert.rejects(
        () =>
          coordinator.runAutonomousControlCycle({
            harnessRunId: 'run_enlarged_fail',
            environment: 'PAPER',
            mode: 'AUTONOMOUS_CYCLE',
            strategyId: 'strat_alpha',
            strategyRevisionId: 'rev_001',
            instrument: 'BTCUSDT',
            venue: 'binance_perpetual',
            correlationId: 'corr_001',
            causationId: 'caus_001',
            asOf: '2026-09-20T12:00:00.000Z',
            dependencies: deps,
          }),
        HarnessAuthorityBypassAttemptError
      );
    });
  });

  describe('5. Readiness Assessment Evaluation', () => {
    it('evaluates all 12 dimensions and returns PASS_WITH_REMEDIATION due to DEBT-AUD-A-03', () => {
      const report = coordinator.evaluateReadiness({
        reportId: 'rep_001',
        evaluatedAt: '2026-09-20T12:00:00.000Z',
      });

      assert.equal(report.overallStatus, 'PASS_WITH_REMEDIATION');
      assert.equal(report.environment, 'PAPER_TESTNET_ONLY');
      assert.equal(report.p0Blockers.length, 0);
      assert.ok(report.p2Findings[0].includes('DEBT-AUD-A-03'));
      assert.equal(report.dimensionEvaluations.ARCHITECTURE_CONFORMANCE.status, 'PASS');
      assert.equal(report.dimensionEvaluations.CONTRACT_CONFORMANCE.status, 'PASS');
      assert.equal(report.dimensionEvaluations.PERSISTENCE_DURABILITY.status, 'PASS');
      assert.equal(report.dimensionEvaluations.EXECUTION_CONTROL.status, 'PASS');
      assert.equal(report.dimensionEvaluations.RECONCILIATION.status, 'PASS');
      assert.equal(report.dimensionEvaluations.ECONOMIC_ACCOUNTING.status, 'PASS');
      assert.equal(report.dimensionEvaluations.QUANT_FEEDBACK.status, 'PASS');
      assert.equal(report.dimensionEvaluations.GOVERNANCE_CONTROL.status, 'PASS');
      assert.equal(report.dimensionEvaluations.SYSTEM_SAFETY.status, 'PASS');
      assert.equal(report.dimensionEvaluations.RECOVERY.status, 'PASS');
      assert.equal(report.dimensionEvaluations.OBSERVABILITY.status, 'PASS');
      assert.equal(report.dimensionEvaluations.TESTNET_PROVIDER.status, 'PASS');
    });

    it('classifies overallStatus as FAIL when any P0 blocker is present', () => {
      const report = coordinator.evaluateReadiness({
        reportId: 'rep_002',
        evaluatedAt: '2026-09-20T12:00:00.000Z',
        p0Blockers: ['CRITICAL_AUTHORITY_BYPASS_DETECTED'],
      });

      assert.equal(report.overallStatus, 'FAIL');
      assert.equal(report.p0Blockers.length, 1);
    });
  });
});
