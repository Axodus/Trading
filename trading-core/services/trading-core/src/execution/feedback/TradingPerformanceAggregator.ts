import type {
  ExecutionDiagnostics,
  PnLAttribution,
  TradingPerformanceAggregate,
  ExecutionEnvironment,
} from '../../../../../packages/trading-contracts/src/index.js';
import { FixedDecimal } from '../../../../../packages/trading-contracts/src/index.js';

export interface AggregateOptions {
  strategyId: string;
  strategyRevisionId: string;
  venue: string;
  instrument: string;
  environment: ExecutionEnvironment;
  accountingCurrency?: string;
  windowStart: string;
  windowEnd: string;
  asOf?: string;
}

export class TradingPerformanceAggregator {
  public aggregate(
    diagnosticsList: readonly ExecutionDiagnostics[],
    pnlList: readonly PnLAttribution[],
    options: AggregateOptions
  ): TradingPerformanceAggregate {
    const asOf = options.asOf ?? new Date().toISOString();
    const accountingCurrency = options.accountingCurrency ?? 'USDT';

    // Filter matching scope
    const matchedDiag = diagnosticsList.filter(
      (d) =>
        d.strategyId === options.strategyId &&
        d.strategyRevisionId === options.strategyRevisionId &&
        d.venue === options.venue &&
        d.instrument === options.instrument &&
        d.environment === options.environment
    );

    const matchedPnl = pnlList.filter(
      (p) =>
        p.strategyId === options.strategyId &&
        p.strategyRevisionId === options.strategyRevisionId &&
        p.venue === options.venue &&
        p.instrument === options.instrument &&
        p.environment === options.environment
    );

    let totalFilled = FixedDecimal.zero();
    let totalGrossPnl = FixedDecimal.zero();
    let totalNetPnl = FixedDecimal.zero();
    let totalFees = FixedDecimal.zero();
    let totalSlippageAmount = FixedDecimal.zero();

    let slippageBpsSum = FixedDecimal.zero();
    let slippageCount = 0;

    let fillRatioSum = FixedDecimal.zero();
    let latencyMsSum = 0;
    let latencyCount = 0;

    let rejectionCount = 0;
    let cancellationCount = 0;
    let anomalyCount = 0;

    const feeAssetMap = new Map<string, FixedDecimal>();

    for (const d of matchedDiag) {
      totalFilled = totalFilled.add(FixedDecimal.from(d.filledQuantity));
      fillRatioSum = fillRatioSum.add(FixedDecimal.from(d.fillRatio));

      if (d.slippageBps !== undefined) {
        slippageBpsSum = slippageBpsSum.add(FixedDecimal.from(d.slippageBps));
        slippageCount++;
      }
      if (d.slippageAmount !== undefined) {
        totalSlippageAmount = totalSlippageAmount.add(FixedDecimal.from(d.slippageAmount));
      }

      if (d.normalizedTotalFee !== undefined) {
        totalFees = totalFees.add(FixedDecimal.from(d.normalizedTotalFee));
      }

      for (const f of d.feeBreakdown) {
        const cur = feeAssetMap.get(f.asset) ?? FixedDecimal.zero();
        feeAssetMap.set(f.asset, cur.add(FixedDecimal.from(f.amount)));
      }

      if (d.rejectionCategory) rejectionCount++;
      if (d.cancellationDetails) cancellationCount++;
      if (d.anomalies.length > 0) anomalyCount += d.anomalies.length;
      if (d.reconciliationSummary.discrepanciesCount > 0) anomalyCount += d.reconciliationSummary.discrepanciesCount;

      if (d.latencies.completionMs !== undefined) {
        latencyMsSum += d.latencies.completionMs;
        latencyCount++;
      }
    }

    for (const p of matchedPnl) {
      totalGrossPnl = totalGrossPnl.add(FixedDecimal.from(p.realizedGrossPnl));
      totalNetPnl = totalNetPnl.add(FixedDecimal.from(p.realizedNetPnl));
    }

    const execCount = matchedDiag.length;
    const avgSlippageBps = slippageCount > 0
      ? slippageBpsSum.div(slippageCount).toString()
      : undefined;

    const avgFillRatio = execCount > 0
      ? fillRatioSum.div(execCount).toString()
      : '0.000000000000';

    const avgLatencyMs = latencyCount > 0
      ? Math.round(latencyMsSum / latencyCount)
      : undefined;

    const totalFeesByAsset = Array.from(feeAssetMap.entries()).map(([asset, amt]) => ({
      asset,
      amount: amt.toString(),
    }));

    const aggregateId = `agg-${options.strategyId}-${options.strategyRevisionId}-${Date.now()}`;

    return {
      aggregateId,
      strategyId: options.strategyId,
      strategyRevisionId: options.strategyRevisionId,
      venue: options.venue,
      instrument: options.instrument,
      environment: options.environment,
      accountingCurrency,
      windowStart: options.windowStart,
      windowEnd: options.windowEnd,
      asOf,
      executionCount: execCount,
      filledQuantity: totalFilled.toString(),
      grossRealizedPnl: totalGrossPnl.toString(),
      netRealizedPnl: totalNetPnl.toString(),
      totalFees: totalFees.toString(),
      totalFeesByAsset,
      averageSlippageBps: avgSlippageBps,
      totalSlippageAmount: slippageCount > 0 ? totalSlippageAmount.toString() : undefined,
      fillRatio: avgFillRatio,
      rejectionCount,
      cancellationCount,
      reconciliationAnomalyCount: anomalyCount,
      averageLatencyMs: avgLatencyMs,
    };
  }
}

