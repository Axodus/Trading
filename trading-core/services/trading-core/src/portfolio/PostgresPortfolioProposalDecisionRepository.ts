import type { PortfolioDecision, TradeProposal } from '../../../../packages/trading-contracts/src/index.js';
import type { PostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import {
  PortfolioProposalDecisionConflictError,
  PortfolioProposalDecisionRepositoryUnavailableError,
  type PortfolioProposalDecisionClaim,
  type PortfolioProposalDecisionRecord,
  type PortfolioProposalDecisionRepository,
} from './PortfolioProposalDecisionRepository.js';
import type { ProposalAllocationEvaluation } from './PortfolioTypes.js';

type Row = {
  proposal_id: string;
  proposal_fingerprint: string;
  state: 'CLAIMED' | 'TERMINAL';
  decision_payload: string | PortfolioDecision | null;
  evaluation_payload: string | ProposalAllocationEvaluation | null;
  correlation_id: string;
  evidence_refs: string | string[];
  claimed_at: string;
  lease_until: string;
  terminal_at: string | null;
};

export class PostgresPortfolioProposalDecisionRepository implements PortfolioProposalDecisionRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async claim(input: {
    proposal: TradeProposal;
    proposalFingerprint: string;
    correlationId: string;
    evidenceRefs: readonly string[];
    claimedAt: string;
    leaseUntil: string;
  }): Promise<PortfolioProposalDecisionClaim> {
    try {
      const inserted = await this.client.query<Row>(
        `INSERT INTO trading_portfolio_proposal_decisions
          (proposal_id, proposal_fingerprint, state, correlation_id, evidence_refs, claimed_at, lease_until)
         VALUES ($1, $2, 'CLAIMED', $3, $4::jsonb, $5, $6)
         ON CONFLICT (proposal_id) DO NOTHING
         RETURNING *`,
        [input.proposal.proposalId, input.proposalFingerprint, input.correlationId, stableJson(input.evidenceRefs), input.claimedAt, input.leaseUntil],
      );
      if (inserted.rows[0]) return { status: 'CLAIMED', record: this.fromRow(inserted.rows[0]) };

      const existing = await this.client.query<Row>(
        'SELECT * FROM trading_portfolio_proposal_decisions WHERE proposal_id = $1',
        [input.proposal.proposalId],
      );
      const row = existing.rows[0];
      if (!row) throw new PortfolioProposalDecisionRepositoryUnavailableError('Portfolio proposal claim disappeared after conflict.');
      if (row.proposal_fingerprint !== input.proposalFingerprint) {
        throw new PortfolioProposalDecisionConflictError(`Proposal ${input.proposal.proposalId} was submitted with a different canonical identity.`);
      }
      return { status: row.state === 'TERMINAL' ? 'TERMINAL' : 'IN_PROGRESS', record: this.fromRow(row) };
    } catch (error) {
      if (error instanceof PortfolioProposalDecisionConflictError || error instanceof PortfolioProposalDecisionRepositoryUnavailableError) throw error;
      throw new PortfolioProposalDecisionRepositoryUnavailableError(`Portfolio proposal claim failed: ${String(error)}`);
    }
  }

  async complete(input: {
    proposalId: string;
    proposalFingerprint: string;
    decision: PortfolioDecision;
    evaluation: ProposalAllocationEvaluation;
    terminalAt: string;
  }): Promise<PortfolioProposalDecisionRecord> {
    try {
      const result = await this.client.query<Row>(
        `UPDATE trading_portfolio_proposal_decisions
            SET state = 'TERMINAL', decision_payload = $1::jsonb, evaluation_payload = $2::jsonb, terminal_at = $3
          WHERE proposal_id = $4 AND proposal_fingerprint = $5 AND state = 'CLAIMED'
          RETURNING *`,
        [stableJson(input.decision), stableJson(input.evaluation), input.terminalAt, input.proposalId, input.proposalFingerprint],
      );
      if (!result.rows[0]) throw new PortfolioProposalDecisionRepositoryUnavailableError(`Cannot complete proposal ${input.proposalId}; claim is missing or conflicting.`);
      return this.fromRow(result.rows[0]);
    } catch (error) {
      if (error instanceof PortfolioProposalDecisionRepositoryUnavailableError) throw error;
      throw new PortfolioProposalDecisionRepositoryUnavailableError(`Portfolio proposal completion failed: ${String(error)}`);
    }
  }

  async recoverExpiredClaim(proposalId: string, now: string, leaseUntil: string): Promise<boolean> {
    try {
      const result = await this.client.query(
        `UPDATE trading_portfolio_proposal_decisions
            SET claimed_at = $1, lease_until = $2
          WHERE proposal_id = $3 AND state = 'CLAIMED' AND lease_until <= $1`,
        [now, leaseUntil, proposalId],
      );
      return (result.rowCount ?? result.rows.length) > 0;
    } catch (error) {
      throw new PortfolioProposalDecisionRepositoryUnavailableError(`Portfolio proposal recovery failed: ${String(error)}`);
    }
  }

  private fromRow(row: Row): PortfolioProposalDecisionRecord {
    const parse = <T>(value: string | T | null): T | undefined => value == null ? undefined : typeof value === 'string' ? JSON.parse(value) as T : value;
    return {
      proposalId: row.proposal_id,
      proposalFingerprint: row.proposal_fingerprint,
      state: row.state,
      decision: parse<PortfolioDecision>(row.decision_payload),
      evaluation: parse<ProposalAllocationEvaluation>(row.evaluation_payload),
      correlationId: row.correlation_id,
      evidenceRefs: typeof row.evidence_refs === 'string' ? JSON.parse(row.evidence_refs) as string[] : row.evidence_refs,
      claimedAt: row.claimed_at,
      leaseUntil: row.lease_until,
      terminalAt: row.terminal_at ?? undefined,
    };
  }
}
