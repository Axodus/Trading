import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  calculateMarketDerivedOutcome,
  createMarketReadingSnapshot,
  JevDecisionProvider,
  JEV_SHADOW_PAPER_R2_MARKET_READER_QUESTION_SET_V1,
  PAPER_R2_OUTCOME_HORIZON_POLICY,
  shadowDigest,
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/index.js';
import { FixedDecimal } from '../../../../dist/services/trading-core/trading-core/packages/trading-contracts/src/index.js';

const EXPERIMENT = Object.freeze({ experimentId: 'jev-paper-shadow-r2-outcome-labeled-market-reading', experimentVersion: '1' });
const QUESTION_SET = Object.freeze({ questionSetId: 'jev-paper-r2-market-reader', questionSetVersion: '1' });
const SAMPLING_POLICY_ID = 'paper-r2-sampling@1';
const FEATURE_POLICY_ID = 'paper-r2-candle-features@1';
const REFERENCE_PRICE_POLICY_ID = 'candle-close@1';
const REQUESTED_MODEL = 'jev-1.13.0';
const SYMBOL = 'BTCUSDT';
const INTERVAL = '1m';
const LIMIT = 96;
const PRINCIPAL_COUNT = 12;
const STABILITY_PROBE_SNAPSHOTS = 3;
const STABILITY_REPEATS = 3;
const BINANCE_TESTNET_KLINES_URL = `https://testnet.binancefuture.com/fapi/v1/klines?symbol=${SYMBOL}&interval=${INTERVAL}&limit=${LIMIT}`;

loadLocalEnv();
const configured = Boolean(process.env.TRADING_TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_AI_API_KEY);
if (!configured) {
  console.error('BLOCKED: TRADING_TYPESAFE_API_KEY not configured.');
  process.exit(2);
}
if (process.env.AXODUS_TRADING_ALLOW_TESTNET_MUTATION === 'true') {
  console.error('BLOCKED: AXODUS_TRADING_ALLOW_TESTNET_MUTATION must not be enabled for PAPER R2.');
  process.exit(2);
}

const campaignStartedAt = new Date().toISOString();
const provider = JevDecisionProvider.fromEnvironment(process.env);
const records = [];

// Principal records are captured at their real t0 boundary.  The provider only
// sees the immutable t0 snapshot; outcomes are fetched after the frozen horizon
// has matured.  Do not replace this with replaying already-matured candles.
let previousCaptureAt;
for (let sample = 0; sample < PRINCIPAL_COUNT; sample += 1) {
  if (previousCaptureAt) await waitForNextClosedCandle(previousCaptureAt);
  const candles = await fetchClosedCandles();
  assertCandles(candles, 1);
  const snapshot = createSnapshot(candles, candles.length - 1, 'CLOSED_CANDLE_INTERVAL');
  console.log(`[R2 PRINCIPAL] ${snapshot.marketStateRef} ${snapshot.capturedAt}`);
  const observation = await evaluate(provider, snapshot, 'principal');
  ensureResolvedModel(observation);
  records.push({
    cohort: 'PRINCIPAL',
    hypothesis: 'H2_MARKET_STATE_READER',
    instrument: SYMBOL,
    snapshotId: snapshot.snapshotId,
    marketStateRef: snapshot.marketStateRef,
    capturedAt: snapshot.capturedAt,
    samplingTrigger: 'CLOSED_CANDLE_INTERVAL',
    snapshot,
    observation,
    outcomeProvenance: 'PENDING_HORIZON_MATURITY',
  });
  previousCaptureAt = snapshot.capturedAt;
}

for (const record of records.slice(0, STABILITY_PROBE_SNAPSHOTS)) {
  const snapshot = record.snapshot;
  for (let repeat = 1; repeat <= STABILITY_REPEATS; repeat += 1) {
    console.log(`[R2 STABILITY] ${snapshot.marketStateRef} repeat ${repeat}/${STABILITY_REPEATS}`);
    const observation = await evaluate(provider, snapshot, `stability-${repeat}`);
    ensureResolvedModel(observation);
    records.push({
      cohort: 'STABILITY_PROBE',
      hypothesis: 'PROVIDER_STABILITY',
      instrument: SYMBOL,
      snapshotId: snapshot.snapshotId,
      marketStateRef: snapshot.marketStateRef,
      capturedAt: snapshot.capturedAt,
      samplingTrigger: 'STABILITY_REPRESENTATIVE_STATE',
      observation,
      outcomeProvenance: 'NO_DEFENSIBLE_OUTCOME',
    });
  }
}

