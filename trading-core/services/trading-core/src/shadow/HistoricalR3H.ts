import { FixedDecimal } from '../../../../packages/trading-contracts/src/index.js';
import { shadowDigest } from './CanonicalShadowJson.js';
import {
  PAPER_R2_OUTCOME_HORIZON_POLICY,
  type MarketDerivedOutcome,
  calculateMarketDerivedOutcome,
  type PaperR2Candle,
} from './MarketDerivedOutcome.js';

export const R3H_POLICIES = Object.freeze({
  samplingPolicyId: 'paper-r3h-sampling@1',
  featurePolicyId: 'paper-r2-candle-features@1',
  outcomeHorizonPolicyId: 'outcome-horizons@1',
  referencePricePolicyId: 'candle-close@1',
  comparatorPolicyId: 'deterministic-market-comparator@1',
  model: 'jev-1.13.0',
  questionSetId: 'jev-paper-r2-market-reader',
  questionSetVersion: '1',
});

export type HistoricalRecordStatus = 'VALID' | 'SOURCE_GAP' | 'MALFORMED_SOURCE' | 'DUPLICATE_SOURCE_RECORD';
export type HistoricalPartition = 'DISCOVERY' | 'VALIDATION' | 'HOLDOUT';

export interface HistoricalCandle extends PaperR2Candle {
  symbol: string;
  interval: '1m';
  openTimeMs: number;
  closeTimeMs: number;
  source: string;
  retrievalTimestamp: string;
}

export interface HistoricalDatasetReport {
  symbol: string;
  interval: '1m';
  start: string;
  end: string;
  expectedRecordCount: number;
  actualRecordCount: number;
  missingRecords: number;
  duplicateRecords: number;
  invalidRecords: number;
  status: 'VALID' | 'INVALID';
  fingerprint: string;
}

export interface HistoricalScheduleEntry {
  observationId: string;
  t0: string;
  dayIndex: number;
  partition: HistoricalPartition;
  outcomeHorizonPolicyId: string;
}

export interface HistoricalT0View {
  readonly kind: 'HISTORICAL_T0_VIEW';
  readonly observationId: string;
  readonly t0: string;
  readonly candlesAtOrBeforeT0: readonly HistoricalCandle[];
  readonly featureSnapshot: readonly HistoricalFeature[];
  readonly inputDigest: string;
}

export interface HistoricalFutureOutcomeView {
  readonly kind: 'HISTORICAL_FUTURE_OUTCOME_VIEW';
  readonly observationId: string;
  readonly candlesAfterT0: readonly HistoricalCandle[];
  readonly inputDigest: string;
}

export interface HistoricalFeature {
  featureId: string;
  featureVersion: string;
  value: string;
  computedAt: string;
}

export interface HistoricalR3HObservation {
  observationId: string;
  partition: HistoricalPartition;
  t0View: HistoricalT0View;
  futureOutcomeView: HistoricalFutureOutcomeView;
  outcome?: MarketDerivedOutcome;
}

export function validateHistoricalCandles(candles: readonly HistoricalCandle[], start: string, end: string): HistoricalDatasetReport {
  const expectedStart = Date.parse(start);
  const expectedEnd = Date.parse(end);
  const sorted = [...candles].sort((a, b) => a.openTimeMs - b.openTimeMs);
  let missingRecords = 0;
  let duplicateRecords = 0;
  let invalidRecords = 0;
  let previous: HistoricalCandle | undefined;
  for (const candle of sorted) {
    const valid = candle.symbol === 'BTCUSDT' && candle.interval === '1m'
      && candle.openTimeMs >= expectedStart && candle.closeTimeMs <= expectedEnd
      && candle.openTimeMs + 59_999 === candle.closeTimeMs
      && [candle.open, candle.high, candle.low, candle.close, candle.volume].every(isDecimal)
      && FixedDecimal.from(candle.high).gte(FixedDecimal.from(candle.low))
      && FixedDecimal.from(candle.high).gte(FixedDecimal.from(candle.open))
      && FixedDecimal.from(candle.high).gte(FixedDecimal.from(candle.close))
      && FixedDecimal.from(candle.low).lte(FixedDecimal.from(candle.open))
      && FixedDecimal.from(candle.low).lte(FixedDecimal.from(candle.close))
      && FixedDecimal.from(candle.volume).gte(FixedDecimal.zero());
    if (!valid) invalidRecords += 1;
    if (previous) {
      const delta = candle.openTimeMs - previous.openTimeMs;
      if (delta === 0) duplicateRecords += 1;
      else if (delta !== 60_000) missingRecords += Math.max(1, Math.floor(delta / 60_000) - 1);
    }
    previous = candle;
  }
  const expectedRecordCount = Math.floor((expectedEnd - expectedStart + 1) / 60_000);
  const reportBase = {
    symbol: 'BTCUSDT' as const,
    interval: '1m' as const,
    start,
    end,
    expectedRecordCount,
    actualRecordCount: sorted.length,
    missingRecords,
    duplicateRecords,
    invalidRecords,
  };
  return { ...reportBase, status: missingRecords || duplicateRecords || invalidRecords || sorted.length !== expectedRecordCount ? 'INVALID' : 'VALID', fingerprint: historicalDatasetFingerprint(sorted) };
}

