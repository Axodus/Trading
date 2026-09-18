import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ContinuousExecutionRuntime,
  ContinuousIntentAdmissionService,
  ContinuousKillSwitch,
  ContinuousObservabilityCollector,
  ContinuousOrderRecoveryService,
  ContinuousPositionReconciliationService,
  ContinuousRiskEnvelopeService,
  ContinuousSimulationRunner,
  DurableCexExecutionLifecycleService,
  InMemoryPostgresClient,
  PostgresDurableExecutionRepository,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function createFailureInjectionHarness(options = {}) {
  const db = new InMemoryPostgresClient();
  const repo = new PostgresDurableExecutionRepository(db);
  const lifecycle = new DurableCexExecutionLifecycleService(repo, db);
  let submitOrderCalls = 0;
  let reconcileCalls = 0;

  const mutationProvider = {
    providerId: 'binance',
    connector: 'binance-futures-testnet',
    capabilities: {
      supportsCallerOrderIdentity: true,
      supportsExactOrderLookup: true,
      supportsDeterministicReconciliation: true,
    },
    get calls() { return submitOrderCalls; },
    async submitOrder(request) {
      submitOrderCalls += 1;
      if (options.failMutation) {
        throw new Error(options.mutationError ?? 'Mutation POST timeout / socket hang up');
      }
      if (options.rejectMutation) {
        return {
          providerOrderId: '',
          providerStatus: 'REJECTED',
          filledQuantity: '0',
          remainingQuantity: '0',
        };
      }
      return {
        providerOrderId: options.providerOrderId ?? `binance-order-${request.attemptId}`,
        providerStatus: options.providerStatus ?? 'NEW',
        filledQuantity: options.filledQuantity ?? '0',
        remainingQuantity: options.remainingQuantity ?? request.quantity,
      };
    },
  };

  const reconciliationProvider = {
    providerId: 'binance',
    connector: 'binance-futures-testnet',
    capabilities: {
      supportsCallerOrderIdentity: true,
      supportsExactOrderLookup: true,
      supportsDeterministicReconciliation: true,
    },
    get calls() { return reconcileCalls; },
    async reconcileByClientOrderId(request) {
      reconcileCalls += 1;
      if (options.failReconciliation) {
        return {
          outcome: 'indeterminate',
          reason: options.reconciliationError ?? 'Network timeout during exact lookup',
          observedAt: new Date().toISOString(),
        };
      }
      if (options.reconciliationOutcome === 'not-found') {
        return {
          outcome: 'not-found',
          observedAt: new Date().toISOString(),
        };
      }
      return {
        outcome: 'found',
        evidence: {
          executionClientOrderId: request.executionClientOrderId,
          providerOrderId: options.recoveredProviderOrderId ?? `binance-order-${request.attemptId}`,
          providerStatus: options.recoveredProviderStatus ?? 'NEW',
          filledQuantity: options.recoveredFilledQuantity ?? '0',
          remainingQuantity: options.recoveredRemainingQuantity ?? '0.001',
          observedAt: new Date().toISOString(),
          source: 'rest-exact-lookup',
        },
      };
    },
  };

  const runtime = new ContinuousExecutionRuntime(
    lifecycle,
    mutationProvider,
    reconciliationProvider,
    undefined,
    () => '2026-09-18T12:00:00.000Z',
  );
  const killSwitch = new ContinuousKillSwitch(() => '2026-09-18T12:00:00.000Z');
  const riskService = new ContinuousRiskEnvelopeService({
    environment: options.environment ?? 'testnet',
    allowedSymbols: ['BTCUSDT'],
    maxOrderNotional: 250,
    maxPositionNotional: 1000,
    maxTotalRunNotional: 5000,
    maxOutstandingOrders: 2,
    maxMarketDataAgeMs: 5000,
    maxPriceDeviationFraction: 0.05,
  }, killSwitch);
  const admissionService = new ContinuousIntentAdmissionService(
    runtime,
    riskService,
    killSwitch,
    {},
    () => '2026-09-18T12:00:00.000Z',
  );
  const recoveryService = new ContinuousOrderRecoveryService(
    repo,
    lifecycle,
    reconciliationProvider,
    undefined,
    () => '2026-09-18T12:00:00.000Z',
  );
  const posReconciliation = new ContinuousPositionReconciliationService();
  const observability = new ContinuousObservabilityCollector(() => '2026-09-18T12:00:00.000Z');
  const simulationRunner = new ContinuousSimulationRunner(admissionService, observability, () => '2026-09-18T12:00:00.000Z');

  return {
    db,
    repo,
    lifecycle,
    runtime,
    killSwitch,
    riskService,
    admissionService,
    recoveryService,
    posReconciliation,
    observability,
    simulationRunner,
    mutationProvider,
    reconciliationProvider,
  };
}