const principalRecords = records.filter((candidate) => candidate.cohort === 'PRINCIPAL');
await waitForHorizonMaturity(principalRecords.at(-1)?.capturedAt);
const outcomeCandles = await fetchClosedCandles();
assertCandles(outcomeCandles, Math.max(...PAPER_R2_OUTCOME_HORIZON_POLICY.horizonsMinutes));
for (const record of principalRecords) {
  try {
    record.outcome = calculateMarketDerivedOutcome(record.capturedAt, outcomeCandles);
    record.outcomeProvenance = 'MARKET_DERIVED_COUNTERFACTUAL';
  } catch (error) {
    if (!(error instanceof Error) || !['OUTCOME_FUTURE_DATA_MISSING', 'OUTCOME_T0_NOT_FOUND'].includes(error.message)) throw error;
    record.outcomeProvenance = 'NO_DEFENSIBLE_OUTCOME';
    record.outcomeFailureCode = error.message;
  }
}

const analysis = analyze(records, campaignStartedAt, new Date().toISOString());
const outDir = resolve(process.cwd(), '../../../.instructions/reports');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'AXODUS-TRADING-IMP-02-PAPER-SHADOW-R2-RESULTS.json');
writeFileSync(outPath, JSON.stringify({
  scope: 'PAPER_SHADOW_R2_OUTCOME_LABELED_MARKET_READING',
  caveat: 'Market-derived counterfactual labels are deterministic candle-close outcomes, not observed execution. Jev remains SHADOW-only.',
  policies: {
    experiment: EXPERIMENT,
    questionSet: QUESTION_SET,
    samplingPolicyId: SAMPLING_POLICY_ID,
    featurePolicyId: FEATURE_POLICY_ID,
    outcomeHorizonPolicy: PAPER_R2_OUTCOME_HORIZON_POLICY,
    referencePricePolicyId: REFERENCE_PRICE_POLICY_ID,
    model: { requestedModel: REQUESTED_MODEL, resolvedModels: analysis.model.resolvedModels },
  },
  marketData: {
    source: 'Binance USD-M Futures Testnet public klines',
    endpoint: 'GET /fapi/v1/klines',
    url: BINANCE_TESTNET_KLINES_URL.replace(/https:\/\/[^/]+/, 'https://testnet.binancefuture.com'),
    networkClass: 'NETWORK_READONLY',
    rows: outcomeCandles.length,
    firstCloseTime: outcomeCandles[0]?.closeTime,
    lastCloseTime: outcomeCandles.at(-1)?.closeTime,
  },
  externalMutationCounters: {
    jevPaperApiCalls: records.length,
    marketDataReadonlyCalls: PRINCIPAL_COUNT + 1,
    exchangeTestnetOrderPost: 0,
    exchangeTestnetOrderDelete: 0,
    exchangeTestnetOtherMutation: 0,
    exchangeMainnetOrderPost: 0,
    exchangeMainnetOrderDelete: 0,
    exchangeMainnetOtherMutation: 0,
    realCapitalMutation: 0,
  },
  records,
  analysis,
}, null, 2));
console.log('\n[R2 ANALYSIS]\n');
console.log(JSON.stringify(analysis, null, 2));
console.log(`\nSaved to ${outPath}`);

