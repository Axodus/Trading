import type { RuntimeQuota } from '../runtime/types.js';

export type AccessDecision = 'granted' | 'denied' | 'pending-review';
export type UnlockConditionType = 'token-balance' | 'staking' | 'nft' | 'subscription' | 'dao-access' | 'trial';

export interface TokenAccessPolicy {
  neuronMinimum?: bigint;
  stakingMinimum?: bigint;
  requiredNftCollections?: string[];
  daoAccessRequired?: boolean;
  allowTrial?: boolean;
}

export interface StrategyAccessPolicy {
  entitlementKey: string;
  tokenPolicy?: TokenAccessPolicy;
  allowedSubscriptionTiers?: string[];
  trialRuntimeQuota?: RuntimeQuota;
}

export interface EntitlementState {
  status: 'eligible' | 'active' | 'expired' | 'suspended' | 'revoked';
  checkedAt: string;
  entitlementKeys: string[];
}

export interface UnlockCondition {
  type: UnlockConditionType;
  reference: string;
  description?: string;
}
