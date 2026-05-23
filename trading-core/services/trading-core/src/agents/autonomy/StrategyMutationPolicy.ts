import type { StrategyMutationPolicy as StrategyMutationPolicyContract } from '../../../../../packages/trading-contracts/src/index.js';
import { BacktestGovernancePolicy } from './BacktestGovernancePolicy.js';
import { SimulationApprovalPolicy } from './SimulationApprovalPolicy.js';

export class StrategyMutationPolicy {
  constructor(
    private readonly simulationPolicy = new SimulationApprovalPolicy(),
    private readonly governancePolicy = new BacktestGovernancePolicy(),
  ) {}

  evaluate(policy: StrategyMutationPolicyContract): { approved: boolean; reason?: string } {
    if (!policy.productionMutationRequested) {
      return { approved: true };
    }
    const simulationDecision = this.simulationPolicy.evaluate(policy.simulationPolicy);
    if (!simulationDecision.approved) {
      return simulationDecision;
    }
    return this.governancePolicy.evaluate(policy.governancePolicy);
  }
}
