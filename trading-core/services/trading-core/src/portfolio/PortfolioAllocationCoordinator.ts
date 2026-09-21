import type { TradeProposal, PortfolioDecision } from '../../../../packages/trading-contracts/src/index.js';
import { FixedDecimal } from '../../../../packages/trading-contracts/src/index.js';
import { CapitalAllocationService } from './CapitalAllocationService.js';
import type { PortfolioAllocationRunResult, PortfolioContext, ProposalAllocationEvaluation } from './PortfolioTypes.js';
import type { PortfolioProposalDecisionRepository } from './PortfolioProposalDecisionRepository.js';

export class PortfolioAllocationCoordinator {
  constructor(
    private readonly repository: PortfolioProposalDecisionRepository,
    private readonly allocator = new CapitalAllocationService(),
    private readonly leaseMs = 60_000,
  ) {}

  async allocate(context: PortfolioContext): Promise<PortfolioAllocationRunResult> {
    const terminalDecisions = new Map<string, { decision: PortfolioDecision; evaluation: ProposalAllocationEvaluation }>();
    const freshlyClaimed: TradeProposal[] = [];
    const fingerprints = new Map<string, string>();

    const sortedProposals = [...context.proposals].sort((a, b) => a.proposalId.localeCompare(b.proposalId));
    for (const proposal of sortedProposals) {
      const fingerprint = canonicalFingerprint(proposal);
      fingerprints.set(proposal.proposalId, fingerprint);
      const claimedAt = context.now;
      const leaseUntil = new Date(Date.parse(context.now) + this.leaseMs).toISOString();
      let claim = await this.repository.claim({ proposal, proposalFingerprint: fingerprint, correlationId: context.correlationId, evidenceRefs: proposal.evidenceRefs, claimedAt, leaseUntil });
      if (claim.status === 'IN_PROGRESS') {
        const recovered = Date.parse(claim.record.leaseUntil) <= Date.parse(context.now)
          && await this.repository.recoverExpiredClaim(proposal.proposalId, context.now, leaseUntil);
        if (recovered) claim = { status: 'CLAIMED', record: { ...claim.record, claimedAt: context.now, leaseUntil } };
        if (claim.status === 'IN_PROGRESS') throw new Error(`Portfolio proposal ${proposal.proposalId} is already being evaluated; retry after durable claim lease.`);
      }
      if (claim.status === 'TERMINAL') {
        if (!claim.record.decision || !claim.record.evaluation) throw new Error(`Portfolio proposal ${proposal.proposalId} is terminal without a decision payload.`);
        terminalDecisions.set(proposal.proposalId, {
          decision: claim.record.decision,
          evaluation: claim.record.evaluation,
        });
        continue;
      }
      freshlyClaimed.push(proposal);
    }

    let freshRunResult: PortfolioAllocationRunResult | undefined;
    if (freshlyClaimed.length > 0) {
      let terminalApprovedSum = FixedDecimal.zero();
      for (const item of terminalDecisions.values()) {
        terminalApprovedSum = terminalApprovedSum.add(FixedDecimal.from(item.decision.approvedCapital));
      }
      const baseAvail = FixedDecimal.from(context.portfolioSnapshot.availableCapital);
      const adjustedAvail = FixedDecimal.max(FixedDecimal.zero(), baseAvail.sub(terminalApprovedSum));
      const adjustedSnapshot = {
        ...context.portfolioSnapshot,
        availableCapital: adjustedAvail.toString(),
      };
      freshRunResult = this.allocator.allocate({
        ...context,
        portfolioSnapshot: adjustedSnapshot,
        proposals: freshlyClaimed,
      });
      for (const dec of freshRunResult.decisions) {
        const proposalId = dec.proposalIds[0];
        const evalItem = freshRunResult.evaluations.find((e) => e.proposal.proposalId === proposalId)!;
        const fingerprint = fingerprints.get(proposalId)!;
        await this.repository.complete({
          proposalId,
          proposalFingerprint: fingerprint,
          decision: dec,
          evaluation: evalItem,
          terminalAt: context.now,
        });
      }
    }

    const finalDecisions: PortfolioDecision[] = [];
    const finalEvaluations: ProposalAllocationEvaluation[] = [];
    let totalRequested = FixedDecimal.zero();
    let totalApproved = FixedDecimal.zero();

    for (const proposal of sortedProposals) {
      totalRequested = totalRequested.add(FixedDecimal.from(proposal.sizing.requestedCapital));
      const terminal = terminalDecisions.get(proposal.proposalId);
      if (terminal) {
        finalDecisions.push(terminal.decision);
        finalEvaluations.push(terminal.evaluation);
        totalApproved = totalApproved.add(FixedDecimal.from(terminal.decision.approvedCapital));
      } else if (freshRunResult) {
        const freshDec = freshRunResult.decisions.find((d) => d.proposalIds.includes(proposal.proposalId));
        const freshEval = freshRunResult.evaluations.find((e) => e.proposal.proposalId === proposal.proposalId);
        if (freshDec && freshEval) {
          finalDecisions.push(freshDec);
          finalEvaluations.push(freshEval);
          totalApproved = totalApproved.add(FixedDecimal.from(freshDec.approvedCapital));
        }
      }
    }

    const totalAvail = FixedDecimal.from(context.portfolioSnapshot.availableCapital);
    const remaining = FixedDecimal.max(FixedDecimal.zero(), totalAvail.sub(totalApproved));

    return {
      decisions: finalDecisions,
      evaluations: finalEvaluations,
      totalRequestedCapital: totalRequested.toString(),
      totalApprovedCapital: totalApproved.toString(),
      remainingAvailableCapital: remaining.toString(),
      deduplicatedProposalIds: [],
    };
  }
}

export function canonicalFingerprint(proposal: TradeProposal): string {
  const canonical = stableSerialize(proposal);
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) { hash ^= canonical.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}
