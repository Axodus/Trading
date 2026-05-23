import type { StrategyProduct, UserTradingProfile } from '../../../../packages/trading-contracts/src/index.js';
import type { GateDecision } from './ProductExecutionGate.js';

export class TokenGateEvaluator {
  evaluate(product: StrategyProduct, profile: UserTradingProfile): GateDecision {
    const policy = product.accessPolicy.tokenPolicy;
    if (!policy) {
      return { approved: true };
    }

    if (policy.neuronMinimum !== undefined && profile.neuronBalance < policy.neuronMinimum) {
      return { approved: false, reason: 'Token gate failed: insufficient neuron balance' };
    }

    return { approved: true };
  }
}
