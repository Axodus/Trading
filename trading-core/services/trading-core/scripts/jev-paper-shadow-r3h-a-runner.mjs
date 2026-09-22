import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildHistoricalObservation,
  buildR3HSchedule,
  createHistoricalFutureOutcomeView,
  createHistoricalT0View,
  createMarketReadingSnapshot,
  evaluateDeterministicMarketComparator,
  historicalDatasetFingerprint,
  JevDecisionProvider,
  JEV_SHADOW_PAPER_R2_MARKET_READER_QUESTION_SET_V1,
  PAPER_R2_OUTCOME_HORIZON_POLICY,
  PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY,
  R3H_POLICIES,
  shadowDigest,
  validateHistoricalCandles,
  comparePaperR3Direction,
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/index.js';
import { FixedDecimal } from '../../../../dist/services/trading-core/trading-core/packages/trading-contracts/src/index.js';

loadLocalEnv();
const configured = Boolean(process.env.TRADING_TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_AI_API_KEY);
if (!configured) {
  console.error('BLOCKED: TRADING_TYPESAFE_API_KEY not configured.');
  process.exit(2);
}
if (process.env.AXODUS_TRADING_ALLOW_TESTNET_MUTATION === 'true') {
  console.error('BLOCKED: AXODUS_TRADING_ALLOW_TESTNET_MUTATION must not be enabled for R3H.');
  process.exit(2);
}

const SYMBOL = 'BTCUSDT';
const INTERVAL = '1m';
const HISTORICAL_START = '2026-06-23T00:00:00.000Z';
const HISTORICAL_END = '2026-09-20T23:59:59.999Z';
const R3E_START = '2026-09-21T17:08:59.999Z';
const REQUESTED_MODEL = 'jev-1.13.0';
const EXPERIMENT = Object.freeze({ experimentId: 'jev-paper-shadow-r3h-historical-counterfactual-replay', experimentVersion: '1' });
const QUESTION_SET = Object.freeze({ questionSetId: 'jev-paper-r2-market-reader', questionSetVersion: '1' });

console.log('[R3H-A] 1. Acquiring 90-day historical OHLCV data...');
const rawCandles = await acquire90DayCandles(HISTORICAL_START, HISTORICAL_END);
console.log(`[R3H-A] Acquired ${rawCandles.length} 1m candles.`);

console.log('[R3H-A] 2. Validating historical dataset integrity and continuity...');
const datasetReport = validateHistoricalCandles(rawCandles, HISTORICAL_START, HISTORICAL_END);
console.log('[R3H-A] Dataset Report:', JSON.stringify(datasetReport, null, 2));

if (datasetReport.status !== 'VALID') {
  console.error('BLOCKED: Historical dataset validation failed:', datasetReport);
  process.exit(3);
}

console.log('[R3H-A] 3. Freezing 90-day sampling schedule (1,080 entries: 12/day)...');
const schedule = buildR3HSchedule(HISTORICAL_START, HISTORICAL_END);
console.log(`[R3H-A] Total schedule entries: ${schedule.length}`);
console.log(`[R3H-A] Discovery: ${schedule.filter(s => s.partition === 'DISCOVERY').length}`);
console.log(`[R3H-A] Validation: ${schedule.filter(s => s.partition === 'VALIDATION').length}`);
console.log(`[R3H-A] Holdout (sealed): ${schedule.filter(s => s.partition === 'HOLDOUT').length}`);

// For R3H-A pipeline validation gate: select 24 principal observations deterministically
// (every 45th observation across the 1080 schedule to cover all 90 days and partitions)
const r3hAPrincipalIndices = Array.from({ length: 24 }, (_, i) => i * 45);
const r3hASchedule = r3hAPrincipalIndices.map(idx => schedule[idx]);
console.log(`[R3H-A] Selected ${r3hASchedule.length} principal observations for R3H-A gate validation.`);

const provider = JevDecisionProvider.fromEnvironment(process.env);
const records = [];
const startedAt = new Date().toISOString();

