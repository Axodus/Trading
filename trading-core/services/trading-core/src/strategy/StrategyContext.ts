import type {
  AgentAttributionRef,
  MarketState,
  MarketStateValidityContext,
  Opportunity,
  PromotionEligibility,
  ProposalSizing,
  StrategyEvidence,
  StrategyHealth,
  StrategyRevision,
  TradingAction,
} from '../../../../packages/trading-contracts/src/index.js';

export interface StrategyContext {
  strategyRevision: StrategyRevision;
  opportunity: Opportunity;
  marketState: MarketState;
  eligibility: PromotionEligibility;
  strategyEvidence?: StrategyEvidence;
  strategyHealth?: StrategyHealth;
  environment: MarketStateValidityContext;
  now: string;
  correlationId: string;
  agentAttribution?: AgentAttributionRef;
}

export interface CandidateTradeProposal {
  action: TradingAction;
  sizing: ProposalSizing;
  expectedReturn: Readonly<Record<string, unknown>>;
  expectedRisk: Readonly<Record<string, unknown>>;
  liquidityAssumptions: Readonly<Record<string, unknown>>;
  duration: Readonly<Record<string, unknown>>;
  costAssumptions: Readonly<Record<string, unknown>>;
  confidence?: number;
  expiresInMs: number;
  evidenceRefs?: readonly string[];
  rationale?: string;
  agentAttribution?: AgentAttributionRef;
}

export type StrategySpecialistStatus = 'PROPOSED' | 'NO_PROPOSAL' | 'REJECTED';

export interface StrategySpecialistResult {
  status: StrategySpecialistStatus;
  candidate?: CandidateTradeProposal;
  reason?: string;
}

export interface StrategyProposalRejection {
  strategyId: string;
  strategyRevisionId: string;
  opportunityId: string;
  marketStateId: string;
  reason: string;
  issues?: readonly string[];
}
