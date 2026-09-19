import type {
  MarketObservation,
  MarketSequenceStatus,
  MarketState,
  MarketStateFeature,
  MarketStateValidityContext,
} from '../../../../packages/trading-contracts/src/index.js';
import { validateMarketState } from '../../../../packages/trading-contracts/src/index.js';
import { MarketObservationNormalizer } from './MarketObservationNormalizer.js';
import { MarketStateFreshnessPolicy } from './MarketStateFreshnessPolicy.js';

export interface MarketStateFeatureInput extends MarketStateFeature {
  definitionDigest?: string;
}

export interface RequiredFeatureDefinition {
  featureId: string;
  featureVersion: string;
}

export interface MarketStateBuildInput {
  observations: readonly MarketObservation[];
  features: readonly MarketStateFeatureInput[];
  requiredFeatures?: readonly RequiredFeatureDefinition[];
  timeframe: string;
  validityContext: MarketStateValidityContext;
  schemaVersion: string;
  constructionVersion: string;
  now: string;
  sourceRefs?: readonly string[];
}

export class MarketStateBuildError extends Error {
  constructor(public readonly reasons: readonly string[]) {
    super(`MarketState construction failed: ${reasons.join('; ')}`);
    this.name = 'MarketStateBuildError';
  }
}

export interface MarketStateBuildResult {
  state: MarketState;
  freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
  sequenceStatus: MarketSequenceStatus;
  validationRefs: readonly string[];
}

export class MarketStateBuilder {
  constructor(
    private readonly freshnessPolicy: MarketStateFreshnessPolicy,
    private readonly normalizer = new MarketObservationNormalizer(),
  ) {}

  build(input: MarketStateBuildInput): MarketStateBuildResult {
    const reasons: string[] = [];
    if (input.observations.length === 0) reasons.push('at least one normalized observation is required');
    if (!input.timeframe.trim()) reasons.push('timeframe is required');
    if (!input.schemaVersion.trim()) reasons.push('schemaVersion is required');
    if (!input.constructionVersion.trim()) reasons.push('constructionVersion is required');
    if (reasons.length) throw new MarketStateBuildError(reasons);

    const deduplicated = this.normalizer.deduplicate(input.observations);
    const observations = deduplicated.observations;
    const first = observations[0];
    if (observations.some((observation) => observation.instrument !== first.instrument)) reasons.push('observations must share instrument');
    if (observations.some((observation) => observation.venue !== first.venue)) reasons.push('observations must share venue');
    if (deduplicated.conflictingObservationIds.length) reasons.push(`conflicting duplicate observations: ${deduplicated.conflictingObservationIds.join(',')}`);

    const featureMap = new Map(input.features.map((feature) => [`${feature.featureId}@${feature.featureVersion}`, feature]));
    for (const required of input.requiredFeatures ?? []) {
      if (!featureMap.has(`${required.featureId}@${required.featureVersion}`)) reasons.push(`missing required feature ${required.featureId}@${required.featureVersion}`);
    }
    if (reasons.length) throw new MarketStateBuildError(reasons);

    const freshnessResults = observations.map((observation) => this.freshnessPolicy.evaluate(observation.observedAt, input.now, input.validityContext));
    const freshness = input.validityContext === 'live'
      ? freshnessResults.some((result) => result.state === 'UNKNOWN') ? 'UNKNOWN' : freshnessResults.some((result) => result.state === 'STALE') ? 'STALE' : 'FRESH'
      : 'FRESH';
    const sequenceStatus = sequenceStatusFor(observations);
    const validationRefs = [
      `freshness-policy:${this.freshnessPolicy.version}`,
      `construction:${input.constructionVersion}`,
      ...deduplicated.duplicateObservationIds.map((id) => `duplicate-observation:${id}`),
      ...deduplicated.conflictingObservationIds.map((id) => `conflicting-observation:${id}`),
    ].sort();
    const state: MarketState = {
      marketStateId: marketStateId(input, observations, freshness, sequenceStatus),
      instrument: first.instrument,
      venue: first.venue,
      timeframe: input.timeframe,
      marketTime: observations.map((observation) => observation.eventTime).sort().at(-1) ?? first.eventTime,
      observedAt: observations.map((observation) => observation.observedAt).sort().at(-1) ?? first.observedAt,
      constructedAt: input.now,
      validityContext: input.validityContext,
      freshness: input.validityContext === 'historical' ? 'historical' : freshness === 'FRESH' ? 'current' : freshness === 'STALE' ? 'stale' : 'unknown',
      schemaVersion: input.schemaVersion,
      features: [...input.features].sort((left, right) => `${left.featureId}@${left.featureVersion}`.localeCompare(`${right.featureId}@${right.featureVersion}`)),
      sourceRefs: [...new Set([...(input.sourceRefs ?? []), ...observations.map((observation) => observation.sourceRef)])].sort(),
      completeness: sequenceStatus === 'gap-detected' || observations.some((observation) => observation.quality === 'incomplete') ? 'partial' : 'complete',
      validationRefs,
      observationRefs: observations.map((observation) => observation.observationId),
      constructionVersion: input.constructionVersion,
      qualityStatus: sequenceStatus === 'gap-detected' ? 'gap-detected' : freshness === 'STALE' ? 'stale' : 'valid',
      sequenceStatus,
    };
    // A stale live snapshot is a valid historical record of what was observed,
    // but the REQ-01 admission validator intentionally rejects it as fresh
    // runtime input. Shape and lineage are validated here; admission remains
    // a later consumer concern.
    if (state.freshness !== 'stale') validateMarketState(state);
    return { state, freshness, sequenceStatus, validationRefs };
  }
}

function marketStateId(input: MarketStateBuildInput, observations: readonly MarketObservation[], freshness: string, sequenceStatus: string): string {
  const canonical = JSON.stringify({
    version: input.constructionVersion,
    schema: input.schemaVersion,
    context: input.validityContext,
    timeframe: input.timeframe,
    observations: observations.map((observation) => ({ id: observation.observationId, eventTime: observation.eventTime, observedAt: observation.observedAt, sourceRef: observation.sourceRef, value: observation.value })),
    features: [...input.features].sort((left, right) => `${left.featureId}@${left.featureVersion}`.localeCompare(`${right.featureId}@${right.featureVersion}`)),
    freshness,
    sequenceStatus,
  });
  return `ms-${fnv1aHex(canonical)}`;
}

function fnv1aHex(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function sequenceStatusFor(observations: readonly MarketObservation[]): MarketSequenceStatus {
  const sequenced = observations.filter((observation) => observation.sequence !== undefined);
  if (sequenced.length === 0) return 'not-provided';
  const byScope = new Map<string, MarketObservation[]>();
  for (const observation of sequenced) {
    const scope = observation.sequenceScope ?? `${observation.venue}:${observation.instrument}`;
    byScope.set(scope, [...(byScope.get(scope) ?? []), observation]);
  }
  for (const values of byScope.values()) {
    const sorted = [...values].sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
    for (let index = 1; index < sorted.length; index += 1) {
      if ((sorted[index].sequence ?? 0) === (sorted[index - 1].sequence ?? 0)) return 'duplicate';
      if ((sorted[index].sequence ?? 0) > (sorted[index - 1].sequence ?? 0) + 1) return 'gap-detected';
    }
    if (values.some((value, index) => index > 0 && (value.sequence ?? 0) < (values[index - 1].sequence ?? 0))) return 'out-of-order';
  }
  return 'sequenced';
}
