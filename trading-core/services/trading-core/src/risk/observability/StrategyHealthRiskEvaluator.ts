import type {
  ObservabilityQueryContext,
  ObservabilityRiskSignal,
  StrategyHealthReadModel,
} from '../../../../../packages/trading-contracts/src/index.js';
import { createObservabilityRiskSignal } from './ObservabilityRiskSignalFactory.js';

export class StrategyHealthRiskEvaluator {
  evaluate(context: ObservabilityQueryContext, strategy?: StrategyHealthReadModel): ObservabilityRiskSignal[] {
    if (!strategy || strategy.tenantId !== context.tenantId) {
      return [];
    }
    if (strategy.health.state !== 'degraded' && strategy.health.state !== 'critical') {
      return [];
    }
    return [createObservabilityRiskSignal(context, 'strategy-degraded', 'strategy-health', strategy.health, {
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId ?? strategy.strategyKey,
    })];
  }
}
