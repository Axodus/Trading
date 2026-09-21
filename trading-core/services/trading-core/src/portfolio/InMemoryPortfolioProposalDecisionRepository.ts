import type { PortfolioDecision, TradeProposal } from '../../../../packages/trading-contracts/src/index.js';
import {
  PortfolioProposalDecisionConflictError,
  PortfolioProposalDecisionRepositoryUnavailableError,
  type PortfolioProposalDecisionClaim,
  type PortfolioProposalDecisionRecord,
  type PortfolioProposalDecisionRepository,
} from './PortfolioProposalDecisionRepository.js';
import type { ProposalAllocationEvaluation } from './PortfolioTypes.js';

export class InMemoryPortfolioProposalDecisionRepository implements PortfolioProposalDecisionRepository {
  private readonly storage = new Map<string, PortfolioProposalDecisionRecord>();
  public shouldFail = false;

  async claim(input: {
    proposal: TradeProposal;
    proposalFingerprint: string;
    correlationId: string;
    evidenceRefs: readonly string[];
    claimedAt: string;
    leaseUntil: string;
  }): Promise<PortfolioProposalDecisionClaim> {
    if (this.shouldFail) {
      throw new PortfolioProposalDecisionRepositoryUnavailableError('Simulated repository outage during claim');
    }
    const existing = this.storage.get(input.proposal.proposalId);
    if (!existing) {
      const record: PortfolioProposalDecisionRecord = {
        proposalId: input.proposal.proposalId,
        proposalFingerprint: input.proposalFingerprint,
        state: 'CLAIMED',
        correlationId: input.correlationId,
        evidenceRefs: input.evidenceRefs,
        claimedAt: input.claimedAt,
        leaseUntil: input.leaseUntil,
      };
      this.storage.set(input.proposal.proposalId, record);
      return { status: 'CLAIMED', record };
    }

    if (existing.proposalFingerprint !== input.proposalFingerprint) {
      throw new PortfolioProposalDecisionConflictError(
        `Proposal ${input.proposal.proposalId} submitted with mismatched fingerprint`,
      );
    }

    if (existing.state === 'TERMINAL') {
      return { status: 'TERMINAL', record: existing };
    }

    return { status: 'IN_PROGRESS', record: existing };
  }

  async complete(input: {
    proposalId: string;
    proposalFingerprint: string;
    decision: PortfolioDecision;
    evaluation: ProposalAllocationEvaluation;
    terminalAt: string;
  }): Promise<PortfolioProposalDecisionRecord> {
    if (this.shouldFail) {
      throw new PortfolioProposalDecisionRepositoryUnavailableError('Simulated repository outage during complete');
    }
    const existing = this.storage.get(input.proposalId);
    if (!existing || existing.state !== 'CLAIMED' || existing.proposalFingerprint !== input.proposalFingerprint) {
      throw new PortfolioProposalDecisionRepositoryUnavailableError(`Cannot complete proposal ${input.proposalId}`);
    }
    const updated: PortfolioProposalDecisionRecord = {
      ...existing,
      state: 'TERMINAL',
      decision: input.decision,
      evaluation: input.evaluation,
      terminalAt: input.terminalAt,
    };
    this.storage.set(input.proposalId, updated);
    return updated;
  }

  async recoverExpiredClaim(proposalId: string, now: string, leaseUntil: string): Promise<boolean> {
    if (this.shouldFail) {
      throw new PortfolioProposalDecisionRepositoryUnavailableError('Simulated repository outage during recover');
    }
    const existing = this.storage.get(proposalId);
    if (existing && existing.state === 'CLAIMED' && Date.parse(existing.leaseUntil) <= Date.parse(now)) {
      existing.claimedAt = now;
      existing.leaseUntil = leaseUntil;
      return true;
    }
    return false;
  }
}
