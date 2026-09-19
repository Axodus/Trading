import type {
  MarketState,
  MarketStateValidityContext,
  PortfolioDecision,
  PromotionEligibility,
  RiskDecision,
  RiskDecisionOutcome,
  StrategyHealth,
  StrategyRevision,
  TradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import type {
  CanonicalPortfolioSnapshot,
} from '../portfolio/PortfolioTypes.js';

export type HaltScope = 'PROPOSAL' | 'STRATEGY' | 'INSTRUMENT' | 'PORTFOLIO' | 'SYSTEM';

export type RiskReasonCode =
  | 'CAPITAL_LIMIT_EXCEEDED'
  | 'GROSS_EXPOSURE_LIMIT_EXCEEDED'
  | 'NET_EXPOSURE_LIMIT_EXCEEDED'
  | 'INSTRUMENT_CONCENTRATION_EXCEEDED'
  | 'STRATEGY_CONCENTRATION_EXCEEDED'
  | 'LEVERAGE_LIMIT_EXCEEDED'
  | 'STRATEGY_HEALTH_SUSPENDED'
  | 'STRATEGY_HEALTH_RETIRED'
  | 'STRATEGY_HEALTH_UNKNOWN'
  | 'STRATEGY_HEALTH_REVALIDATION_REQUIRED'
  | 'STRATEGY_HEALTH_DEGRADED'
  | 'PROMOTION_INELIGIBLE'
  | 'STALE_MARKET_STATE'
  | 'STALE_PORTFOLIO_DECISION'
  | 'INVALID_INPUT'
  | 'POLICY_UNAVAILABLE'
  | 'EXPOSURE_STATE_INVALID'
  | 'GLOBAL_DRAWDOWN_LIMIT_BREACHED'
  | 'OPPOSING_POSITION_FAIL_CLOSED'
  | 'KILL_SWITCH_ACTIVE'
  | 'PORTFOLIO_STATE_INCONSISTENT'
  | 'MONOTONICITY_VIOLATION';

export interface RiskPolicyLimits {
  policyVersion: string;
  policyRevision: number;
  maxCapitalPerTrade: string; // FixedDecimal string
  maxGrossExposureTotal: string; // FixedDecimal string
  maxNetExposureTotal?: string; // FixedDecimal string
  maxInstrumentGrossExposure: Record<string, string>; // FixedDecimal strings
  defaultMaxInstrumentGrossExposure: string;
  maxStrategyGrossExposure: Record<string, string>; // FixedDecimal strings
  defaultMaxStrategyGrossExposure: string;
  maxLeverageCeiling: string; // FixedDecimal string, e.g. "5.0"
  maxDrawdownLimitPct?: string; // e.g. "0.10" (10%)
  maxMarketStateAgeMs: number; // max age for market state in live context
  maxPortfolioDecisionAgeMs: number; // max age for portfolio decision
  allowOpposingPositions?: boolean;
  allowModifyOnCapitalBreach?: boolean; // if true, can MODIFY down; if false, REJECT
  allowModifyOnLeverageBreach?: boolean; // if true, can MODIFY down; if false, REJECT
  degradedStrategyAction?: 'MODIFY' | 'REJECT' | 'ALLOW';
  degradedCapitalMultiplier?: string; // e.g. "0.5" for 50% capital reduction on degraded
  degradedLeverageCap?: string; // e.g. "2.0"
  systemHaltActive?: boolean;
  systemHaltReference?: string;
}

export interface RiskEvaluationContext {
  portfolioDecision: PortfolioDecision;
  proposal: TradeProposal;
  strategyRevision: StrategyRevision;
  policy: RiskPolicyLimits;
  exposureSnapshot: CanonicalPortfolioSnapshot;
  strategyHealth?: StrategyHealth;
  marketState?: MarketState;
  eligibility?: PromotionEligibility;
  evaluationTime: string; // Injected deterministic ISO timestamp
  correlationId: string;
  environment: MarketStateValidityContext;
}

export interface RiskRuleViolation {
  code: RiskReasonCode;
  message: string;
  severity: 'REJECT' | 'HALT';
  haltScope?: HaltScope;
}

export interface RiskRuleModification {
  code: RiskReasonCode;
  message: string;
  effectiveCapital?: string;
  effectiveLeverage?: string;
  effectiveQuantity?: string;
}

export interface RiskEvaluationResult {
  outcome: RiskDecisionOutcome;
  effectiveCapital: string;
  effectiveLeverage: string;
  reasons: readonly RiskReasonCode[];
  violations: readonly RiskRuleViolation[];
  modifications: readonly RiskRuleModification[];
  haltScope?: HaltScope;
  rationale: string;
  decision: RiskDecision;
}
