import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMarketDerivedOutcome,
  createMarketReadingSnapshot,
  JEV_SHADOW_PAPER_R2_MARKET_READER_QUESTION_SET_V1,
  MarketDerivedOutcomeError,
  PAPER_R2_OUTCOME_HORIZON_POLICY,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const candles = [
  candle('00', '100', '101', '99', '100'),
  candle('01', '100', '103', '100', '102'),
  candle('02', '102', '104', '101', '103'),
  candle('03', '103', '105', '102', '104'),
  candle('04', '104', '104', '100', '101'),
];

function candle(minute, open, high, low, close) {
  return { openTime: `2026-09-21T12:${minute}:00.000Z`, closeTime: `2026-09-21T12:${minute}:59.999Z`, open, high, low, close, volume: '10', sourceRef: `fixture:${minute}` };
}

describe('AXODUS-TRADING-IMP-02 PAPER SHADOW R2 outcomes', () => {
  it('freezes the horizon and reference-price policies', () => {
    assert.deepEqual(PAPER_R2_OUTCOME_HORIZON_POLICY.horizonsMinutes, [1, 3]);
    assert.equal(PAPER_R2_OUTCOME_HORIZON_POLICY.referencePriceType, 'CANDLE_CLOSE');
    assert.equal(Object.isFrozen(PAPER_R2_OUTCOME_HORIZON_POLICY), true);
    assert.equal(JEV_SHADOW_PAPER_R2_MARKET_READER_QUESTION_SET_V1.some((q) => q.questionId === 'proposal_alignment'), false);
  });

  it('computes exact future-only outcomes from closed candles', () => {
    const result = calculateMarketDerivedOutcome(candles[0].closeTime, candles);
    assert.equal(result.provenance, 'MARKET_DERIVED_COUNTERFACTUAL');
    assert.equal(result.horizons[0].forwardReturn, '0.02');
    assert.equal(result.horizons[1].forwardReturn, '0.04');
    assert.equal(result.horizons[1].maximumFavorableExcursion, '0.05');
    assert.equal(result.horizons[1].maximumAdverseExcursion, '0');
    assert.equal(result.horizons[1].regimeOutcome, 'UPWARD');
  });

  it('fails closed when future candles are unavailable or temporally unordered', () => {
    assert.throws(() => calculateMarketDerivedOutcome(candles[2].closeTime, candles), (error) => error instanceof MarketDerivedOutcomeError && error.code === 'OUTCOME_FUTURE_DATA_MISSING');
    assert.throws(() => calculateMarketDerivedOutcome(candles[0].closeTime, [candles[1], candles[0], ...candles.slice(2)]), (error) => error instanceof MarketDerivedOutcomeError && error.code === 'OUTCOME_CANDLE_ORDER_INVALID');
  });

  it('creates a market-reading snapshot without manufacturing a trade proposal', () => {
    const marketState = {
      marketStateId: 'market-r2', instrument: 'BTCUSDT', venue: 'binance-testnet-public', timeframe: '1m',
      marketTime: candles[0].closeTime, observedAt: candles[0].closeTime, constructedAt: candles[0].closeTime,
      validityContext: 'paper', freshness: 'historical', schemaVersion: '1', completeness: 'complete',
      sourceRefs: ['fixture'], validationRefs: ['fixture'], features: [{ featureId: 'mid_price', featureVersion: '1', value: '100', computedAt: candles[0].closeTime }],
    };
    const snapshot = createMarketReadingSnapshot({
      environment: 'PAPER', capturedAt: candles[0].closeTime, marketState,
      experiment: { experimentId: 'jev-paper-shadow-r2', experimentVersion: '1' },
      questionSet: { questionSetId: 'jev-paper-r2-market-reader', questionSetVersion: '1' },
      requestedProvider: 'typesafe-jev', requestedModel: 'jev-1.13.0', correlationId: 'r2-correlation',
      samplingTrigger: 'CLOSED_CANDLE_INTERVAL', samplingPolicyId: 'paper-r2-sampling@1', featurePolicyId: 'paper-r2-candle-features@1',
      outcomeHorizonPolicyId: PAPER_R2_OUTCOME_HORIZON_POLICY.policyId, referencePricePolicyId: 'candle-close@1',
    });
    assert.equal(snapshot.observationKind, 'MARKET_STATE');
    assert.equal(snapshot.tradeProposalRef, undefined);
    assert.equal(JSON.stringify(snapshot.providerState).includes('proposal'), false);
  });
});
