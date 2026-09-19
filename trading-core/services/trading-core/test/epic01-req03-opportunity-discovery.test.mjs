import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MarketStateFreshnessPolicy,
  OpportunityDiscoveryService,
  OpportunityRankingService,
  revalidateOpportunity,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const policy = new MarketStateFreshnessPolicy({ policyVersion: 'freshness-v1', maxAgeMs: 5_000, futureToleranceMs: 500 });

function marketState(overrides = {}) {
  return {
    marketStateId: 'ms-req03-1',
    instrument: 'BTC-USDT',
    venue: 'venue-a',
    timeframe: '1m',
    marketTime: '2026-09-19T12:00:00.000Z',
    observedAt: '2026-09-19T12:00:00.000Z',
    constructedAt: '2026-09-19T12:00:00.100Z',
    validityContext: 'live',
    freshness: 'current',
    schemaVersion: '1.0.0',
    features: [
      { featureId: 'spread_bps', featureVersion: '1.0.0', value: 18, computedAt: '2026-09-19T12:00:00.100Z' },
      { featureId: 'volatility', featureVersion: '1.0.0', value: 0.04, computedAt: '2026-09-19T12:00:00.100Z' },
      { featureId: 'liquidity', featureVersion: '1.0.0', value: 0.8, computedAt: '2026-09-19T12:00:00.100Z' },
    ],
    sourceRefs: ['source:venue-a:1'],
    completeness: 'complete',
    validationRefs: ['validation:market-state'],
    ...overrides,
  };
}

function strategy(overrides = {}) {
  return { strategyId: 'strategy-swing', strategyRevisionId: 'strategy-swing:1', family: 'spot-swing', timeframe: '1m', ...overrides };
}

function detector(overrides = {}) {
  return {
    detectorId: 'detector-spread',
    detectorVersion: '1.0.0',
    methodologyRef: 'methodology:spread-v1',
    requiredFeatures: [{ featureId: 'spread_bps', featureVersion: '1.0.0' }],
    detect: ({ strategy: context }) => context.family === 'spot-swing'
      ? { applicability: 'APPLICABLE', qualification: 'qualified', opportunityType: 'spread-condition', expectedCharacteristics: { discoveryRelevance: 0.8, spreadBps: 18 }, evidenceRefs: ['evidence:spread'], expiresInMs: 5_000, reason: 'spread condition is applicable' }
      : { applicability: 'NOT_APPLICABLE', qualification: 'unqualified', opportunityType: 'spread-condition', expectedCharacteristics: {}, evidenceRefs: [], expiresInMs: 5_000, reason: 'strategy family is not applicable' },
    ...overrides,
  };
}

function discovery(overrides = {}) {
  return new OpportunityDiscoveryService().discover({
    discoveryRunId: 'run-req03-1',
    correlationId: 'corr-req03-1',
    now: '2026-09-19T12:00:01.000Z',
    marketState: marketState(),
    strategies: [strategy()],
    detectors: [detector()],
    ...overrides,
  });
}