async function fetchClosedCandles() {
  const response = await fetch(BINANCE_TESTNET_KLINES_URL, { headers: { 'User-Agent': 'Axodus-Research-ReadOnly/1.0' } });
  if (!response.ok) throw new Error(`MARKET_DATA_READONLY_HTTP_${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('MARKET_DATA_READONLY_SCHEMA_INVALID');
  const now = Date.now();
  return body.map(normalizeKline).filter((candle) => Date.parse(candle.closeTime) <= now);
}

function normalizeKline(row) {
  if (!Array.isArray(row) || row.length < 7) throw new Error('KLINE_ROW_INVALID');
  return {
    openTime: new Date(Number(row[0])).toISOString(),
    open: String(row[1]),
    high: String(row[2]),
    low: String(row[3]),
    close: String(row[4]),
    volume: String(row[5]),
    closeTime: new Date(Number(row[6])).toISOString(),
    sourceRef: `binance-testnet-kline:${SYMBOL}:${INTERVAL}:${row[0]}`,
  };
}

function assertCandles(candles, requiredFutureRows) {
  if (candles.length < requiredFutureRows + 2) throw new Error('INSUFFICIENT_MARKET_DATA_ROWS');
  for (let i = 1; i < candles.length; i += 1) if (candles[i - 1].closeTime >= candles[i].closeTime) throw new Error('MARKET_DATA_ORDER_INVALID');
}

async function waitForNextClosedCandle(previousCaptureAt) {
  for (;;) {
    const now = Date.now();
    const nextMinuteBoundary = Math.floor(now / 60_000 + 1) * 60_000 + 1_500;
    await sleep(Math.max(1_000, nextMinuteBoundary - now));
    const candles = await fetchClosedCandles();
    if (candles.at(-1)?.closeTime !== previousCaptureAt) return;
  }
}

async function waitForHorizonMaturity(capturedAt) {
  if (!capturedAt) throw new Error('R2_MISSING_FINAL_CAPTURE');
  const horizonMs = Math.max(...PAPER_R2_OUTCOME_HORIZON_POLICY.horizonsMinutes) * 60_000;
  const target = Date.parse(capturedAt) + horizonMs + 2_000;
  await sleep(Math.max(0, target - Date.now()));
}

function sleep(ms) { return new Promise((resolveSleep) => setTimeout(resolveSleep, ms)); }

function createSnapshot(candles, index, trigger) {
  const candle = candles[index];
  const previous = candles[index - 1] ?? candle;
  const features = [
    { featureId: 'reference_close', featureVersion: 'paper-r2-candle-features@1', value: candle.close, unit: 'USDT', computedAt: candle.closeTime },
    { featureId: 'candle_return_1m', featureVersion: 'paper-r2-candle-features@1', value: decimalReturn(candle.close, previous.close), computedAt: candle.closeTime },
    { featureId: 'candle_range_ratio', featureVersion: 'paper-r2-candle-features@1', value: decimalRatio(decimalSub(candle.high, candle.low), candle.close), computedAt: candle.closeTime },
    { featureId: 'candle_body_ratio', featureVersion: 'paper-r2-candle-features@1', value: decimalRatio(decimalSub(candle.close, candle.open), candle.close), computedAt: candle.closeTime },
    { featureId: 'volume', featureVersion: 'paper-r2-candle-features@1', value: candle.volume, unit: 'base', computedAt: candle.closeTime },
  ];
  const marketState = {
    marketStateId: `market-r2-${candle.closeTime}`,
    instrument: SYMBOL,
    venue: 'binance-usdm-futures-testnet-public',
    timeframe: INTERVAL,
    marketTime: candle.closeTime,
    observedAt: candle.closeTime,
    constructedAt: candle.closeTime,
    validityContext: 'paper',
    freshness: 'historical',
    schemaVersion: 'paper-r2-marketstate@1',
    features,
    sourceRefs: [candle.sourceRef],
    completeness: 'partial',
    validationRefs: ['binance-public-kline-schema@1'],
    qualityStatus: 'valid',
    sequenceStatus: 'sequenced',
  };
  return createMarketReadingSnapshot({
    environment: 'PAPER',
    capturedAt: candle.closeTime,
    marketState,
    experiment: EXPERIMENT,
    questionSet: QUESTION_SET,
    requestedProvider: 'typesafe-jev',
    requestedModel: REQUESTED_MODEL,
    correlationId: `r2-${candle.closeTime}`,
    samplingTrigger: trigger,
    samplingPolicyId: SAMPLING_POLICY_ID,
    featurePolicyId: FEATURE_POLICY_ID,
    outcomeHorizonPolicyId: PAPER_R2_OUTCOME_HORIZON_POLICY.policyId,
    referencePricePolicyId: REFERENCE_PRICE_POLICY_ID,
  });
}

async function evaluate(provider, snapshot, attemptId) {
  const request = {
    requestId: `r2-${snapshot.snapshotId}-${attemptId}`,
    snapshot,
    questions: JEV_SHADOW_PAPER_R2_MARKET_READER_QUESTION_SET_V1,
    requestedAt: new Date().toISOString(),
    timeoutMs: 15_000,
    inputDigest: shadowDigest({ snapshotId: snapshot.snapshotId, attemptId }),
  };
  return await provider.evaluate(request);
}

function ensureResolvedModel(observation) {
  if (observation.status === 'SUCCEEDED' && observation.resolvedModel !== REQUESTED_MODEL) throw new Error(`JEV_MODEL_MISMATCH:${observation.resolvedModel}`);
}

function analyze(records, startedAt, completedAt) {
  const principal = records.filter((r) => r.cohort === 'PRINCIPAL');
  const stability = records.filter((r) => r.cohort === 'STABILITY_PROBE');
  const successful = records.filter((r) => r.observation.status === 'SUCCEEDED');
  const latencies = successful.map((r) => r.observation.totalProviderWallTimeMs).sort((a, b) => a - b);
  const durationHours = Math.max(1 / 3600, (Date.parse(completedAt) - Date.parse(startedAt)) / 3_600_000);
  const totalTokens = successful.reduce((sum, r) => sum + (r.observation.usage?.inputTokens ?? 0) + (r.observation.usage?.outputTokens ?? 0), 0);
  const estimatedUsd = (successful.reduce((sum, r) => sum + (r.observation.usage?.inputTokens ?? 0), 0) * 0.042 / 1_000_000).toFixed(8);
  return {
    status: 'INSUFFICIENT_EVIDENCE_PRELIMINARY_DATASET',
    model: { requestedModel: REQUESTED_MODEL, resolvedModels: [...new Set(successful.map((r) => r.observation.resolvedModel).filter(Boolean))] },
    volume: {
      principalObservations: principal.length,
      completedOutcomes: principal.filter((r) => r.outcomeProvenance === 'MARKET_DERIVED_COUNTERFACTUAL').length,
      noDefensibleOutcome: principal.filter((r) => r.outcomeProvenance === 'NO_DEFENSIBLE_OUTCOME').length,
      stabilityProbes: stability.length,
      abstentions: principal.filter((r) => answer(r, 'state_sufficiency') === 'insufficient' || answer(r, 'market_regime') === 'uncertain').length,
      failures: records.filter((r) => r.observation.status !== 'SUCCEEDED').length,
    },
    latencyMs: summarize(latencies),
    h2: h2Summary(principal),
    h1: { organicTradeProposalObservations: 0, disposition: 'NOT_APPLICABLE_IN_R2_MARKET_READER_COHORT' },
    stability: stabilitySummary(stability),
    cadence: {
      campaignDurationHours: Number(durationHours.toFixed(6)),
      observationsPerHourActualWallClock: Number((principal.length / durationHours).toFixed(4)),
      marketSamplingWindowMinutes: principal.length,
      principalSamplingPolicy: SAMPLING_POLICY_ID,
    },
    cost: {
      inputTokens: successful.reduce((sum, r) => sum + (r.observation.usage?.inputTokens ?? 0), 0),
      outputTokens: successful.reduce((sum, r) => sum + (r.observation.usage?.outputTokens ?? 0), 0),
      totalTokens,
      estimatedUsd,
      estimatedUsdPerObservation: successful.length ? (Number(estimatedUsd) / successful.length).toFixed(8) : '0',
      projectedUsdPerDayAtObservedWallClock: (Number(estimatedUsd) / durationHours * 24).toFixed(4),
      projectedUsdPer30DaysAtObservedWallClock: (Number(estimatedUsd) / durationHours * 24 * 30).toFixed(2),
    },
    externalMutationCounters: { exchangeTestnetOrderPost: 0, exchangeTestnetOrderDelete: 0, exchangeMainnetOrderPost: 0, exchangeMainnetOrderDelete: 0, realCapitalMutation: 0 },
  };
}

function h2Summary(principal) {
  const byRegime = counts(principal.map((r) => answer(r, 'market_regime') ?? 'failure'));
  const byDirection = counts(principal.map((r) => answer(r, 'directional_pressure') ?? 'failure'));
  const horizonReturns = {};
  for (const horizon of PAPER_R2_OUTCOME_HORIZON_POLICY.horizonsMinutes) {
    const outcomes = principal.map((r) => r.outcome?.horizons.find((h) => h.horizonMinutes === horizon)).filter(Boolean);
    horizonReturns[`${horizon}m`] = {
      n: outcomes.length,
      positive: outcomes.filter((h) => !String(h.forwardReturn).startsWith('-') && h.forwardReturn !== '0').length,
      negative: outcomes.filter((h) => String(h.forwardReturn).startsWith('-')).length,
      rangeOutcomes: outcomes.filter((h) => h.regimeOutcome === 'RANGE').length,
      avgForwardReturn: averageExact(outcomes.map((h) => h.forwardReturn)),
    };
  }
  return { regimeDistribution: byRegime, directionalPressureDistribution: byDirection, horizonReturns, calibrationStatus: principal.length < 30 ? 'NOT_SCORABLE_SMALL_N' : 'EXPLORATORY_ONLY', incrementalInformationStatus: 'NOT_DETERMINABLE_SMALL_N_BASELINE_MODEL_NOT_FIT' };
}

function stabilitySummary(records) {
  const bySnapshot = new Map();
  for (const record of records) {
    const arr = bySnapshot.get(record.snapshotId) ?? [];
    arr.push(record);
    bySnapshot.set(record.snapshotId, arr);
  }
  const perSnapshot = [];
  for (const [snapshotId, rows] of bySnapshot.entries()) {
    perSnapshot.push({ snapshotId, n: rows.length, marketRegimeTopClasses: counts(rows.map((r) => answer(r, 'market_regime') ?? 'failure')), maxMarketRegimeProbabilityDelta: maxProbabilityDelta(rows, 'market_regime') });
  }
  return { snapshots: bySnapshot.size, observations: records.length, perSnapshot };
}

function answer(record, id) { return record.observation.answers?.find((a) => a.questionId === id)?.value; }
function counts(values) { return Object.fromEntries([...new Set(values)].sort().map((v) => [v, values.filter((x) => x === v).length])); }
function summarize(values) { if (!values.length) return null; const pick = (p) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))]; return { n: values.length, min: values[0], p50: pick(.5), p95: pick(.95), p99: pick(.99), max: values.at(-1) }; }
function maxProbabilityDelta(records, questionId) { const vectors = records.map((r) => r.observation.answers?.find((a) => a.questionId === questionId)?.probabilities).filter(Boolean); if (vectors.length < 2) return null; const keys = new Set(vectors.flatMap((v) => Object.keys(v))); let max = 0; for (const key of keys) { const values = vectors.map((v) => v[key] ?? 0); max = Math.max(max, Math.max(...values) - Math.min(...values)); } return Number(max.toFixed(6)); }
function averageExact(values) { return values.length ? values.map((value) => FixedDecimal.from(value)).reduce((sum, value) => sum.add(value), FixedDecimal.zero()).div(BigInt(values.length)).toString() : null; }
function decimalSub(a, b) { return FixedDecimal.from(a).sub(b).toString(); }
function decimalReturn(a, b) { return FixedDecimal.from(a).sub(b).div(b).toString(); }
function decimalRatio(a, b) { return FixedDecimal.from(a).div(b).toString(); }
function loadLocalEnv() { const envFile = resolve(process.cwd(), '../../../.env.local'); if (!existsSync(envFile)) return; for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) { const trimmed = line.trim(); if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue; const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed; const separator = normalized.indexOf('='); const key = normalized.slice(0, separator).trim(); let value = normalized.slice(separator + 1).trim(); if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1); if (!(key in process.env)) process.env[key] = value; } }
