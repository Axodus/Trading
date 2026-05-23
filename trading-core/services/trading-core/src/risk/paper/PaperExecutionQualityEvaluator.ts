import type { PaperRiskEvaluationInput, PaperRiskSignal } from '../../../../../packages/trading-contracts/src/index.js';

export interface PaperExecutionQualityThresholds {
  maxLatencyMs: number;
  maxSlippageBps: number;
}

export class PaperExecutionQualityEvaluator {
  constructor(private readonly thresholds: PaperExecutionQualityThresholds = { maxLatencyMs: 1000, maxSlippageBps: 50 }) {}

  evaluate(input: PaperRiskEvaluationInput): PaperRiskSignal[] {
    return [
      ...this.latencySignals(input),
      ...this.slippageSignals(input),
      ...this.fillSignals(input),
    ];
  }

  private latencySignals(input: PaperRiskEvaluationInput): PaperRiskSignal[] {
    if (!input.averageLatencyMs || input.averageLatencyMs <= this.thresholds.maxLatencyMs) {
      return [];
    }
    return [this.signal(input, 'paper-execution-latency-high', 'high', {
      averageLatencyMs: input.averageLatencyMs,
      reasons: [`paper latency ${input.averageLatencyMs}ms exceeded ${this.thresholds.maxLatencyMs}ms`],
    })];
  }

  private slippageSignals(input: PaperRiskEvaluationInput): PaperRiskSignal[] {
    const expected = Number(input.expectedPrice);
    const fill = input.fills?.at(-1);
    if (!fill || !Number.isFinite(expected) || expected <= 0) {
      return [];
    }
    const observed = Number(fill.price);
    const slippageBps = Math.abs((observed - expected) / expected) * 10000;
    if (slippageBps <= this.thresholds.maxSlippageBps) {
      return [];
    }
    return [this.signal(input, 'paper-slippage-high', 'high', {
      fillCount: input.fills?.length ?? 0,
      slippageBps,
      reasons: [`paper slippage ${slippageBps.toFixed(2)}bps exceeded ${this.thresholds.maxSlippageBps}bps`],
    })];
  }

  private fillSignals(input: PaperRiskEvaluationInput): PaperRiskSignal[] {
    if ((input.fills?.length ?? 0) > 0) {
      return [];
    }
    return [this.signal(input, 'paper-fill-quality-degraded', 'warning', {
      fillCount: 0,
      reasons: ['paper validation produced no normalized fills'],
    })];
  }

  private signal(
    input: PaperRiskEvaluationInput,
    signalType: PaperRiskSignal['signalType'],
    severity: PaperRiskSignal['severity'],
    evidence: PaperRiskSignal['evidence'],
  ): PaperRiskSignal {
    return {
      id: `${input.correlationId}:${signalType}`,
      correlationId: input.correlationId,
      tenantId: input.tenantId,
      signalType,
      severity,
      providerId: input.providerId,
      runtimeInstanceId: input.runtimeInstanceId,
      strategyId: input.strategyId,
      strategyProductId: input.strategyProductId,
      userId: input.userId,
      daoId: input.daoId,
      evidence,
      createdAt: new Date().toISOString(),
    };
  }
}

