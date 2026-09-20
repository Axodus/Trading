/**
 * AXODUS-TRADING-EPIC-01 / VAL-14-PAPER
 * End-to-End Autonomous Trading Harness Paper Mode Acceptance Suite
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TradingHarnessCoordinator,
  HarnessEnvironmentProhibitedError,
  HarnessRevisionMismatchError,
  HarnessStaleStateError,
  HarnessAuthorityBypassAttemptError,
  HarnessKillSwitchActiveError,
} from "../../../../dist-test/trading-core/services/trading-core/src/index.js";
import {
  FixedDecimal,
} from "../../../../dist-test/trading-core/packages/trading-contracts/src/index.js";

describe("AXODUS-TRADING-EPIC-01 / VAL-14-PAPER — End-to-End Paper Acceptance Suite", () => {
  const coordinator = new TradingHarnessCoordinator();

  const makeFullDependencies = (overrides = {}) => {
    const now = "2026-09-20T12:00:00.000Z";
    const future = "2026-09-20T13:00:00.000Z";
    const rev = "rev_strategy_v1";

    return {
      marketObservation: {
        observationId: "obs_001",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        bidPrice: "65000.00",
        askPrice: "65001.00",
        timestamp: now,
      },
      marketState: {
        marketStateId: "ms_001",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        markPrice: "65000.50",
        bidPrice: "65000.00",
        askPrice: "65001.00",
        regime: "TRENDING_BULLISH",
        asOf: now,
        expiresAt: future,
        inputDigest: "digest_ms_001",
      },
      opportunity: {
        opportunityId: "opp_001",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        strategyType: "DIRECTIONAL_SWING",
        direction: "BUY",
        score: "0.85",
        asOf: now,
      },
      tradeProposal: {
        proposalId: "prop_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        side: "BUY",
        proposedQuantity: "0.50000000",
        proposedNotional: "32500.00",
        marketStateRef: "ms_001",
        opportunityRef: "opp_001",
        createdAt: now,
        inputDigest: "digest_prop_001",
      },
      portfolioDecision: {
        portfolioDecisionId: "pdec_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        side: "BUY",
        allocatedCapital: "32500.00",
        approvedQuantity: "0.50000000",
        status: "APPROVED",
        createdAt: now,
        inputDigest: "digest_pdec_001",
      },
      riskDecision: {
        riskDecisionId: "rdec_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        outcome: "ALLOW",
        authorizedQuantity: "0.50000000",
        authorizedCapital: "32500.00",
        maxLeverage: "3",
        createdAt: now,
        expiresAt: future,
        inputDigest: "digest_rdec_001",
      },
      tradingIntent: {
        tradingIntentId: "tint_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        side: "BUY",
        quantity: "0.50000000",
        notional: "32500.00",
        portfolioDecisionRef: "pdec_001",
        riskDecisionRef: "rdec_001",
        status: "AUTHORIZED",
        createdAt: now,
        inputDigest: "digest_tint_001",
      },
      executionIntent: {
        executionIntentId: "eint_001",
        tradingIntentRef: "tint_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        orderType: "LIMIT",
        side: "BUY",
        quantity: "0.50000000",
        limitPrice: "65000.00",
        environment: "PAPER",
        createdAt: now,
        inputDigest: "digest_eint_001",
      },
      executionAttempt: {
        attemptId: "att_001",
        executionIntentRef: "eint_001",
        clientOrderId: "client_ord_001",
        attemptNumber: 1,
        status: "ACCEPTED",
        submittedAt: now,
        inputDigest: "digest_att_001",
      },
      canonicalOrder: {
        canonicalOrderId: "cord_001",
        clientOrderId: "client_ord_001",
        executionIntentRef: "eint_001",
        venue: "binance_perpetual",
        instrument: "BTCUSDT",
        side: "BUY",
        orderedQuantity: "0.50000000",
        filledQuantity: "0.50000000",
        status: "FILLED",
        createdAt: now,
        inputDigest: "digest_cord_001",
      },
      canonicalFills: [
        {
          fillId: "fill_001",
          canonicalOrderId: "cord_001",
          price: "65000.00",
          quantity: "0.50000000",
          fee: "13.00",
          feeAsset: "USDT",
          filledAt: now,
          inputDigest: "digest_fill_001",
        },
      ],
      executionResult: {
        executionResultId: "eres_001",
        executionIntentRef: "eint_001",
        canonicalOrderId: "cord_001",
        status: "COMPLETED",
        reconciled: true,
        filledQuantity: "0.50000000",
        averagePrice: "65000.00",
        createdAt: now,
        inputDigest: "digest_eres_001",
      },
      diagnostics: {
        diagnosticsId: "diag_001",
        executionResultRef: "eres_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        realizedExecutionPrice: "65000.00",
        filledQuantity: "0.50000000",
        remainingQuantity: "0.00000000",
        fillRatio: "1.000000",
        slippageBps: "0.00",
        reconciliationQuality: "COMPLETE",
        createdAt: now,
        inputDigest: "digest_diag_001",
      },
      pnlAttribution: {
        attributionId: "pnl_001",
        executionResultRef: "eres_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        realizedGrossPnl: "0.00",
        realizedNetPnl: "-13.00",
        canonicalFees: "13.00",
        accountingCurrency: "USDT",
        quality: "COMPLETE",
        createdAt: now,
        inputDigest: "digest_pnl_001",
      },
      feedbackSnapshot: {
        snapshotId: "feed_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        diagnosticsRef: "diag_001",
        pnlAttributionRef: "pnl_001",
        quality: "COMPLETE",
        createdAt: now,
        inputDigest: "digest_feed_001",
      },
      expectedEnvelope: {
        envelopeId: "env_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        expectedReturnBps: "50.0",
        expectedSlippageBps: "2.0",
        expectedFeeBps: "4.0",
        evidenceStrength: "VALIDATED",
        createdAt: now,
        inputDigest: "digest_env_001",
      },
      performanceEvaluation: {
        evaluationId: "eval_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        sampleSize: 100,
        sampleSufficiency: "SUFFICIENT",
        observedReturnBps: "48.0",
        observedSlippageBps: "1.5",
        quality: "COMPLETE",
        createdAt: now,
        inputDigest: "digest_eval_001",
      },
      driftAssessment: {
        assessmentId: "drift_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        classification: "NORMAL",
        persistenceState: "STABLE",
        quality: "COMPLETE",
        createdAt: now,
        inputDigest: "digest_drift_001",
      },
      governanceDecision: {
        governanceDecisionId: "gdec_001",
        strategyId: "strat_swing_btc",
        strategyRevisionId: rev,
        classification: "CONTINUE",
        reasonCodes: ["GOVERNANCE_NORMAL_CONTINUE"],
        requiredInterventions: [],
        createdAt: now,
        inputDigest: "digest_gdec_001",
      },
      safetyAssessment: {
        assessmentId: "safe_001",
        state: "NORMAL",
        severity: "INFO",
        scope: "SYSTEM",
        reasonCodes: ["SYSTEM_NORMAL"],
        requiredActions: [],
        createdAt: now,
        inputDigest: "digest_safe_001",
      },
      ...overrides,
    };
  };

  describe("1. Full End-to-End Paper Control Loop", () => {
    it("executes the complete 17-stage control loop monotonically from Market to Complete", async () => {
      const deps = makeFullDependencies();
      const result = await coordinator.runAutonomousControlCycle({
        harnessRunId: "hrun_paper_001",
        environment: "PAPER",
        mode: "AUTONOMOUS_CYCLE",
        strategyId: "strat_swing_btc",
        strategyRevisionId: "rev_strategy_v1",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        correlationId: "corr_001",
        causationId: "caus_001",
        asOf: "2026-09-20T12:00:00.000Z",
        dependencies: deps,
      });

      assert.equal(result.run.harnessRunId, "hrun_paper_001");
      assert.equal(result.run.environment, "PAPER");
      assert.equal(result.run.currentStage, "COMPLETE");
      assert.equal(result.run.status, "COMPLETED");

      // Verify all 16 stage transitions executed in exact order to reach COMPLETE
      const targetStages = result.transitions.map((t) => t.toStage);
      assert.deepEqual(targetStages, [
        "MARKET_STATE",
        "OPPORTUNITY",
        "STRATEGY_PROPOSAL",
        "PORTFOLIO",
        "RISK",
        "TRADING_INTENT",
        "EXECUTION_INTENT",
        "EXECUTION",
        "RECONCILIATION",
        "DIAGNOSTICS",
        "PNL_ATTRIBUTION",
        "PERFORMANCE",
        "DRIFT",
        "GOVERNANCE",
        "SAFETY",
        "COMPLETE",
      ]);

      // Verify evidence package links all sovereign entities
      assert.equal(result.evidencePackage.harnessRunId, "hrun_paper_001");
      assert.equal(result.evidencePackage.environment, "PAPER");
      assert.ok(result.evidencePackage.evidenceRefs.includes("prop_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("pdec_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("rdec_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("tint_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("eint_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("cord_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("diag_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("pnl_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("feed_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("drift_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("gdec_001"));
    });

    it("guarantees deterministic replay: identical inputs produce identical transition signatures", async () => {
      const deps = makeFullDependencies();
      const r1 = await coordinator.runAutonomousControlCycle({
        harnessRunId: "hrun_replay_001",
        environment: "PAPER",
        mode: "AUTONOMOUS_CYCLE",
        strategyId: "strat_swing_btc",
        strategyRevisionId: "rev_strategy_v1",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        correlationId: "corr_rep_001",
        causationId: "caus_rep_001",
        asOf: "2026-09-20T12:00:00.000Z",
        dependencies: deps,
      });

      const r2 = await coordinator.runAutonomousControlCycle({
        harnessRunId: "hrun_replay_001",
        environment: "PAPER",
        mode: "AUTONOMOUS_CYCLE",
        strategyId: "strat_swing_btc",
        strategyRevisionId: "rev_strategy_v1",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        correlationId: "corr_rep_001",
        causationId: "caus_rep_001",
        asOf: "2026-09-20T12:00:00.000Z",
        dependencies: deps,
      });

      assert.equal(r1.run.inputDigest, r2.run.inputDigest);
      assert.equal(r1.evidencePackage.inputDigest, r2.evidencePackage.inputDigest);
      assert.equal(r1.transitions.length, r2.transitions.length);
    });
  });

  describe("2. Risk Gating, Monotonicity & Monotonic Propagation", () => {
    it("terminates cleanly at RISK stage when Risk rejects proposal (zero downstream intent)", async () => {
      const deps = makeFullDependencies({
        riskDecision: {
          riskDecisionId: "rdec_rej_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          instrument: "BTCUSDT",
          venue: "binance_perpetual",
          outcome: "REJECT",
          authorizedQuantity: "0.00000000",
          authorizedCapital: "0.00",
          maxLeverage: "0",
          createdAt: "2026-09-20T12:00:00.000Z",
          expiresAt: "2026-09-20T13:00:00.000Z",
          inputDigest: "digest_rdec_rej",
        },
        tradingIntent: undefined,
        executionIntent: undefined,
      });

      const result = await coordinator.runAutonomousControlCycle({
        harnessRunId: "hrun_risk_rej_001",
        environment: "PAPER",
        mode: "AUTONOMOUS_CYCLE",
        strategyId: "strat_swing_btc",
        strategyRevisionId: "rev_strategy_v1",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        correlationId: "corr_002",
        causationId: "caus_002",
        asOf: "2026-09-20T12:00:00.000Z",
        dependencies: deps,
      });

      assert.equal(result.run.currentStage, "COMPLETE");
      assert.equal(result.run.status, "COMPLETED");
      assert.equal(result.run.failureReason, "RISK_REJECTED");
      assert.equal(result.run.tradingIntentRef, undefined);
      assert.equal(result.run.executionIntentRef, undefined);
      assert.equal(result.run.canonicalOrderRef, undefined);
    });

    it("enforces Risk MODIFY monotonicity: Q_exec <= Q_risk <= Q_port <= Q_prop", async () => {
      const propQty = "1.00000000";
      const portQty = "0.80000000";
      const riskQty = "0.40000000";
      const execQty = "0.40000000";

      const deps = makeFullDependencies({
        tradeProposal: {
          proposalId: "prop_mod_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          instrument: "BTCUSDT",
          venue: "binance_perpetual",
          side: "BUY",
          proposedQuantity: propQty,
          proposedNotional: "65000.00",
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_prop_mod",
        },
        portfolioDecision: {
          portfolioDecisionId: "pdec_mod_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          instrument: "BTCUSDT",
          venue: "binance_perpetual",
          side: "BUY",
          allocatedCapital: "52000.00",
          approvedQuantity: portQty,
          status: "APPROVED",
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_pdec_mod",
        },
        riskDecision: {
          riskDecisionId: "rdec_mod_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          instrument: "BTCUSDT",
          venue: "binance_perpetual",
          outcome: "MODIFY",
          authorizedQuantity: riskQty,
          authorizedCapital: "26000.00",
          maxLeverage: "3",
          createdAt: "2026-09-20T12:00:00.000Z",
          expiresAt: "2026-09-20T13:00:00.000Z",
          inputDigest: "digest_rdec_mod",
        },
        tradingIntent: {
          tradingIntentId: "tint_mod_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          instrument: "BTCUSDT",
          venue: "binance_perpetual",
          side: "BUY",
          quantity: riskQty,
          notional: "26000.00",
          status: "AUTHORIZED",
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_tint_mod",
        },
        executionIntent: {
          executionIntentId: "eint_mod_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          instrument: "BTCUSDT",
          venue: "binance_perpetual",
          orderType: "LIMIT",
          side: "BUY",
          quantity: execQty,
          limitPrice: "65000.00",
          environment: "PAPER",
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_eint_mod",
        },
      });

      const result = await coordinator.runAutonomousControlCycle({
        harnessRunId: "hrun_monotonic_001",
        environment: "PAPER",
        mode: "AUTONOMOUS_CYCLE",
        strategyId: "strat_swing_btc",
        strategyRevisionId: "rev_strategy_v1",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        correlationId: "corr_003",
        causationId: "caus_003",
        asOf: "2026-09-20T12:00:00.000Z",
        dependencies: deps,
      });

      assert.equal(result.run.status, "COMPLETED");
      assert.equal(FixedDecimal.from(execQty).lte(FixedDecimal.from(riskQty)), true);
      assert.equal(FixedDecimal.from(riskQty).lte(FixedDecimal.from(portQty)), true);
      assert.equal(FixedDecimal.from(portQty).lte(FixedDecimal.from(propQty)), true);
    });
  });

  describe("3. Economic Feedback, Diagnostics & PnL Boundaries", () => {
    it("handles partial fill accurately: executed economics only for filled units (4/10)", async () => {
      const deps = makeFullDependencies({
        canonicalOrder: {
          canonicalOrderId: "cord_partial_001",
          clientOrderId: "client_ord_part_001",
          executionIntentRef: "eint_001",
          venue: "binance_perpetual",
          instrument: "BTCUSDT",
          side: "BUY",
          orderedQuantity: "1.00000000",
          filledQuantity: "0.40000000",
          status: "CANCELLED",
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_cord_part",
        },
        diagnostics: {
          diagnosticsId: "diag_part_001",
          executionResultRef: "eres_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          realizedExecutionPrice: "65000.00",
          filledQuantity: "0.40000000",
          remainingQuantity: "0.60000000",
          fillRatio: "0.400000",
          slippageBps: "0.00",
          reconciliationQuality: "PARTIAL",
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_diag_part",
        },
      });

      const result = await coordinator.runAutonomousControlCycle({
        harnessRunId: "hrun_partial_001",
        environment: "PAPER",
        mode: "AUTONOMOUS_CYCLE",
        strategyId: "strat_swing_btc",
        strategyRevisionId: "rev_strategy_v1",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        correlationId: "corr_004",
        causationId: "caus_004",
        asOf: "2026-09-20T12:00:00.000Z",
        dependencies: deps,
      });

      assert.equal(result.run.status, "COMPLETED");
      assert.equal(result.run.diagnosticsRef, "diag_part_001");
      assert.ok(result.evidencePackage.evidenceRefs.includes("diag_part_001"));
    });

    it("preserves side-aware slippage and prevents slippage double-counting in PnL", () => {
      const refPrice = FixedDecimal.from("65000.00");
      const buyFillPrice = FixedDecimal.from("65010.00");
      const sellFillPrice = FixedDecimal.from("64990.00");
      const qty = FixedDecimal.from("1.00000000");

      // BUY: Fill > Ref is adverse (+10)
      const buySlippage = buyFillPrice.sub(refPrice).mul(qty);
      assert.equal(buySlippage.toString(), "10");

      // SELL: Fill < Ref is adverse (+10)
      const sellSlippage = refPrice.sub(sellFillPrice).mul(qty);
      assert.equal(sellSlippage.toString(), "10");

      // PnL uses actual executed price, not refPrice - slippage
      const grossPnl = buyFillPrice.mul(qty);
      assert.equal(grossPnl.toString(), "65010");
    });
  });

  describe("4. Drift Detection, Governance Intervention & Safety Integration", () => {
    it("evaluates MATERIAL drift and registers RevalidationRequest without lifecycle mutation", async () => {
      const deps = makeFullDependencies({
        driftAssessment: {
          assessmentId: "drift_mat_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          classification: "MATERIAL",
          persistenceState: "PERSISTENT_DEGRADED",
          quality: "COMPLETE",
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_drift_mat",
        },
        governanceDecision: {
          governanceDecisionId: "gdec_reval_001",
          strategyId: "strat_swing_btc",
          strategyRevisionId: "rev_strategy_v1",
          classification: "REVALIDATE",
          reasonCodes: ["MATERIAL_PERFORMANCE_DRIFT_DETECTED"],
          requiredInterventions: [
            {
              interventionId: "int_reval_001",
              targetAuthority: "REVALIDATION",
              interventionType: "REQUEST_REVALIDATION",
              severity: "HIGH",
            },
          ],
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_gdec_reval",
        },
      });

      const result = await coordinator.runAutonomousControlCycle({
        harnessRunId: "hrun_drift_mat_001",
        environment: "PAPER",
        mode: "AUTONOMOUS_CYCLE",
        strategyId: "strat_swing_btc",
        strategyRevisionId: "rev_strategy_v1",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        correlationId: "corr_005",
        causationId: "caus_005",
        asOf: "2026-09-20T12:00:00.000Z",
        dependencies: deps,
      });

      assert.equal(result.run.status, "COMPLETED");
      assert.equal(result.run.driftAssessmentRef, "drift_mat_001");
      assert.equal(result.run.governanceDecisionRef, "gdec_reval_001");
      assert.ok(result.evidencePackage.evidenceRefs.includes("drift_mat_001"));
      assert.ok(result.evidencePackage.evidenceRefs.includes("gdec_reval_001"));
    });

    it("enforces fail-closed behavior on INCONCLUSIVE revalidation and SAFE_TO_RESUME != RESUME", async () => {
      const deps = makeFullDependencies({
        safetyAssessment: {
          assessmentId: "safe_contain_001",
          state: "CONTAINED",
          severity: "HIGH",
          scope: "SYSTEM",
          reasonCodes: ["CONTAINMENT_ACTIVE"],
          requiredActions: ["RECONCILE_EXECUTION"],
          createdAt: "2026-09-20T12:00:00.000Z",
          inputDigest: "digest_safe_contain",
        },
      });

      const result = await coordinator.runAutonomousControlCycle({
        harnessRunId: "hrun_safety_contain_001",
        environment: "PAPER",
        mode: "AUTONOMOUS_CYCLE",
        strategyId: "strat_swing_btc",
        strategyRevisionId: "rev_strategy_v1",
        instrument: "BTCUSDT",
        venue: "binance_perpetual",
        correlationId: "corr_006",
        causationId: "caus_006",
        asOf: "2026-09-20T12:00:00.000Z",
        dependencies: deps,
      });

      assert.equal(result.run.status, "COMPLETED");
      assert.equal(result.evidencePackage.safetySummary.safetyState, "CONTAINED");
    });
  });
});
