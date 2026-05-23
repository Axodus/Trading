import type { ReconciliationReviewPolicy as ReconciliationReviewPolicyContract } from '../../../../packages/trading-contracts/src/index.js';

export const defaultReconciliationReviewPolicy: ReconciliationReviewPolicyContract = {
  requireRiskApproval: true,
  requireGovernanceForTreasury: true,
  requireTreasuryPolicyForTreasury: true,
  allowUserRuntimeRemediation: true,
};

