import type { ExecutionIntent } from '../application/ExecutionIntent.js';
import type { GateDecision } from '../product/ProductExecutionGate.js';

export interface ConstitutionalStandingState {
  governanceStatus: 'active' | 'restricted' | 'halted';
  constitutionalStanding: 'compliant' | 'review-required' | 'blocked';
  strategyWhitelist: string[];
}

export class ConstitutionalStandingEvaluator {
  constructor(private readonly state: ConstitutionalStandingState) {}

  evaluate(intent: ExecutionIntent): GateDecision {
    if (this.state.governanceStatus !== 'active') {
      return { approved: false, reason: `Governance status blocks execution: ${this.state.governanceStatus}` };
    }

    if (this.state.constitutionalStanding !== 'compliant') {
      return { approved: false, reason: `Constitutional standing blocks execution: ${this.state.constitutionalStanding}` };
    }

    if (intent.context.strategyId && !this.state.strategyWhitelist.includes(intent.context.strategyId)) {
      return { approved: false, reason: 'Strategy is not constitutionally whitelisted' };
    }

    return { approved: true };
  }
}
