import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createShadowDecisionSnapshot,
  JevDecisionProvider,
  JEV_SHADOW_QUESTION_SET_V1,
  shadowDigest,
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/index.js';

loadLocalEnv();
const singleObservation = process.argv.includes('--single');
const configured = Boolean(process.env.TRADING_TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_AI_API_KEY);
if (!configured) {
  process.stdout.write(`${JSON.stringify({
    status: 'BLOCKED',
    credentialConfigured: false,
    reason: 'TRADING_TYPESAFE_API_KEY_OR_LEGACY_TYPESAFE_KEY_NOT_CONFIGURED',
    jevApiCalls: 0,
  }, null, 2)}\n`);
  process.exitCode = 2;
} else {
  const provider = JevDecisionProvider.fromEnvironment(process.env);
  const snapshot = fixtureSnapshot();
  const observations = [];
  observations.push(await evaluate(provider, snapshot, 0));
  const connectivity = observations[0];
  if (!singleObservation && connectivity.status === 'SUCCEEDED' && connectivity.resolvedModel === snapshot.requestedModel) {
    for (let index = 1; index < 5; index += 1) {
      observations.push(await evaluate(provider, snapshot, index));
    }
  }
  const succeeded = observations.filter((item) => item.status === 'SUCCEEDED');
  const latencies = succeeded.map((item) => item.totalProviderWallTimeMs).sort((a, b) => a - b);
  const inputTokens = succeeded.reduce((total, item) => total + (item.usage?.inputTokens ?? 0), 0);
  const modelConfirmed = connectivity.resolvedModel === snapshot.requestedModel;
  process.stdout.write(`${JSON.stringify({
    status: connectivity.status !== 'SUCCEEDED' ? 'CONNECTIVITY_FAILED' : !modelConfirmed ? 'MODEL_MISMATCH' : succeeded.length === observations.length ? 'PASS' : 'PARTIAL',
    credentialConfigured: true,
    sampleMode: singleObservation ? 'SINGLE_OBSERVATION' : 'CONNECTIVITY_PLUS_REPEATABILITY',
    jevApiCalls: observations.length,
    connectivity: { status: connectivity.status, failureCode: connectivity.failureCode ?? null },
    requestedModel: snapshot.requestedModel,
    resolvedModel: connectivity.resolvedModel ?? null,
    modelConfirmed,
    outcomes: observations.map((item) => item.status),
    answerSummary: summarizeLatestAnswers(succeeded),
    latencyMs: summarize(latencies),
    repeatability: summarizeAnswers(succeeded),
    retry: { maxAttempts: 1, observedAttemptCounts: observations.map((item) => item.attemptCount) },
    usage: { inputTokens, estimatedCostUsd: ((inputTokens / 1_000_000) * 0.042).toFixed(8), pricingBasis: 'vendor-documented-2026-09-21' },
  }, null, 2)}\n`);
}

async function evaluate(provider, snapshot, index) {
    const request = {
      requestId: `stage0:${snapshot.snapshotId}:${index}`,
      snapshot,
      questions: JEV_SHADOW_QUESTION_SET_V1,
      requestedAt: new Date().toISOString(),
      timeoutMs: 10_000,
      inputDigest: shadowDigest({ snapshotId: snapshot.snapshotId, repeat: index }),
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

function fixtureSnapshot() {
  const timestamp = '2026-09-21T12:00:00.000Z';
  return createShadowDecisionSnapshot({
    environment: 'PAPER', capturedAt: timestamp,
    marketState: {
      marketStateId: 'stage0-market', instrument: 'BTCUSDT', venue: 'paper', timeframe: '1m', marketTime: timestamp,
      observedAt: timestamp, constructedAt: timestamp, validityContext: 'paper', freshness: 'current', schemaVersion: '1',
      features: [
        { featureId: 'mid_price', featureVersion: '1', value: '65000.000000000000', unit: 'USDT', computedAt: timestamp },
        { featureId: 'spread_bps', featureVersion: '1', value: '1.500000000000', unit: 'bps', computedAt: timestamp },
      ], sourceRefs: ['synthetic-stage0'], completeness: 'complete', validationRefs: ['stage0-fixture'], qualityStatus: 'valid', sequenceStatus: 'sequenced',
    },
    opportunity: {
      opportunityId: 'stage0-opportunity', instrument: 'BTCUSDT', venue: 'paper', strategyId: 'stage0-strategy',
      strategyRevisionId: 'stage0-revision-1', timeframe: '1m', marketStateId: 'stage0-market', qualification: 'qualified',
      expectedCharacteristics: { direction: 'up', horizonSeconds: 60 }, evidenceRefs: ['stage0-fixture'], createdAt: timestamp,
      expiresAt: '2026-09-21T12:01:00.000Z',
    },
    tradeProposal: {
      proposalId: 'stage0-proposal', strategyId: 'stage0-strategy', strategyRevisionId: 'stage0-revision-1',
      strategyRevision: { strategy: 'stage0-strategy', revision: 1, revisionId: 'stage0-revision-1' },
      opportunity: { opportunityId: 'stage0-opportunity', marketStateId: 'stage0-market', instrument: 'BTCUSDT', venue: 'paper', timeframe: '1m' },
      marketState: { marketStateId: 'stage0-market', schemaVersion: '1', validityContext: 'paper' },
      action: 'buy', sizing: { requestedQuantity: '0.001000000000', requestedCapital: '65.000000000000', leverage: '1.000000000000' },
      expectedReturn: { direction: 'positive' }, expectedRisk: { bounded: true }, liquidityAssumptions: { spreadBps: '1.500000000000' },
      duration: { seconds: 60 }, costAssumptions: { feeBps: '4.000000000000' },
      eligibility: { eligibilityId: 'stage0-eligibility', strategyRevisionId: 'stage0-revision-1', decision: 'ELIGIBLE', policyVersion: 'stage0' },
      correlationId: 'stage0-correlation', idempotencyKey: 'stage0-proposal-idem', createdAt: timestamp,
      expiresAt: '2026-09-21T12:01:00.000Z', evidenceRefs: ['stage0-fixture'],
    },
    experiment: { experimentId: 'jev-stage0-characterization', experimentVersion: '1' },
    questionSet: { questionSetId: 'jev-shadow-core', questionSetVersion: '1' },
    requestedProvider: 'typesafe-jev', requestedModel: 'jev-1.13.0',
  });
}

function summarize(values) {
  if (values.length === 0) return null;
  const pick = (p) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))];
  return { min: values[0], p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), max: values.at(-1), n: values.length };
}

function summarizeAnswers(observations) {
  const fingerprints = observations.map((item) => shadowDigest(item.answers));
  return { successfulSamples: observations.length, distinctAnswerFingerprints: new Set(fingerprints).size };
}

function summarizeLatestAnswers(observations) {
  const latest = observations.at(-1);
  if (!latest) return [];
  return latest.answers.map((answer) => ({
    questionId: answer.questionId,
    type: answer.type,
    value: answer.value,
    confidence: answer.confidence ?? null,
    probabilityKeys: answer.probabilities ? Object.keys(answer.probabilities).sort() : [],
    probabilityTotal: answer.probabilities ? Number(Object.values(answer.probabilities).reduce((total, value) => total + value, 0).toFixed(6)) : null,
  }));
}
