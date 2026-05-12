import type { StrategyAccessPolicy, EntitlementState } from '../access/types.js';
import type { ExecutionProviderType } from '../execution/types.js';
import type { Address, ExecutionLimits, RuntimeQuota } from '../runtime/types.js';

export interface StrategyProduct {
  id: string;
  name: string;
  description?: string;
  visibility: 'public' | 'token-gated' | 'dao-only' | 'premium';
  accessPolicy: StrategyAccessPolicy;
  runtimeLimits: RuntimeQuota;
  supportedProviders: ExecutionProviderType[];
  monetization: 'free' | 'subscription' | 'milestone' | 'staking' | 'dao-access';
  lifecycleStatus: 'draft' | 'active' | 'deprecated' | 'suspended';
}

export interface UserTradingProfile {
  userId: string;
  wallet: Address;
  neuronBalance: bigint;
  unlockedStrategies: string[];
  runtimeQuota: RuntimeQuota;
  executionLimits: ExecutionLimits;
  subscriptionTier?: string;
  entitlementState: EntitlementState;
}
