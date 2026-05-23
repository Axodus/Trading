import type { StrategyProduct } from '../../../../../packages/trading-contracts/src/index.js';
import { whiteRabbitExecutionProfile } from './WhiteRabbitExecutionProfile.js';
import { whiteRabbitRuntimePolicy } from './WhiteRabbitRuntimePolicy.js';

export class WhiteRabbitProductAdapter {
  toStrategyProduct(): StrategyProduct {
    return {
      id: 'whiterabbit-scalper-futures',
      name: 'WhiteRabbit Scalper Futures',
      description: 'WhiteRabbit V1 packaged as an Axodus strategy product.',
      visibility: 'premium',
      accessPolicy: {
        entitlementKey: 'strategy.whiterabbit.scalper',
        tokenPolicy: {
          neuronMinimum: 100n,
          allowTrial: true,
        },
        allowedSubscriptionTiers: ['pro', 'premium'],
        trialExecutionLimit: 5,
      },
      runtimeLimits: whiteRabbitRuntimePolicy,
      supportedProviders: ['simulation', 'hummingbot'],
      monetization: 'subscription',
      lifecycleStatus: 'active',
    };
  }

  executionProfile() {
    return whiteRabbitExecutionProfile;
  }
}
