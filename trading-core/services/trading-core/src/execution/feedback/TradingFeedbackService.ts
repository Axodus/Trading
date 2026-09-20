import type {
  ExecutionDiagnostics,
  PnLAttribution,
  TradingPerformanceAggregate,
  TradingFeedbackSnapshot,
  ExpectedVsObservedDivergence,
  EconomicQuality,
  ExecutionEnvironment,
} from '../../../../../packages/trading-contracts/src/index.js';
import { FixedDecimal } from '../../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import { TradingPerformanceAggregator } from './TradingPerformanceAggregator.js';

export interface ExpectedMetrics {
  expectedSlippageBps?: string;
  expectedFee?: string;
  expectedFillRatio?: string;
  expectedLatencyMs?: number;
  expectedPnl?: string;
}

export interface CreateFeedbackSnapshotOptions {
  strategyId: string;
  strategyRevisionId: string;
  venue: string;
  instrument: string;
  environment: ExecutionEnvironment;
  windowStart: string;
  windowEnd: string;
  expectedMetrics?: ExpectedMetrics;
  evidenceRef?: string;
  asOf?: string;
}

export class TradingFeedbackService {
  private readonly aggregator = new TradingPerformanceAggregator();

  public createSnapshot(
    diagnosticsList: readonly ExecutionDiagnostics[],
    pnlList: readonly PnLAttribution[],
    options: CreateFeedbackSnapshotOptions
  ): TradingFeedbackSnapshot {
    const asOf = options.asOf ?? new Date().toISOString();

    const aggregate = this.aggregator.aggregate(diagnosticsList, pnlList, {
      strategyId: options.strategyId,
      strategyRevisionId: options.strategyRevisionId,
      venue: options.venue,
      instrument: options.instrument,
      environment: options.environment,
      windowStart: options.windowStart,
      windowEnd: options.windowEnd,
      asOf,
    });

    const diagnosticsRefs = diagnosticsList.map((d) => d.diagnosticsId);
    const pnlAttributionRefs = pnlList.map((p) => p.pnlAttributionId);

    // Expected vs Observed Divergence
    let divergence: ExpectedVsObservedDivergence | undefined;
    if (options.expectedMetrics) {
      const exp = options.expectedMetrics;
      let slippageDiv: string | undefined;
      let feeDiv: string | undefined;
      let fillRatioDiv: string | undefined;
      let latencyDiv: number | undefined;
      let pnlDiv: string | undefined;

      if (exp.expectedSlippageBps !== undefined && aggregate.averageSlippageBps !== undefined) {
        slippageDiv = FixedDecimal.from(aggregate.averageSlippageBps).sub(exp.expectedSlippageBps).toString();
      }

      if (exp.expectedFee !== undefined) {
        feeDiv = FixedDecimal.from(aggregate.totalFees).sub(exp.expectedFee).toString();
      }

      if (exp.expectedFillRatio !== undefined) {
        fillRatioDiv = FixedDecimal.from(aggregate.fillRatio).sub(exp.expectedFillRatio).toString();
      }

      if (exp.expectedLatencyMs !== undefined && aggregate.averageLatencyMs !== undefined) {
        latencyDiv = aggregate.averageLatencyMs - exp.expectedLatencyMs;
      }

      if (exp.expectedPnl !== undefined) {
        pnlDiv = FixedDecimal.from(aggregate.netRealizedPnl).sub(exp.expectedPnl).toString();
      }

      divergence = {
        slippageDivergenceBps: slippageDiv,
        feeDivergence: feeDiv,
        fillRatioDivergence: fillRatioDiv,
        latencyDivergenceMs: latencyDiv,
        pnlDivergence: pnlDiv,
      };
    }

    let quality: EconomicQuality = 'COMPLETE';
    if (diagnosticsList.some((d) => d.quality === 'INVALID') || pnlList.some((p) => p.quality === 'INVALID')) {
      quality = 'INVALID';
    } else if (diagnosticsList.some((d) => d.quality === 'UNRESOLVED') || pnlList.some((p) => p.quality === 'PENDING_RECONCILIATION')) {
      quality = 'UNRESOLVED';
    } else if (diagnosticsList.some((d) => d.quality === 'PARTIAL') || pnlList.some((p) => p.quality === 'PARTIAL')) {
      quality = 'PARTIAL';
    }

    const inputPayload = {
      strategyId: options.strategyId,
      strategyRevisionId: options.strategyRevisionId,
      windowStart: options.windowStart,
      windowEnd: options.windowEnd,
      diagnosticsRefs,
      pnlAttributionRefs,
      aggregate,
      divergence,
    };
    const inputDigest = stableJson(inputPayload);
    const feedbackSnapshotId = `feed-${options.strategyId}-${options.strategyRevisionId}-${Date.now()}`;

    return {
      feedbackSnapshotId,
      strategyId: options.strategyId,
      strategyRevisionId: options.strategyRevisionId,
      venue: options.venue,
      instrument: options.instrument,
      environment: options.environment,
      windowStart: options.windowStart,
      windowEnd: options.windowEnd,
      diagnosticsRefs,
      pnlAttributionRefs,
      aggregate,
      divergence,
      quality,
      inputDigest,
      createdAt: asOf,
      evidenceRef: options.evidenceRef,
    };
  }
}