console.log('[R3H-A] 4. Executing R3H-A principal inference with strict t0 isolation...');
for (let i = 0; i < r3hASchedule.length; i++) {
  const entry = r3hASchedule[i];
  console.log(`[R3H-A PRINCIPAL ${i+1}/${r3hASchedule.length}] ${entry.observationId} (${entry.partition}) at ${entry.t0}`);
  const obs = buildHistoricalObservation(rawCandles, entry);

  // Strict anti-lookahead check
  if (!obs.t0View.candlesAtOrBeforeT0.every(c => c.closeTime <= obs.t0View.t0)) {
    throw new Error(`LOOK_AHEAD_VIOLATION: t0View contains future candle for ${entry.observationId}`);
  }
  if (!obs.futureOutcomeView.candlesAfterT0.every(c => c.closeTime > obs.t0View.t0)) {
    throw new Error(`LOOK_AHEAD_VIOLATION: futureOutcomeView contains past candle for ${entry.observationId}`);
  }

  const snapshot = createMarketReadingSnapshotFromT0View(obs.t0View, entry);
  const providerObservation = await evaluate(provider, snapshot, 'principal');
  ensureResolvedModel(providerObservation);

  const comparatorResult = evaluateDeterministicMarketComparator(
    obs.t0View.featureSnapshot.map(f => ({ featureId: f.featureId, value: f.value })),
    PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY
  );

  records.push({
    cohort: 'PRINCIPAL',
    hypothesis: 'H2_MARKET_STATE_READER',
    instrument: SYMBOL,
    observationId: entry.observationId,
    partition: entry.partition,
    snapshotId: snapshot.snapshotId,
    marketStateRef: snapshot.marketStateRef,
    capturedAt: entry.t0,
    samplingTrigger: 'SCHEDULED_HISTORICAL_INTERVAL',
    snapshot,
    t0ViewDigest: obs.t0View.inputDigest,
    futureOutcomeViewDigest: obs.futureOutcomeView.inputDigest,
    deterministicComparator: comparatorResult,
    observation: providerObservation,
    outcome: obs.outcome,
    outcomeProvenance: 'MARKET_DERIVED_COUNTERFACTUAL',
  });
}

console.log('[R3H-A] 5. Running stability probes on 3 representative snapshots (3 repeats each)...');
const stabilitySnapshots = [records[0], records[10], records[20]].filter(Boolean);
for (const principalRecord of stabilitySnapshots) {
  const snapshot = principalRecord.snapshot;
  for (let repeat = 1; repeat <= 3; repeat++) {
    console.log(`[R3H-A STABILITY] ${snapshot.marketStateRef} repeat ${repeat}/3`);
    const observation = await evaluate(provider, snapshot, `stability-${repeat}`);
    ensureResolvedModel(observation);
    records.push({
      cohort: 'STABILITY_PROBE',
      hypothesis: 'PROVIDER_STABILITY',
      instrument: SYMBOL,
      observationId: `${principalRecord.observationId}-stability-${repeat}`,
      partition: principalRecord.partition,
      snapshotId: snapshot.snapshotId,
      marketStateRef: snapshot.marketStateRef,
      capturedAt: snapshot.capturedAt,
      samplingTrigger: 'STABILITY_REPRESENTATIVE_STATE',
      observation,
      outcomeProvenance: 'NO_DEFENSIBLE_OUTCOME',
    });
  }
}

const completedAt = new Date().toISOString();
const analysis = analyzeR3H(records, startedAt, completedAt, datasetReport);

const outDir = resolve(process.cwd(), '../../../.instructions/reports');
mkdirSync(outDir, { recursive: true });

const schedulePath = resolve(outDir, 'AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3H-SAMPLING-SCHEDULE.json');
writeFileSync(schedulePath, JSON.stringify({
  scope: 'PAPER_SHADOW_R3H_SAMPLING_SCHEDULE',
  historicalStart: HISTORICAL_START,
  historicalEnd: HISTORICAL_END,
  totalEntries: schedule.length,
  policy: R3H_POLICIES.samplingPolicyId,
  schedule,
}, null, 2));

