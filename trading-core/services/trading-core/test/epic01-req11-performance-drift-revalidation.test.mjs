import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FixedDecimal,
  DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1,
  DEFAULT_DRIFT_POLICY_V1,
  DEFAULT_REVALIDATION_REQUEST_POLICY_V1,
} from "../../../../dist-test/trading-core/packages/trading-contracts/src/index.js";
import {
  PerformanceEvaluationAuthority,
  DriftDetectionAuthority,
  RevalidationRequestAuthority,
  PerformanceRevisionMismatchError,
  PerformanceEnvironmentMismatchError,
} from "../../../../dist-test/trading-core/services/trading-core/src/index.js";

function makeMockEnvelope(overrides = {}) {
  return {
    envelopeId: "env-strat-r7-001",
    strategyId: "strat-momentum",
    strategyRevisionId: "strat-momentum:r7",
    strategyEvidenceRefs: ["ev-quant-001", "ev-quant-002"],
    experimentRefs: ["exp-wf-001"],
    datasetRefs: ["ds-binance-btc-001"],
    policyId: "POLICY_PERF_V1",
    policyRevision: "POLICY_PERF_V1_R1",
    environmentApplicability: ["TESTNET", "SIMULATED", "PAPER", "PRODUCTION"],
    evidenceStrength: "VALIDATED",
    expectedMetrics: {
      expectedReturn: "150.000000000000",
      expectedSharpe: "2.100000000000",
      expectedMaxDrawdown: "5.000000000000",
      expectedSlippageBps: "5.000000000000",
      expectedFee: "1.000000000000",
      expectedFillRatio: "0.950000000000",
      expectedLatencyMs: 150,
      expectedRejectionRate: "0.000000000000",
    },
    createdAt: "2026-09-20T10:00:00.000Z",
    validFrom: "2026-09-20T10:00:00.000Z",
    inputDigest: "digest-env-001",
    ...overrides,
  };
}

function makeMockDiagnostic(id, overrides = {}) {
  return {
    diagnosticsId: "diag-" + id,
    executionResultId: "res-" + id,
    executionIntentId: "intent-" + id,
    canonicalOrderId: "order-" + id,
    strategyId: "strat-momentum",
    strategyRevisionId: "strat-momentum:r7",
    venue: "binance",
    instrument: "BTC-USDT",
    environment: "TESTNET",
    diagnosticsPolicyId: "POLICY_DIAG_V1",
    diagnosticsPolicyRevision: "POLICY_DIAG_V1_R1",
    filledQuantity: "1.000000000000",
    fillRatio: "1.000000000000",
    slippageBps: "5.000000000000",
    slippageAmount: "5.000000000000",
    realizedExecutionPrice: "60000.000000000000",
    canonicalFees: "1.000000000000",
    accountingCurrency: "USDT",
    latencies: {
      submissionMs: 50,
      ackMs: 40,
      completionMs: 140,
    },
    observationsCount: 3,
    duplicateObservationsCount: 0,
    outOfOrderObservationsCount: 0,
    reconciliationAttemptsCount: 1,
    ambiguousSubmissionOccurred: false,
    quality: "COMPLETE",
    createdAt: "2026-09-20T12:00:00.000Z",
    asOf: "2026-09-20T12:00:00.000Z",
    inputDigest: "digest-diag-" + id,
    ...overrides,
  };
}

function makeMockPnL(id, overrides = {}) {
  return {
    pnlAttributionId: "pnl-" + id,
    strategyId: "strat-momentum",
    strategyRevisionId: "strat-momentum:r7",
    executionIntentId: "intent-" + id,
    executionResultId: "res-" + id,
    canonicalOrderId: "order-" + id,
    venue: "binance",
    instrument: "BTC-USDT",
    environment: "TESTNET",
    accountingCurrency: "USDT",
    pnlPolicyId: "POLICY_PNL_V1",
    pnlPolicyRevision: "POLICY_PNL_V1_R1",
    realizedGrossPnl: "50.000000000000",
    canonicalFees: "1.000000000000",
    otherCanonicalCosts: "0.000000000000",
    realizedNetPnl: "49.000000000000",
    closedQuantity: "1.000000000000",
    quality: "COMPLETE",
    createdAt: "2026-09-20T12:00:00.000Z",
    asOf: "2026-09-20T12:00:00.000Z",
    inputDigest: "digest-pnl-" + id,
    ...overrides,
  };
}

