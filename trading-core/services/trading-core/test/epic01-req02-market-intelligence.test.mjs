import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MarketObservationNormalizer,
  MarketStateBuildError,
  MarketStateBuilder,
  MarketStateFreshnessPolicy,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const policy = new MarketStateFreshnessPolicy({
  policyVersion: 'freshness-v1',
  maxAgeMs: 5_000,
  futureToleranceMs: 500,
});

function observation(overrides = {}) {
  return {
    observationId: 'obs-1',
    instrument: 'BTC-USDT',
    venue: 'venue-a',
    observationType: 'ticker',
    eventTime: '2026-09-19T12:00:00.000Z',
    observedAt: '2026-09-19T12:00:00.000Z',
    receivedAt: '2026-09-19T12:00:00.100Z',
    value: { price: '100.00' },
    sourceRef: 'source:venue-a:obs-1',
    schemaVersion: '1.0.0',
    quality: 'valid',
    ...overrides,
  };
}

function buildInput(overrides = {}) {
  return {
    observations: [observation()],
    features: [{ featureId: 'mid_price', featureVersion: '1.0.0', value: '100.00', computedAt: '2026-09-19T12:00:00.200Z' }],
    requiredFeatures: [{ featureId: 'mid_price', featureVersion: '1.0.0' }],
    timeframe: '1m',
    validityContext: 'live',
    schemaVersion: '1.0.0',
    constructionVersion: 'market-state-builder-v1',
    now: '2026-09-19T12:00:01.000Z',
    ...overrides,
  };
}

describe('REQ-02 Market Intelligence and MarketState foundation', () => {
  it('normalizes provider-neutral observations and builds deterministic MarketState', () => {
    const normalizer = new MarketObservationNormalizer();
    const builder = new MarketStateBuilder(policy, normalizer);
    const first = builder.build(buildInput());
    const second = builder.build(buildInput());
    assert.equal(first.state.marketStateId, second.state.marketStateId);
    assert.equal(first.state.freshness, 'current');
    assert.deepEqual(first.state.observationRefs, ['obs-1']);
    assert.deepEqual(first.state.sourceRefs, ['source:venue-a:obs-1']);
  });

  it('distinguishes stale live freshness from historical validity', () => {
    const builder = new MarketStateBuilder(policy);
    const stale = builder.build(buildInput({
      observations: [observation({ observedAt: '2026-09-19T11:59:00.000Z' })],
      now: '2026-09-19T12:00:00.000Z',
    }));
    assert.equal(stale.freshness, 'STALE');
    assert.equal(stale.state.freshness, 'stale');

    const historical = builder.build(buildInput({
      validityContext: 'historical',
      observations: [observation({ observedAt: '2024-01-01T00:00:00.000Z', eventTime: '2024-01-01T00:00:00.000Z' })],
      now: '2026-09-19T12:00:00.000Z',
    }));
    assert.equal(historical.freshness, 'FRESH');
    assert.equal(historical.state.freshness, 'historical');
  });

  it('fails closed for missing and incompatible required features', () => {
    const builder = new MarketStateBuilder(policy);
    assert.throws(() => builder.build(buildInput({ requiredFeatures: [{ featureId: 'mid_price', featureVersion: '2.0.0' }] })), MarketStateBuildError);
    assert.throws(() => builder.build(buildInput({ features: [] })), MarketStateBuildError);
  });

  it('deduplicates equivalent observations and rejects conflicting duplicates', () => {
    const normalizer = new MarketObservationNormalizer();
    const builder = new MarketStateBuilder(policy, normalizer);
    const equivalent = builder.build(buildInput({ observations: [observation(), observation()] }));
    assert.deepEqual(equivalent.state.observationRefs, ['obs-1']);
    assert.ok(equivalent.state.validationRefs.includes('duplicate-observation:obs-1'));
    assert.throws(() => builder.build(buildInput({ observations: [observation(), observation({ value: { price: '101.00' } })] })), MarketStateBuildError);
  });

  it('reports sequence gaps without claiming unsupported sequencing', () => {
    const builder = new MarketStateBuilder(policy);
    const result = builder.build(buildInput({
      observations: [
        observation({ observationId: 'obs-1', sequence: 10, sequenceScope: 'book:BTC-USDT' }),
        observation({ observationId: 'obs-2', sequence: 12, sequenceScope: 'book:BTC-USDT', sourceRef: 'source:venue-a:obs-2' }),
      ],
    }));
    assert.equal(result.sequenceStatus, 'gap-detected');
    assert.equal(result.state.completeness, 'partial');
    assert.equal(result.state.sequenceStatus, 'gap-detected');
  });

  it('preserves feature semantics and provenance without provider payload types', () => {
    const normalizer = new MarketObservationNormalizer();
    const normalized = normalizer.normalize({
      observationType: 'ticker', instrument: 'ETH-USDT', venue: 'venue-a',
      observedAt: '2026-09-19T12:00:00.000Z', receivedAt: '2026-09-19T12:00:00.100Z',
      value: { price: '2000.00' }, sourceRef: 'public-feed:eth', schemaVersion: '1.0.0',
    });
    assert.equal(normalized.sourceRef, 'public-feed:eth');
    assert.equal(normalized.schemaVersion, '1.0.0');
    assert.equal(normalized.observationType, 'ticker');
  });
});
