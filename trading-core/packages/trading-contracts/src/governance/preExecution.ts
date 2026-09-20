import type { MarketState } from '../market/types.js';
import type { StrategyRevision } from '../strategy/types.js';
import type { PortfolioDecision, RiskDecision, TradeProposal, TradingIntent } from './types.js';

export type PreExecutionAuthorizationDecision = 'AUTHORIZED' | 'REJECTED' | 'STALE' | 'CONFLICT';

export type PreExecutionReasonCode =
  | 'RISK_HALT_ACTIVE'
  | 'AGENT_UNAUTHORIZED_INTENT_CREATION'
  | 'PORTFOLIO_BYPASS'
  | 'RISK_DECISION_REQUIRED'
  | 'RISK_DECISION_REJECTED'
  | 'STRATEGY_REVISION_MISMATCH'
  | 'LIFECYCLE_VERSION_MISMATCH'
  | 'HEALTH_VERSION_MISMATCH'
  | 'OPERATIONAL_SNAPSHOT_MISMATCH'
  | 'OPERATIONAL_SNAPSHOT_EXPIRED'
  | 'OPERATIONAL_SNAPSHOT_INCOMPATIBLE'
  | 'STRATEGY_HEALTH_SUSPENDED'
  | 'STRATEGY_HEALTH_RETIRED'
  | 'STRATEGY_HEALTH_REVALIDATION_REQUIRED'
  | 'STRATEGY_HEALTH_UNKNOWN'
  | 'STRATEGY_RETIRED'
  | 'PORTFOLIO_DECISION_MISMATCH'
  | 'PORTFOLIO_DECISION_EXPIRED'
  | 'RISK_DECISION_EXPIRED'
  | 'RISK_DECISION_STALE'
  | 'MARKET_STATE_EXPIRED'
  | 'CAPITAL_MONOTONICITY_VIOLATION'
  | 'LEVERAGE_MONOTONICITY_VIOLATION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'AUTHORIZATION_ALREADY_CONSUMED'
  | 'INVALID_INPUT';

export interface PreExecutionOperationalSnapshotRef {
  snapshotId: string;
  strategyId: string;
  strategyRevisionId: string;
  lifecycleState: string;
  lifecycleVersion: number;
  healthState: string;
  healthVersion: number;
  compatibility: 'FULL' | 'RISK_REDUCING_ONLY' | 'CONDITIONAL' | 'REJECTED';
  effectiveAt: string;
  expiresAt: string;
  snapshotVersion: string;
}

export interface PreExecutionAuthorizationCommand {
  commandId: string;
  proposal: TradeProposal;
  portfolioDecision: PortfolioDecision;
  riskDecision: RiskDecision;
  operationalSnapshot: PreExecutionOperationalSnapshotRef;
  strategyRevision?: StrategyRevision;
  marketState?: MarketState;
  evaluationTime: string;
  idempotencyKey: string;
  correlationId?: string;
  actorType?: 'system' | 'risk_authority' | 'portfolio' | 'agent' | 'operator';
  actorId?: string;
  caller?: string;
}

export interface PreExecutionAuthorizationResult {
  authorizationId: string;
  strategyId: string;
  strategyRevisionId: string;
  decision: PreExecutionAuthorizationDecision;
  reasonCodes: readonly PreExecutionReasonCode[];
  intent?: TradingIntent;
  effectiveCapital: string;
  effectiveLeverage: string;
  decidedAt: string;
  eventRef?: string;
  rationale: string;
}

export interface PreExecutionAuthorizationRecord {
  authorizationId: string;
  strategyId: string;
  strategyRevisionId: string;
  proposalId: string;
  portfolioDecisionId: string;
  riskDecisionId: string;
  snapshotId: string;
  decision: PreExecutionAuthorizationDecision;
  reasonCodes: readonly PreExecutionReasonCode[];
  intentId?: string;
  effectiveCapital: string;
  effectiveLeverage: string;
  idempotencyKey: string;
  commandHash: string;
  rationale: string;
  decidedAt: string;
  createdAt: string;
}
