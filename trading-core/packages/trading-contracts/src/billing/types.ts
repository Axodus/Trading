import type { ExecutionQuota, RuntimeQuota } from '../runtime/types.js';

export interface BillingPolicy {
  billingMode:
    | 'none'
    | 'subscription'
    | 'usage'
    | 'milestone'
    | 'staking'
    | 'dao-funded';
  entitlementKey: string;
  quotaPolicy?: RuntimeQuota;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  includedStrategies: string[];
  runtimeQuota: RuntimeQuota;
  executionQuota?: ExecutionQuota[];
}

export interface EntitlementGrant {
  userId: string;
  entitlementKey: string;
  grantedAt: string;
  expiresAt?: string;
  source: 'billing' | 'staking' | 'dao' | 'manual' | 'trial';
}

export interface QuotaConsumption {
  userId: string;
  quotaKey: string;
  consumed: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
}
