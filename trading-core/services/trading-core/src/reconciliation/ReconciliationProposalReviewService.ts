import type {
  AcsReconciliationReviewCommand,
  ReconciliationApprovalDecision,
  ReconciliationProposal,
  ReconciliationRemediationRequest,
  ReconciliationRemediationRequestType,
} from '../../../../packages/trading-contracts/src/index.js';
import { ReconciliationProposalRepository } from './ReconciliationProposalRepository.js';
import { ReconciliationProposalAuditService } from './ReconciliationProposalAuditService.js';
import { ReconciliationRemediationEligibilityService } from './ReconciliationRemediationEligibilityService.js';

export interface ReconciliationProposalReviewServiceDependencies {
  proposals: ReconciliationProposalRepository;
  audit?: ReconciliationProposalAuditService;
  eligibility?: ReconciliationRemediationEligibilityService;
}

export class ReconciliationProposalReviewService {
  private readonly audit: ReconciliationProposalAuditService;
  private readonly eligibility: ReconciliationRemediationEligibilityService;

  constructor(private readonly deps: ReconciliationProposalReviewServiceDependencies) {
    this.audit = deps.audit ?? new ReconciliationProposalAuditService();
    this.eligibility = deps.eligibility ?? new ReconciliationRemediationEligibilityService();
  }

  async review(command: AcsReconciliationReviewCommand): Promise<ReconciliationApprovalDecision> {
    const proposal = await this.deps.proposals.get(command.proposalId);
    await this.audit.reviewRequested(command, proposal);

    const eligibility = this.eligibility.evaluate(command, proposal);
    if (!eligibility.approved || !proposal || !command.tenantId) {
      if (proposal) {
        await this.deps.proposals.updateReviewState(proposal.id, eligibility.reviewState);
      }
      const decision = this.decision(command, eligibility.reviewState, false, eligibility.reason, eligibility.blockedBy);
      await this.audit.reviewRejected(decision, proposal);
      await this.audit.remediationBlocked(decision, proposal);
      return decision;
    }

    const updated = await this.deps.proposals.updateReviewState(proposal.id, 'approved-for-remediation');
    const request = this.remediationRequest(command, updated ?? proposal);
    const decision = this.decision(command, 'approved-for-remediation', true, undefined, undefined, request);
    await this.audit.reviewApproved(decision, updated ?? proposal);
    await this.audit.remediationRequested(request);
    return decision;
  }

  private decision(
    command: AcsReconciliationReviewCommand,
    reviewState: ReconciliationApprovalDecision['reviewState'],
    approved: boolean,
    reason?: string,
    blockedBy?: ReconciliationApprovalDecision['blockedBy'],
    remediationRequest?: ReconciliationRemediationRequest,
  ): ReconciliationApprovalDecision {
    return {
      id: `${command.id}:decision`,
      commandId: command.id,
      proposalId: command.proposalId,
      correlationId: command.correlationId,
      tenantId: command.tenantId,
      approved,
      reviewState,
      blockedBy,
      reason,
      remediationRequest,
      autoHealing: false,
      createdAt: new Date().toISOString(),
    };
  }

  private remediationRequest(command: AcsReconciliationReviewCommand, proposal: ReconciliationProposal): ReconciliationRemediationRequest {
    return {
      id: `${command.id}:remediation-request`,
      proposalId: proposal.id,
      correlationId: command.correlationId,
      tenantId: command.tenantId ?? proposal.context.daoId ?? proposal.context.userId ?? 'unknown',
      context: { ...proposal.context },
      requestType: this.requestType(proposal),
      status: 'requested',
      reason: command.reason,
      autoHealing: false,
      mutatesProvider: false,
      mutatesSovereignState: false,
      createdAt: new Date().toISOString(),
    };
  }

  private requestType(proposal: ReconciliationProposal): ReconciliationRemediationRequestType {
    if (proposal.recommendedActions.includes('request-runtime-recovery')) {
      return 'runtime-recovery-request';
    }
    if (proposal.recommendedActions.includes('request-provider-health-review')) {
      return 'provider-resync-request';
    }
    if (proposal.recommendedActions.includes('request-order-review')) {
      return 'order-review-request';
    }
    if (proposal.recommendedActions.includes('request-position-review')) {
      return 'position-review-request';
    }
    if (proposal.recommendedActions.includes('record-audit')) {
      return 'manual-operator-review-request';
    }
    return 'reconciliation-retry-request';
  }
}

