import type {
  AcsReconciliationReviewCommand,
  ReconciliationApprovalDecision,
  ReconciliationProposal,
  ReconciliationReviewPolicy,
} from '../../../../packages/trading-contracts/src/index.js';
import { defaultReconciliationReviewPolicy } from './ReconciliationReviewPolicy.js';

export class ReconciliationRemediationEligibilityService {
  constructor(private readonly policy: ReconciliationReviewPolicy = defaultReconciliationReviewPolicy) {}

  evaluate(command: AcsReconciliationReviewCommand, proposal?: ReconciliationProposal): Pick<ReconciliationApprovalDecision, 'approved' | 'blockedBy' | 'reason' | 'reviewState'> {
    if (!command.tenantId) {
      return {
        approved: false,
        blockedBy: 'tenant-context',
        reason: 'ACS reconciliation review requires tenant context.',
        reviewState: 'rejected',
      };
    }
    if (!proposal) {
      return {
        approved: false,
        blockedBy: 'proposal-not-found',
        reason: `Reconciliation proposal not found: ${command.proposalId}`,
        reviewState: 'rejected',
      };
    }
    const proposalTenant = proposal.context.daoId ?? proposal.context.userId;
    if (proposalTenant !== command.tenantId) {
      return {
        approved: false,
        blockedBy: 'tenant-mismatch',
        reason: 'ACS reconciliation review cannot cross tenant boundaries.',
        reviewState: 'rejected',
      };
    }
    if (command.requestedBy === 'reconciliation-worker') {
      return {
        approved: false,
        blockedBy: 'worker-self-approval',
        reason: 'Reconciliation worker cannot approve its own proposal.',
        reviewState: 'pending-review',
      };
    }
    if (command.decisionIntent === 'reject') {
      return {
        approved: false,
        blockedBy: 'operator-rejection',
        reason: command.reason ?? 'ACS rejected reconciliation proposal.',
        reviewState: 'rejected',
      };
    }
    if (this.policy.requireRiskApproval && command.riskApproved !== true) {
      return {
        approved: false,
        blockedBy: 'risk',
        reason: command.reason ?? 'Risk review rejected reconciliation remediation.',
        reviewState: 'under-risk-review',
      };
    }
    if (proposal.context.executionDomain === 'treasury' && this.policy.requireGovernanceForTreasury && command.governanceApproved !== true) {
      return {
        approved: false,
        blockedBy: 'governance',
        reason: command.reason ?? 'Governance approval is required for treasury reconciliation remediation.',
        reviewState: 'under-governance-review',
      };
    }
    if (proposal.context.executionDomain === 'treasury' && this.policy.requireTreasuryPolicyForTreasury && command.treasuryPolicyApproved !== true) {
      return {
        approved: false,
        blockedBy: 'treasury-policy',
        reason: command.reason ?? 'Treasury policy approval is required for treasury reconciliation remediation.',
        reviewState: 'under-governance-review',
      };
    }
    if (proposal.context.executionDomain === 'user' && !this.policy.allowUserRuntimeRemediation) {
      return {
        approved: false,
        blockedBy: 'risk',
        reason: 'User runtime remediation is disabled by reconciliation review policy.',
        reviewState: 'under-risk-review',
      };
    }
    return {
      approved: true,
      reviewState: 'approved-for-remediation',
    };
  }
}

