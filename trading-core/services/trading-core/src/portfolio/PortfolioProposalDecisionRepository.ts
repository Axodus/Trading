import type { PortfolioDecision, TradeProposal } from '../../../../packages/trading-contracts/src/index.js';
import type { ProposalAllocationEvaluation } from './PortfolioTypes.js';

export type PortfolioProposalDecisionState = 'CLAIMED' | 'TERMINAL';

export interface PortfolioProposalDecisionRecord {
  proposalId: string;
  proposalFingerprint: string;
  state: PortfolioProposalDecisionState;
  decision?: PortfolioDecision;
  evaluation?: ProposalAllocationEvaluation;
  correlationId: string;
  evidenceRefs: readonly string[];
  claimedAt: string;
  leaseUntil: string;
  terminalAt?: string;
}

export type PortfolioProposalDecisionClaim =
  | { status: 'CLAIMED'; record: PortfolioProposalDecisionRecord }
  | { status: 'TERMINAL'; record: PortfolioProposalDecisionRecord }
  | { status: 'IN_PROGRESS'; record: PortfolioProposalDecisionRecord };

export class PortfolioProposalDecisionConflictError extends Error {
  readonly code = 'PORTFOLIO_PROPOSAL_IDENTITY_CONFLICT' as const;
}

export class PortfolioProposalDecisionRepositoryUnavailableError extends Error {
  readonly code = 'PORTFOLIO_PROPOSAL_REPOSITORY_UNAVAILABLE' as const;
}

export interface PortfolioProposalDecisionRepository {
  claim(input: {
    proposal: TradeProposal;
    proposalFingerprint: string;
    correlationId: string;
    evidenceRefs: readonly string[];
    claimedAt: string;
    leaseUntil: string;
  }): Promise<PortfolioProposalDecisionClaim>;
  complete(input: {
    proposalId: string;
    proposalFingerprint: string;
    decision: PortfolioDecision;
    evaluation: ProposalAllocationEvaluation;
    terminalAt: string;
  }): Promise<PortfolioProposalDecisionRecord>;
  recoverExpiredClaim(proposalId: string, now: string, leaseUntil: string): Promise<boolean>;
}
