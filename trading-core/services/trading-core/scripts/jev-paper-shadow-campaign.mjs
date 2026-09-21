import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createShadowDecisionSnapshot,
  JevDecisionProvider,
  JEV_SHADOW_PAPER_QUESTION_SET_V1,
  shadowDigest,
  analyzePaperShadow
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/index.js';

loadLocalEnv();
const configured = Boolean(process.env.TRADING_TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_AI_API_KEY);
if (!configured) {
  console.error('BLOCKED: TRADING_TYPESAFE_API_KEY not configured.');
  process.exit(2);
}
const provider = JevDecisionProvider.fromEnvironment(process.env);

// Conservative PAPER SHADOW resumption.
// These are deterministic PAPER snapshot fixtures for provider/evaluation plumbing only.
// They are not observed market outcomes and must not be used as Jev quality evidence.
const STATES = [
  { id: '1', mid: '65000', spread: '1.5', trend: 'bullish', volatility: 'low', baseline: 'ACCEPT' },
  { id: '2', mid: '66000', spread: '2.0', trend: 'bullish', volatility: 'low', baseline: 'ACCEPT' },
  { id: '3', mid: '68000', spread: '15.0', trend: 'bearish', volatility: 'high', baseline: 'REJECT' },
  { id: '4', mid: '64000', spread: '5.0', trend: 'bearish', volatility: 'high', baseline: 'REJECT' },
  { id: '5', mid: '65500', spread: '1.2', trend: 'range', volatility: 'low', baseline: 'ACCEPT' },
  { id: '6', mid: '65550', spread: '8.0', trend: 'breakout', volatility: 'high', baseline: 'ACCEPT' }
];

const records = [];

for (const state of STATES) {
  const snapshot = buildSnapshot(state);
  console.log(`[PRINCIPAL] Evaluating state ${state.id} (baseline: ${state.baseline})`);
  const observation = await evaluate(provider, snapshot, 'principal');
  records.push({
    cohort: 'PRINCIPAL',
    opportunityId: snapshot.opportunityRef,
    instrument: snapshot.instrument,
    strategyId: snapshot.strategyId,
    capturedAt: snapshot.capturedAt,
    baselineDecision: state.baseline,
    observation,
    outcomeProvenance: 'NO_DEFENSIBLE_OUTCOME'
  });
}

const report = analyzePaperShadow(records);
const outDir = resolve(process.cwd(), '../../../.instructions/reports');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'AXODUS-TRADING-IMP-02-PAPER-SHADOW-RESULTS.json');
writeFileSync(outPath, JSON.stringify({
  scope: 'PAPER_SHADOW_PRINCIPAL_ONLY',
  caveat: 'Deterministic PAPER fixtures validate shadow plumbing and provider behavior only; no outcome labels or incremental-value conclusion are claimed.',
  externalMutationCounters: {
    jevPaperApiCalls: records.length,
    exchangeTestnetOrderPost: 0,
    exchangeTestnetOrderDelete: 0,
    exchangeMainnetOrderPost: 0,
    exchangeMainnetOrderDelete: 0,
    realCapital: 0,
  },
  records,
  report,
}, null, 2));

console.log('\n[ANALYSIS REPORT]\n');
console.log(JSON.stringify(report, null, 2));
console.log(`\nSaved to ${outPath}`);

function buildSnapshot(state) {
  const timestamp = `2026-09-21T12:0${state.id}:00.000Z`;
  return createShadowDecisionSnapshot({
    environment: 'PAPER',
    capturedAt: timestamp,
    marketState: {
      marketStateId: `market-${state.id}`, instrument: 'BTCUSDT', venue: 'paper', timeframe: '1m',
      marketTime: timestamp, observedAt: timestamp, constructedAt: timestamp,
      validityContext: 'paper', freshness: 'current', schemaVersion: '1',
      features: [
        { featureId: 'mid_price', featureVersion: '1', value: state.mid, unit: 'USDT', computedAt: timestamp },
        { featureId: 'spread_bps', featureVersion: '1', value: state.spread, unit: 'bps', computedAt: timestamp },
        { featureId: 'trend', featureVersion: '1', value: state.trend, computedAt: timestamp },
        { featureId: 'volatility', featureVersion: '1', value: state.volatility, computedAt: timestamp },
      ],
      sourceRefs: ['paper-sim'], completeness: 'complete', validationRefs: ['paper-sim'],
      qualityStatus: 'valid', sequenceStatus: 'sequenced',
    },
    opportunity: {
      opportunityId: `opp-${state.id}`, instrument: 'BTCUSDT', venue: 'paper', strategyId: 'strategy-paper',
      strategyRevisionId: 'rev-paper-1', timeframe: '1m', marketStateId: `market-${state.id}`, qualification: 'qualified',
      expectedCharacteristics: { direction: state.baseline === 'ACCEPT' ? 'up' : 'down' }, evidenceRefs: ['paper-sim'], createdAt: timestamp,
      expiresAt: `2026-09-21T12:0${state.id}:59.000Z`,
    },
    tradeProposal: {
      proposalId: `prop-${state.id}`, strategyId: 'strategy-paper', strategyRevisionId: 'rev-paper-1',
      strategyRevision: { strategy: 'strategy-paper', revision: 1, revisionId: 'rev-paper-1' },
      opportunity: { opportunityId: `opp-${state.id}`, marketStateId: `market-${state.id}`, instrument: 'BTCUSDT', venue: 'paper', timeframe: '1m' },
      marketState: { marketStateId: `market-${state.id}`, schemaVersion: '1', validityContext: 'paper' },
      action: state.baseline === 'ACCEPT' ? 'buy' : 'sell',
      sizing: { requestedQuantity: '0.01', requestedCapital: '650', leverage: '1' },
      expectedReturn: { direction: 'positive' }, expectedRisk: { bounded: true }, liquidityAssumptions: { spreadBps: state.spread },
      duration: { seconds: 60 }, costAssumptions: { feeBps: '4' },
      eligibility: { eligibilityId: `elig-${state.id}`, strategyRevisionId: 'rev-paper-1', decision: 'ELIGIBLE', policyVersion: 'paper' },
      correlationId: `corr-${state.id}`, idempotencyKey: `idem-${state.id}`, createdAt: timestamp,
      expiresAt: `2026-09-21T12:0${state.id}:59.000Z`, evidenceRefs: ['paper-sim'],
    },
    experiment: { experimentId: 'jev-paper-shadow', experimentVersion: '1' },
    questionSet: { questionSetId: 'jev-shadow-paper-core', questionSetVersion: '1' },
    requestedProvider: 'typesafe-jev', requestedModel: 'jev-1.13.0',
  });
}

async function evaluate(provider, snapshot, attemptId) {
  const request = {
    requestId: `paper-${snapshot.snapshotId}-${attemptId}`,
    snapshot,
    questions: JEV_SHADOW_PAPER_QUESTION_SET_V1,
    requestedAt: new Date().toISOString(),
    timeoutMs: 15_000,
    inputDigest: shadowDigest({ snapshotId: snapshot.snapshotId, attemptId }),
  };
  return await provider.evaluate(request);
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