describe("AXODUS-TRADING-EPIC-01 / REQ-11 — Strategy Performance Evaluation & Drift Detection", () => {
  const evalAuthority = new PerformanceEvaluationAuthority();
  const driftAuthority = new DriftDetectionAuthority();
  const revalAuthority = new RevalidationRequestAuthority();

  describe("1. Exact StrategyRevision Binding & Environment Guarding", () => {
    it("evaluates successfully when strategyRevision matches across all inputs", () => {
      const envelope = makeMockEnvelope();
      const diags = [makeMockDiagnostic("1"), makeMockDiagnostic("2"), makeMockDiagnostic("3")];
      const pnls = [makeMockPnL("1"), makeMockPnL("2"), makeMockPnL("3")];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      assert.equal(evaluation.strategyId, "strat-momentum");
      assert.equal(evaluation.strategyRevisionId, "strat-momentum:r7");
      assert.equal(evaluation.sampleSize, 3);
      assert.equal(evaluation.quality, "COMPLETE");
    });

    it("strictly throws PerformanceRevisionMismatchError if a diagnostic has revision drift", () => {
      const envelope = makeMockEnvelope({ strategyRevisionId: "strat-momentum:r7" });
      const diags = [
        makeMockDiagnostic("1", { strategyRevisionId: "strat-momentum:r7" }),
        makeMockDiagnostic("2", { strategyRevisionId: "strat-momentum:r8" }),
      ];
      const pnls = [makeMockPnL("1")];

      assert.throws(
        () => evalAuthority.evaluate(envelope, diags, pnls),
        PerformanceRevisionMismatchError
      );
    });

    it("strictly throws PerformanceRevisionMismatchError if a PnL record has revision drift", () => {
      const envelope = makeMockEnvelope({ strategyRevisionId: "strat-momentum:r7" });
      const diags = [makeMockDiagnostic("1")];
      const pnls = [makeMockPnL("1", { strategyRevisionId: "strat-momentum:r8" })];

      assert.throws(
        () => evalAuthority.evaluate(envelope, diags, pnls),
        PerformanceRevisionMismatchError
      );
    });

    it("strictly throws PerformanceEnvironmentMismatchError if target environment is not applicable", () => {
      const envelope = makeMockEnvelope({ environmentApplicability: ["SIMULATED", "TESTNET"] });
      const diags = [makeMockDiagnostic("1", { environment: "PRODUCTION" })];
      const pnls = [makeMockPnL("1", { environment: "PRODUCTION" })];

      assert.throws(
        () => evalAuthority.evaluate(envelope, diags, pnls, { environment: "PRODUCTION" }),
        PerformanceEnvironmentMismatchError
      );
    });
  });

  describe("2. Sample Sufficiency & Mandatory Invariant: INSUFFICIENT_DATA != NORMAL", () => {
    it("sets quality to INSUFFICIENT_DATA when sample size < minSampleSize", () => {
      const envelope = makeMockEnvelope();
      const diags = [makeMockDiagnostic("1"), makeMockDiagnostic("2")];
      const pnls = [makeMockPnL("1"), makeMockPnL("2")];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls, {
        policy: { ...DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1, minSampleSize: 3 },
      });
      assert.equal(evaluation.sampleSize, 2);
      assert.equal(evaluation.quality, "INSUFFICIENT_DATA");

      const assessment = driftAuthority.assessDrift(evaluation);
      assert.equal(assessment.classification, "INSUFFICIENT_DATA");
      assert.equal(assessment.quality, "INSUFFICIENT_DATA");
    });

    it("preserves PARTIAL or INVALID quality from source facts into evaluation", () => {
      const envelope = makeMockEnvelope();
      const diags = [
        makeMockDiagnostic("1", { quality: "COMPLETE" }),
        makeMockDiagnostic("2", { quality: "PARTIAL" }),
        makeMockDiagnostic("3", { quality: "COMPLETE" }),
      ];
      const pnls = [makeMockPnL("1"), makeMockPnL("2"), makeMockPnL("3")];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      assert.equal(evaluation.quality, "PARTIAL");

      const assessment = driftAuthority.assessDrift(evaluation);
      assert.ok(assessment.driftDimensions.includes("DATA_QUALITY"));
    });
  });

  describe("3. Multi-Dimensional Drift Detection & Classifications", () => {
    it("classifies as NORMAL when all observed metrics are within policy tolerances", () => {
      const envelope = makeMockEnvelope();
      const diags = [makeMockDiagnostic("1"), makeMockDiagnostic("2"), makeMockDiagnostic("3")];
      const pnls = [
        makeMockPnL("1", { realizedNetPnl: "50.000000000000" }),
        makeMockPnL("2", { realizedNetPnl: "50.000000000000" }),
        makeMockPnL("3", { realizedNetPnl: "50.000000000000" }),
      ];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      const assessment = driftAuthority.assessDrift(evaluation);

      assert.equal(assessment.classification, "NORMAL");
      assert.equal(assessment.driftDimensions.length, 0);
      assert.equal(assessment.persistenceState.isTriggered, false);
    });

    it("detects EXECUTION drift when slippage exceeds threshold", () => {
      const envelope = makeMockEnvelope();
      const diags = [
        makeMockDiagnostic("1", { slippageBps: "35.000000000000" }),
        makeMockDiagnostic("2", { slippageBps: "35.000000000000" }),
        makeMockDiagnostic("3", { slippageBps: "35.000000000000" }),
      ];
      const pnls = [makeMockPnL("1"), makeMockPnL("2"), makeMockPnL("3")];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      const assessment = driftAuthority.assessDrift(evaluation);

      assert.equal(assessment.classification, "DEGRADED");
      assert.ok(assessment.driftDimensions.includes("EXECUTION"));
      assert.equal(assessment.persistenceState.consecutiveDegradedWindows, 1);
    });

    it("detects COST drift when fees exceed expected envelope", () => {
      const envelope = makeMockEnvelope({ expectedMetrics: { expectedFee: "1.000000000000" } });
      const diags = [makeMockDiagnostic("1"), makeMockDiagnostic("2"), makeMockDiagnostic("3")];
      const pnls = [
        makeMockPnL("1", { canonicalFees: "6.000000000000" }),
        makeMockPnL("2", { canonicalFees: "6.000000000000" }),
        makeMockPnL("3", { canonicalFees: "6.000000000000" }),
      ];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      const assessment = driftAuthority.assessDrift(evaluation);

      assert.equal(assessment.classification, "DEGRADED");
      assert.ok(assessment.driftDimensions.includes("COST"));
    });

    it("detects LATENCY drift when completion latency exceeds threshold", () => {
      const envelope = makeMockEnvelope({ expectedMetrics: { expectedLatencyMs: 100 } });
      const diags = [
        makeMockDiagnostic("1", { latencies: { completionMs: 800 } }),
        makeMockDiagnostic("2", { latencies: { completionMs: 800 } }),
        makeMockDiagnostic("3", { latencies: { completionMs: 800 } }),
      ];
      const pnls = [makeMockPnL("1"), makeMockPnL("2"), makeMockPnL("3")];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      const assessment = driftAuthority.assessDrift(evaluation);

      assert.equal(assessment.classification, "DEGRADED");
      assert.ok(assessment.driftDimensions.includes("LATENCY"));
    });

    it("detects FILL_QUALITY drift when fill ratio deteriorates below threshold", () => {
      const envelope = makeMockEnvelope({ expectedMetrics: { expectedFillRatio: "0.950000000000" } });
      const diags = [
        makeMockDiagnostic("1", { fillRatio: "0.600000000000" }),
        makeMockDiagnostic("2", { fillRatio: "0.600000000000" }),
        makeMockDiagnostic("3", { fillRatio: "0.600000000000" }),
      ];
      const pnls = [makeMockPnL("1"), makeMockPnL("2"), makeMockPnL("3")];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      const assessment = driftAuthority.assessDrift(evaluation);

      assert.equal(assessment.classification, "DEGRADED");
      assert.ok(assessment.driftDimensions.includes("FILL_QUALITY"));
    });

    it("detects ECONOMIC drift when realized net PnL deteriorates below expected", () => {
      const envelope = makeMockEnvelope({ expectedMetrics: { expectedReturn: "150.000000000000" } });
      const diags = [makeMockDiagnostic("1"), makeMockDiagnostic("2"), makeMockDiagnostic("3")];
      const pnls = [
        makeMockPnL("1", { realizedNetPnl: "10.000000000000" }),
        makeMockPnL("2", { realizedNetPnl: "10.000000000000" }),
        makeMockPnL("3", { realizedNetPnl: "10.000000000000" }),
      ];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      const assessment = driftAuthority.assessDrift(evaluation);

      assert.equal(assessment.classification, "DEGRADED");
      assert.ok(assessment.driftDimensions.includes("ECONOMIC"));
    });
  });

  describe("4. Hysteresis, Persistence & Material Revalidation Trigger", () => {
    it("escalates to MATERIAL after N consecutive degraded windows (persistenceWindowsRequired)", () => {
      const envelope = makeMockEnvelope();
      const diags = [
        makeMockDiagnostic("1", { slippageBps: "35.000000000000" }),
        makeMockDiagnostic("2", { slippageBps: "35.000000000000" }),
        makeMockDiagnostic("3", { slippageBps: "35.000000000000" }),
      ];
      const pnls = [makeMockPnL("1"), makeMockPnL("2"), makeMockPnL("3")];

      const eval1 = evalAuthority.evaluate(envelope, diags, pnls);
      const assess1 = driftAuthority.assessDrift(eval1, {
        policy: { ...DEFAULT_DRIFT_POLICY_V1, persistenceWindowsRequired: 2 },
      });
      assert.equal(assess1.classification, "DEGRADED");
      assert.equal(assess1.persistenceState.isTriggered, false);

      const eval2 = evalAuthority.evaluate(envelope, diags, pnls);
      const assess2 = driftAuthority.assessDrift(eval2, {
        policy: { ...DEFAULT_DRIFT_POLICY_V1, persistenceWindowsRequired: 2 },
        priorPersistenceState: assess1.persistenceState,
      });
      assert.equal(assess2.classification, "MATERIAL");
      assert.equal(assess2.persistenceState.isTriggered, true);

      const revalRequest = revalAuthority.createRequest(assess2);
      assert.ok(revalRequest);
      assert.equal(revalRequest.strategyId, "strat-momentum");
      assert.equal(revalRequest.strategyRevisionId, "strat-momentum:r7");
      assert.equal(revalRequest.triggerClassification, "MATERIAL");
      assert.equal(revalRequest.requestedValidationScope, "FULL_STRATEGY");
      assert.equal(revalRequest.status, "REQUESTED");
    });

    it("applies recovery hysteresis: retains previous classification until recoveryWindowsRequired is satisfied", () => {
      const envelope = makeMockEnvelope();
      const normalDiags = [makeMockDiagnostic("1"), makeMockDiagnostic("2"), makeMockDiagnostic("3")];
      const normalPnls = [
        makeMockPnL("1", { realizedNetPnl: "50.000000000000" }),
        makeMockPnL("2", { realizedNetPnl: "50.000000000000" }),
        makeMockPnL("3", { realizedNetPnl: "50.000000000000" }),
      ];

      const priorState = {
        consecutiveDegradedWindows: 2,
        consecutiveNormalWindows: 0,
        previousClassification: "MATERIAL",
        isTriggered: true,
      };

      const evalNormal1 = evalAuthority.evaluate(envelope, normalDiags, normalPnls);
      const assessRecovery1 = driftAuthority.assessDrift(evalNormal1, {
        policy: { ...DEFAULT_DRIFT_POLICY_V1, recoveryWindowsRequired: 2 },
        priorPersistenceState: priorState,
      });
      assert.equal(assessRecovery1.classification, "MATERIAL");
      assert.equal(assessRecovery1.persistenceState.consecutiveNormalWindows, 1);

      const evalNormal2 = evalAuthority.evaluate(envelope, normalDiags, normalPnls);
      const assessRecovery2 = driftAuthority.assessDrift(evalNormal2, {
        policy: { ...DEFAULT_DRIFT_POLICY_V1, recoveryWindowsRequired: 2 },
        priorPersistenceState: assessRecovery1.persistenceState,
      });
      assert.equal(assessRecovery2.classification, "NORMAL");
      assert.equal(assessRecovery2.persistenceState.consecutiveNormalWindows, 2);
      assert.equal(assessRecovery2.persistenceState.isTriggered, false);
    });
  });

  describe("5. Missing Data & UNAVAILABLE Metric Semantics", () => {
    it("sets metric deviation to UNAVAILABLE when expected metric exists but observed is missing (never defaults to 0)", () => {
      const envelope = makeMockEnvelope({ expectedMetrics: { expectedSlippageBps: "5.000000000000" } });
      const diags = [
        makeMockDiagnostic("1", { slippageBps: undefined }),
        makeMockDiagnostic("2", { slippageBps: undefined }),
        makeMockDiagnostic("3", { slippageBps: undefined }),
      ];
      const pnls = [makeMockPnL("1"), makeMockPnL("2"), makeMockPnL("3")];

      const evaluation = evalAuthority.evaluate(envelope, diags, pnls);
      const slippageDev = evaluation.deviations.find((d) => d.metricName === "slippageBps");
      assert.ok(slippageDev);
      assert.equal(slippageDev.status, "UNAVAILABLE");

      const assessment = driftAuthority.assessDrift(evaluation);
      const slippageAssessment = assessment.metricAssessments.find((m) => m.metricName === "slippageBps");
      assert.ok(slippageAssessment);
      assert.equal(slippageAssessment.severity, "UNAVAILABLE");
    });
  });

  describe("6. Metamorphic & Property Tests", () => {
    it("Property: Strategy & Revision Isolation — observations for r1 cannot affect r2 evaluation", () => {
      const envelopeR1 = makeMockEnvelope({ strategyRevisionId: "strat-momentum:r1" });
      const envelopeR2 = makeMockEnvelope({ strategyRevisionId: "strat-momentum:r2" });

      const diagsR1 = [
        makeMockDiagnostic("1", { strategyRevisionId: "strat-momentum:r1" }),
        makeMockDiagnostic("2", { strategyRevisionId: "strat-momentum:r1" }),
        makeMockDiagnostic("3", { strategyRevisionId: "strat-momentum:r1" }),
      ];
      const pnlsR1 = [
        makeMockPnL("1", { strategyRevisionId: "strat-momentum:r1" }),
        makeMockPnL("2", { strategyRevisionId: "strat-momentum:r1" }),
        makeMockPnL("3", { strategyRevisionId: "strat-momentum:r1" }),
      ];

      const diagsR2 = [
        makeMockDiagnostic("4", { strategyRevisionId: "strat-momentum:r2" }),
        makeMockDiagnostic("5", { strategyRevisionId: "strat-momentum:r2" }),
        makeMockDiagnostic("6", { strategyRevisionId: "strat-momentum:r2" }),
      ];
      const pnlsR2 = [
        makeMockPnL("4", { strategyRevisionId: "strat-momentum:r2" }),
        makeMockPnL("5", { strategyRevisionId: "strat-momentum:r2" }),
        makeMockPnL("6", { strategyRevisionId: "strat-momentum:r2" }),
      ];

      const evalR1 = evalAuthority.evaluate(envelopeR1, diagsR1, pnlsR1);
      const evalR2 = evalAuthority.evaluate(envelopeR2, diagsR2, pnlsR2);

      assert.equal(evalR1.strategyRevisionId, "strat-momentum:r1");
      assert.equal(evalR2.strategyRevisionId, "strat-momentum:r2");
      assert.notEqual(evalR1.inputDigest, evalR2.inputDigest);
    });

    it("Metamorphic: Reordering input observations does not change evaluation metrics or digest", () => {
      const envelope = makeMockEnvelope();
      const d1 = makeMockDiagnostic("1", { filledQuantity: "1.000000000000" });
      const d2 = makeMockDiagnostic("2", { filledQuantity: "2.000000000000" });
      const d3 = makeMockDiagnostic("3", { filledQuantity: "3.000000000000" });

      const p1 = makeMockPnL("1", { realizedNetPnl: "10.000000000000" });
      const p2 = makeMockPnL("2", { realizedNetPnl: "20.000000000000" });
      const p3 = makeMockPnL("3", { realizedNetPnl: "30.000000000000" });

      const evalA = evalAuthority.evaluate(envelope, [d1, d2, d3], [p1, p2, p3], {
        observationWindowStart: "2026-09-20T10:00:00.000Z",
        observationWindowEnd: "2026-09-20T12:00:00.000Z",
      });
      const evalB = evalAuthority.evaluate(envelope, [d3, d1, d2], [p3, p1, p2], {
        observationWindowStart: "2026-09-20T10:00:00.000Z",
        observationWindowEnd: "2026-09-20T12:00:00.000Z",
      });

      assert.equal(evalA.observedMetrics.filledQuantity, evalB.observedMetrics.filledQuantity);
      assert.equal(evalA.observedMetrics.realizedNetPnl, evalB.observedMetrics.realizedNetPnl);
      assert.equal(evalA.inputDigest, evalB.inputDigest);
    });
  });
});
