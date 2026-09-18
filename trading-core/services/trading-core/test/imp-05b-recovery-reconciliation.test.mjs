import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ContinuousExecutionRuntime,
  ContinuousOrderRecoveryService,
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
      if (options.throwError) {
        throw new Error(options.errorMessage ?? 'Network timeout during reconciliation lookup');
      }
      const outcome = typeof options.outcome === 'function' ? options.outcome(request) : (options.outcome ?? 'found');
      if (outcome === 'found') {
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
      if (outcome === 'not-found') {
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

function setupTestEnvironment(mutationOptions = {}, reconOptions = {}) {
  const client = new InMemoryPostgresClient();
  const repository = new PostgresDurableExecutionRepository(client);
  const lifecycleService = new DurableCexExecutionLifecycleService(repository, client);
  const mutationProvider = createMockMutationProvider(mutationOptions);
  const reconciliationProvider = createMockReconciliationProvider(reconOptions);
  const runtime = new ContinuousExecutionRuntime(lifecycleService, mutationProvider, reconciliationProvider);
  const recoveryService = new ContinuousOrderRecoveryService(repository, lifecycleService, reconciliationProvider);
  return { runtime, repository, mutationProvider, reconciliationProvider, lifecycleService, recoveryService, client };
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

describe('IMP-05B: Failure Recovery & Order Reconciliation', () => {
  it('discovers non-terminal recovery candidates after crash / ambiguous state', async () => {
    const { runtime, recoveryService, repository } = setupTestEnvironment({ throwError: true });

    // Simulate 2 ambiguous executions (e.g. timeout during POST)
    await runtime.execute(validExecutionOptions('att-crash-01'));
    await runtime.execute(validExecutionOptions('att-crash-02'));

    const candidates = await recoveryService.findRecoveryCandidates();
    assert.equal(candidates.length, 2);
    assert.deepEqual(
      candidates.map((c) => c.attemptId).sort(),
      ['att-crash-01', 'att-crash-02'],
    );
    assert.equal(candidates[0].state, 'execution-unknown');
    assert.equal(candidates[1].state, 'execution-unknown');
  });

  it('recovers ambiguous execution on startup when provider accepted the order (found)', async () => {
    const { runtime, recoveryService, repository, mutationProvider, reconciliationProvider } = setupTestEnvironment(
      { throwError: true },
      { outcome: 'found', providerOrderId: 'binance-recovered-101' }
    );

    // Initial POST failed with network timeout
    const initial = await runtime.execute(validExecutionOptions('att-rec-found-01'));
    assert.equal(initial.status, 'UNKNOWN');
    assert.equal(initial.reconciliationRequired, true);
    assert.equal(mutationProvider.calls, 1);

    // Run recovery
    const recoveryResult = await recoveryService.recoverAll();
    assert.equal(recoveryResult.recoveredCount, 1);
    assert.equal(recoveryResult.terminalCount, 1);
    assert.equal(recoveryResult.indeterminateCount, 0);
    assert.equal(recoveryResult.errorCount, 0);
    assert.equal(reconciliationProvider.calls, 1);
    // Invariant: zero additional mutations
    assert.equal(mutationProvider.calls, 1);

    const persisted = await repository.get('att-rec-found-01');
    assert.equal(persisted.state, 'reconciled-found');
    assert.equal(persisted.providerOrderId, 'binance-recovered-101');
  });

  it('recovers ambiguous execution on startup when provider never received the order (not-found)', async () => {
    const { runtime, recoveryService, repository, mutationProvider, reconciliationProvider } = setupTestEnvironment(
      { throwError: true },
      { outcome: 'not-found' }
    );

    await runtime.execute(validExecutionOptions('att-rec-notfound-01'));
    assert.equal(mutationProvider.calls, 1);

    const recoveryResult = await recoveryService.recoverAll();
    assert.equal(recoveryResult.recoveredCount, 1);
    assert.equal(recoveryResult.terminalCount, 1);
    assert.equal(reconciliationProvider.calls, 1);
    // Invariant: no blind resubmission
    assert.equal(mutationProvider.calls, 1);

    const persisted = await repository.get('att-rec-notfound-01');
    assert.equal(persisted.state, 'reconciled-not-found');
  });

  it('handles reconciliation lookup network failure safely by preserving indeterminate state', async () => {
    const { runtime, recoveryService, repository, mutationProvider, reconciliationProvider } = setupTestEnvironment(
      { throwError: true },
      { throwError: true, errorMessage: 'ECONNRESET on lookup' }
    );

    await runtime.execute(validExecutionOptions('att-recon-fail-01'));

    const recoveryResult = await recoveryService.recoverAll();
    assert.equal(recoveryResult.indeterminateCount, 1);
    assert.equal(recoveryResult.terminalCount, 0);
    assert.equal(mutationProvider.calls, 1); // No new order submitted!

    const persisted = await repository.get('att-recon-fail-01');
    assert.equal(persisted.state, 'reconciled-indeterminate');
    assert.match(persisted.lastFailure, /ECONNRESET on lookup/);
  });

  it('is idempotent across repeated recovery invocations on terminal state', async () => {
    const { runtime, recoveryService, reconciliationProvider } = setupTestEnvironment(
      { throwError: true },
      { outcome: 'found', providerOrderId: 'prov-idempotent-01' }
    );

    await runtime.execute(validExecutionOptions('att-idempotent-01'));

    // First recovery run transitions to reconciled-found
    const firstRun = await recoveryService.recoverAll();
    assert.equal(firstRun.recoveredCount, 1);
    assert.equal(firstRun.terminalCount, 1);
    assert.equal(reconciliationProvider.calls, 1);

    // Second recovery run sees no non-terminal candidates
    const secondRun = await recoveryService.recoverAll();
    assert.equal(secondRun.recoveredCount, 0);
    assert.equal(secondRun.terminalCount, 0);
    assert.equal(reconciliationProvider.calls, 1); // No redundant provider calls
  });

  it('recovers multiple heterogeneous non-terminal executions in a single recovery pass', async () => {
    const { runtime, recoveryService, repository, mutationProvider } = setupTestEnvironment(
      { throwError: true },
      {
        outcome: (req) => {
          if (req.attemptId === 'att-multi-found') return 'found';
          if (req.attemptId === 'att-multi-notfound') return 'not-found';
          return 'indeterminate';
        },
      }
    );

    await runtime.execute(validExecutionOptions('att-multi-found'));
    await runtime.execute(validExecutionOptions('att-multi-notfound'));
    await runtime.execute(validExecutionOptions('att-multi-indet'));

    const result = await recoveryService.recoverAll();
    assert.equal(result.recoveredCount, 2);
    assert.equal(result.terminalCount, 2);
    assert.equal(result.indeterminateCount, 1);
    assert.equal(mutationProvider.calls, 3); // exactly 3 original POSTs, 0 recovery mutations

    const p1 = await repository.get('att-multi-found');
    const p2 = await repository.get('att-multi-notfound');
    const p3 = await repository.get('att-multi-indet');

    assert.equal(p1.state, 'reconciled-found');
    assert.equal(p2.state, 'reconciled-not-found');
    assert.equal(p3.state, 'reconciled-indeterminate');
  });
});

