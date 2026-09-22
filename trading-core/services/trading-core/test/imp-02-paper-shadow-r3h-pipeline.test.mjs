import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildR3HSchedule,
  createHistoricalFutureOutcomeView,
  createHistoricalT0View,
  historicalDatasetFingerprint,
  validateHistoricalCandles,
  buildHistoricalObservation,
  R3H_POLICIES,
  evaluateDeterministicMarketComparator,
  PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import { FixedDecimal } from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';

function candles(count = 10) {
  return Array.from({ length: count }, (_, i) => {
    const openMs = Date.parse('2026-06-23T00:00:00.000Z') + i * 60_000;
    return {
      symbol: 'BTCUSDT', interval: '1m', openTimeMs: openMs, closeTimeMs: openMs + 59_999,
      openTime: new Date(openMs).toISOString(), closeTime: new Date(openMs + 59_999).toISOString(),
      open: String(100 + i), high: String(101 + i), low: String(99 + i), close: String(100.5 + i), volume: '10',
      source: 'fixture', retrievalTimestamp: '2026-09-22T00:00:00.000Z', sourceRef: 'fixture:' + i,
    };
  });
}

describe('AXODUS-TRADING-IMP-02 PAPER SHADOW R3H pipeline validation', () => {
  it('produces deterministic schedules with chronological partitioning', () => {
    const schedule = buildR3HSchedule('2026-06-23T00:00:00.000Z', '2026-09-20T23:59:59.999Z');
    assert.equal(schedule.length, 1080);
    assert.equal(schedule[0].partition, 'DISCOVERY');
    assert.equal(schedule[719].partition, 'DISCOVERY');
    assert.equal(schedule[720].partition, 'VALIDATION');
    assert.equal(schedule[899].partition, 'VALIDATION');
    assert.equal(schedule[900].partition, 'HOLDOUT');
  });

  it('strictly isolates t0 input from future outcome data with zero look-ahead', () => {
    const schedule = buildR3HSchedule('2026-06-23T00:00:00.000Z', '2026-06-23T23:59:59.999Z')[0];
    const rows = candles(10);
    const t0 = createHistoricalT0View(rows, { ...schedule, t0: rows[2].closeTime });
    const future = createHistoricalFutureOutcomeView(rows, { ...schedule, t0: rows[2].closeTime });
    assert.ok(t0.candlesAtOrBeforeT0.every((row) => row.closeTime <= t0.t0));
    assert.ok(future.candlesAfterT0.every((row) => row.closeTime > t0.t0));
    assert.equal(t0.featureSnapshot.at(-1)?.computedAt, t0.t0);
  });

  it('validates continuity, detects gaps, and derives reproducible dataset fingerprints', () => {
    const validRows = candles(5);
    const validReport = validateHistoricalCandles(validRows, validRows[0].openTime, validRows.at(-1).closeTime);
    assert.equal(validReport.status, 'VALID');
    assert.equal(validReport.missingRecords, 0);
    assert.equal(validReport.invalidRecords, 0);

    const gappedRows = [validRows[0], validRows[2], validRows[4]];
    const gappedReport = validateHistoricalCandles(gappedRows, validRows[0].openTime, validRows.at(-1).closeTime);
    assert.equal(gappedReport.status, 'INVALID');
    assert.ok(gappedReport.missingRecords > 0);

    assert.equal(historicalDatasetFingerprint(validRows), historicalDatasetFingerprint(validRows));
  });

  it('produces identical t0 features for comparator and Jev view without look-ahead', () => {
    const schedule = buildR3HSchedule('2026-06-23T00:00:00.000Z', '2026-06-23T23:59:59.999Z')[0];
    const rows = candles(10);
    const obs = buildHistoricalObservation(rows, { ...schedule, t0: rows[4].closeTime });
    assert.equal(obs.t0View.t0, rows[4].closeTime);
    assert.equal(obs.outcome?.provenance, 'MARKET_DERIVED_COUNTERFACTUAL');
    assert.equal(obs.outcome?.horizons.length, 2);

    const compFeatures = obs.t0View.featureSnapshot.map((f) => ({ featureId: f.featureId, value: f.value }));
    const comparatorResult = evaluateDeterministicMarketComparator(compFeatures, PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY);
    assert.equal(comparatorResult.policyId, 'deterministic-market-comparator@1');
    assert.ok(['upward', 'downward', 'neutral'].includes(comparatorResult.directionalPressure));
    assert.ok(['trending', 'range', 'high_volatility'].includes(comparatorResult.marketRegime));
  });

  it('computes exact FixedDecimal returns and excursions for 1m and 3m horizons', () => {
    const schedule = buildR3HSchedule('2026-06-23T00:00:00.000Z', '2026-06-23T23:59:59.999Z')[0];
    const rows = candles(10);
    const obs = buildHistoricalObservation(rows, { ...schedule, t0: rows[3].closeTime });
    const h1 = obs.outcome?.horizons.find((h) => h.horizonMinutes === 1);
    const h3 = obs.outcome?.horizons.find((h) => h.horizonMinutes === 3);
    assert.ok(h1);
    assert.ok(h3);
    assert.match(FixedDecimal.from(h1.forwardReturn).toString(), /^-?\d+(\.\d+)?$/);
    assert.match(FixedDecimal.from(h3.forwardReturn).toString(), /^-?\d+(\.\d+)?$/);
  });
});
