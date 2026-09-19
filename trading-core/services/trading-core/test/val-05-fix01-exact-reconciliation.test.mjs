import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ContinuousExecutionRuntime,
  DurableCexExecutionLifecycleService,
  InMemoryPostgresClient,
  PostgresDurableExecutionRepository,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const capabilities = {
  supportsCallerOrderIdentity: true,
  supportsExactOrderLookup: true,
  supportsDeterministicReconciliation: true,
};

function createHarness(reconciliationResult = {}) {
  const client = new InMemoryPostgresClient();
  const repository = new PostgresDurableExecutionRepository(client);
  const lifecycle = new DurableCexExecutionLifecycleService(repository, client);
  let submitCalls = 0;
  const lookupRequests = [];
  const mutationProvider = {
    providerId: 'binance',
    connector: 'binance-futures-testnet',
    capabilities,
    get calls() { return submitCalls; },
    async submitOrder(request) {
      submitCalls += 1;
      return {
        providerOrderId: reconciliationResult.providerOrderId ?? `provider-${request.attemptId}`,
        providerStatus: 'NEW',
        filledQuantity: '0',
        remainingQuantity: request.quantity,
      };
    },
  };
  const reconciliationProvider = {
    providerId: 'binance',
    connector: 'binance-futures-testnet',
    capabilities,
    get calls() { return lookupRequests.length; },
    get requests() { return lookupRequests; },
    async reconcileByClientOrderId(request) {
      lookupRequests.push(request);
      if (reconciliationResult.throwError) {
        throw new Error(reconciliationResult.throwError);
      }
      const status = reconciliationResult.providerStatus ?? 'NEW';
      return {
        outcome: reconciliationResult.outcome ?? 'found',
        ...(reconciliationResult.outcome === 'not-found' ? {} : {
          evidence: {
            executionClientOrderId: request.executionClientOrderId,
            providerOrderId: reconciliationResult.providerOrderId ?? `provider-${request.attemptId}`,
            providerStatus: status,
            filledQuantity: reconciliationResult.filledQuantity ?? '0',
            remainingQuantity: reconciliationResult.remainingQuantity ?? '0.001',
            observedAt: '2026-09-19T12:00:00.000Z',
            source: 'rest-exact-lookup',
          },
        }),
        observedAt: '2026-09-19T12:00:00.000Z',
      };
    },
  };
  const runtime = new ContinuousExecutionRuntime(lifecycle, mutationProvider, reconciliationProvider);
  return { client, repository, runtime, mutationProvider, reconciliationProvider };
}

function options(attemptId = 'val-05-fix01-ack') {
  return {
    attemptId,
    intentId: `intent-${attemptId}`,
    correlationId: `correlation-${attemptId}`,
    providerId: 'binance',
    connector: 'binance-futures-testnet',
    market: 'BTCUSDT',
    symbol: 'BTCUSDT',
    instrument: 'BTCUSDT_PERPETUAL',
    side: 'buy',
    orderType: 'limit',
    quantity: '0.001',
    price: '50000',
    environment: 'testnet',
    maxOrderNotional: 250,
    maxTotalRunNotional: 2500,
    maxOutstandingOrders: 1,
  };
}

describe('VAL-05-FIX-01: provider acknowledgement requires exact reconciliation', () => {
  it('looks up an acknowledged execution by its persisted client identity without a second POST', async () => {
    const { runtime, repository, mutationProvider, reconciliationProvider } = createHarness({
      providerOrderId: 'provider-ack-001',
    });
    const input = options();

    const submitted = await runtime.execute(input);
    assert.equal(submitted.status, 'SUBMITTED');
    assert.equal(submitted.durableAttempt.state, 'provider-acknowledged');
    assert.equal(mutationProvider.calls, 1);

    const reconciled = await runtime.reconcile(input.attemptId);
    assert.equal(reconciled.state, 'reconciled-found');
    assert.equal(reconciliationProvider.calls, 1);
    assert.equal(reconciliationProvider.requests[0].executionClientOrderId, submitted.executionClientOrderId);
    assert.equal(reconciled.providerOrderId, 'provider-ack-001');
    assert.equal(mutationProvider.calls, 1);

    const persisted = await repository.get(input.attemptId);
    assert.equal(persisted.executionClientOrderId, submitted.executionClientOrderId);
    assert.equal(persisted.state, 'reconciled-found');
  });

  it('returns acknowledged executions as submitted but reconciliation-required on re-entry', async () => {
    const { runtime, mutationProvider } = createHarness();
    const input = options('val-05-fix01-reentry');

    const first = await runtime.execute(input);
    const second = await runtime.execute(input);

    assert.equal(first.status, 'SUBMITTED');
    assert.equal(second.status, 'SUBMITTED');
    assert.equal(second.reconciliationRequired, true);
    assert.equal(second.executionClientOrderId, first.executionClientOrderId);
    assert.equal(mutationProvider.calls, 1);
  });

  for (const providerStatus of ['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED']) {
    it(`consumes provider ${providerStatus} state through exact reconciliation`, async () => {
      const { runtime, reconciliationProvider } = createHarness({ providerStatus });
      const input = options(`val-05-fix01-${providerStatus.toLowerCase()}`);

      await runtime.execute(input);
      const result = await runtime.reconcile(input.attemptId);

      assert.equal(result.state, 'reconciled-found');
      assert.equal(result.evidence.providerStatus, providerStatus);
      assert.equal(reconciliationProvider.calls, 1);
    });
  }

  it('keeps lookup failure indeterminate and never mutates to recover', async () => {
    const { runtime, repository, mutationProvider, reconciliationProvider } = createHarness({
      throwError: 'temporary exact lookup outage',
    });
    const input = options('val-05-fix01-lookup-failure');

    await runtime.execute(input);
    const result = await runtime.reconcile(input.attemptId);

    assert.equal(result.state, 'reconciled-indeterminate');
    assert.match(result.lastFailure, /temporary exact lookup outage/);
    assert.equal(reconciliationProvider.calls, 1);
    assert.equal(mutationProvider.calls, 1);
    assert.equal((await repository.get(input.attemptId)).state, 'reconciled-indeterminate');
  });

  it('makes repeated reconciliation terminal and mutation-free', async () => {
    const { runtime, mutationProvider, reconciliationProvider } = createHarness({
      providerOrderId: 'provider-repeat-001',
    });
    const input = options('val-05-fix01-repeat');

    await runtime.execute(input);
    const first = await runtime.reconcile(input.attemptId);
    const second = await runtime.reconcile(input.attemptId);

    assert.equal(first.state, 'reconciled-found');
    assert.deepEqual(second, first);
    assert.equal(reconciliationProvider.calls, 1);
    assert.equal(mutationProvider.calls, 1);
  });

  it('uses the persisted client identity even when provider order identity was acknowledged', async () => {
    const { runtime, reconciliationProvider } = createHarness({
      providerOrderId: 'provider-known-001',
    });
    const input = options('val-05-fix01-known-provider-id');

    const submitted = await runtime.execute(input);
    const reconciled = await runtime.reconcile(input.attemptId);

    assert.equal(submitted.providerOrderId, 'provider-known-001');
    assert.equal(reconciled.providerOrderId, 'provider-known-001');
    assert.equal(reconciliationProvider.requests[0].executionClientOrderId, submitted.executionClientOrderId);
  });
});
