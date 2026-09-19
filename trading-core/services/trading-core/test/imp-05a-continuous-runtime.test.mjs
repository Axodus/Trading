import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ContinuousExecutionRuntime,
  ContinuousExecutionRuntimeError,
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
      if (options.throwError) {
        throw new Error(options.errorMessage ?? 'Network timeout during POST');
      }
      return {
        providerOrderId: options.providerOrderId ?? `prov-order-${request.attemptId}`,
        providerStatus: options.providerStatus ?? 'NEW',
        filledQuantity: '0',
        remainingQuantity: request.quantity,
      };
    },
  };
}

function createMockReconciliationProvider(options = {}) {
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
    async reconcileByClientOrderId(request) {
      calls += 1;
      if (options.outcome === 'found') {
        return {
          outcome: 'found',
          evidence: {
            executionClientOrderId: request.executionClientOrderId,
            providerOrderId: options.providerOrderId ?? `prov-order-${request.attemptId}`,
            providerStatus: options.providerStatus ?? 'NEW',
            filledQuantity: '0',
            remainingQuantity: '0.001',
            observedAt: new Date().toISOString(),
            source: 'rest-exact-lookup',
          },
        };
      }
      if (options.outcome === 'not-found') {
        return {
          outcome: 'not-found',
          observedAt: new Date().toISOString(),
        };
      }
      return {
        outcome: 'indeterminate',
        reason: options.reason ?? 'Network error during reconciliation',
        observedAt: new Date().toISOString(),
      };
    },
  };
}

function createTestRuntime(mutationOptions = {}, reconOptions = {}) {
  const client = new InMemoryPostgresClient();
  const repository = new PostgresDurableExecutionRepository(client);
  const lifecycleService = new DurableCexExecutionLifecycleService(repository, client);
  const mutationProvider = createMockMutationProvider(mutationOptions);
  const reconciliationProvider = createMockReconciliationProvider(reconOptions);
  const runtime = new ContinuousExecutionRuntime(lifecycleService, mutationProvider, reconciliationProvider);
  return { runtime, repository, mutationProvider, reconciliationProvider, lifecycleService, client };
}

