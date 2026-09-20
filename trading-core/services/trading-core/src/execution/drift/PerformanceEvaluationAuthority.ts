import type {
  ExpectedPerformanceEnvelope,
  PerformanceComparisonPolicy,
  PerformanceEvaluation,
  ObservedMetrics,
  MetricDeviation,
  PerformanceEvaluationQuality,
  ExecutionDiagnostics,
  PnLAttribution,
  PerformanceEnvironment,
} from "../../../../../packages/trading-contracts/src/index.js";
import {
  FixedDecimal,
  DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1,
} from "../../../../../packages/trading-contracts/src/index.js";
import { stableJson } from "../../repositories/postgres/PostgresClient.js";
import {
  PerformanceRevisionMismatchError,
  PerformanceEnvironmentMismatchError,
} from "./PerformanceDriftErrors.js";

export interface EvaluatePerformanceOptions {
  policy?: PerformanceComparisonPolicy;
  observationWindowStart?: string;
  observationWindowEnd?: string;
  asOf?: string;
  environment?: PerformanceEnvironment;
  regime?: string;
  feedbackSnapshotRefs?: readonly string[];
}

export class PerformanceEvaluationAuthority {
  public evaluate(
    envelope: ExpectedPerformanceEnvelope,
    diagnosticsList: readonly ExecutionDiagnostics[],
    pnlList: readonly PnLAttribution[],
    options: EvaluatePerformanceOptions = {}
  ): PerformanceEvaluation {
    const policy = options.policy ?? DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1;
    const asOf = options.asOf ?? new Date().toISOString();
    const windowStart = options.observationWindowStart ?? (diagnosticsList[0]?.asOf || asOf);
    const windowEnd = options.observationWindowEnd ?? asOf;
    const targetEnv: PerformanceEnvironment = (options.environment ?? diagnosticsList[0]?.environment ?? "TESTNET") as PerformanceEnvironment;

    // 1. Exact StrategyRevision Verification
    for (const diag of diagnosticsList) {
      if (diag.strategyId !== envelope.strategyId || diag.strategyRevisionId !== envelope.strategyRevisionId) {
        throw new PerformanceRevisionMismatchError(
          `Diagnostics strategy revision ${diag.strategyRevisionId} does not match expected envelope revision ${envelope.strategyRevisionId}`,
          { expectedRevision: envelope.strategyRevisionId, observedRevision: diag.strategyRevisionId }
        );
      }
    }
    for (const pnl of pnlList) {
      if (pnl.strategyId !== envelope.strategyId || pnl.strategyRevisionId !== envelope.strategyRevisionId) {
        throw new PerformanceRevisionMismatchError(
          `PnL attribution strategy revision ${pnl.strategyRevisionId} does not match expected envelope revision ${envelope.strategyRevisionId}`,
          { expectedRevision: envelope.strategyRevisionId, observedRevision: pnl.strategyRevisionId }
        );
      }
    }

    // 2. Environment Compatibility Verification
    if (!envelope.environmentApplicability.includes(targetEnv) || !policy.allowedEnvironments.includes(targetEnv)) {
      throw new PerformanceEnvironmentMismatchError(
        `Environment ${targetEnv} is not compatible with envelope environments [${envelope.environmentApplicability.join(", ")}]`,
        { targetEnv, allowedEnvelopeEnvs: envelope.environmentApplicability }
      );
    }

    // 3. Sample Size Evaluation
    const sampleSize = diagnosticsList.length;
    let quality: PerformanceEvaluationQuality = "COMPLETE";

    if (sampleSize < policy.minSampleSize) {
      quality = "INSUFFICIENT_DATA";
    }

    // Check if any source data is invalid or pending reconciliation
    const hasPendingReconciliation = diagnosticsList.some((d) => d.quality === "PENDING_RECONCILIATION") ||
      pnlList.some((p) => p.quality === "PENDING_RECONCILIATION");
    const hasInvalid = diagnosticsList.some((d) => d.quality === "INVALID") ||
      pnlList.some((p) => p.quality === "INVALID");
    const hasPartial = diagnosticsList.some((d) => d.quality === "PARTIAL") ||
      pnlList.some((p) => p.quality === "PARTIAL");

    if (hasInvalid) {
      quality = "INVALID";
    } else if (hasPendingReconciliation) {
      quality = "PENDING_RECONCILIATION";
    } else if (hasPartial && quality === "COMPLETE") {
      quality = "PARTIAL";
    }

    // 4. Compute Observed Metrics
    let totalFilled = FixedDecimal.zero();
    let totalGrossPnl = FixedDecimal.zero();
    let totalNetPnl = FixedDecimal.zero();
    let totalFees = FixedDecimal.zero();
    let sumSlippageBps = FixedDecimal.zero();
    let countSlippage = 0;
    let sumLatencyMs = 0;
    let countLatency = 0;
    let sumFillRatio = FixedDecimal.zero();
    let countFillRatio = 0;
    let rejectionsCount = 0;
    let cancellationsCount = 0;

    for (const diag of diagnosticsList) {
      totalFilled = totalFilled.add(FixedDecimal.from(diag.filledQuantity));
      if (diag.slippageBps !== undefined) {
        sumSlippageBps = sumSlippageBps.add(FixedDecimal.from(diag.slippageBps));
        countSlippage++;
      }
      if (diag.latencies?.completionMs !== undefined) {
        sumLatencyMs += diag.latencies.completionMs;
        countLatency++;
      } else if (diag.latencies?.submissionMs !== undefined) {
        sumLatencyMs += diag.latencies.submissionMs;
        countLatency++;
      }
      if (diag.fillRatio !== undefined) {
        sumFillRatio = sumFillRatio.add(FixedDecimal.from(diag.fillRatio));
        countFillRatio++;
      }
      if (diag.rejectionCategory !== undefined) {
        rejectionsCount++;
      }
      if (diag.cancellationDetails !== undefined) {
        cancellationsCount++;
      }
    }

    for (const pnl of pnlList) {
      totalGrossPnl = totalGrossPnl.add(FixedDecimal.from(pnl.realizedGrossPnl));
      totalNetPnl = totalNetPnl.add(FixedDecimal.from(pnl.realizedNetPnl));
      totalFees = totalFees.add(FixedDecimal.from(pnl.canonicalFees));
    }

    const observedMetrics: ObservedMetrics = {
      tradeCount: sampleSize,
      filledQuantity: totalFilled.toString(),
      realizedGrossPnl: totalGrossPnl.toString(),
      realizedNetPnl: totalNetPnl.toString(),
      canonicalFees: totalFees.toString(),
      averageSlippageBps: countSlippage > 0 ? sumSlippageBps.div(FixedDecimal.from(countSlippage)).toString() : undefined,
      averageLatencyMs: countLatency > 0 ? Math.round(sumLatencyMs / countLatency) : undefined,
      fillRatio: countFillRatio > 0 ? sumFillRatio.div(FixedDecimal.from(countFillRatio)).toString() : undefined,
      rejectionRate: sampleSize > 0 ? FixedDecimal.from(rejectionsCount).div(FixedDecimal.from(sampleSize)).toString() : undefined,
      cancellationRate: sampleSize > 0 ? FixedDecimal.from(cancellationsCount).div(FixedDecimal.from(sampleSize)).toString() : undefined,
    };

    // 5. Compute Deviations Against Expected Metrics
    const deviations: MetricDeviation[] = [];
    const exp = envelope.expectedMetrics;

    // Slippage Deviation
    if (exp.expectedSlippageBps !== undefined && observedMetrics.averageSlippageBps !== undefined) {
      const expDec = FixedDecimal.from(exp.expectedSlippageBps);
      const obsDec = FixedDecimal.from(observedMetrics.averageSlippageBps);
      const diff = obsDec.sub(expDec);
      const absDiff = diff.abs();
      const isDeviated = policy.maxAllowedSlippageDeviationBps
        ? absDiff.gt(FixedDecimal.from(policy.maxAllowedSlippageDeviationBps))
        : false;
      deviations.push({
        metricName: "slippageBps",
        expectedValue: exp.expectedSlippageBps,
        observedValue: observedMetrics.averageSlippageBps,
        absoluteDeviation: absDiff.toString(),
        status: isDeviated ? "DEVIATED" : "COMPATIBLE",
      });
    } else if (exp.expectedSlippageBps !== undefined || observedMetrics.averageSlippageBps !== undefined) {
      deviations.push({
        metricName: "slippageBps",
        expectedValue: exp.expectedSlippageBps,
        observedValue: observedMetrics.averageSlippageBps,
        status: "UNAVAILABLE",
      });
    }

    // Fee Deviation
    if (exp.expectedFee !== undefined && sampleSize > 0) {
      const expFeeTotal = FixedDecimal.from(exp.expectedFee).mul(FixedDecimal.from(sampleSize));
      const obsFee = FixedDecimal.from(observedMetrics.canonicalFees);
      const diff = obsFee.sub(expFeeTotal);
      const absDiff = diff.abs();
      const isDeviated = policy.maxAllowedFeeDeviationBps
        ? absDiff.gt(FixedDecimal.from(policy.maxAllowedFeeDeviationBps))
        : false;
      deviations.push({
        metricName: "fee",
        expectedValue: expFeeTotal.toString(),
        observedValue: observedMetrics.canonicalFees,
        absoluteDeviation: absDiff.toString(),
        status: isDeviated ? "DEVIATED" : "COMPATIBLE",
      });
    }

    // Fill Ratio Deviation
    if (exp.expectedFillRatio !== undefined && observedMetrics.fillRatio !== undefined) {
      const expDec = FixedDecimal.from(exp.expectedFillRatio);
      const obsDec = FixedDecimal.from(observedMetrics.fillRatio);
      const diff = expDec.sub(obsDec); // lower fill ratio is adverse
      const isDeviated = policy.minAllowedFillRatio
        ? obsDec.lt(FixedDecimal.from(policy.minAllowedFillRatio))
        : false;
      deviations.push({
        metricName: "fillRatio",
        expectedValue: exp.expectedFillRatio,
        observedValue: observedMetrics.fillRatio,
        absoluteDeviation: diff.abs().toString(),
        status: isDeviated ? "DEVIATED" : "COMPATIBLE",
      });
    }

    // Latency Deviation
    if (exp.expectedLatencyMs !== undefined && observedMetrics.averageLatencyMs !== undefined) {
      const diff = observedMetrics.averageLatencyMs - exp.expectedLatencyMs;
      const isDeviated = policy.maxAllowedLatencyDeviationMs
        ? diff > policy.maxAllowedLatencyDeviationMs
        : false;
      deviations.push({
        metricName: "latencyMs",
        expectedValue: String(exp.expectedLatencyMs),
        observedValue: String(observedMetrics.averageLatencyMs),
        absoluteDeviation: String(Math.abs(diff)),
        status: isDeviated ? "DEVIATED" : "COMPATIBLE",
      });
    }

    // Return / PnL Deviation
    if (exp.expectedReturn !== undefined) {
      const expReturnDec = FixedDecimal.from(exp.expectedReturn);
      const obsNetPnlDec = FixedDecimal.from(observedMetrics.realizedNetPnl);
      const diff = expReturnDec.sub(obsNetPnlDec);
      const isDeviated = policy.maxAllowedReturnDeviationBps
        ? diff.gt(FixedDecimal.from(policy.maxAllowedReturnDeviationBps))
        : false;
      deviations.push({
        metricName: "realizedNetPnl",
        expectedValue: exp.expectedReturn,
        observedValue: observedMetrics.realizedNetPnl,
        absoluteDeviation: diff.abs().toString(),
        status: isDeviated ? "DEVIATED" : "COMPATIBLE",
      });
    }

    const evaluationId = `eval-${envelope.strategyRevisionId.replace(/:/g, "-")}-${Date.now()}`;
    const inputDigest = stableJson({
      envelopeId: envelope.envelopeId,
      strategyRevisionId: envelope.strategyRevisionId,
      windowStart,
      windowEnd,
      sampleSize,
      observedMetrics,
      policyRevision: policy.policyRevision,
    });

    return {
      evaluationId,
      strategyId: envelope.strategyId,
      strategyRevisionId: envelope.strategyRevisionId,
      expectedEnvelopeId: envelope.envelopeId,
      comparisonPolicyId: policy.policyId,
      comparisonPolicyRevision: policy.policyRevision,
      observationWindowStart: windowStart,
      observationWindowEnd: windowEnd,
      feedbackSnapshotRefs: options.feedbackSnapshotRefs ?? [],
      diagnosticsRefs: diagnosticsList.map((d) => d.diagnosticsId),
      pnlAttributionRefs: pnlList.map((p) => p.pnlAttributionId),
      expectedMetrics: envelope.expectedMetrics,
      observedMetrics,
      deviations,
      sampleSize,
      quality,
      createdAt: asOf,
      asOf,
      inputDigest,
    };
  }
}
