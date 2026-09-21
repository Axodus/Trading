import type {
  ExperimentPolicyIdentity,
  MarketState,
  QuestionSetIdentity,
  ShadowDecisionSnapshot,
  ShadowEnvironment,
  ShadowJsonValue,
} from '../../../../packages/trading-contracts/src/index.js';
import { shadowDigest } from './CanonicalShadowJson.js';

export interface CreateMarketReadingSnapshotInput {
  environment: ShadowEnvironment;
  capturedAt: string;
  marketState: MarketState;
  experiment: ExperimentPolicyIdentity;
  questionSet: QuestionSetIdentity;
  requestedProvider: string;
  requestedModel: string;
  correlationId: string;
  strategyId?: string;
  strategyRevisionId?: string;
  samplingTrigger: string;
  samplingPolicyId: string;
  featurePolicyId: string;
  outcomeHorizonPolicyId: string;
  referencePricePolicyId: string;
}

export function createMarketReadingSnapshot(input: CreateMarketReadingSnapshotInput): ShadowDecisionSnapshot {
  const providerState = buildMarketReaderProviderState(input);
  const identity = toJson({
    observationKind: 'MARKET_STATE',
    environment: input.environment,
    capturedAt: input.capturedAt,
    marketStateId: input.marketState.marketStateId,
    experiment: input.experiment,
    questionSet: input.questionSet,
    requestedProvider: input.requestedProvider,
    requestedModel: input.requestedModel,
    samplingTrigger: input.samplingTrigger,
    providerState,
  });
  const inputDigest = shadowDigest(identity);
  return Object.freeze({
    observationKind: 'MARKET_STATE',
    snapshotId: `shadow-snapshot:${inputDigest.slice('fnv1a64:'.length)}`,
    correlationId: input.correlationId,
    capturedAt: input.capturedAt,
    environment: input.environment,
    strategyId: input.strategyId ?? 'market-reader',
    strategyRevisionId: input.strategyRevisionId ?? 'market-reader@1',
    instrument: input.marketState.instrument,
    marketStateRef: input.marketState.marketStateId,
    marketStateDigest: shadowDigest(toJson(input.marketState)),
    experiment: Object.freeze({ ...input.experiment }),
    questionSet: Object.freeze({ ...input.questionSet }),
    requestedProvider: input.requestedProvider,
    requestedModel: input.requestedModel,
    providerState,
    inputDigest,
  });
}

export function buildMarketReaderProviderState(input: CreateMarketReadingSnapshotInput): Readonly<Record<string, ShadowJsonValue>> {
  return deepFreeze({
    task: 'paper-shadow-r2-market-state-reading',
    sampling: {
      trigger: input.samplingTrigger,
      samplingPolicyId: input.samplingPolicyId,
      featurePolicyId: input.featurePolicyId,
      outcomeHorizonPolicyId: input.outcomeHorizonPolicyId,
      referencePricePolicyId: input.referencePricePolicyId,
    },
    market: {
      instrument: input.marketState.instrument,
      venue: input.marketState.venue ?? null,
      timeframe: input.marketState.timeframe,
      marketTime: input.marketState.marketTime,
      observedAt: input.marketState.observedAt,
      freshness: input.marketState.freshness,
      completeness: input.marketState.completeness,
      qualityStatus: input.marketState.qualityStatus ?? null,
      sequenceStatus: input.marketState.sequenceStatus ?? null,
      features: input.marketState.features.map((feature) => ({
        featureId: feature.featureId,
        featureVersion: feature.featureVersion,
        value: feature.value,
        unit: feature.unit ?? null,
        computedAt: feature.computedAt,
      })),
    },
  });
}

function toJson(value: unknown): ShadowJsonValue { return JSON.parse(JSON.stringify(value)) as ShadowJsonValue; }
function deepFreeze<T extends ShadowJsonValue>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested as ShadowJsonValue);
  }
  return value;
}
