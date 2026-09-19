import type {
  MarketStateValidityContext,
  PromotionEligibility,
  StrategyEvidence,
  StrategyHealth,
  StrategyRevision,
  TradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';

export type PositionSide = 'LONG' | 'SHORT' | 'FLAT';

export interface PortfolioPosition {
  instrument: string;
  venue?: string;
  side: PositionSide;
  quantity: string;
  notional: string;
  unrealizedPnl?: string;
  entryPrice?: string;
  strategyId?: string;
  strategyRevisionId?: string;
}

export interface StrategyAllocationRecord {
  strategyId: string;
  allocatedCapital: string;
  committedCapital: string;
  activePositionCount: number;
}

export interface InstrumentExposureRecord {
  instrument: string;
  grossNotional: string;
  netNotional: string;
  longNotional: string;
  shortNotional: string;
}

export interface CanonicalPortfolioSnapshot {
  snapshotId: string;
  asOf: string;
  validityContext: MarketStateValidityContext;
  totalCapital: string;
  availableCapital: string;
  reservedCapital: string;
  positions: readonly PortfolioPosition[];
  strategyAllocations?: readonly StrategyAllocationRecord[];
  instrumentExposures?: readonly InstrumentExposureRecord[];
  drawdownContext?: {
    currentDrawdownPct: string;
    highWaterMark: string;
  };
  provenanceRef: string;
}

export interface CapitalPolicyLimits {
  policyVersion: string;
  maxTotalCapital: string;
  maxStrategyBudgetPct: Record<string, number>;
  defaultMaxStrategyBudgetPct: number;
  maxInstrumentConcentrationPct: Record<string, number>;
  defaultMaxInstrumentConcentrationPct: number;
  maxTotalGrossLeverage: number;
  reserveBufferPct?: number;
  allowOpposingPositions?: boolean;
}

export interface PortfolioContext {
  portfolioSnapshot: CanonicalPortfolioSnapshot;
  proposals: readonly TradeProposal[];
  strategyRevisions?: readonly StrategyRevision[];
  strategyHealth?: readonly StrategyHealth[];
  strategyEvidence?: readonly StrategyEvidence[];
  eligibilities?: readonly PromotionEligibility[];
  policy: CapitalPolicyLimits;
  environment: MarketStateValidityContext;
  now: string;
  correlationId: string;
  knownCorrelations?: Readonly<Record<string, Record<string, number>>>;
}

export interface ProposalAllocationEvaluation {
  proposal: TradeProposal;
  disposition: 'ALLOCATED' | 'REDUCED' | 'REJECTED';
  requestedCapital: string;
  approvedCapital: string;
  modifications: Readonly<Record<string, unknown>>;
  rationale: string;
  violations: readonly string[];
}

export interface PortfolioAllocationRunResult {
  decisions: readonly import('../../../../packages/trading-contracts/src/index.js').PortfolioDecision[];
  evaluations: readonly ProposalAllocationEvaluation[];
  totalRequestedCapital: string;
  totalApprovedCapital: string;
  remainingAvailableCapital: string;
  deduplicatedProposalIds: readonly string[];
}