describe('REQ-03 Opportunity Discovery Foundation', () => {
  it('creates a contextual provider-neutral Opportunity from valid MarketState', () => {
    const result = discovery();
    assert.equal(result.opportunities.length, 1);
    const opportunity = result.opportunities[0];
    assert.equal(opportunity.strategyId, 'strategy-swing');
    assert.equal(opportunity.marketStateId, 'ms-req03-1');
    assert.equal(opportunity.status, 'QUALIFIED');
    assert.equal(opportunity.detector.detectorVersion, '1.0.0');
    assert.ok(opportunity.evidenceRefs.includes('market-state:ms-req03-1'));
    assert.equal('pairScore' in opportunity, false);
  });

  it('keeps one MarketState contextual across different strategies', () => {
    const result = discovery({
      strategies: [strategy(), strategy({ strategyId: 'strategy-arbitrage', strategyRevisionId: 'strategy-arbitrage:1', family: 'arbitrage' })],
    });
    assert.equal(result.opportunities.length, 1);
    assert.equal(result.opportunities[0].strategyId, 'strategy-swing');
    assert.equal(result.rejected[0].reason, 'strategy family is not applicable');
  });

  it('fails closed for stale live MarketState and missing required features', () => {
    const service = new OpportunityDiscoveryService();
    const stale = service.discover({
      discoveryRunId: 'run-stale', correlationId: 'corr-stale', now: '2026-09-19T12:00:01.000Z',
      marketState: marketState({ freshness: 'stale' }), strategies: [strategy()], detectors: [detector()],
    });
    assert.deepEqual(stale.opportunities, []);

    const missing = service.discover({
      discoveryRunId: 'run-missing', correlationId: 'corr-missing', now: '2026-09-19T12:00:01.000Z',
      marketState: marketState({ features: [] }), strategies: [strategy()], detectors: [detector()],
    });
    assert.deepEqual(missing.opportunities, []);
    assert.match(missing.rejected[0].reason, /missing required features/);
  });

  it('produces deterministic identity and suppresses duplicate semantic detectors', () => {
    const first = discovery();
    const second = discovery({ detectors: [detector(), detector()] });
    assert.equal(first.opportunities[0].opportunityId, second.opportunities[0].opportunityId);
    assert.deepEqual(second.duplicateOpportunityIds, [first.opportunities[0].opportunityId]);
  });

  it('preserves detector revision identity', () => {
    const result = discovery({ detectors: [detector({ detectorVersion: '2.0.0', methodologyRef: 'methodology:spread-v2' })] });
    assert.equal(result.opportunities[0].detector.detectorVersion, '2.0.0');
    assert.notEqual(result.opportunities[0].opportunityId, discovery().opportunities[0].opportunityId);
  });

  it('supports historical discovery without applying live freshness rejection', () => {
    const historical = discovery({
      marketState: marketState({ marketStateId: 'ms-historical-1', validityContext: 'historical', freshness: 'historical' }),
    });
    assert.equal(historical.opportunities.length, 1);
    assert.equal(historical.opportunities[0].validityContext, 'historical');
  });

  it('revalidates expiry and supporting MarketState without rewriting the opportunity', () => {
    const opportunity = discovery().opportunities[0];
    const expired = revalidateOpportunity(opportunity, marketState(), '2026-09-19T12:00:07.000Z');
    assert.equal(expired.status, 'EXPIRED');
    assert.equal(expired.opportunityId, opportunity.opportunityId);
    const invalidated = revalidateOpportunity(opportunity, marketState({ marketStateId: 'ms-newer' }), '2026-09-19T12:00:02.000Z');
    assert.equal(invalidated.status, 'INVALIDATED');
  });

  it('ranks only within explicit strategy/timeframe context', () => {
    const service = new OpportunityRankingService();
    const opportunities = discovery({ strategies: [strategy(), strategy({ strategyId: 'strategy-scalp', strategyRevisionId: 'strategy-scalp:1', family: 'futures-scalping' })] }).opportunities;
    const ranked = service.rank(opportunities, { methodologyId: 'rank-relevance', methodologyVersion: '1.0.0', strategyId: 'strategy-swing', timeframe: '1m', universeRef: 'universe:test' });
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[0].comparisonValue, 0.8);
  });

  it('uses policy-defined freshness semantics as an explicit dependency', () => {
    const fresh = policy.evaluate('2026-09-19T12:00:00.000Z', '2026-09-19T12:00:04.000Z', 'live');
    const stale = policy.evaluate('2026-09-19T11:59:00.000Z', '2026-09-19T12:00:04.000Z', 'live');
    const historical = policy.evaluate('2024-01-01T00:00:00.000Z', '2026-09-19T12:00:04.000Z', 'historical');
    assert.equal(fresh.state, 'FRESH');
    assert.equal(stale.state, 'STALE');
    assert.equal(historical.state, 'FRESH');
  });
});
