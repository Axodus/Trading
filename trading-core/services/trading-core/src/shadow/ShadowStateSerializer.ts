import type {
  ExperimentPolicyIdentity,
  MarketState,
  Opportunity,
  QuestionSetIdentity,
  ShadowDecisionSnapshot,
  ShadowEnvironment,
  ShadowJsonValue,
  TradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import { canonicalShadowJson, shadowDigest } from './CanonicalShadowJson.js';

export interface CreateShadowSnapshotInput {
  environment: ShadowEnvironment;
  capturedAt: string;
  marketState: MarketState;
  opportunity: Opportunity;
  tradeProposal: TradeProposal;
  experiment: ExperimentPolicyIdentity;
  questionSet: QuestionSetIdentity;
  requestedProvider: string;
  requestedModel: string;
}

export function createShadowDecisionSnapshot(input: CreateShadowSnapshotInput): ShadowDecisionSnapshot {
  if (input.marketState.marketStateId !== input.opportunity.marketStateId ||
      input.marketState.marketStateId !== input.tradeProposal.marketState.marketStateId) {
    throw new Error('SHADOW_MARKET_STATE_MISMATCH');
  }
  if (input.opportunity.opportunityId !== input.tradeProposal.opportunity.opportunityId) {
    throw new Error('SHADOW_OPPORTUNITY_MISMATCH');
  }
  if (input.opportunity.strategyRevisionId !== input.tradeProposal.strategyRevisionId) {
    throw new Error('SHADOW_STRATEGY_REVISION_MISMATCH');
  }

  const providerState = buildAllowlistedProviderState(input.marketState, input.opportunity, input.tradeProposal);
  const identity = toJson({
    environment: input.environment,
    capturedAt: input.capturedAt,
    marketStateId: input.marketState.marketStateId,
    opportunityId: input.opportunity.opportunityId,
    proposalId: input.tradeProposal.proposalId,
    strategyRevisionId: input.tradeProposal.strategyRevisionId,
    experiment: input.experiment,
    questionSet: input.questionSet,
    requestedProvider: input.requestedProvider,
    requestedModel: input.requestedModel,
    providerState,
  });
  const inputDigest = shadowDigest(identity);

  return Object.freeze({
    snapshotId: `shadow-snapshot:${inputDigest.slice('fnv1a64:'.length)}`,
    correlationId: input.tradeProposal.correlationId,
    capturedAt: input.capturedAt,
    environment: input.environment,
    strategyId: input.tradeProposal.strategyId,
    strategyRevisionId: input.tradeProposal.strategyRevisionId,
    instrument: input.opportunity.instrument,
    marketStateRef: input.marketState.marketStateId,
    marketStateDigest: shadowDigest(toJson(input.marketState)),
    opportunityRef: input.opportunity.opportunityId,
    opportunityDigest: shadowDigest(toJson(input.opportunity)),
    tradeProposalRef: input.tradeProposal.proposalId,
    tradeProposalDigest: shadowDigest(toJson(input.tradeProposal)),
    experiment: Object.freeze({ ...input.experiment }),
    questionSet: Object.freeze({ ...input.questionSet }),
    requestedProvider: input.requestedProvider,
    requestedModel: input.requestedModel,
    providerState,
    inputDigest,
  });
}

export function buildAllowlistedProviderState(
  marketState: MarketState,
  opportunity: Opportunity,
  proposal: TradeProposal,
): Readonly<Record<string, ShadowJsonValue>> {
  return deepFreeze({
    market: {
      instrument: marketState.instrument,
      venue: marketState.venue ?? null,
      timeframe: marketState.timeframe,
      marketTime: marketState.marketTime,
      observedAt: marketState.observedAt,
      freshness: marketState.freshness,
      completeness: marketState.completeness,
      qualityStatus: marketState.qualityStatus ?? null,
      sequenceStatus: marketState.sequenceStatus ?? null,
      features: marketState.features.map((feature) => ({
        featureId: feature.featureId,
        featureVersion: feature.featureVersion,
        value: feature.value,
        unit: feature.unit ?? null,
        computedAt: feature.computedAt,
      })),
    },
    opportunity: {
      qualification: opportunity.qualification,
      expectedCharacteristics: toJson(opportunity.expectedCharacteristics),
      expiresAt: opportunity.expiresAt,
    },
    proposal: {
      action: proposal.action,
      requestedQuantity: proposal.sizing.requestedQuantity,
      requestedCapital: proposal.sizing.requestedCapital,
      leverage: proposal.sizing.leverage ?? null,
      expectedReturn: toJson(proposal.expectedReturn),
      expectedRisk: toJson(proposal.expectedRisk),
      liquidityAssumptions: toJson(proposal.liquidityAssumptions),
      duration: toJson(proposal.duration),
      costAssumptions: toJson(proposal.costAssumptions),
      createdAt: proposal.createdAt,
      expiresAt: proposal.expiresAt,
    },
  });
}

function toJson(value: unknown): ShadowJsonValue {
  return JSON.parse(JSON.stringify(value)) as ShadowJsonValue;
}

function deepFreeze<T extends ShadowJsonValue>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested as ShadowJsonValue);
  }
  return value;
}

export function serializeProviderState(snapshot: ShadowDecisionSnapshot): string {
  return canonicalShadowJson(snapshot.providerState);
}
