import type { StrategyProduct, UserRuntimeInstance, UserTradingProfile } from '../../../../packages/trading-contracts/src/index.js';
import type { GateDecision } from './ProductExecutionGate.js';
import { StrategyAccessService } from './StrategyAccessService.js';

export class RuntimeQuotaEvaluator {
  constructor(private readonly accessService: StrategyAccessService) {}

  evaluate(product: StrategyProduct, profile: UserTradingProfile, runtime: UserRuntimeInstance): GateDecision {
    if (runtime.status !== 'active') {
      return { approved: false, reason: `Runtime is not active: ${runtime.status}` };
    }

    const runtimeQuota = profile.runtimeQuota;
    const productQuota = product.runtimeLimits;
    const maxActiveRuntimes = Math.min(runtimeQuota.maxConcurrentRuntimes, productQuota.maxConcurrentRuntimes);
    const maxActiveStrategies = Math.min(runtimeQuota.maxActiveStrategies, productQuota.maxActiveStrategies);

    if (this.accessService.getActiveRuntimeCount(profile.userId) > maxActiveRuntimes) {
      return { approved: false, reason: 'Runtime quota exceeded: max active runtimes' };
    }

    if (this.accessService.getActiveStrategyCount(profile.userId) > maxActiveStrategies) {
      return { approved: false, reason: 'Runtime quota exceeded: max active strategies' };
    }

    const maxDailyExecutions = Math.min(
      runtimeQuota.maxDailyExecutions ?? Number.POSITIVE_INFINITY,
      productQuota.maxDailyExecutions ?? Number.POSITIVE_INFINITY,
      this.accessService.getExecutionQuota(product.id)?.maxOrdersPerDay ?? Number.POSITIVE_INFINITY,
      product.accessPolicy.trialExecutionLimit ?? Number.POSITIVE_INFINITY,
    );
    if (this.accessService.getDailyExecutionCount(profile.userId, product.id) >= maxDailyExecutions) {
      return { approved: false, reason: 'Execution quota exceeded: max executions per day' };
    }

    const executionQuota = this.accessService.getExecutionQuota(product.id);
    if (
      executionQuota?.maxConcurrentPositions !== undefined
      && this.accessService.getConcurrentPositionCount(profile.userId, product.id) >= executionQuota.maxConcurrentPositions
    ) {
      return { approved: false, reason: 'Execution quota exceeded: max concurrent positions' };
    }

    return { approved: true };
  }
}