export function historicalDatasetFingerprint(candles: readonly HistoricalCandle[]): string {
  return shadowDigest(candles.map((candle) => [candle.openTimeMs, candle.closeTimeMs, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.sourceRef]));
}

export function buildR3HSchedule(start: string, end: string): readonly HistoricalScheduleEntry[] {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  const entries: HistoricalScheduleEntry[] = [];
  const dayMs = 24 * 60 * 60_000;
  const dayCount = Math.floor((endMs - startMs + 1) / dayMs);
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const dayStart = startMs + dayIndex * dayMs;
    for (let slot = 0; slot < 12; slot += 1) {
      const t0 = new Date(dayStart + slot * 2 * 60 * 60_000 + 59_999).toISOString();
      const partition: HistoricalPartition = dayIndex < 60 ? 'DISCOVERY' : dayIndex < 75 ? 'VALIDATION' : 'HOLDOUT';
      entries.push({ observationId: `r3h-${dayIndex + 1}-${String(slot + 1).padStart(2, '0')}`, t0, dayIndex: dayIndex + 1, partition, outcomeHorizonPolicyId: R3H_POLICIES.outcomeHorizonPolicyId });
    }
  }
  return Object.freeze(entries);
}

export function createHistoricalT0View(candles: readonly HistoricalCandle[], schedule: HistoricalScheduleEntry): HistoricalT0View {
  const atT0 = candles.filter((candle) => candle.closeTime === schedule.t0);
  if (atT0.length !== 1) throw new Error('R3H_T0_CANDLE_NOT_UNIQUE');
  const index = candles.indexOf(atT0[0]!);
  const history = candles.slice(0, index + 1);
  const featureSnapshot = featuresFor(history);
  return Object.freeze({ kind: 'HISTORICAL_T0_VIEW', observationId: schedule.observationId, t0: schedule.t0, candlesAtOrBeforeT0: Object.freeze(history), featureSnapshot: Object.freeze(featureSnapshot), inputDigest: shadowDigest(JSON.parse(JSON.stringify({ observationId: schedule.observationId, t0: schedule.t0, features: featureSnapshot }))) });
}

export function createHistoricalFutureOutcomeView(candles: readonly HistoricalCandle[], schedule: HistoricalScheduleEntry): HistoricalFutureOutcomeView {
  const t0Index = candles.findIndex((candle) => candle.closeTime === schedule.t0);
  if (t0Index < 0) throw new Error('R3H_T0_CANDLE_NOT_FOUND');
  const future = candles.slice(t0Index + 1);
  return Object.freeze({ kind: 'HISTORICAL_FUTURE_OUTCOME_VIEW', observationId: schedule.observationId, candlesAfterT0: Object.freeze(future), inputDigest: shadowDigest(JSON.parse(JSON.stringify({ observationId: schedule.observationId, future: future.map((candle) => candle.sourceRef) }))) });
}

export function buildHistoricalObservation(candles: readonly HistoricalCandle[], schedule: HistoricalScheduleEntry): HistoricalR3HObservation {
  const t0View = createHistoricalT0View(candles, schedule);
  const futureOutcomeView = createHistoricalFutureOutcomeView(candles, schedule);
  const combined = [...t0View.candlesAtOrBeforeT0, ...futureOutcomeView.candlesAfterT0];
  const outcome = calculateMarketDerivedOutcome(schedule.t0, combined, PAPER_R2_OUTCOME_HORIZON_POLICY);
  return Object.freeze({ observationId: schedule.observationId, partition: schedule.partition, t0View, futureOutcomeView, outcome });
}

function featuresFor(history: readonly HistoricalCandle[]): HistoricalFeature[] {
  const candle = history.at(-1);
  const previous = history.at(-2) ?? candle;
  if (!candle || !previous) throw new Error('R3H_HISTORY_INSUFFICIENT');
  const close = FixedDecimal.from(candle.close);
  return [
    { featureId: 'reference_close', featureVersion: R3H_POLICIES.featurePolicyId, value: candle.close, computedAt: candle.closeTime },
    { featureId: 'candle_return_1m', featureVersion: R3H_POLICIES.featurePolicyId, value: close.sub(previous.close).div(previous.close).toString(), computedAt: candle.closeTime },
    { featureId: 'candle_range_ratio', featureVersion: R3H_POLICIES.featurePolicyId, value: close.sub(candle.low).add(candle.high).sub(close).div(close).toString(), computedAt: candle.closeTime },
    { featureId: 'candle_body_ratio', featureVersion: R3H_POLICIES.featurePolicyId, value: close.sub(candle.open).div(close).toString(), computedAt: candle.closeTime },
    { featureId: 'volume', featureVersion: R3H_POLICIES.featurePolicyId, value: candle.volume, computedAt: candle.closeTime },
  ];
}

function isDecimal(value: string): boolean { try { FixedDecimal.from(value); return true; } catch { return false; } }
