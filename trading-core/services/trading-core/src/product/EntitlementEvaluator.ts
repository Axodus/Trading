import type { StrategyProduct, UserTradingProfile } from '../../../../packages/trading-contracts/src/index.js';
import type { GateDecision } from './ProductExecutionGate.js';

export class EntitlementEvaluator {
  evaluate(product: StrategyProduct, profile: UserTradingProfile, now: Date = new Date()): GateDecision {
    if (product.visibility === 'public') {
      return { approved: true };
    }

    if (profile.entitlementState.status === 'suspended' || profile.entitlementState.status === 'revoked') {
      return { approved: false, reason: 'Entitlement is not active' };
    }

    const hasEntitlement = profile.entitlementState.status === 'active'
      && profile.entitlementState.entitlementKeys.includes(product.accessPolicy.entitlementKey);
    if (hasEntitlement) {
      return { approved: true };
    }

    const tierAllowed = Boolean(
      profile.subscriptionTier
      && product.accessPolicy.allowedSubscriptionTiers?.includes(profile.subscriptionTier),
    );
    if (tierAllowed) {
      return { approved: true };
    }

    if (product.visibility === 'trial-enabled' || product.accessPolicy.tokenPolicy?.allowTrial) {
      if (profile.entitlementState.status !== 'trial') {
        return { approved: false, reason: 'Trial entitlement is required' };
      }

      const expiresAt = profile.entitlementState.expiresAt ?? product.accessPolicy.trialExpiresAt;
      if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) {
        return { approved: false, reason: 'Trial entitlement expired' };
      }

      return { approved: true };
    }

    return { approved: false, reason: 'Strategy entitlement is required' };
  }
}
