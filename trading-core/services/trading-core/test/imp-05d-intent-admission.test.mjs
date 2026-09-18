import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ContinuousExecutionRuntime,
  ContinuousIntentAdmissionService,
  ContinuousKillSwitch,
  ContinuousPositionReconciliationService,
  ContinuousRiskEnvelopeService,
  DurableCexExecutionLifecycleService,
  InMemoryPostgresClient,
  PostgresDurableExecutionRepository,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function createMockMutationProvider(options = {}) {
  let calls = 0;
  return {
    providerId: 'binance',
    connector: 'binance-futures-testnet',
    capabilities: {
      supportsCallerOrderIdentity: true,
      supportsExactOrderLookup: true,
      supportsDeterministicReconciliation: true,
    },
    get calls() { return calls; },
    async submitOrder(request) {
      calls += 1;
      return {
        providerOrderId: 'binance-order-' + request.attemptId,
        providerStatus: 'NEW',
        filledQuantity: '0',
        remainingQuantity: request.quantity,
      };
    },
  };
}

function createMockReconciliationProvider() {
  return {
    providerId: 'binance',
    connector: 'binance-futures-testnet',
    capabilities: {
      supportsCallerOrderIdentity: true,
      supportsExactOrderLookup: true,
      supportsDeterministicReconciliation: true,
    },
    async reconcileByClientOrderId(request) {
      return {
        outcome: 'found',
        evidence: {
          executionClientOrderId: request.executionClientOrderId,
          providerOrderId: 'prov-id-123',
          providerStatus: 'NEW',
          filledQuantity: '0',
          remainingQuantity: '0.001',
          observedAt: '2026-09-18T12:00:00.000Z',
          source: 'rest-exact-lookup',
        },
      };
    },
  };
}

function createHarness(options = {}) {
  const db = new InMemoryPostgresClient();
  const repo = new PostgresDurableExecutionRepository(db);
  const lifecycle = new DurableCexExecutionLifecycleService(repo, db);
  const mutationProvider = createMockMutationProvider(options);
  const reconciliationProvider = createMockReconciliationProvider();
  const runtime = new ContinuousExecutionRuntime(
    lifecycle,
    mutationProvider,
    reconciliationProvider,
    undefined,
    () => '2026-09-18T12:00:00.000Z',
  );
  const killSwitch = new ContinuousKillSwitch(() => '2026-09-18T12:00:00.000Z');
  const riskService = new ContinuousRiskEnvelopeService({
    environment: 'testnet',
    allowedSymbols: ['BTCUSDT'],
    maxOrderNotional: 250,
    maxPositionNotional: 1000,
    maxTotalRunNotional: 5000,
    maxOutstandingOrders: 1,
    maxMarketDataAgeMs: 5000,
    maxPriceDeviationFraction: 0.05,
  }, killSwitch);
  const admissionService = new ContinuousIntentAdmissionService(
    runtime,
    riskService,
    killSwitch,
    { requireDeterministicSymbolLock: options.requireDeterministicSymbolLock ?? false },
    () => '2026-09-18T12:00:00.000Z',
  );

  return { db, repo, lifecycle, mutationProvider, runtime, killSwitch, riskService, admissionService };
}

describe('IMP-05D: Continuous Intent Admission & Operational Concurrency', () => {
  it('admits valid trading intent through canonical pipeline without credentials', async () => {
    const { admissionService, mutationProvider } = createHarness();
    const intent = {
      intentId: 'intent-001',
      source: { type: 'strategy', id: 'whiterabbit-strat-1', correlationId: 'corr-001' },
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
    };

    const res = await admissionService.submitIntent(intent);
    assert.equal(res.admitted, true);
    assert.equal(res.intentId, 'intent-001');
    assert.equal(res.executionResult?.status, 'SUBMITTED');
    assert.equal(mutationProvider.calls, 1);
  });

  it('blocks intent admission when kill switch is active', async () => {
    const { admissionService, killSwitch, mutationProvider } = createHarness();
    killSwitch.trigger('OPERATOR_STOP', 'Manual intervention');

    const intent = {
      intentId: 'intent-002',
      source: { type: 'agent', id: 'agent-1', correlationId: 'corr-002' },
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
    };

    const res = await admissionService.submitIntent(intent);
    assert.equal(res.admitted, false);
    assert.equal(res.rejectionCode, 'KILL_SWITCH_ACTIVE');
    assert.equal(mutationProvider.calls, 0);
  });

  it('rejects duplicate intent idempotently without second mutation', async () => {
    const { admissionService, mutationProvider } = createHarness();
    const intent = {
      intentId: 'intent-003',
      source: { type: 'strategy', id: 'strat-1', correlationId: 'corr-003' },
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
    };

    const res1 = await admissionService.submitIntent(intent);
    assert.equal(res1.admitted, true);
    assert.equal(mutationProvider.calls, 1);

    const res2 = await admissionService.submitIntent(intent);
    assert.equal(res2.admitted, true);
    assert.equal(res2.intentId, 'intent-003');
    assert.equal(mutationProvider.calls, 1);
  });

  it('rejects intent when position divergence exists', async () => {
    const { admissionService, mutationProvider } = createHarness();
    const intent = {
      intentId: 'intent-004',
      source: { type: 'trinity', id: 'trinity-1', correlationId: 'corr-004' },
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
    };

    const divergence = {
      divergent: true,
      status: 'DIVERGENT',
      findings: [{
        type: 'position-divergence',
        state: 'divergent',
        severity: 'critical',
        message: 'Discrepancy found on venue',
      }],
      localPositions: [],
      venuePositions: [],
    };

    const res = await admissionService.submitIntent(intent, divergence);
    assert.equal(res.admitted, false);
    assert.equal(res.rejectionCode, 'POSITION_DIVERGENCE_UNRESOLVED');
    assert.equal(mutationProvider.calls, 0);
  });

  it('rejects intent with unapproved symbol or exceeding risk limits', async () => {
    const { admissionService, mutationProvider } = createHarness();
    const unapprovedSymbolIntent = {
      intentId: 'intent-005',
      source: { type: 'strategy', id: 'strat-1', correlationId: 'corr-005' },
      market: 'ETHUSDT',
      symbol: 'ETHUSDT',
      instrument: 'ETHUSDT',
      side: 'buy',
      orderType: 'limit',
      quantity: '0.01',
      price: '3000',
      providerId: 'binance',
      connector: 'binance-futures-testnet',
      createdAt: '2026-09-18T12:00:00.000Z',
    };

    const res = await admissionService.submitIntent(unapprovedSymbolIntent);
    assert.equal(res.admitted, false);
    assert.equal(res.rejectionCode, 'RISK_REJECTED');
    assert.equal(mutationProvider.calls, 0);
  });

  it('handles concurrent identical intent submissions without duplicating mutation', async () => {
    const { admissionService, mutationProvider } = createHarness();
    const intent = {
      intentId: 'intent-conc-1',
      source: { type: 'agent', id: 'agent-1', correlationId: 'corr-c1' },
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
    };

    const [r1, r2] = await Promise.all([
      admissionService.submitIntent(intent),
      admissionService.submitIntent(intent),
    ]);

    assert.equal(r1.admitted, true);
    assert.equal(r2.admitted, true);
    assert.equal(r1.executionResult?.durableAttempt.attemptId, 'intent-conc-1');
    assert.equal(mutationProvider.calls, 1);
  });
});
