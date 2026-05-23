import type {
  ObservabilityQueryContext,
  StrategyHealthReadModel,
  TradingRecommendation,
} from '../../../../../packages/trading-contracts/src/index.js';
import { createObservabilityRecommendation, healthEvidence } from './ObservabilityRecommendationTypes.js';

export class StrategyHealthRecommendationService {
  evaluate(context: ObservabilityQueryContext, strategy?: StrategyHealthReadModel): TradingRecommendation[] {
    if (!strategy || (strategy.health.state !== 'degraded' && strategy.health.state !== 'critical')) {
      return [];
    }

    const evidence = healthEvidence('strategy-health', strategy.health, {
      strategyKey: strategy.strategyKey,
    });

    const recommendations = [
      createObservabilityRecommendation(
        context,
        'recommend-strategy-pause',
        strategy.health.state === 'critical' ? 0.9 : 0.76,
        `Strategy health is ${strategy.health.state}; Trinity recommends ACS-reviewed pause consideration.`,
        evidence,
      ),
      createObservabilityRecommendation(
        context,
        'recommend-simulation',
        0.74,
        'Strategy degradation requires simulation before any production parameter change.',
        evidence,
      ),
    ];

    if (strategy.health.state === 'critical') {
      recommendations.push(createObservabilityRecommendation(
        context,
        'recommend-backtest',
        0.72,
        'Critical strategy degradation requires backtest before controlled resume eligibility.',
        evidence,
      ));
    }

    return recommendations;
  }
}
