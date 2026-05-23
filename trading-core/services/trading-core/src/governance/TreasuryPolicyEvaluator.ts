import type { ExecutionIntent } from '../application/ExecutionIntent.js';
import type { GateDecision } from '../product/ProductExecutionGate.js';

export interface TreasuryPolicyState {
  treasuryAuthorized: boolean;
  allowedStrategyIds: string[];
}

export class TreasuryPolicyEvaluator {
  constructor(private readonly state: TreasuryPolicyState) {}

  evaluate(intent: ExecutionIntent): GateDecision {
    if (!this.state.treasuryAuthorized) {
      return { approved: false, reason: 'Treasury execution is not authorized' };
    }

    if (intent.context.strategyId && !this.state.allowedStrategyIds.includes(intent.context.strategyId)) {
      return { approved: false, reason: 'Treasury policy blocks unauthorized strategy' };
    }

    return { approved: true };
  }
}
