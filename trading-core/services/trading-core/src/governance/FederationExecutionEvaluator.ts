import type { ExecutionIntent } from '../application/ExecutionIntent.js';
import type { GateDecision } from '../product/ProductExecutionGate.js';

export interface FederationExecutionState {
  federationTier: 'observer' | 'operator' | 'governed' | 'sovereign';
  delegatedExecutionAllowed: boolean;
  allowedStrategyIds: string[];
}

const executableTiers = new Set<FederationExecutionState['federationTier']>(['operator', 'governed', 'sovereign']);

export class FederationExecutionEvaluator {
  constructor(private readonly state: FederationExecutionState) {}

  evaluate(intent: ExecutionIntent): GateDecision {
    if (!executableTiers.has(this.state.federationTier)) {
      return { approved: false, reason: `Federation tier cannot execute: ${this.state.federationTier}` };
    }

    if (!this.state.delegatedExecutionAllowed) {
      return { approved: false, reason: 'Federation delegated execution is not allowed' };
    }

    if (intent.context.strategyId && !this.state.allowedStrategyIds.includes(intent.context.strategyId)) {
      return { approved: false, reason: 'Federation restriction blocks unauthorized strategy' };
    }

    return { approved: true };
  }
}
