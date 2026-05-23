import type { StrategyProduct, TradingExecutionContext, UserTradingProfile } from '../../../../packages/trading-contracts/src/index.js';
import { EntitlementEvaluator } from '../product/EntitlementEvaluator.js';
import { TokenGateEvaluator } from '../product/TokenGateEvaluator.js';
import type { RuntimeLifecycleService } from './RuntimeLifecycleService.js';

export interface RuntimeProvisioningPolicyDecision {
  approved: boolean;
  reason?: string;
}

export class RuntimeProvisioningPolicy {
  private readonly entitlementEvaluator = new EntitlementEvaluator();
  private readonly tokenGateEvaluator = new TokenGateEvaluator();

  constructor(private readonly lifecycle: RuntimeLifecycleService) {}

  evaluate(request: {
    context: TradingExecutionContext;
    product: StrategyProduct;
    profile: UserTradingProfile;
  }): RuntimeProvisioningPolicyDecision {
    const { context, product, profile } = request;
    if (context.executionDomain !== 'user') {
      return { approved: false, reason: 'Runtime provisioning is limited to user execution domain.' };
    }
    if (!context.userId || context.userId !== profile.userId) {
      return { approved: false, reason: 'Runtime provisioning requires matching user tenant context.' };
    }
    if (!context.strategyProductId || context.strategyProductId !== product.id) {
      return { approved: false, reason: 'Runtime provisioning requires matching strategy product context.' };
    }
    if (!product.supportedProviders.includes(context.providerId as never)) {
      return { approved: false, reason: `Provider is not compatible with strategy product: ${context.providerId}` };
    }
    if (product.lifecycleStatus !== 'active') {
      return { approved: false, reason: `Strategy product is not active: ${product.lifecycleStatus}` };
    }

    const entitlementDecision = this.entitlementEvaluator.evaluate(product, profile);
    if (!entitlementDecision.approved) {
      return entitlementDecision;
    }
    const tokenDecision = this.tokenGateEvaluator.evaluate(product, profile);
    if (!tokenDecision.approved) {
      return tokenDecision;
    }

    const activeUserRuntimes = this.lifecycle.listByUser(context.userId)
      .filter((record) => ['requested', 'provisioning', 'active', 'paused', 'degraded', 'recovering'].includes(record.runtime.status));
    const maxRuntimes = Math.min(profile.runtimeQuota.maxConcurrentRuntimes, product.runtimeLimits.maxConcurrentRuntimes);
    if (activeUserRuntimes.length >= maxRuntimes) {
      return { approved: false, reason: 'Runtime quota exhausted: max concurrent runtimes' };
    }

    const activeStrategies = new Set(activeUserRuntimes.map((record) => record.runtime.strategyProductId));
    if (!activeStrategies.has(product.id) && activeStrategies.size >= Math.min(profile.runtimeQuota.maxActiveStrategies, product.runtimeLimits.maxActiveStrategies)) {
      return { approved: false, reason: 'Runtime quota exhausted: max active strategies' };
    }

    return { approved: true };
  }
}