const resultsPath = resolve(outDir, 'AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3H-A-RESULTS.json');
writeFileSync(resultsPath, JSON.stringify({
  scope: 'PAPER_SHADOW_R3H_A_PIPELINE_VALIDATION',
  caveat: 'Historical counterfactual replay with strict t0 isolation. Jev remains SHADOW-only with zero execution authority.',
  policies: {
    experiment: EXPERIMENT,
    questionSet: QUESTION_SET,
    samplingPolicyId: R3H_POLICIES.samplingPolicyId,
    featurePolicyId: R3H_POLICIES.featurePolicyId,
    comparatorPolicyId: R3H_POLICIES.comparatorPolicyId,
    outcomeHorizonPolicyId: R3H_POLICIES.outcomeHorizonPolicyId,
    referencePricePolicyId: R3H_POLICIES.referencePricePolicyId,
    model: { requestedModel: REQUESTED_MODEL, resolvedModels: analysis.model.resolvedModels },
  },
  dataset: datasetReport,
  externalMutationCounters: {
    jevPaperApiCalls: records.length,
    historicalMarketReadCalls: Math.ceil(rawCandles.length / 1500),
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

console.log('\n[R3H-A SUMMARY]\n', JSON.stringify(analysis, null, 2));
console.log(`\nArtifacts persisted:\n- ${schedulePath}\n- ${resultsPath}`);
async function acquire90DayCandles(start, end) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  const candles = [];
  let currentStart = startMs;
  const limit = 1500;
  while (currentStart <= endMs) {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${SYMBOL}&interval=${INTERVAL}&startTime=${currentStart}&limit=${limit}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Axodus-Research-Historical-ReadOnly/1.0' } });
    if (!res.ok) throw new Error(`HISTORICAL_MARKET_DATA_HTTP_${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const row of data) {
      const openTimeMs = Number(row[0]);
      const closeTimeMs = Number(row[6]);
      if (openTimeMs > endMs) break;
      candles.push({
        symbol: SYMBOL,
        interval: '1m',
        openTimeMs,
        closeTimeMs,
        openTime: new Date(openTimeMs).toISOString(),
        closeTime: new Date(closeTimeMs).toISOString(),
        open: String(row[1]),
        high: String(row[2]),
        low: String(row[3]),
        close: String(row[4]),
        volume: String(row[5]),
        source: 'binance-usdm-futures-public-klines',
        retrievalTimestamp: new Date().toISOString(),
        sourceRef: `binance-fapi-kline:${SYMBOL}:${INTERVAL}:${row[0]}`,
      });
    }
    const lastRow = data[data.length - 1];
    const nextStart = Number(lastRow[0]) + 60_000;
    if (nextStart <= currentStart) break;
    currentStart = nextStart;
  }
  return candles;
}

function createMarketReadingSnapshotFromT0View(t0View, entry) {
  const features = t0View.featureSnapshot.map(f => ({
    featureId: f.featureId,
    featureVersion: f.featureVersion,
    value: f.value,
    computedAt: f.computedAt,
  }));
  const marketState = {
    marketStateId: `market-r3h-${t0View.t0}`,
    instrument: SYMBOL,
    venue: 'binance-usdm-futures-public',
    timeframe: INTERVAL,
    marketTime: t0View.t0,
    observedAt: t0View.t0,
    constructedAt: t0View.t0,
    validityContext: 'historical',
    freshness: 'historical',
    schemaVersion: 'paper-r2-marketstate@1',
    features,
    sourceRefs: [t0View.candlesAtOrBeforeT0.at(-1)?.sourceRef ?? ''],
    completeness: 'complete',
    validationRefs: ['binance-public-kline-schema@1'],
    qualityStatus: 'valid',
    sequenceStatus: 'sequenced',
  };
  return createMarketReadingSnapshot({
    environment: 'PAPER',
    capturedAt: t0View.t0,
    marketState,
    experiment: EXPERIMENT,
    questionSet: QUESTION_SET,
    requestedProvider: 'typesafe-jev',
    requestedModel: REQUESTED_MODEL,
    correlationId: `r3h-${entry.observationId}`,
    samplingTrigger: 'SCHEDULED_HISTORICAL_INTERVAL',
    samplingPolicyId: R3H_POLICIES.samplingPolicyId,
    featurePolicyId: R3H_POLICIES.featurePolicyId,
    outcomeHorizonPolicyId: R3H_POLICIES.outcomeHorizonPolicyId,
    referencePricePolicyId: R3H_POLICIES.referencePricePolicyId,
  });
}

async function evaluate(provider, snapshot, attemptId) {
  const request = {
    requestId: `r3h-${snapshot.snapshotId}-${attemptId}`,
    snapshot,
    questions: JEV_SHADOW_PAPER_R2_MARKET_READER_QUESTION_SET_V1,
    requestedAt: new Date().toISOString(),
    timeoutMs: 15_000,
    inputDigest: shadowDigest({ snapshotId: snapshot.snapshotId, attemptId }),
  };
  return await provider.evaluate(request);
}

function ensureResolvedModel(obs) {
  if (obs.status === 'SUCCEEDED' && obs.resolvedModel !== REQUESTED_MODEL) {
    throw new Error(`JEV_MODEL_MISMATCH:${obs.resolvedModel}`);
  }
}

function analyzeR3H(records, startedAt, completedAt, datasetReport) {
  const principal = records.filter(r => r.cohort === 'PRINCIPAL');
  const stability = records.filter(r => r.cohort === 'STABILITY_PROBE');
  const successful = records.filter(r => r.observation.status === 'SUCCEEDED');
  const latencies = successful.map(r => r.observation.totalProviderWallTimeMs).sort((a, b) => a - b);
  const totalTokens = successful.reduce((sum, r) => sum + (r.observation.usage?.inputTokens ?? 0) + (r.observation.usage?.outputTokens ?? 0), 0);
  const inputTokens = successful.reduce((sum, r) => sum + (r.observation.usage?.inputTokens ?? 0), 0);
  const estimatedUsd = (inputTokens * 0.042 / 1_000_000).toFixed(8);

  const byRegime = counts(principal.map(r => answer(r, 'market_regime') ?? 'failure'));
  const byDirection = counts(principal.map(r => answer(r, 'directional_pressure') ?? 'failure'));
  const compDirection = counts(principal.map(r => r.deterministicComparator?.directionalPressure ?? 'missing'));
  const compRegime = counts(principal.map(r => r.deterministicComparator?.marketRegime ?? 'missing'));

  const comparatorComparison = Object.fromEntries(
    PAPER_R2_OUTCOME_HORIZON_POLICY.horizonsMinutes.map(h => [h, comparePaperR3Direction(principal, h)])
  );

  return {
    pipelineValidationStatus: datasetReport.status === 'VALID' && principal.length >= 20 ? 'R3H_PIPELINE_ACCEPTED' : 'R3H_PIPELINE_REQUIRES_FIX',
    model: { requestedModel: REQUESTED_MODEL, resolvedModels: [...new Set(successful.map(r => r.observation.resolvedModel).filter(Boolean))] },
    volume: {
      principalObservations: principal.length,
      completedOutcomes: principal.filter(r => r.outcomeProvenance === 'MARKET_DERIVED_COUNTERFACTUAL').length,
      stabilityProbes: stability.length,
      providerSuccesses: successful.length,
      providerFailures: records.filter(r => r.observation.status !== 'SUCCEEDED').length,
      abstentions: principal.filter(r => answer(r, 'state_sufficiency') === 'insufficient' || answer(r, 'market_regime') === 'uncertain').length,
    },
    latencyMs: summarize(latencies),
    cost: {
      inputTokens,
      outputTokens: successful.reduce((sum, r) => sum + (r.observation.usage?.outputTokens ?? 0), 0),
      totalTokens,
      estimatedUsd,
      estimatedUsdPerObservation: successful.length ? (Number(estimatedUsd) / successful.length).toFixed(8) : '0',
    },
    h2: {
      regimeDistribution: byRegime,
      directionalPressureDistribution: byDirection,
      comparatorDirectionDistribution: compDirection,
      comparatorRegimeDistribution: compRegime,
      comparatorComparison,
      lookaheadTested: true,
      t0IsolationVerified: true,
    },
    stability: stabilitySummary(stability),
  };
}

function answer(record, id) { return record.observation.answers?.find(a => a.questionId === id)?.value; }
function counts(values) { return Object.fromEntries([...new Set(values)].sort().map(v => [v, values.filter(x => x === v).length])); }
function summarize(values) { if (!values.length) return null; const pick = (p) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))]; return { n: values.length, min: values[0], p50: pick(.5), p95: pick(.95), p99: pick(.99), max: values.at(-1) }; }
function stabilitySummary(records) {
  const bySnapshot = new Map();
  for (const record of records) {
    const arr = bySnapshot.get(record.snapshotId) ?? [];
    arr.push(record);
    bySnapshot.set(record.snapshotId, arr);
  }
  const perSnapshot = [];
  for (const [snapshotId, rows] of bySnapshot.entries()) {
    perSnapshot.push({ snapshotId, n: rows.length, marketRegimeTopClasses: counts(rows.map(r => answer(r, 'market_regime') ?? 'failure')) });
  }
  return { snapshots: bySnapshot.size, observations: records.length, perSnapshot };
}
function loadLocalEnv() {
  const envFile = resolve(process.cwd(), '../../../.env.local');
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separator = normalized.indexOf('=');
    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
