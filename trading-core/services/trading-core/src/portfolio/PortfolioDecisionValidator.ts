import type {
  PortfolioDecision,
  PromotionEligibility,
  StrategyHealth,
  TradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  TradingContractValidationError,
  validateTradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import type {
  CanonicalPortfolioSnapshot,
  CapitalPolicyLimits,
  PortfolioContext,
} from './PortfolioTypes.js';

export interface ContextValidationResult {
  valid: boolean;
  issues: readonly string[];
}

export interface DecisionRevalidationResult {
  valid: boolean;
  status: 'ALLOCATED' | 'EXPIRED' | 'INVALIDATED';
  reason?: string;
}

export function validatePortfolioContext(context: PortfolioContext): ContextValidationResult {
  const issues: string[] = [];

  if (!context.portfolioSnapshot || typeof context.portfolioSnapshot !== 'object') {
    issues.push('valid portfolioSnapshot is required');
  } else {
    const snap = context.portfolioSnapshot;
    if (!snap.snapshotId || snap.snapshotId.trim().length === 0) issues.push('snapshotId is required');
    if (!isNonNegativeNumber(snap.totalCapital)) issues.push('totalCapital must be non-negative number');
    if (!isNonNegativeNumber(snap.availableCapital)) issues.push('availableCapital must be non-negative number');
    if (!isNonNegativeNumber(snap.reservedCapital)) issues.push('reservedCapital must be non-negative number');
    const total = Number(snap.totalCapital);
    const avail = Number(snap.availableCapital);
    const reserved = Number(snap.reservedCapital);
    if (avail + reserved > total + 0.0001) {
      issues.push(`availableCapital (${avail}) + reservedCapital (${reserved}) exceeds totalCapital (${total})`);
    }
  }

  if (!Array.isArray(context.proposals)) {
    issues.push('proposals array is required');
  }

  if (!context.policy || typeof context.policy !== 'object') {
    issues.push('valid CapitalPolicyLimits policy is required');
  } else {
    if (!context.policy.policyVersion) issues.push('policy.policyVersion is required');
  }

  if (!context.now || !Number.isFinite(Date.parse(context.now))) {
    issues.push('valid now ISO timestamp is required');
  }
  if (!context.correlationId || context.correlationId.trim().length === 0) {
    issues.push('correlationId is required');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateProposalForPortfolioAdmission(
  proposal: TradeProposal,
  context: PortfolioContext
): { admissible: boolean; reason?: string } {
  try {
    validateTradeProposal(proposal);
  } catch (error) {
    return { admissible: false, reason: `TradeProposal validation failed: ${error instanceof Error ? error.message : String(error)}` };
  }

  const nowMs = Date.parse(context.now);
  const expMs = Date.parse(proposal.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expMs) || nowMs >= expMs) {
    return { admissible: false, reason: `TradeProposal expired at ${proposal.expiresAt} for current time ${context.now}` };
  }

  if (proposal.marketState.validityContext !== context.environment) {
    return { admissible: false, reason: `Proposal validityContext ${proposal.marketState.validityContext} does not match portfolio environment ${context.environment}` };
  }

  if (context.strategyHealth) {
    const health = context.strategyHealth.find((h) => h.strategyId === proposal.strategyId && h.strategyRevisionId === proposal.strategyRevisionId);
    if (health && (health.state === 'SUSPENDED' || health.state === 'RETIRED')) {
      if (context.environment !== 'historical' && context.environment !== 'simulation') {
        return { admissible: false, reason: `StrategyHealth state ${health.state} prohibits portfolio allocation in ${context.environment}` };
      }
    }
  }

  if (context.eligibilities) {
    const elig = context.eligibilities.find((e) => e.strategyRevisionId === proposal.strategyRevisionId);
    if (elig && elig.decision !== 'ELIGIBLE') {
      return { admissible: false, reason: `PromotionEligibility decision is ${elig.decision}, required ELIGIBLE` };
    }
  }

  return { admissible: true };
}

export function revalidatePortfolioDecision(
  decision: PortfolioDecision,
  context: {
    now: string;
    currentSnapshot: CanonicalPortfolioSnapshot;
    proposals: readonly TradeProposal[];
    strategyHealth?: readonly StrategyHealth[];
    eligibilities?: readonly PromotionEligibility[];
  }
): DecisionRevalidationResult {
  const nowMs = Date.parse(context.now);
  const expMs = Date.parse(decision.expiresAt);

  if (!Number.isFinite(nowMs) || !Number.isFinite(expMs) || nowMs >= expMs) {
    return { valid: false, status: 'EXPIRED', reason: 'PortfolioDecision validity window expired' };
  }

  for (const proposalId of decision.proposalIds) {
    const prop = context.proposals.find((p) => p.proposalId === proposalId);
    if (!prop) {
      return { valid: false, status: 'INVALIDATED', reason: `Supporting TradeProposal ${proposalId} not found` };
    }
    const propExp = Date.parse(prop.expiresAt);
    if (Number.isFinite(propExp) && nowMs >= propExp) {
      return { valid: false, status: 'EXPIRED', reason: `Supporting TradeProposal ${proposalId} expired` };
    }
    if (context.strategyHealth) {
      const h = context.strategyHealth.find((sh) => sh.strategyId === prop.strategyId && sh.strategyRevisionId === prop.strategyRevisionId);
      if (h && (h.state === 'SUSPENDED' || h.state === 'RETIRED')) {
        return { valid: false, status: 'INVALIDATED', reason: `Strategy ${prop.strategyId} entered ${h.state} state` };
      }
    }
    if (context.eligibilities) {
      const el = context.eligibilities.find((e) => e.strategyRevisionId === prop.strategyRevisionId);
      if (el && el.decision !== 'ELIGIBLE') {
        return { valid: false, status: 'INVALIDATED', reason: `Strategy ${prop.strategyId} eligibility changed to ${el.decision}` };
      }
    }
  }

  const approved = Number(decision.approvedCapital);
  const available = Number(context.currentSnapshot.availableCapital);
  if (approved > available + 0.0001 && decision.outcome === 'APPROVED') {
    return { valid: false, status: 'INVALIDATED', reason: `Portfolio capital no longer sufficient: approved=${approved}, available=${available}` };
  }

  return { valid: true, status: 'ALLOCATED' };
}

function isNonNegativeNumber(value: string | number | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0;
}
