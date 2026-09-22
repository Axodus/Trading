import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildHistoricalObservation,
  buildR3HSchedule,
  createMarketReadingSnapshot,
  evaluateDeterministicMarketComparator,
  JevDecisionProvider,
  JEV_SHADOW_PAPER_R2_MARKET_READER_QUESTION_SET_V1,
  PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY,
  R3H_POLICIES,
  shadowDigest,
  validateHistoricalCandles,
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/index.js';

loadLocalEnv();
if (!hasJevCredential()) {
  console.error('BLOCKED: Jev credential is not configured.');
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
const REQUESTED_MODEL = 'jev-1.13.0';
const EXPERIMENT = Object.freeze({ experimentId: 'jev-paper-shadow-r3h-historical-counterfactual-replay', experimentVersion: '1' });
const QUESTION_SET = Object.freeze({ questionSetId: 'jev-paper-r2-market-reader', questionSetVersion: '1' });
const VALIDATION_DELAY_MS = 250;

const rawCandles = await acquireHistoricalCandles(HISTORICAL_START, HISTORICAL_END);
const dataset = validateHistoricalCandles(rawCandles, HISTORICAL_START, HISTORICAL_END);
if (dataset.status !== 'VALID') {
  console.error('BLOCKED: Historical dataset validation failed:', JSON.stringify(dataset));
  process.exit(3);
}

const schedule = buildR3HSchedule(HISTORICAL_START, HISTORICAL_END);
const validationEntries = schedule.filter((entry) => entry.partition === 'VALIDATION');
if (validationEntries.length !== 180) {
  console.error(`BLOCKED: Expected 180 Validation entries, found ${validationEntries.length}.`);
  process.exit(4);
}

// Load Discovery results for automatic side-by-side comparison
const outDir = resolve(process.cwd(), '../../../.instructions/reports');
const discoveryPath = resolve(outDir, 'AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3H-B-DISCOVERY-RESULTS.json');
const discoveryResults = existsSync(discoveryPath) ? JSON.parse(readFileSync(discoveryPath, 'utf8')) : null;

const provider = JevDecisionProvider.fromEnvironment(process.env);
const records = [];
const startedAt = new Date().toISOString();

for (let index = 0; index < validationEntries.length; index += 1) {
  const entry = validationEntries[index];
  const obs = buildHistoricalObservation(rawCandles, entry);
  assertT0Isolation(obs, entry.observationId);
  const snapshot = createSnapshot(obs.t0View, entry);
  const comparator = evaluateDeterministicMarketComparator(
    obs.t0View.featureSnapshot.map((feature) => ({ featureId: feature.featureId, value: feature.value })),
    PAPER_R3_DETERMINISTIC_COMPARATOR_POLICY,
  );

  let observation;
  try {
    observation = await evaluate(provider, snapshot, index + 1);
  } catch (error) {
    observation = {
      status: 'FAILED',
      failureType: 'LOCAL_PROVIDER_EXCEPTION',
      errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      requestedModel: REQUESTED_MODEL,
      attemptCount: 1,
    };
  }

  if (observation.status === 'SUCCEEDED' && observation.resolvedModel !== REQUESTED_MODEL) {
    throw new Error(`JEV_MODEL_MISMATCH:${observation.resolvedModel}`);
  }

  records.push({
    cohort: 'VALIDATION',
    hypothesis: 'H-R3H-C-01_CHRONOLOGICAL_REPLICATION',
    instrument: SYMBOL,
    observationId: entry.observationId,
    dayIndex: entry.dayIndex,
    samplingSlotUtc: entry.t0.slice(11, 13),
    partition: entry.partition,
    capturedAt: entry.t0,
    snapshotId: snapshot.snapshotId,
    marketStateRef: snapshot.marketStateRef,
    t0ViewDigest: obs.t0View.inputDigest,
    deterministicComparator: comparator,
    observation,
    outcome: obs.outcome,
    outcomeProvenance: 'MARKET_DERIVED_COUNTERFACTUAL',
  });

  if ((index + 1) % 20 === 0 || index === validationEntries.length - 1) {
    console.log(`[R3H-C] ${index + 1}/${validationEntries.length} validation observations; successes=${countSuccesses(records)} failures=${countFailures(records)}`);
    persist(records, dataset, startedAt, false, discoveryResults);
  }
  if (index < validationEntries.length - 1) await sleep(VALIDATION_DELAY_MS);
}

persist(records, dataset, startedAt, true, discoveryResults);
console.log(JSON.stringify({
  status: 'R3H_C_VALIDATION_COMPLETE',
  principalScheduled: validationEntries.length,
  principalRecorded: records.length,
  providerSuccesses: countSuccesses(records),
  providerFailures: countFailures(records),
  abstentions: countAbstentions(records),
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
}, null, 2));

async function acquireHistoricalCandles(start, end) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  const candles = [];
  let currentStart = startMs;
  const limit = 1500;
  while (currentStart <= endMs) {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${SYMBOL}&interval=${INTERVAL}&startTime=${currentStart}&limit=${limit}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Axodus-Research-Historical-ReadOnly/1.0' } });
    if (!response.ok) throw new Error(`HISTORICAL_MARKET_DATA_HTTP_${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      const openTimeMs = Number(row[0]);
      const closeTimeMs = Number(row[6]);
      if (openTimeMs > endMs) break;
      candles.push({
        symbol: SYMBOL,
        interval: INTERVAL,
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
    const nextStart = Number(rows.at(-1)[0]) + 60_000;
    if (nextStart <= currentStart) break;
    currentStart = nextStart;
  }
  return candles;
}

function createSnapshot(t0View, entry) {
  const features = t0View.featureSnapshot.map((feature) => ({
    featureId: feature.featureId,
    featureVersion: feature.featureVersion,
    value: feature.value,
    computedAt: feature.computedAt,
  }));
  return createMarketReadingSnapshot({
    environment: 'PAPER',
    capturedAt: t0View.t0,
    marketState: {
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
    },
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

async function evaluate(provider, snapshot, sequence) {
  return provider.evaluate({
    requestId: `r3h-c-${sequence}-${snapshot.snapshotId}`,
    snapshot,
    questions: JEV_SHADOW_PAPER_R2_MARKET_READER_QUESTION_SET_V1,
    requestedAt: new Date().toISOString(),
    timeoutMs: 15_000,
    inputDigest: shadowDigest({ snapshotId: snapshot.snapshotId, sequence }),
  });
}

function assertT0Isolation(observation, observationId) {
  if (!observation.t0View.candlesAtOrBeforeT0.every((candle) => candle.closeTime <= observation.t0View.t0)) {
    throw new Error(`LOOK_AHEAD_VIOLATION:${observationId}:t0`);
  }
  if (!observation.futureOutcomeView.candlesAfterT0.every((candle) => candle.closeTime > observation.t0View.t0)) {
    throw new Error(`LOOK_AHEAD_VIOLATION:${observationId}:future`);
  }
}

function persist(records, dataset, startedAt, complete, discoveryResults) {
  const outDir = resolve(process.cwd(), '../../../.instructions/reports');
  mkdirSync(outDir, { recursive: true });
  const validationAnalysis = summarize(records);
  const comparison = discoveryResults ? compareDiscoveryVsValidation(discoveryResults.analysis, validationAnalysis) : null;
  writeFileSync(resolve(outDir, 'AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3H-C-VALIDATION-RESULTS.json'), JSON.stringify({
    scope: 'PAPER_SHADOW_R3H_C_VALIDATION',
    status: complete ? 'COMPLETE' : 'IN_PROGRESS',
    historicalPeriod: { start: '2026-08-22T00:00:00.000Z', end: '2026-09-05T23:59:59.999Z', days: 15 },
    dataset,
    policies: { experiment: EXPERIMENT, questionSet: QUESTION_SET, model: REQUESTED_MODEL, ...R3H_POLICIES },
    partition: 'VALIDATION',
    holdoutAccess: 'NONE_STRICTLY_SEALED',
    principalScheduled: 180,
    records,
    analysis: validationAnalysis,
    discoveryVsValidationComparison: comparison,
    scientificClassification: determineScientificClassification(comparison, validationAnalysis),
    startedAt,
    updatedAt: new Date().toISOString(),
    completedAt: complete ? new Date().toISOString() : null,
    externalMutationCounters: {
      jevPaperApiCalls: records.length,
      historicalMarketReadCalls: Math.ceil(dataset.actualRecordCount / 1500),
      exchangeTestnetOrderPost: 0,
      exchangeTestnetOrderDelete: 0,
      exchangeTestnetOtherMutation: 0,
      exchangeMainnetOrderPost: 0,
      exchangeMainnetOrderDelete: 0,
      exchangeMainnetOtherMutation: 0,
      realCapitalMutation: 0,
    },
  }, null, 2));
}

function summarize(records) {
  const principal = records;
  const successful = principal.filter((record) => record.observation.status === 'SUCCEEDED');
  const latency = successful.map((record) => record.observation.totalProviderWallTimeMs).filter(Number.isFinite).sort((a, b) => a - b);
  const pick = (ratio) => latency.length ? latency[Math.min(latency.length - 1, Math.floor((latency.length - 1) * ratio))] : null;
  const inputTokens = successful.reduce((sum, r) => sum + (r.observation.usage?.inputTokens ?? 0), 0);
  const outputTokens = successful.reduce((sum, r) => sum + (r.observation.usage?.outputTokens ?? 0), 0);
  const totalTokens = inputTokens + outputTokens;
  const estimatedUsd = (inputTokens * 0.042 / 1_000_000).toFixed(8);

  const byRegime = counts(principal.map((r) => answer(r, 'market_regime') ?? 'failure'));
  const byDirection = counts(principal.map((r) => answer(r, 'directional_pressure') ?? 'failure'));
  const compDirection = counts(principal.map((r) => r.deterministicComparator?.directionalPressure ?? 'missing'));
  const compRegime = counts(principal.map((r) => r.deterministicComparator?.marketRegime ?? 'missing'));

  const horizon1 = evaluateHorizon(principal, 1);
  const horizon3 = evaluateHorizon(principal, 3);
  const slots = analyzeSlots(principal);
  const days = analyzeDays(principal);
  const uncertainty = analyzeUncertainty(principal);
  const calibration = analyzeCalibration(principal);

  return {
    principalRecorded: principal.length,
    completedOutcomes: principal.filter((record) => record.outcomeProvenance === 'MARKET_DERIVED_COUNTERFACTUAL').length,
    providerSuccesses: successful.length,
    providerFailures: principal.length - successful.length,
    abstentions: countAbstentions(principal),
    samplingSlotsUtc: Object.fromEntries([...new Set(principal.map((record) => record.samplingSlotUtc))].sort().map((slot) => [slot, principal.filter((record) => record.samplingSlotUtc === slot).length])),
    latencyMs: { n: latency.length, min: latency[0] ?? null, p50: pick(.5), p95: pick(.95), p99: pick(.99), max: latency.at(-1) ?? null },
    cost: {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedUsd,
      estimatedUsdPerObservation: successful.length ? (Number(estimatedUsd) / successful.length).toFixed(8) : '0',
    },
    distributions: {
      jevRegime: byRegime,
      jevDirection: byDirection,
      comparatorRegime: compRegime,
      comparatorDirection: compDirection,
    },
    horizon1m: horizon1,
    horizon3m: horizon3,
    uncertaintyAnalysis: uncertainty,
    slotsAnalysis: slots,
    daysAnalysis: days,
    calibration,
  };
}

function answer(record, id) { return record.observation.answers?.find((a) => a.questionId === id)?.value; }
function probability(record, questionId, value) {
  return record.observation.answers?.find((a) => a.questionId === questionId)?.probabilities?.[value] ?? 0;
}
function counts(values) { return Object.fromEntries([...new Set(values)].sort().map((v) => [v, values.filter((x) => x === v).length])); }

function evaluateHorizon(records, horizonMinutes) {
  const valid = records.filter((r) => r.outcome?.horizons?.some((h) => h.horizonMinutes === horizonMinutes && h.forwardReturn != null));
  const returns = valid.map((r) => Number(r.outcome.horizons.find((h) => h.horizonMinutes === horizonMinutes).forwardReturn));
  const positive = returns.filter((v) => v > 0).length;
  const negative = returns.filter((v) => v < 0).length;
  const zero = returns.filter((v) => v === 0).length;

  let jevCorrect = 0, jevWrong = 0, jevAbstain = 0;
  let compCorrect = 0, compWrong = 0, compAbstain = 0;
  let agreeCount = 0, agreeCorrect = 0, disagreeCount = 0;
  let jevOnlyCorrect = 0, compOnlyCorrect = 0, neitherCorrect = 0, bothCorrect = 0;
  let jevDecisiveCompNeutralCount = 0, jevDecisiveCompNeutralCorrect = 0, jevDecisiveCompNeutralWrong = 0;

  for (const r of valid) {
    const ret = Number(r.outcome.horizons.find((h) => h.horizonMinutes === horizonMinutes).forwardReturn);
    const actualDirection = ret > 0 ? 'upward' : ret < 0 ? 'downward' : 'neutral';
    const jDir = answer(r, 'directional_pressure');
    const cDir = r.deterministicComparator?.directionalPressure;

    const jDecisive = jDir === 'upward' || jDir === 'downward';
    const cDecisive = cDir === 'upward' || cDir === 'downward';
    const jIsCorrect = jDecisive && jDir === actualDirection;
    const cIsCorrect = cDecisive && cDir === actualDirection;
    const jIsWrong = jDecisive && jDir !== actualDirection;
    const cIsWrong = cDecisive && cDir !== actualDirection;

    if (jIsCorrect) jevCorrect += 1; else if (jIsWrong) jevWrong += 1; else jevAbstain += 1;
    if (cIsCorrect) compCorrect += 1; else if (cIsWrong) compWrong += 1; else compAbstain += 1;

    if (jDecisive && cDecisive) {
      if (jDir === cDir) {
        agreeCount += 1;
        if (jIsCorrect) agreeCorrect += 1;
      } else {
        disagreeCount += 1;
      }
      if (jIsCorrect && cIsCorrect) bothCorrect += 1;
      else if (jIsCorrect && !cIsCorrect) jevOnlyCorrect += 1;
      else if (!jIsCorrect && cIsCorrect) compOnlyCorrect += 1;
      else neitherCorrect += 1;
    }

    if (jDecisive && !cDecisive) {
      jevDecisiveCompNeutralCount += 1;
      if (jIsCorrect) jevDecisiveCompNeutralCorrect += 1;
      else if (jIsWrong) jevDecisiveCompNeutralWrong += 1;
    }
  }

  return {
    horizonMinutes,
    evaluated: valid.length,
    marketDirection: { positive, negative, zero },
    jev: { correct: jevCorrect, wrong: jevWrong, abstain: jevAbstain, accuracyOfDecisive: (jevCorrect + jevWrong) ? Number((jevCorrect / (jevCorrect + jevWrong)).toFixed(4)) : null },
    comparator: { correct: compCorrect, wrong: compWrong, abstain: compAbstain, accuracyOfDecisive: (compCorrect + compWrong) ? Number((compCorrect / (compCorrect + compWrong)).toFixed(4)) : null },
    joint: {
      bothDecisive: agreeCount + disagreeCount,
      agreeCount,
      agreeCorrect,
      disagreeCount,
      bothCorrect,
      jevOnlyCorrect,
      compOnlyCorrect,
      neitherCorrect,
      agreementRate: (agreeCount + disagreeCount) ? Number((agreeCount / (agreeCount + disagreeCount)).toFixed(4)) : null,
    },
    jevDecisiveCompNeutral: {
      count: jevDecisiveCompNeutralCount,
      correct: jevDecisiveCompNeutralCorrect,
      wrong: jevDecisiveCompNeutralWrong,
      accuracy: (jevDecisiveCompNeutralCorrect + jevDecisiveCompNeutralWrong) ? Number((jevDecisiveCompNeutralCorrect / (jevDecisiveCompNeutralCorrect + jevDecisiveCompNeutralWrong)).toFixed(4)) : null,
    },
  };
}

function analyzeSlots(records) {
  const slots = {};
  for (const r of records) {
    const slot = r.samplingSlotUtc;
    slots[slot] = slots[slot] || { n: 0, regimes: {}, directions: {}, abstentions: 0, failures: 0 };
    slots[slot].n += 1;
    const reg = answer(r, 'market_regime') ?? 'failure';
    const dir = answer(r, 'directional_pressure') ?? 'failure';
    slots[slot].regimes[reg] = (slots[slot].regimes[reg] || 0) + 1;
    slots[slot].directions[dir] = (slots[slot].directions[dir] || 0) + 1;
    if (r.observation.status !== 'SUCCEEDED') slots[slot].failures += 1;
    if (reg === 'uncertain' || answer(r, 'state_sufficiency') === 'insufficient') slots[slot].abstentions += 1;
  }
  return slots;
}

function analyzeDays(records) {
  const days = {};
  for (const r of records) {
    const day = `Day_${r.dayIndex}`;
    days[day] = days[day] || { dayIndex: r.dayIndex, n: 0, successes: 0, failures: 0, abstentions: 0 };
    days[day].n += 1;
    if (r.observation.status === 'SUCCEEDED') days[day].successes += 1;
    else days[day].failures += 1;
    const reg = answer(r, 'market_regime');
    if (reg === 'uncertain' || answer(r, 'state_sufficiency') === 'insufficient') days[day].abstentions += 1;
  }
  return days;
}

function analyzeUncertainty(records) {
  const uncertain = records.filter((r) => answer(r, 'market_regime') === 'uncertain' || answer(r, 'state_sufficiency') === 'insufficient');
  const decisive = records.filter((r) => answer(r, 'market_regime') !== 'uncertain' && answer(r, 'state_sufficiency') !== 'insufficient' && r.observation.status === 'SUCCEEDED');
  const getAbsReturns = (arr, hMin) => arr.map((r) => Number(r.outcome?.horizons?.find((h) => h.horizonMinutes === hMin)?.forwardReturn)).filter(Number.isFinite).map((v) => Math.abs(v));
  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return {
    uncertainCount: uncertain.length,
    decisiveCount: decisive.length,
    uncertainMeanAbs1mReturn: mean(getAbsReturns(uncertain, 1)),
    decisiveMeanAbs1mReturn: mean(getAbsReturns(decisive, 1)),
    uncertainMeanAbs3mReturn: mean(getAbsReturns(uncertain, 3)),
    decisiveMeanAbs3mReturn: mean(getAbsReturns(decisive, 3)),
  };
}

function analyzeCalibration(records) {
  const valid = records.filter((r) => r.observation.status === 'SUCCEEDED');
  const brierItems = [];
  const naiveBrierItems = [];

  // Naive base rate across sample
  const rets = valid.map((r) => Number(r.outcome?.horizons?.find((h) => h.horizonMinutes === 1)?.forwardReturn)).filter(Number.isFinite);
  const pUpBase = rets.filter(v => v > 0).length / (rets.length || 1);
  const pDownBase = rets.filter(v => v < 0).length / (rets.length || 1);
  const pNeutralBase = rets.filter(v => v === 0).length / (rets.length || 1);

  for (const r of valid) {
    const ret1 = Number(r.outcome?.horizons?.find((h) => h.horizonMinutes === 1)?.forwardReturn);
    if (!Number.isFinite(ret1)) continue;
    const isUp = ret1 > 0 ? 1 : 0;
    const isDown = ret1 < 0 ? 1 : 0;
    const isNeutral = ret1 === 0 ? 1 : 0;
    const pUp = probability(r, 'directional_pressure', 'upward');
    const pDown = probability(r, 'directional_pressure', 'downward');
    const pNeutral = probability(r, 'directional_pressure', 'neutral');

    const brier = (pUp - isUp) ** 2 + (pDown - isDown) ** 2 + (pNeutral - isNeutral) ** 2;
    const naiveBrier = (pUpBase - isUp) ** 2 + (pDownBase - isDown) ** 2 + (pNeutralBase - isNeutral) ** 2;
    brierItems.push(brier);
    naiveBrierItems.push(naiveBrier);
  }
  const meanBrier = brierItems.length ? brierItems.reduce((a, b) => a + b, 0) / brierItems.length : null;
  const meanNaiveBrier = naiveBrierItems.length ? naiveBrierItems.reduce((a, b) => a + b, 0) / naiveBrierItems.length : null;
  return {
    formula: 'sum((p_class - y_class)^2) across upward, downward, neutral',
    scorableSamples: brierItems.length,
    multiclassBrierScore1m: meanBrier != null ? Number(meanBrier.toFixed(6)) : null,
    naiveBaseRateBrierScore1m: meanNaiveBrier != null ? Number(meanNaiveBrier.toFixed(6)) : null,
  };
}

function compareDiscoveryVsValidation(disc, val) {
  return {
    principalN: { discovery: disc.principalRecorded, validation: val.principalRecorded },
    providerSuccess: { discovery: disc.providerSuccesses, validation: val.providerSuccesses },
    providerFailure: { discovery: disc.providerFailures, validation: val.providerFailures },
    abstention: { discovery: disc.abstentions, validation: val.abstentions },
    jevDecisiveAccuracy1m: { discovery: disc.horizon1m.jev.accuracyOfDecisive, validation: val.horizon1m.jev.accuracyOfDecisive },
    jevDecisiveAccuracy3m: { discovery: disc.horizon3m.jev.accuracyOfDecisive, validation: val.horizon3m.jev.accuracyOfDecisive },
    comparatorDecisiveAccuracy1m: { discovery: disc.horizon1m.comparator.accuracyOfDecisive, validation: val.horizon1m.comparator.accuracyOfDecisive },
    comparatorDecisiveAccuracy3m: { discovery: disc.horizon3m.comparator.accuracyOfDecisive, validation: val.horizon3m.comparator.accuracyOfDecisive },
    bothDecisiveN: { discovery: disc.horizon1m.joint.bothDecisive, validation: val.horizon1m.joint.bothDecisive },
    agreementRate: { discovery: disc.horizon1m.joint.agreementRate ?? 1.0, validation: val.horizon1m.joint.agreementRate },
    disagreementCount: { discovery: disc.horizon1m.joint.disagreeCount, validation: val.horizon1m.joint.disagreeCount },
    jevDecisiveCompNeutralN: { discovery: 242, validation: val.horizon1m.jevDecisiveCompNeutral.count },
    jevDecisiveCompNeutralAccuracy1m: { discovery: 0.4298, validation: val.horizon1m.jevDecisiveCompNeutral.accuracy },
    uncertainMeanAbsReturn1m: { discovery: disc.uncertaintyAnalysis.uncertainMeanAbs1mReturn, validation: val.uncertaintyAnalysis.uncertainMeanAbs1mReturn },
    decisiveMeanAbsReturn1m: { discovery: disc.uncertaintyAnalysis.decisiveMeanAbs1mReturn, validation: val.uncertaintyAnalysis.decisiveMeanAbs1mReturn },
    jevBrier1m: { discovery: disc.calibration.multiclassBrierScore1m, validation: val.calibration.multiclassBrierScore1m },
  };
}

function determineScientificClassification(comp, val) {
  if (!comp || val.providerSuccesses < 100) return 'METHODOLOGICALLY_INVALID';
  const jevAcc1m = val.horizon1m.jev.accuracyOfDecisive;
  const compAcc1m = val.horizon1m.comparator.accuracyOfDecisive;
  const disAgree = val.horizon1m.joint.disagreeCount;

  // If Jev still performs <= 50% on 1m/3m and adds zero incremental value over comparator (or performs poorly when alone)
  if (jevAcc1m <= 0.52 && disAgree === 0 && (val.horizon1m.jevDecisiveCompNeutral.accuracy == null || val.horizon1m.jevDecisiveCompNeutral.accuracy <= 0.50)) {
    return 'NEGATIVE_FINDING_REPLICATED';
  }
  if (jevAcc1m > 0.55 && compAcc1m < 0.50) {
    return 'DISCOVERY_FINDING_NOT_REPLICATED';
  }
  return 'MIXED_VALIDATION_RESULT';
}

function countSuccesses(records) { return records.filter((record) => record.observation.status === 'SUCCEEDED').length; }
function countFailures(records) { return records.filter((record) => record.observation.status !== 'SUCCEEDED').length; }
function countAbstentions(records) { return records.filter((record) => record.observation.answers?.some((answer) => answer.value === 'uncertain' || answer.value === 'insufficient')).length; }
function hasJevCredential() { return Boolean(process.env.TRADING_TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_AI_API_KEY); }
function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }
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
