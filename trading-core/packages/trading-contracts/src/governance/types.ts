import type { MarketState, Opportunity } from '../market/types.js';
import type { PromotionEligibility } from '../research/types.js';
import type { AgentAttributionRef, StrategyRevision } from '../strategy/types.js';

export type PortfolioDecisionOutcome = 'APPROVED' | 'MODIFIED' | 'REJECTED';
export type RiskDecisionOutcome = 'ALLOW' | 'MODIFY' | 'REJECT' | 'HALT';
export type TradingAction = 'buy' | 'sell' | 'reduce' | 'close';

export interface ProposalSizing {
  requestedQuantity: string;
  requestedCapital: string;
  maxQuantity?: string;
  maxCapital?: string;
  leverage?: string;
}

export interface TradeProposal {
  proposalId: string;
  strategyId: string;
  strategyRevisionId: string;
  strategyRevision: Pick<StrategyRevision, 'strategy' | 'revision' | 'revisionId'>;
  opportunity: Pick<Opportunity, 'opportunityId' | 'marketStateId' | 'instrument' | 'venue' | 'timeframe'>;
  marketState: Pick<MarketState, 'marketStateId' | 'schemaVersion' | 'validityContext'>;
  action: TradingAction;
  sizing: ProposalSizing;
  expectedReturn: Readonly<Record<string, unknown>>;
  expectedRisk: Readonly<Record<string, unknown>>;
  liquidityAssumptions: Readonly<Record<string, unknown>>;
  duration: Readonly<Record<string, unknown>>;
  costAssumptions: Readonly<Record<string, unknown>>;
  confidence?: number;
  eligibility: Pick<PromotionEligibility, 'eligibilityId' | 'strategyRevisionId' | 'decision' | 'policyVersion'>;
  agentAttribution?: AgentAttributionRef;
  correlationId: string;
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string;
  evidenceRefs: readonly string[];
}

export interface PortfolioDecision {
  portfolioDecisionId: string;
  proposalIds: readonly string[];
  outcome: PortfolioDecisionOutcome;
  requestedCapital: string;
  approvedCapital: string;
  currentExposure: Readonly<Record<string, unknown>>;
  correlatedExposure: Readonly<Record<string, unknown>>;
  concentration: Readonly<Record<string, unknown>>;
  leverage: Readonly<Record<string, unknown>>;
  liquidity: Readonly<Record<string, unknown>>;
  duration: Readonly<Record<string, unknown>>;
  drawdown: Readonly<Record<string, unknown>>;
  executionCost: Readonly<Record<string, unknown>>;
  modifications: Readonly<Record<string, unknown>>;
  rationale: string;
  evidenceRefs: readonly string[];
  createdAt: string;
  expiresAt: string;
}

export interface RiskDecision {
  riskDecisionId: string;
  proposalId: string;
  portfolioDecisionId: string;
  marketStateId: string;
  strategyRevisionId: string;
  outcome: RiskDecisionOutcome;
  policyVersion: string;
  hardLimitEvaluation: Readonly<Record<string, unknown>>;
  killSwitch: { active: boolean; reference?: string };
  modifications: Readonly<Record<string, unknown>>;
  rationale: string;
  evidenceRefs: readonly string[];
  decidedAt: string;
  expiresAt: string;
}

export interface TradingIntent {
  intentId: string;
  strategyId: string;
  strategyRevisionId: string;
  marketStateId: string;
  opportunityId: string;
  proposalId: string;
  portfolioDecisionId: string;
  riskDecisionId: string;
  eligibilityId: string;
  instrument: string;
  venue?: string;
  action: TradingAction;
  approvedQuantity: string;
  approvedCapital: string;
  approvedLeverage?: string;
  priceConstraints?: Readonly<Record<string, unknown>>;
  timeConstraints?: Readonly<Record<string, unknown>>;
  executionPolicyRef: string;
  correlationId: string;
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string;
  evidenceRefs: readonly string[];
}
