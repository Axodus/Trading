import type { RemediationWorkflowPolicy as RemediationWorkflowPolicyContract } from '../../../../packages/trading-contracts/src/index.js';

export const defaultRemediationWorkflowPolicy: RemediationWorkflowPolicyContract = {
  requireRiskApproval: true,
  requireGovernanceForTreasury: true,
  requireTreasuryPolicyForTreasury: true,
  allowUserRuntimeRemediation: true,
  requireRuntimeContextForUser: true,
  expiresAfterMs: 24 * 60 * 60 * 1000,
};

