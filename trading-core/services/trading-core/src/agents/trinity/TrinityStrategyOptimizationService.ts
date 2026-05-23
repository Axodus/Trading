import type { TradingRecommendation, TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';

export class TrinityStrategyOptimizationService {
  evaluate(intent: TrinityTradingIntent, createdAt = new Date().toISOString()): TradingRecommendation[] {
    const degradationScore = intent.strategySnapshot?.degradationScore ?? 0;
    const drawdownPct = intent.strategySnapshot?.drawdownPct ?? 0;
    const recommendations: TradingRecommendation[] = [];

    if (degradationScore >= 0.75 || drawdownPct >= 8) {
      recommendations.push(this.recommend(intent, 'pause-strategy', 0.86, 'Strategy degradation threshold exceeded.', createdAt));
      recommendations.push(this.recommend(intent, 'request-backtest', 0.82, 'Backtest requested before any production parameter mutation.', createdAt));
    } else if (degradationScore >= 0.5) {
      recommendations.push(this.recommend(intent, 'adjust-parameter', 0.68, 'Parameter optimization should be simulated before execution.', createdAt));
      recommendations.push(this.recommend(intent, 'request-simulation', 0.74, 'Simulation required before controlled strategy change.', createdAt));
    }

    return recommendations;
  }

  private recommend(
    intent: TrinityTradingIntent,
    recommendationType: TradingRecommendation['recommendationType'],
    confidence: number,
    rationale: string,
    createdAt: string,
  ): TradingRecommendation {
    return {
      id: `trinity-${recommendationType}-${intent.id}`,
      correlationId: intent.correlationId,
      tenantId: intent.tenantId,
      producedByAgent: 'trinity',
      context: intent.context,
      recommendationType,
      confidence,
      rationale,
      createdAt,
      requiresAcs: true,
      authorizedExecution: false,
    };
  }
}
