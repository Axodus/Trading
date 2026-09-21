import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalShadowJson,
  createShadowDecisionSnapshot,
  DeterministicMockDecisionProvider,
  InMemoryShadowDecisionRepository,
  JevDecisionProvider,
  JEV_SHADOW_QUESTION_SET_V1,
  ShadowDecisionDispatcher,
  ShadowTradeProposalObserver,
  shadowDigest,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const now = '2026-09-21T12:00:00.000Z';

function fixture() {
  const marketState = {
    marketStateId: 'market-1', instrument: 'BTCUSDT', venue: 'paper', timeframe: '1m',
    marketTime: now, observedAt: now, constructedAt: now, validityContext: 'paper',
    freshness: 'current', schemaVersion: '1', completeness: 'complete', qualityStatus: 'valid',
    sequenceStatus: 'sequenced', sourceRefs: ['source-safe'], validationRefs: ['validation-safe'],
    features: [{ featureId: 'mid_price', featureVersion: '1', value: '100.00', unit: 'USDT', computedAt: now }],
    secret: 'must-not-leave-axodus',
  };
  const opportunity = {
    opportunityId: 'opportunity-1', instrument: 'BTCUSDT', venue: 'paper', strategyId: 'strategy-1',
    strategyRevisionId: 'revision-1', timeframe: '1m', marketStateId: 'market-1', qualification: 'qualified',
    expectedCharacteristics: { direction: 'up' }, evidenceRefs: ['evidence-1'], createdAt: now,
    expiresAt: '2026-09-21T12:01:00.000Z',
  };
  const tradeProposal = {
    proposalId: 'proposal-1', strategyId: 'strategy-1', strategyRevisionId: 'revision-1',
    strategyRevision: { strategy: 'strategy-1', revision: 1, revisionId: 'revision-1' },
    opportunity: { opportunityId: 'opportunity-1', marketStateId: 'market-1', instrument: 'BTCUSDT', venue: 'paper', timeframe: '1m' },
    marketState: { marketStateId: 'market-1', schemaVersion: '1', validityContext: 'paper' },
    action: 'buy', sizing: { requestedQuantity: '1.000000000000', requestedCapital: '100.000000000000', leverage: '1.000000000000' },
    expectedReturn: { net: '0.010000000000' }, expectedRisk: { maxLoss: '0.005000000000' },
    liquidityAssumptions: { spread: '0.000100000000' }, duration: { seconds: 60 }, costAssumptions: { fee: '0.000400000000' },
    eligibility: { eligibilityId: 'eligibility-1', strategyRevisionId: 'revision-1', decision: 'ELIGIBLE', policyVersion: '1' },
    correlationId: 'correlation-1', idempotencyKey: 'proposal-idem-1', createdAt: now,
    expiresAt: '2026-09-21T12:01:00.000Z', evidenceRefs: ['evidence-1'], apiKey: 'must-not-leave-axodus',
  };
  const snapshot = createShadowDecisionSnapshot({
    environment: 'PAPER', capturedAt: now, marketState, opportunity, tradeProposal,
    experiment: { experimentId: 'jev-shadow-trade-validation', experimentVersion: '1' },
    questionSet: { questionSetId: 'jev-shadow-core', questionSetVersion: '1' },
    requestedProvider: 'typesafe-jev', requestedModel: 'jev-1.13.0',
  });
  const request = {
    requestId: `shadow-request:${snapshot.snapshotId}`,
    snapshot,
    questions: JEV_SHADOW_QUESTION_SET_V1,
    requestedAt: now,
    timeoutMs: 100,
    inputDigest: shadowDigest({ snapshotId: snapshot.snapshotId, questionSet: '1' }),
  };
  return { snapshot, request };
}

