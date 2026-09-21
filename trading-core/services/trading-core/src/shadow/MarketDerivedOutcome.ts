import { FixedDecimal, type ShadowJsonValue } from '../../../../packages/trading-contracts/src/index.js';
import { shadowDigest } from './CanonicalShadowJson.js';

export const PAPER_R2_OUTCOME_HORIZON_POLICY = Object.freeze({
  policyId: 'outcome-horizons@1',
  interval: '1m',
  horizonsMinutes: Object.freeze([1, 3]),
  referencePriceType: 'CANDLE_CLOSE',
  calculationVersion: 'market-derived-outcome@1',
});

export interface PaperR2Candle {
  openTime: string;
  closeTime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  sourceRef: string;
}

export interface MarketDerivedHorizonOutcome {
  horizonMinutes: number;
  outcomeAt: string;
  referencePriceAtT0: string;
  referencePriceAtOutcome: string;
  forwardReturn: string;
  maximumFavorableExcursion: string;
  maximumAdverseExcursion: string;
  realizedRange: string;
  regimeOutcome: 'UPWARD' | 'DOWNWARD' | 'RANGE';
  sourceRefs: readonly string[];
}

export interface MarketDerivedOutcome {
  outcomeId: string;
  observationAt: string;
  provenance: 'MARKET_DERIVED_COUNTERFACTUAL';
  horizonPolicyId: string;
  referencePriceType: 'CANDLE_CLOSE';
  calculationVersion: string;
  horizons: readonly MarketDerivedHorizonOutcome[];
  inputDigest: string;
}

export class MarketDerivedOutcomeError extends Error {
  constructor(readonly code: 'OUTCOME_T0_NOT_FOUND' | 'OUTCOME_FUTURE_DATA_MISSING' | 'OUTCOME_CANDLE_ORDER_INVALID') {
    super(code);
    this.name = 'MarketDerivedOutcomeError';
  }
}

/**
 * Computes labels strictly after t0 from closed source candles. It deliberately
 * does not accept provider/Jev output and cannot make an inference outcome
 * depend on future data available at request construction time.
 */
export function calculateMarketDerivedOutcome(
  observationAt: string,
  candles: readonly PaperR2Candle[],
  policy = PAPER_R2_OUTCOME_HORIZON_POLICY,
): MarketDerivedOutcome {
  assertOrdered(candles);
  const t0Index = candles.findIndex((candle) => candle.closeTime === observationAt);
  if (t0Index < 0) throw new MarketDerivedOutcomeError('OUTCOME_T0_NOT_FOUND');
  const t0 = candles[t0Index]!;
  const horizons = policy.horizonsMinutes.map((horizonMinutes) => {
    const futureIndex = t0Index + horizonMinutes;
    if (futureIndex >= candles.length) throw new MarketDerivedOutcomeError('OUTCOME_FUTURE_DATA_MISSING');
    const window = candles.slice(t0Index + 1, futureIndex + 1);
    if (window.length !== horizonMinutes) throw new MarketDerivedOutcomeError('OUTCOME_FUTURE_DATA_MISSING');
    const outcome = candles[futureIndex]!;
    const reference = FixedDecimal.from(t0.close);
    const future = FixedDecimal.from(outcome.close);
    const highest = window.map((item) => FixedDecimal.from(item.high)).reduce((current, value) => current.max(value));
    const lowest = window.map((item) => FixedDecimal.from(item.low)).reduce((current, value) => current.min(value));
    const forwardReturn = ratio(future.sub(reference), reference);
    const mfe = ratio(highest.sub(reference), reference);
    const mae = ratio(lowest.sub(reference), reference);
    const realizedRange = ratio(highest.sub(lowest), reference);
    return Object.freeze({
      horizonMinutes,
      outcomeAt: outcome.closeTime,
      referencePriceAtT0: reference.toString(),
      referencePriceAtOutcome: future.toString(),
      forwardReturn: forwardReturn.toString(),
      maximumFavorableExcursion: mfe.toString(),
      maximumAdverseExcursion: mae.toString(),
      realizedRange: realizedRange.toString(),
      regimeOutcome: classify(forwardReturn, realizedRange),
      sourceRefs: Object.freeze([t0.sourceRef, ...window.map((item) => item.sourceRef)]),
    });
  });
  const digest = shadowDigest({ observationAt, policy: policy.policyId, candles: [t0, ...candles.slice(t0Index + 1, t0Index + Math.max(...policy.horizonsMinutes) + 1)] } as unknown as ShadowJsonValue);
  return Object.freeze({
    outcomeId: `market-outcome:${digest}`,
    observationAt,
    provenance: 'MARKET_DERIVED_COUNTERFACTUAL',
    horizonPolicyId: policy.policyId,
    referencePriceType: policy.referencePriceType,
    calculationVersion: policy.calculationVersion,
    horizons: Object.freeze(horizons),
    inputDigest: digest,
  });
}

function ratio(numerator: FixedDecimal, denominator: FixedDecimal): FixedDecimal {
  if (denominator.isZero()) throw new MarketDerivedOutcomeError('OUTCOME_T0_NOT_FOUND');
  return numerator.div(denominator);
}

function classify(returnValue: FixedDecimal, range: FixedDecimal): 'UPWARD' | 'DOWNWARD' | 'RANGE' {
  const threshold = FixedDecimal.from('0.0005');
  if (returnValue.gte(threshold)) return 'UPWARD';
  if (returnValue.lte(threshold.mul('-1'))) return 'DOWNWARD';
  return range.gte(threshold) ? 'RANGE' : 'RANGE';
}

function assertOrdered(candles: readonly PaperR2Candle[]): void {
  for (let index = 1; index < candles.length; index += 1) {
    if (candles[index - 1]!.closeTime >= candles[index]!.closeTime) {
      throw new MarketDerivedOutcomeError('OUTCOME_CANDLE_ORDER_INVALID');
    }
  }
}