function validExecutionOptions(attemptId = 'att-001') {
  return {
    attemptId,
    intentId: `intent-${attemptId}`,
    correlationId: `corr-${attemptId}`,
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

describe('IMP-05A: Continuous Execution Runtime & Durable Ownership', () => {
  it('creates durable attempt and deterministic client order ID before external mutation', async () => {
    const { runtime, repository, mutationProvider } = createTestRuntime();
    const options = validExecutionOptions('att-durable-01');

    const result = await runtime.execute(options);
    assert.equal(result.status, 'SUBMITTED');
    assert.equal(result.attemptId, 'att-durable-01');
    assert.match(result.executionClientOrderId, /^ax-att-durable-01/);
    assert.equal(mutationProvider.calls, 1);

    const persisted = await repository.get('att-durable-01');
    assert.ok(persisted);
    assert.equal(persisted.state, 'provider-acknowledged');
    assert.equal(persisted.executionClientOrderId, result.executionClientOrderId);
    assert.equal(persisted.providerOrderId, 'prov-order-att-durable-01');
  });

  it('rejects forbidden environment (mainnet) in preflight without attempting mutation', async () => {
    const { runtime, mutationProvider, repository } = createTestRuntime();
    const options = {
      ...validExecutionOptions('att-mainnet-reject'),
      environment: 'mainnet',
    };

    const result = await runtime.execute(options);
    assert.equal(result.status, 'PREFLIGHT_REJECTED');
    assert.equal(result.preflightViolationCode, 'ENVIRONMENT_REJECTED');
    assert.equal(mutationProvider.calls, 0);

    const persisted = await repository.get('att-mainnet-reject');
    assert.ok(persisted);
    assert.equal(persisted.state, 'rejected');
    assert.match(persisted.lastFailure, /Environment 'mainnet' is not admitted/);
  });

  it('rejects order exceeding maxOrderNotional ceiling without attempting mutation', async () => {
    const { runtime, mutationProvider, repository } = createTestRuntime();
    const options = {
      ...validExecutionOptions('att-notional-exceeded'),
      quantity: '0.01',
      price: '50000', // 500 USDT notional > 250 maxOrderNotional
      maxOrderNotional: 250,
    };

    const result = await runtime.execute(options);
    assert.equal(result.status, 'PREFLIGHT_REJECTED');
    assert.equal(result.preflightViolationCode, 'MAX_ORDER_NOTIONAL_EXCEEDED');
    assert.equal(mutationProvider.calls, 0);

    const persisted = await repository.get('att-notional-exceeded');
    assert.ok(persisted);
    assert.equal(persisted.state, 'rejected');
  });

  it('records UNKNOWN state and requires reconciliation when mutation encounters network error (no blind retry)', async () => {
    const { runtime, mutationProvider, repository } = createTestRuntime({
      throwError: true,
      errorMessage: 'ETIMEDOUT connecting to Binance',
    });
    const options = validExecutionOptions('att-ambiguous-01');

    const result = await runtime.execute(options);
    assert.equal(result.status, 'UNKNOWN');
    assert.equal(result.reconciliationRequired, true);
    assert.match(result.error, /ETIMEDOUT/);
    assert.equal(mutationProvider.calls, 1);

    const persisted = await repository.get('att-ambiguous-01');
    assert.ok(persisted);
    assert.equal(persisted.state, 'execution-unknown');

    // Executing the same attemptId again should not submit another mutation
    const duplicateRun = await runtime.execute(options);
    assert.equal(duplicateRun.status, 'UNKNOWN');
    assert.equal(duplicateRun.reconciliationRequired, true);
    assert.equal(mutationProvider.calls, 1); // Remains 1, zero blind resubmission
  });

  it('reconciles ambiguous execution deterministically via exact lookup', async () => {
    const { runtime, repository, mutationProvider } = createTestRuntime(
      { throwError: true },
      { outcome: 'found', providerOrderId: 'recon-prov-order-01' }
    );
    const options = validExecutionOptions('att-recon-01');

    await runtime.execute(options);
    assert.equal(mutationProvider.calls, 1);

    const reconciled = await runtime.reconcile('att-recon-01');
    assert.equal(reconciled.state, 'reconciled-found');
    assert.equal(reconciled.providerOrderId, 'recon-prov-order-01');

    const persisted = await repository.get('att-recon-01');
    assert.equal(persisted.state, 'reconciled-found');
  });

  it('suppresses concurrent duplicate executions for the same attemptId', async () => {
    const { runtime, mutationProvider } = createTestRuntime();
    const options = validExecutionOptions('att-concurrent-01');

    const [res1, res2] = await Promise.all([
      runtime.execute(options),
      runtime.execute(options),
    ]);

    assert.equal(res1.status, 'SUBMITTED');
    assert.equal(res2.status, 'SUBMITTED');
    assert.equal(res1.executionClientOrderId, res2.executionClientOrderId);
    assert.equal(mutationProvider.calls, 1); // Exactly one external mutation
  });

  it('supports multiple sequential executions with distinct deterministic identities', async () => {
    const { runtime, mutationProvider, repository } = createTestRuntime({}, { outcome: 'found' });

    const options1 = validExecutionOptions('att-seq-01');
    const options2 = validExecutionOptions('att-seq-02');

    const res1 = await runtime.execute(options1);
    assert.equal(res1.status, 'SUBMITTED');

    // Reconcile/cancel to clear active order if maxOutstandingOrders is 1
    await runtime.reconcile('att-seq-01');

    const res2 = await runtime.execute(options2);
    assert.equal(res2.status, 'SUBMITTED');
    assert.notEqual(res1.executionClientOrderId, res2.executionClientOrderId);
    assert.equal(mutationProvider.calls, 2);

    const p1 = await repository.get('att-seq-01');
    const p2 = await repository.get('att-seq-02');
    assert.ok(p1);
    assert.ok(p2);
  });
});
