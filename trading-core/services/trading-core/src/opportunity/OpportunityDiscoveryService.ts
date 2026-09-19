import type {
  MarketState,
  Opportunity,
  OpportunityApplicability,
  OpportunityDetectorRef,
  OpportunityQualification,
} from '../../../../packages/trading-contracts/src/index.js';
import type { StrategyFamily } from '../../../../packages/trading-contracts/src/index.js';

export interface OpportunityStrategyContext {
  strategyId: string;
  strategyRevisionId: string;
  family: StrategyFamily;
  timeframe: string;
  requiredFeatures?: readonly FeatureRequirement[];
  promotionEligibility?: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'REVALIDATION_REQUIRED' | 'DISQUALIFIED';
}

export interface FeatureRequirement {
  featureId: string;
  featureVersion: string;
}

export interface OpportunityDetectorContext {
  strategy: OpportunityStrategyContext;
  marketState: MarketState;
  now: string;
}

export interface DetectorResult {
  applicability: OpportunityApplicability;
  qualification: OpportunityQualification;
  opportunityType: string;
  expectedCharacteristics: Readonly<Record<string, unknown>>;
  evidenceRefs: readonly string[];
  expiresInMs: number;
  reason: string;
}

export interface OpportunityDetector extends OpportunityDetectorRef {
  requiredFeatures?: readonly FeatureRequirement[];
  detect(context: OpportunityDetectorContext): DetectorResult;
}

export interface DiscoveryRunContext {
  discoveryRunId: string;
  correlationId: string;
  now: string;
}

export interface OpportunityDiscoveryInput extends DiscoveryRunContext {
  marketState: MarketState;
  strategies: readonly OpportunityStrategyContext[];
  detectors: readonly OpportunityDetector[];
}

export interface OpportunityDiscoveryResult {
  opportunities: readonly Opportunity[];
  rejected: readonly OpportunityRejection[];
  duplicateOpportunityIds: readonly string[];
}

export interface OpportunityRejection {
  strategyId: string;
  strategyRevisionId: string;
  detector: OpportunityDetectorRef;
  reason: string;
  marketStateId: string;
}

export class OpportunityDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpportunityDiscoveryError';
  }
}

export class OpportunityDiscoveryService {
  discover(input: OpportunityDiscoveryInput): OpportunityDiscoveryResult {
    if (!input.marketState || input.marketState.marketStateId.trim().length === 0) {
      throw new OpportunityDiscoveryError('valid MarketState is required');
    }
    if (input.marketState.validityContext === 'live' && input.marketState.freshness !== 'current') {
      return { opportunities: [], rejected: [], duplicateOpportunityIds: [] };
    }

    const opportunities = new Map<string, Opportunity>();
    const rejected: OpportunityRejection[] = [];
    const duplicateOpportunityIds: string[] = [];
    for (const strategy of input.strategies) {
      for (const detector of input.detectors) {
        const missingFeatures = missingFeatureRequirements(input.marketState, [...(strategy.requiredFeatures ?? []), ...(detector.requiredFeatures ?? [])]);
        if (missingFeatures.length > 0) {
          rejected.push({ strategyId: strategy.strategyId, strategyRevisionId: strategy.strategyRevisionId, detector, reason: `missing required features: ${missingFeatures.join(', ')}`, marketStateId: input.marketState.marketStateId });
          continue;
        }
        const result = detector.detect({ strategy, marketState: input.marketState, now: input.now });
        if (result.applicability !== 'APPLICABLE' || result.qualification !== 'qualified') {
          rejected.push({ strategyId: strategy.strategyId, strategyRevisionId: strategy.strategyRevisionId, detector, reason: result.reason, marketStateId: input.marketState.marketStateId });
          continue;
        }
        if (result.expiresInMs <= 0 || !Number.isFinite(result.expiresInMs)) {
          rejected.push({ strategyId: strategy.strategyId, strategyRevisionId: strategy.strategyRevisionId, detector, reason: 'detector returned invalid expiry', marketStateId: input.marketState.marketStateId });
          continue;
        }
        const opportunity = createOpportunity(input, strategy, detector, result);
        if (opportunities.has(opportunity.opportunityId)) {
          duplicateOpportunityIds.push(opportunity.opportunityId);
          continue;
        }
        opportunities.set(opportunity.opportunityId, opportunity);
      }
    }
    return {
      opportunities: [...opportunities.values()].sort((left, right) => left.opportunityId.localeCompare(right.opportunityId)),
      rejected,
      duplicateOpportunityIds: [...new Set(duplicateOpportunityIds)].sort(),
    };
  }
}

export function revalidateOpportunity(opportunity: Opportunity, marketState: MarketState, now: string): Opportunity {
  if (opportunity.marketStateId !== marketState.marketStateId) {
    return { ...opportunity, status: 'INVALIDATED', qualification: 'invalid', qualificationReason: 'supporting MarketState changed' };
  }
  if (!Number.isFinite(Date.parse(now)) || Date.parse(now) >= Date.parse(opportunity.expiresAt)) {
    return { ...opportunity, status: 'EXPIRED', qualification: 'expired', qualificationReason: 'opportunity validity window expired' };
  }
  if (marketState.validityContext === 'live' && marketState.freshness !== 'current') {
    return { ...opportunity, status: 'INVALIDATED', qualification: 'invalid', qualificationReason: 'live MarketState is no longer fresh' };
  }
  return { ...opportunity, status: 'QUALIFIED', qualification: 'qualified' };
}

function createOpportunity(input: OpportunityDiscoveryInput, strategy: OpportunityStrategyContext, detector: OpportunityDetector, result: DetectorResult): Opportunity {
  const expiresAt = new Date(Date.parse(input.now) + result.expiresInMs).toISOString();
  const detectorRef: OpportunityDetectorRef = { detectorId: detector.detectorId, detectorVersion: detector.detectorVersion, methodologyRef: detector.methodologyRef };
  const identity = stableHash({ marketStateId: input.marketState.marketStateId, strategyId: strategy.strategyId, strategyRevisionId: strategy.strategyRevisionId, timeframe: strategy.timeframe, detector: detectorRef, opportunityType: result.opportunityType });
  return {
    opportunityId: `opp-${identity}`,
    instrument: input.marketState.instrument,
    venue: input.marketState.venue,
    strategyId: strategy.strategyId,
    strategyRevisionId: strategy.strategyRevisionId,
    timeframe: strategy.timeframe,
    marketStateId: input.marketState.marketStateId,
    qualification: 'qualified',
    expectedCharacteristics: result.expectedCharacteristics,
    evidenceRefs: [...new Set([...result.evidenceRefs, `market-state:${input.marketState.marketStateId}`, ...input.marketState.validationRefs])].sort(),
    createdAt: input.now,
    expiresAt,
    opportunityType: result.opportunityType,
    applicability: result.applicability,
    status: 'QUALIFIED',
    detector: detectorRef,
    validityContext: input.marketState.validityContext,
    discoveryRunId: input.discoveryRunId,
    correlationId: input.correlationId,
    qualificationReason: result.reason,
    idempotencyKey: `opportunity:${identity}`,
  };
}

function missingFeatureRequirements(state: MarketState, requirements: readonly FeatureRequirement[]): string[] {
  const available = new Set(state.features.map((feature) => `${feature.featureId}@${feature.featureVersion}`));
  return [...new Set(requirements.map((requirement) => `${requirement.featureId}@${requirement.featureVersion}`).filter((key) => !available.has(key)))].sort();
}

function stableHash(value: unknown): string {
  const canonical = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}