describe('IMP-05E: Failure Injection Suite & Continuous Runtime Hardening', () => {
  it('Scenario 1: Persistence failure blocks mutation from being attempted (attempts = 0)', async () => {
    const brokenDb = {
      async transaction() {
        throw new Error('Database connection lost / disk full');
      },
      async query() {
        throw new Error('Database connection lost / disk full');
      },
    };
    const repo = new PostgresDurableExecutionRepository(brokenDb);
    const lifecycle = new DurableCexExecutionLifecycleService(repo, brokenDb);
    let mutationCalls = 0;
    const mutationProvider = {
      providerId: 'binance',
      connector: 'binance-futures-testnet',
      capabilities: { supportsCallerOrderIdentity: true, supportsExactOrderLookup: true, supportsDeterministicReconciliation: true },
      async submitOrder() { mutationCalls += 1; return { providerOrderId: 'p1', providerStatus: 'NEW' }; },
    };
    const reconciliationProvider = {
      providerId: 'binance',
      connector: 'binance-futures-testnet',
      capabilities: { supportsCallerOrderIdentity: true, supportsExactOrderLookup: true, supportsDeterministicReconciliation: true },
      async reconcileByClientOrderId() { return { outcome: 'not-found', observedAt: new Date().toISOString() }; },
    };
    const runtime = new ContinuousExecutionRuntime(lifecycle, mutationProvider, reconciliationProvider);

    await assert.rejects(async () => {
      await runtime.execute({
        attemptId: 'att-db-fail',
        intentId: 'intent-db-fail',
        correlationId: 'corr-db-fail',
        providerId: 'binance',
        connector: 'binance-futures-testnet',
        market: 'BTCUSDT',
        symbol: 'BTCUSDT',
        instrument: 'BTCUSDT',
        side: 'buy',
        orderType: 'limit',
        quantity: '0.001',
        price: '60000',
      });
    }, /Database connection lost/);

    assert.equal(mutationCalls, 0);
  });

  it('Scenario 2: Ambiguous POST response records UNKNOWN state without blind retry', async () => {
    const harness = createFailureInjectionHarness({ failMutation: true });
    const res = await harness.runtime.execute({
      attemptId: 'att-ambiguous-01',
      intentId: 'intent-amb-01',
      correlationId: 'corr-amb-01',
      providerId: 'binance',
      connector: 'binance-futures-testnet',
      market: 'BTCUSDT',
      symbol: 'BTCUSDT',
      instrument: 'BTCUSDT',
      side: 'buy',
      orderType: 'limit',
      quantity: '0.001',
      price: '60000',
    });

    assert.equal(res.status, 'UNKNOWN');
    assert.equal(res.reconciliationRequired, true);
    assert.equal(res.durableAttempt.state, 'execution-unknown');
    assert.equal(harness.mutationProvider.calls, 1);
  });

  it('Scenario 3: Recovery survives crash post-POST and recovers provider order without second mutation', async () => {
    const harness = createFailureInjectionHarness({
      failMutation: true,
      recoveredProviderOrderId: 'binance-order-recovered-99',
      recoveredProviderStatus: 'NEW',
    });

    await harness.runtime.execute({
      attemptId: 'att-crash-01',
      intentId: 'intent-crash-01',
      correlationId: 'corr-crash-01',
      providerId: 'binance',
      connector: 'binance-futures-testnet',
      market: 'BTCUSDT',
      symbol: 'BTCUSDT',
      instrument: 'BTCUSDT',
      side: 'buy',
      orderType: 'limit',
      quantity: '0.001',
      price: '60000',
    });

    const recoveryResult = await harness.recoveryService.recoverAll();
    assert.equal(recoveryResult.recoveredCount, 1);
    assert.equal(recoveryResult.outcomes[0].outcome, 'found');
    assert.equal(recoveryResult.outcomes[0].finalState, 'reconciled-found');
    assert.equal(harness.mutationProvider.calls, 1); // Exact 1 mutation, 0 blind retries
  });

  it('Scenario 4: Observability records sanitized telemetry without exposing secrets', async () => {
    const harness = createFailureInjectionHarness();
    harness.observability.record({
      eventType: 'ORDER_SUBMITTED',
      intentId: 'intent-sec-01',
      details: {
        symbol: 'BTCUSDT',
        apiKey: 'secret-api-key-testnet-12345',
        authToken: 'jwt-bearer-super-secret',
        price: 60000,
      },
    });

    const events = harness.observability.getEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0].details.apiKey, '[REDACTED]');
    assert.equal(events[0].details.authToken, '[REDACTED]');
    assert.equal(events[0].details.price, 60000);
  });

  it('Scenario 5: Continuous Simulation Session executes sequential intents across admission, risk and observability', async () => {
    const harness = createFailureInjectionHarness();
    const intents = [
      {
        intentId: 'sim-intent-1',
        source: { type: 'strategy', id: 'strat-alpha', correlationId: 'sim-corr-1' },
        market: 'BTCUSDT',
        symbol: 'BTCUSDT',
        instrument: 'BTCUSDT',
        side: 'buy',
        orderType: 'limit',
        quantity: '0.001',
        price: '60000',
        providerId: 'binance',
        connector: 'binance-futures-testnet',
        createdAt: '2026-09-18T12:00:00.000Z',
      },
      {
        intentId: 'sim-intent-2',
        source: { type: 'strategy', id: 'strat-alpha', correlationId: 'sim-corr-2' },
        market: 'BTCUSDT',
        symbol: 'BTCUSDT',
        instrument: 'BTCUSDT',
        side: 'buy',
        orderType: 'limit',
        quantity: '0.001',
        price: '60000',
        providerId: 'binance',
        connector: 'binance-futures-testnet',
        createdAt: '2026-09-18T12:01:00.000Z',
      },
    ];

    const session = await harness.simulationRunner.runSession(intents);
    console.log(JSON.stringify(session, null, 2)); assert.equal(session.totalIntents, 2);
    assert.equal(session.admittedCount, 2);
    assert.equal(session.rejectedCount, 0);
    assert.equal(session.blockedCount, 0);
    assert.equal(session.observability.eventCount, 2);
    assert.equal(session.observability.metrics.intentsAdmitted, 2);
  });
});
