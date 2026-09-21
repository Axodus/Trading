import { FixedDecimal } from '../../../../packages/trading-contracts/src/index.js';
import { shadowDigest } from './CanonicalShadowJson.js';

export const PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY = Object.freeze({
  policyId: 'deterministic-market-comparator@1',
  featurePolicyId: 'paper-r2-candle-features@1',
  directionalPressureThreshold: '0.0002',
  trendingReturnThreshold: '0.0004',
  highVolatilityRangeThreshold: '0.0015',
  outcomeDirectionThreshold: '0.0002',
  description: 'Frozen transparent comparator over the same t0 OHLCV-derived features provided to Jev. It is intentionally not fitted to outcome data.',
});

export type DeterministicDirectionalPressure = 'upward' | 'downward' | 'neutral';
export type DeterministicMarketRegime = 'trending' | 'range' | 'high_volatility';
export type DirectionalOutcome = 'upward' | 'downward' | 'neutral';

export interface DeterministicMarketFeature {
  featureId: string;
  value: string;
}

export interface DeterministicMarketComparatorResult {
  policyId: string;
  directionalPressure: DeterministicDirectionalPressure;
  marketRegime: DeterministicMarketRegime;
  inputs: Readonly<Record<'candle_return_1m' | 'candle_range_ratio' | 'candle_body_ratio' | 'volume', string>>;
  inputDigest: string;
}

export class DeterministicMarketComparatorError extends Error {
  constructor(readonly code: 'COMPARATOR_FEATURE_MISSING' | 'COMPARATOR_FEATURE_INVALID') {
    super(code);
    this.name = 'DeterministicMarketComparatorError';
  }
}

export function classifyDirectionalOutcome(
  forwardReturn: string,
  policy = PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY,
): DirectionalOutcome {
  const value = decimal(forwardReturn);
  const threshold = FixedDecimal.from(policy.outcomeDirectionThreshold);
  if (value.gte(threshold)) return 'upward';
  if (value.lte(threshold.mul('-1'))) return 'downward';
  return 'neutral';
}

/**
 * A deliberately small, non-fitted t0 comparator. Its job is to establish the
 * minimum information already recoverable from Jev's own input, not to compete
 * through training or outcome-specific tuning.
 */
export function evaluateDeterministicMarketComparator(
  features: readonly DeterministicMarketFeature[],
  policy = PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY,
): DeterministicMarketComparatorResult {
  const inputs = Object.freeze({
    candle_return_1m: required(features, 'candle_return_1m'),
    candle_range_ratio: required(features, 'candle_range_ratio'),
    candle_body_ratio: required(features, 'candle_body_ratio'),
    volume: required(features, 'volume'),
  });
  const candleReturn = decimal(inputs.candle_return_1m);
  const candleRange = decimal(inputs.candle_range_ratio).abs();
  const candleBody = decimal(inputs.candle_body_ratio);
  const directionalThreshold = FixedDecimal.from(policy.directionalPressureThreshold);
  const trendingThreshold = FixedDecimal.from(policy.trendingReturnThreshold);
  const volatilityThreshold = FixedDecimal.from(policy.highVolatilityRangeThreshold);

  const directionalPressure: DeterministicDirectionalPressure = candleReturn.gte(directionalThreshold)
    ? 'upward'
    : candleReturn.lte(directionalThreshold.mul('-1'))
      ? 'downward'
      : 'neutral';
  const sameDirection = (candleReturn.gte(FixedDecimal.zero()) && candleBody.gte(FixedDecimal.zero()))
    || (candleReturn.lte(FixedDecimal.zero()) && candleBody.lte(FixedDecimal.zero()));
  const marketRegime: DeterministicMarketRegime = candleRange.gte(volatilityThreshold)
    ? 'high_volatility'
    : candleReturn.abs().gte(trendingThreshold) && sameDirection
      ? 'trending'
      : 'range';

  return Object.freeze({
    policyId: policy.policyId,
    directionalPressure,
    marketRegime,
    inputs,
    inputDigest: shadowDigest({ policyId: policy.policyId, inputs } as any),
  });
}

function required(features: readonly DeterministicMarketFeature[], featureId: DeterministicMarketFeature['featureId']): string {
  const value = features.find((feature) => feature.featureId === featureId)?.value;
  if (typeof value !== 'string') throw new DeterministicMarketComparatorError('COMPARATOR_FEATURE_MISSING');
  decimal(value);
  return value;
}

function decimal(value: string): FixedDecimal {
  try {
    return FixedDecimal.from(value);
  } catch {
    throw new DeterministicMarketComparatorError('COMPARATOR_FEATURE_INVALID');
  }
}
