import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DeterministicMarketComparatorError,
  comparePaperR3Direction,
  evaluateDeterministicMarketComparator,
  PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const base = [
  { featureId: 'candle_return_1m', value: '0.0005' },
  { featureId: 'candle_range_ratio', value: '0.0008' },
  { featureId: 'candle_body_ratio', value: '0.0003' },
  { featureId: 'volume', value: '10' },
];

describe('AXODUS-TRADING-IMP-02 PAPER SHADOW R3 deterministic comparator', () => {
  it('uses only frozen t0 features and classifies an upward trending state', () => {
    const result = evaluateDeterministicMarketComparator(base);
    assert.equal(result.policyId, 'deterministic-market-comparator@1');
    assert.equal(result.directionalPressure, 'upward');
    assert.equal(result.marketRegime, 'trending');
    assert.equal(result.inputs.volume, '10');
  });

  it('classifies high range deterministically before trend', () => {
    const result = evaluateDeterministicMarketComparator(base.map((item) => item.featureId === 'candle_range_ratio' ? { ...item, value: '0.0015' } : item));
    assert.equal(result.marketRegime, 'high_volatility');
  });

  it('fails closed for a missing or malformed comparator feature', () => {
    assert.throws(() => evaluateDeterministicMarketComparator(base.slice(0, 3)), (error) => error instanceof DeterministicMarketComparatorError && error.code === 'COMPARATOR_FEATURE_MISSING');
    assert.throws(() => evaluateDeterministicMarketComparator(base.map((item) => item.featureId === 'volume' ? { ...item, value: 'not-decimal' } : item)), (error) => error instanceof DeterministicMarketComparatorError && error.code === 'COMPARATOR_FEATURE_INVALID');
  });

  it('freezes thresholds rather than deriving them from outcomes', () => {
    assert.equal(PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY.directionalPressureThreshold, '0.0002');
    assert.equal(PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY.trendingReturnThreshold, '0.0004');
    assert.equal(Object.isFrozen(PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY), true);
  });

  it('compares Jev and the deterministic baseline only against later outcome labels', () => {
    const comparison = comparePaperR3Direction([
      { deterministicComparator: { directionalPressure: 'upward' }, observation: { answers: [{ questionId: 'directional_pressure', value: 'upward' }] }, outcome: { horizons: [{ horizonMinutes: 1, forwardReturn: '0.0003' }] } },
      { deterministicComparator: { directionalPressure: 'downward' }, observation: { answers: [{ questionId: 'directional_pressure', value: 'upward' }] }, outcome: { horizons: [{ horizonMinutes: 1, forwardReturn: '-0.0003' }] } },
      { deterministicComparator: { directionalPressure: 'neutral' }, observation: { answers: [{ questionId: 'directional_pressure', value: 'neutral' }] }, outcome: { horizons: [{ horizonMinutes: 1, forwardReturn: '0.0003' }] } },
    ], 1);
    assert.deepEqual(comparison, {
      horizonMinutes: 1,
      directionalOutcomes: 3,
      deterministicPredictions: 2,
      deterministicCorrect: 2,
      deterministicAbstentions: 1,
      jevPredictions: 2,
      jevCorrect: 1,
      jevAbstentions: 1,
      jointPredictions: 2,
      bothCorrect: 1,
      deterministicOnlyCorrect: 1,
      jevOnlyCorrect: 0,
      neitherCorrect: 0,
    });
  });

  it('keeps individual Jev signal visible when the deterministic comparator abstains', () => {
    const comparison = comparePaperR3Direction([
      { deterministicComparator: { directionalPressure: 'neutral' }, observation: { answers: [{ questionId: 'directional_pressure', value: 'upward' }] }, outcome: { horizons: [{ horizonMinutes: 1, forwardReturn: '0.0003' }] } },
    ], 1);
    assert.equal(comparison.directionalOutcomes, 1);
    assert.equal(comparison.deterministicPredictions, 0);
    assert.equal(comparison.deterministicAbstentions, 1);
    assert.equal(comparison.jevPredictions, 1);
    assert.equal(comparison.jevCorrect, 1);
    assert.equal(comparison.jointPredictions, 0);
  });
});
