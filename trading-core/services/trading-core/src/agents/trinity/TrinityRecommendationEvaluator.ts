import type {
  AcsTradingRecommendation,
  TradingRecommendation,
  TrinityRecommendationEvaluation,
} from '../../../../../packages/trading-contracts/src/index.js';

export class TrinityRecommendationEvaluator {
  evaluate(recommendation: TradingRecommendation): TrinityRecommendationEvaluation {
    if (!recommendation.context.userId && !recommendation.context.daoId) {
      return {
        approvedForAcsIntake: false,
        reason: 'Trinity recommendation requires tenant context before ACS intake.',
      };
    }

    return {
      approvedForAcsIntake: true,
      acsRecommendation: this.toAcsRecommendation(recommendation),
    };
  }

  toAcsRecommendation(recommendation: TradingRecommendation): AcsTradingRecommendation {
    return {
      id: recommendation.id,
      correlationId: recommendation.correlationId,
      tenantId: recommendation.tenantId,
      producedByAgent: 'trinity',
      context: recommendation.context,
      recommendationType: this.mapRecommendationType(recommendation.recommendationType),
      confidence: recommendation.confidence,
      rationale: recommendation.rationale,
    };
  }

  private mapRecommendationType(recommendationType: TradingRecommendation['recommendationType']): AcsTradingRecommendation['recommendationType'] {
    if (recommendationType === 'pause-strategy') {
      return 'pause-runtime';
    }
    if (recommendationType === 'request-backtest' || recommendationType === 'request-simulation' || recommendationType === 'adjust-parameter' || recommendationType === 'rotate-pair') {
      return 'strategy-simulation';
    }
    if (recommendationType === 'recommend-runtime-recovery') {
      return 'risk-review';
    }
    return 'risk-review';
  }
}
