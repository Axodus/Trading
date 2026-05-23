import type { ReconciliationProposal, ReconciliationProposalReviewState } from '../../../../packages/trading-contracts/src/index.js';

export class ReconciliationProposalRepository {
  private readonly proposals = new Map<string, ReconciliationProposal>();

  async save(proposal: ReconciliationProposal): Promise<void> {
    this.proposals.set(proposal.id, this.clone(proposal));
  }

  async updateReviewState(id: string, reviewState: ReconciliationProposalReviewState): Promise<ReconciliationProposal | undefined> {
    const current = this.proposals.get(id);
    if (!current) {
      return undefined;
    }
    const next = { ...current, reviewState };
    this.proposals.set(id, this.clone(next));
    return this.clone(next);
  }

  async get(id: string): Promise<ReconciliationProposal | undefined> {
    const proposal = this.proposals.get(id);
    return proposal ? this.clone(proposal) : undefined;
  }

  async list(): Promise<ReconciliationProposal[]> {
    return [...this.proposals.values()].map((proposal) => this.clone(proposal));
  }

  async listByTenant(tenantId: string): Promise<ReconciliationProposal[]> {
    return [...this.proposals.values()]
      .filter((proposal) => this.tenantId(proposal) === tenantId)
      .map((proposal) => this.clone(proposal));
  }

  async listByCorrelationId(correlationId: string): Promise<ReconciliationProposal[]> {
    return [...this.proposals.values()]
      .filter((proposal) => proposal.correlationId === correlationId)
      .map((proposal) => this.clone(proposal));
  }

  private tenantId(proposal: ReconciliationProposal): string | undefined {
    return proposal.context.daoId ?? proposal.context.userId;
  }

  private clone(proposal: ReconciliationProposal): ReconciliationProposal {
    return JSON.parse(JSON.stringify(proposal)) as ReconciliationProposal;
  }
}