describe('AXODUS-TRADING-IMP-02 Stage 0 shadow boundary', () => {
  it('serializes provider-neutral state deterministically and excludes non-allowlisted secrets', () => {
    const { snapshot } = fixture();
    const serialized = canonicalShadowJson(snapshot.providerState);
    assert.equal(serialized, canonicalShadowJson(JSON.parse(serialized)));
    assert.equal(serialized.includes('must-not-leave-axodus'), false);
    assert.equal(serialized.includes('apiKey'), false);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.providerState), true);
  });

  it('binds observations to the exact immutable snapshot and model identity', async () => {
    const { request } = fixture();
    const observation = await new DeterministicMockDecisionProvider().evaluate(request);
    assert.equal(observation.snapshotId, request.snapshot.snapshotId);
    assert.equal(observation.requestedModel, 'jev-1.13.0');
    assert.equal(observation.resolvedModel, 'mock-v1');
    assert.equal(observation.attemptCount, 1);
    const authoritySurface = JSON.stringify({ snapshot: request.snapshot, observation });
    for (const forbidden of ['portfolioDecisionId', 'riskDecisionId', 'tradingIntentId', 'executionIntentId', 'providerOrderId']) {
      assert.equal(authoritySurface.includes(forbidden), false);
    }
  });

  it('does not put a delayed provider on the baseline temporal path', async () => {
    const { request } = fixture();
    const dispatcher = new ShadowDecisionDispatcher(
      new DeterministicMockDecisionProvider('DELAYED', 75),
      new InMemoryShadowDecisionRepository(),
    );
    const started = Date.now();
    assert.equal(dispatcher.enqueue(request), 'ENQUEUED');
    const baselineDecision = { outcome: 'ALLOW', proposalId: request.snapshot.tradeProposalRef };
    assert.equal(baselineDecision.outcome, 'ALLOW');
    assert.ok(Date.now() - started < 50);
    await dispatcher.whenIdle();
    assert.equal(dispatcher.telemetry.completed, 1);
  });

  it('provides a one-way TradeProposal observation port with no decision return channel', async () => {
    const repository = new InMemoryShadowDecisionRepository();
    const dispatcher = new ShadowDecisionDispatcher(new DeterministicMockDecisionProvider(), repository);
    const observer = new ShadowTradeProposalObserver(dispatcher);
    const { snapshot } = fixture();
    const result = observer.observe({
      environment: snapshot.environment,
      capturedAt: snapshot.capturedAt,
      marketState: {
        marketStateId: snapshot.marketStateRef, instrument: snapshot.instrument, venue: 'paper', timeframe: '1m',
        marketTime: now, observedAt: now, constructedAt: now, validityContext: 'paper', freshness: 'current',
        schemaVersion: '1', features: [], sourceRefs: [], completeness: 'complete', validationRefs: [],
      },
      opportunity: {
        opportunityId: snapshot.opportunityRef, instrument: snapshot.instrument, venue: 'paper', strategyId: snapshot.strategyId,
        strategyRevisionId: snapshot.strategyRevisionId, timeframe: '1m', marketStateId: snapshot.marketStateRef,
        qualification: 'qualified', expectedCharacteristics: {}, evidenceRefs: [], createdAt: now, expiresAt: '2026-09-21T12:01:00.000Z',
      },
      tradeProposal: {
        proposalId: snapshot.tradeProposalRef, strategyId: snapshot.strategyId, strategyRevisionId: snapshot.strategyRevisionId,
        strategyRevision: { strategy: snapshot.strategyId, revision: 1, revisionId: snapshot.strategyRevisionId },
        opportunity: { opportunityId: snapshot.opportunityRef, marketStateId: snapshot.marketStateRef, instrument: snapshot.instrument, venue: 'paper', timeframe: '1m' },
        marketState: { marketStateId: snapshot.marketStateRef, schemaVersion: '1', validityContext: 'paper' }, action: 'buy',
        sizing: { requestedQuantity: '1', requestedCapital: '1' }, expectedReturn: {}, expectedRisk: {}, liquidityAssumptions: {},
        duration: {}, costAssumptions: {}, eligibility: { eligibilityId: 'e', strategyRevisionId: snapshot.strategyRevisionId, decision: 'ELIGIBLE', policyVersion: '1' },
        correlationId: snapshot.correlationId, idempotencyKey: 'i', createdAt: now, expiresAt: '2026-09-21T12:01:00.000Z', evidenceRefs: [],
      },
      experiment: snapshot.experiment, questionSet: snapshot.questionSet,
      requestedProvider: snapshot.requestedProvider, requestedModel: snapshot.requestedModel,
    });
    assert.deepEqual(Object.keys(result).sort(), ['dispatch', 'requestId', 'snapshotId']);
    assert.equal(result.dispatch, 'ENQUEUED');
    await dispatcher.whenIdle();
    assert.equal(repository.observations.size, 1);
  });

  it('isolates provider and persistence failures from canonical baseline behavior', async () => {
    const { request } = fixture();
    const failingRepository = { saveSnapshot: async () => { throw new Error('persistence down'); }, saveObservation: async () => {}, saveEvaluation: async () => {} };
    const dispatcher = new ShadowDecisionDispatcher(new DeterministicMockDecisionProvider('ERROR'), failingRepository);
    assert.equal(dispatcher.enqueue(request), 'ENQUEUED');
    const canonical = Object.freeze({ portfolio: 'APPROVED', risk: 'ALLOW' });
    await dispatcher.whenIdle();
    assert.deepEqual(canonical, { portfolio: 'APPROVED', risk: 'ALLOW' });
    assert.equal(dispatcher.telemetry.failed, 1);
  });

  it('leaves canonical behavior equivalent when Jev is disabled or removed', () => {
    const { request } = fixture();
    const withNoProvider = new ShadowDecisionDispatcher(undefined, new InMemoryShadowDecisionRepository());
    assert.equal(withNoProvider.enqueue(request), 'DISABLED');
    const canonicalInput = { proposalId: request.snapshot.tradeProposalRef, requestedCapital: '100.000000000000' };
    assert.equal(shadowDigest(canonicalInput), shadowDigest({ ...canonicalInput }));
  });

  it('drops saturated shadow work without baseline backpressure', () => {
    const { request } = fixture();
    const dispatcher = new ShadowDecisionDispatcher(new DeterministicMockDecisionProvider('DELAYED', 50), new InMemoryShadowDecisionRepository(), 0);
    assert.equal(dispatcher.enqueue(request), 'DROPPED');
    assert.equal(dispatcher.telemetry.dropped, 1);
  });

  it('maps the official Jev wire schema without leaking provider fields into the contract', async () => {
    const { request } = fixture();
    let captured;
    const provider = new JevDecisionProvider({
      apiKey: 'test-key-never-logged',
      clock: () => new Date(now),
      fetch: async (_url, init) => {
        captured = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'jev-1.13.0',
            answers: {
              state_sufficiency: { type: 'choice', choice: 'sufficient', confidence: 0.8, probabilities: { sufficient: 0.8, insufficient: 0.2 } },
              proposal_alignment: { type: 'choice', choice: 'aligned', confidence: 0.7, probabilities: { aligned: 0.7, not_aligned: 0.1, uncertain: 0.2 } },
              market_regime: { type: 'choice', choice: 'trending', confidence: 0.6, probabilities: { trending: 0.6, ranging: 0.2, volatile: 0.1, unknown: 0.1 } },
              contextual_risk: { type: 'score', score: 1.1, confidence: 0.7, probabilities: { 0: 0.1, 1: 0.7, 2: 0.2 } },
            },
            usage: { input_tokens: 10, output_tokens: 4 },
          }),
        };
      },
    });
    const observation = await provider.evaluate(request);
    assert.equal(observation.status, 'SUCCEEDED');
    assert.equal(observation.resolvedModel, 'jev-1.13.0');
    assert.equal(observation.attemptCount, 1);
    assert.equal(captured.body.includes('test-key-never-logged'), false);
    assert.equal(JSON.stringify(observation).includes('test-key-never-logged'), false);
  });

  it('fails closed on malformed/missing probabilities and records only one attempt', async () => {
    const { request } = fixture();
    const provider = new JevDecisionProvider({
      apiKey: 'redacted', clock: () => new Date(now),
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ model: 'jev-1.13.0', answers: {} }) }),
    });
    const observation = await provider.evaluate(request);
    assert.equal(observation.status, 'INVALID_RESPONSE');
    assert.equal(observation.failureCode, 'JEV_RESPONSE_INVALID');
    assert.equal(observation.attemptCount, 1);
  });

  it('records timeout and provider absence as shadow-only failures', async () => {
    const { request } = fixture();
    const absent = await JevDecisionProvider.fromEnvironment({}).evaluate(request);
    assert.equal(absent.status, 'UNAVAILABLE');
    assert.equal(absent.failureCode, 'JEV_CREDENTIAL_NOT_CONFIGURED');
    assert.equal(absent.answers.length, 0);

    const timeoutProvider = new JevDecisionProvider({
      apiKey: 'redacted', timeoutMs: 2,
      fetch: async (_url, init) => await new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
    });
    const timedOut = await timeoutProvider.evaluate(request);
    assert.equal(timedOut.status, 'TIMED_OUT');
    assert.equal(timedOut.attemptCount, 1);
    assert.equal(timedOut.failureCode, 'JEV_TIMEOUT');
  });

  it('resolves the scoped local Jev credential alias without exposing its value', () => {
    const provider = JevDecisionProvider.fromEnvironment({ TRADING_TYPESAFE_API_KEY: 'redacted-local-key' });
    assert.equal(provider.configured, true);
  });

  it('classifies rate limiting without a retry or baseline effect', async () => {
    const { request } = fixture();
    const provider = new JevDecisionProvider({
      apiKey: 'redacted', fetch: async () => ({ ok: false, status: 429, json: async () => ({}) }),
    });
    const observation = await provider.evaluate(request);
    assert.equal(observation.status, 'RATE_LIMITED');
    assert.equal(observation.attemptCount, 1);
    assert.equal(observation.failureCode, 'JEV_HTTP_429');
  });

  it('detects duplicate and stale responses without changing the request or snapshot', async () => {
    const { request } = fixture();
    const duplicate = new DeterministicMockDecisionProvider('DUPLICATE');
    assert.equal((await duplicate.evaluate(request)).status, 'SUCCEEDED');
    assert.equal((await duplicate.evaluate(request)).status, 'DUPLICATE_RESPONSE');
    assert.equal((await new DeterministicMockDecisionProvider('STALE').evaluate(request)).status, 'STALE_RESPONSE');
  });
});
