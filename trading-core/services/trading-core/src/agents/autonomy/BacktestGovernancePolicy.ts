import type { BacktestGovernancePolicy as BacktestGovernancePolicyContract } from '../../../../../packages/trading-contracts/src/index.js';

export class BacktestGovernancePolicy {
  evaluate(policy: BacktestGovernancePolicyContract): { approved: boolean; reason?: string } {
    if ((policy.completedBacktestRuns ?? 0) < (policy.minimumBacktestRuns ?? 0)) {
      return { approved: false, reason: 'Minimum backtest runs are not complete.' };
    }
    if (!policy.governanceApproved) {
      return { approved: false, reason: 'Governance approval is required.' };
    }
    if (!policy.riskApproved) {
      return { approved: false, reason: 'Risk approval is required.' };
    }
    return { approved: true };
  }
}
