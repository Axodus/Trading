import type { SimulationApprovalPolicy as SimulationApprovalPolicyContract } from '../../../../../packages/trading-contracts/src/index.js';

export class SimulationApprovalPolicy {
  evaluate(policy: SimulationApprovalPolicyContract): { approved: boolean; reason?: string } {
    if (policy.simulationRequired && !policy.simulationCompleted) {
      return { approved: false, reason: 'Simulation is required before mutation.' };
    }
    if (policy.backtestRequired && !policy.backtestCompleted) {
      return { approved: false, reason: 'Backtest is required before mutation.' };
    }
    if (policy.paperValidationRequired && !policy.paperValidationCompleted) {
      return { approved: false, reason: 'Paper validation is required before mutation.' };
    }
    return { approved: true };
  }
}
