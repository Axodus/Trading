import type {
  MarketState,
  Opportunity,
  PromotionEligibility,
  StrategyHealth,
  TradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  TradingContractValidationError,
  validateTradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import type {
  CandidateTradeProposal,
  StrategyContext,
} from './StrategyContext.js';

export interface ValidationOutcome {
  valid: boolean;
  issues: readonly string[];
}

export interface RevalidationOutcome {
  valid: boolean;
  status: 'PROPOSED' | 'EXPIRED' | 'INVALIDATED';
  reason?: string;
}

export function validateStrategyContext(context: StrategyContext): ValidationOutcome {
  const issues: string[] = [];

  if (!context.strategyRevision || !context.strategyRevision.strategy?.strategyId) {
    issues.push('valid StrategyRevision with strategyId is required');
  }
  if (!context.opportunity || !context.opportunity.opportunityId) {
    issues.push('valid Opportunity is required');
  }
  if (!context.marketState || !context.marketState.marketStateId) {
    issues.push('valid MarketState is required');
  }
  if (!context.eligibility || !context.eligibility.eligibilityId) {
    issues.push('valid PromotionEligibility is required');
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  if (context.strategyRevision.strategy.strategyId !== context.opportunity.strategyId) {
    issues.push(`StrategyId mismatch: revision=${context.strategyRevision.strategy.strategyId}, opportunity=${context.opportunity.strategyId}`);
  }
  if (context.strategyRevision.revisionId !== context.opportunity.strategyRevisionId) {
    issues.push(`StrategyRevisionId mismatch: revision=${context.strategyRevision.revisionId}, opportunity=${context.opportunity.strategyRevisionId}`);
  }
  if (context.opportunity.marketStateId !== context.marketState.marketStateId) {
    issues.push(`MarketStateId mismatch: opportunity=${context.opportunity.marketStateId}, marketState=${context.marketState.marketStateId}`);
  }
  if (context.eligibility.strategyRevisionId !== context.strategyRevision.revisionId) {
    issues.push(`Eligibility strategyRevisionId mismatch: eligibility=${context.eligibility.strategyRevisionId}, revision=${context.strategyRevision.revisionId}`);
  }
  if (context.eligibility.decision !== 'ELIGIBLE') {
    issues.push(`PromotionEligibility must be ELIGIBLE, received ${context.eligibility.decision}`);
  }

  if (context.opportunity.status !== 'QUALIFIED' || context.opportunity.qualification !== 'qualified') {
    issues.push(`Opportunity must be QUALIFIED/qualified, received status=${context.opportunity.status}, qualification=${context.opportunity.qualification}`);
  }

  const nowMs = Date.parse(context.now);
  const oppExpiresMs = Date.parse(context.opportunity.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(oppExpiresMs) || nowMs >= oppExpiresMs) {
    issues.push(`Opportunity has expired at ${context.opportunity.expiresAt} for evaluation time ${context.now}`);
  }

  if (context.environment === 'live' && context.marketState.freshness !== 'current') {
    issues.push(`Live environment requires current MarketState freshness, received ${context.marketState.freshness}`);
  }

  if (context.strategyHealth && (context.strategyHealth.state === 'SUSPENDED' || context.strategyHealth.state === 'RETIRED')) {
    if (context.environment !== 'historical' && context.environment !== 'simulation') {
      issues.push(`StrategyHealth state ${context.strategyHealth.state} prohibits proposal generation in ${context.environment} environment`);
    }
  }

  const missingFeatures = checkMissingFeatures(context.marketState, context.strategyRevision.featureDefinitions);
  if (missingFeatures.length > 0) {
    issues.push(`Missing required features for strategy revision: ${missingFeatures.join(', ')}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateCandidateProposal(candidate: CandidateTradeProposal): ValidationOutcome {
  const issues: string[] = [];

  if (!['buy', 'sell', 'reduce', 'close'].includes(candidate.action)) {
    issues.push(`Invalid action: ${candidate.action}`);
  }

  if (!candidate.sizing || typeof candidate.sizing !== 'object') {
    issues.push('sizing object is required');
  } else {
    if (typeof candidate.sizing.requestedQuantity !== 'string' || candidate.sizing.requestedQuantity.trim().length === 0 || !isPositiveNumber(candidate.sizing.requestedQuantity)) {
      issues.push('sizing.requestedQuantity must be a positive numeric string');
    }
    if (typeof candidate.sizing.requestedCapital !== 'string' || candidate.sizing.requestedCapital.trim().length === 0 || !isPositiveNumber(candidate.sizing.requestedCapital)) {
      issues.push('sizing.requestedCapital must be a positive numeric string');
    }
    if (candidate.sizing.leverage !== undefined && (!isPositiveNumber(candidate.sizing.leverage))) {
      issues.push('sizing.leverage must be a positive numeric string if provided');
    }
  }

  if (!Number.isFinite(candidate.expiresInMs) || candidate.expiresInMs <= 0) {
    issues.push('expiresInMs must be a positive finite number');
  }

  if (candidate.confidence !== undefined && (typeof candidate.confidence !== 'number' || candidate.confidence < 0 || candidate.confidence > 1)) {
    issues.push('confidence must be a number between 0 and 1 if provided');
  }

  if (!candidate.expectedReturn || typeof candidate.expectedReturn !== 'object') {
    issues.push('expectedReturn object is required');
  }
  if (!candidate.expectedRisk || typeof candidate.expectedRisk !== 'object') {
    issues.push('expectedRisk object is required');
  }
  if (!candidate.liquidityAssumptions || typeof candidate.liquidityAssumptions !== 'object') {
    issues.push('liquidityAssumptions object is required');
  }
  if (!candidate.duration || typeof candidate.duration !== 'object') {
    issues.push('duration object is required');
  }
  if (!candidate.costAssumptions || typeof candidate.costAssumptions !== 'object') {
    issues.push('costAssumptions object is required');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function buildTradeProposal(context: StrategyContext, candidate: CandidateTradeProposal): TradeProposal {
  const contextValidation = validateStrategyContext(context);
  if (!contextValidation.valid) {
    throw new Error(`Cannot build TradeProposal from invalid StrategyContext: ${contextValidation.issues.join('; ')}`);
  }

  const candidateValidation = validateCandidateProposal(candidate);
  if (!candidateValidation.valid) {
    throw new Error(`Cannot build TradeProposal from invalid candidate: ${candidateValidation.issues.join('; ')}`);
  }

  const nowMs = Date.parse(context.now);
  const expiresAt = new Date(nowMs + candidate.expiresInMs).toISOString();

  const identityPayload = {
    strategyRevisionId: context.strategyRevision.revisionId,
    opportunityId: context.opportunity.opportunityId,
    marketStateId: context.marketState.marketStateId,
    action: candidate.action,
    sizing: candidate.sizing,
    correlationId: context.correlationId,
  };

  const idempotencyPayload = {
    strategyRevisionId: context.strategyRevision.revisionId,
    opportunityId: context.opportunity.opportunityId,
    marketStateId: context.marketState.marketStateId,
    action: candidate.action,
    sizing: candidate.sizing,
  };

  const proposalHash = stableHash(identityPayload);
  const idempHash = stableHash(idempotencyPayload);

  const evidenceRefs = [
    ...new Set([
      ...context.opportunity.evidenceRefs,
      ...context.marketState.validationRefs,
      ...(context.strategyEvidence?.evidenceId ? [`evidence:${context.strategyEvidence.evidenceId}`] : []),
      ...(candidate.evidenceRefs ?? []),
    ]),
  ].sort();

  const proposal: TradeProposal = {
    proposalId: `prop-${proposalHash}`,
    strategyId: context.strategyRevision.strategy.strategyId,
    strategyRevisionId: context.strategyRevision.revisionId,
    strategyRevision: {
      strategy: context.strategyRevision.strategy,
      revision: context.strategyRevision.revision,
      revisionId: context.strategyRevision.revisionId,
    },
    opportunity: {
      opportunityId: context.opportunity.opportunityId,
      marketStateId: context.opportunity.marketStateId,
      instrument: context.opportunity.instrument,
      venue: context.opportunity.venue,
      timeframe: context.opportunity.timeframe,
    },
    marketState: {
      marketStateId: context.marketState.marketStateId,
      schemaVersion: context.marketState.schemaVersion,
      validityContext: context.marketState.validityContext,
    },
    action: candidate.action,
    sizing: candidate.sizing,
    expectedReturn: candidate.expectedReturn,
    expectedRisk: candidate.expectedRisk,
    liquidityAssumptions: candidate.liquidityAssumptions,
    duration: candidate.duration,
    costAssumptions: candidate.costAssumptions,
    confidence: candidate.confidence,
    eligibility: {
      eligibilityId: context.eligibility.eligibilityId,
      strategyRevisionId: context.eligibility.strategyRevisionId,
      decision: context.eligibility.decision,
      policyVersion: context.eligibility.policyVersion,
    },
    agentAttribution: candidate.agentAttribution ?? context.agentAttribution,
    correlationId: context.correlationId,
    idempotencyKey: `proposal:${idempHash}`,
    createdAt: context.now,
    expiresAt,
    evidenceRefs,
  };

  validateTradeProposal(proposal);
  return proposal;
}

export function revalidateTradeProposal(
  proposal: TradeProposal,
  context: {
    now: string;
    opportunity: Opportunity;
    marketState: MarketState;
    strategyHealth?: StrategyHealth;
    eligibility: PromotionEligibility;
  }
): RevalidationOutcome {
  if (proposal.opportunity.opportunityId !== context.opportunity.opportunityId) {
    return { valid: false, status: 'INVALIDATED', reason: 'Opportunity reference mismatch' };
  }
  if (proposal.marketState.marketStateId !== context.marketState.marketStateId) {
    return { valid: false, status: 'INVALIDATED', reason: 'MarketState reference mismatch' };
  }
  if (context.opportunity.marketStateId !== context.marketState.marketStateId) {
    return { valid: false, status: 'INVALIDATED', reason: 'Opportunity marketStateId mismatch' };
  }
  if (context.eligibility.decision !== 'ELIGIBLE' || context.eligibility.strategyRevisionId !== proposal.strategyRevisionId) {
    return { valid: false, status: 'INVALIDATED', reason: 'StrategyRevision is no longer ELIGIBLE' };
  }
  if (context.strategyHealth && (context.strategyHealth.state === 'SUSPENDED' || context.strategyHealth.state === 'RETIRED')) {
    if (proposal.marketState.validityContext !== 'historical' && proposal.marketState.validityContext !== 'simulation') {
      return { valid: false, status: 'INVALIDATED', reason: `StrategyHealth state is ${context.strategyHealth.state}` };
    }
  }

  const nowMs = Date.parse(context.now);
  const propExpiresMs = Date.parse(proposal.expiresAt);
  const oppExpiresMs = Date.parse(context.opportunity.expiresAt);

  if (!Number.isFinite(nowMs) || !Number.isFinite(propExpiresMs) || nowMs >= propExpiresMs) {
    return { valid: false, status: 'EXPIRED', reason: 'TradeProposal validity window expired' };
  }
  if (!Number.isFinite(oppExpiresMs) || nowMs >= oppExpiresMs) {
    return { valid: false, status: 'EXPIRED', reason: 'Supporting Opportunity expired' };
  }
  if (proposal.marketState.validityContext === 'live' && context.marketState.freshness !== 'current') {
    return { valid: false, status: 'INVALIDATED', reason: 'Live MarketState is no longer current' };
  }

  return { valid: true, status: 'PROPOSED' };
}

function isPositiveNumber(value: string): boolean {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function checkMissingFeatures(
  state: MarketState,
  requirements: readonly { featureId: string; featureVersion: string }[]
): string[] {
  const available = new Set(state.features.map((f) => `${f.featureId}@${f.featureVersion}`));
  return requirements
    .map((r) => `${r.featureId}@${r.featureVersion}`)
    .filter((reqKey) => !available.has(reqKey));
}

function stableHash(value: unknown): string {
  const canonical = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((k) => `${JSON.stringify(k)}:${stableSerialize(record[k])}`).join(',')}}`;
}
