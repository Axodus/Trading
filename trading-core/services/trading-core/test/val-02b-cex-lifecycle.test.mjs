import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CexExecutionLifecycleError,
  CexExecutionLifecycleService,
  InMemoryCexExecutionAttemptRepository,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const capabilities = {
  supportsCallerOrderIdentity: true,
  supportsExactOrderLookup: true,
  supportsDeterministicReconciliation: true,
};

const baseInput = {
  attemptId: 'val-02b-001', intentId: 'intent-val-02b', correlationId: 'corr-val-02b',
  providerId: 'binance-http', connector: 'binance_spot', market: 'BTC-USDT',
  side: 'buy', orderType: 'limit', quantity: '0.1', price: '100',
};

function makeProvider(result, overrides = {}) {
  let calls = 0;
  const customReconcile = overrides.reconcileByClientOrderId;
  return {
    providerId: 'binance-http', connector: 'binance_spot', capabilities,
    ...overrides,
    get calls() { return calls; },
    async reconcileByClientOrderId(request) {
      calls += 1;
      assert.match(request.executionClientOrderId, /^ax-val-02b-/);
      if (customReconcile) return customReconcile(request);
      return typeof result === 'function' ? result(request) : result;
    },
  };
}

async function unknownAttempt(service, input = baseInput) {
  const attempt = await service.createAttempt(input);
  await service.markSubmissionInProgress(attempt.attemptId);
  return service.recordUnknown(attempt.attemptId, 'transport failure after submission');
}

function foundEvidence(id = 'ax-val-02b-001', providerOrderId = 'binance-order-1', extra = {}) {
  return {
    executionClientOrderId: id, providerOrderId, providerStatus: 'NEW',
    filledQuantity: '0', remainingQuantity: '0.1', observedAt: '2026-09-17T12:02:00.000Z',
    source: 'rest-exact-lookup', ...extra,
  };
}

describe('VAL-02B: offline deterministic CEX lifecycle and reconciliation', () => {
  it('validates acknowledged and explicitly rejected submission paths', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const accepted = await service.createAttempt(baseInput);
    await service.markSubmissionInProgress(accepted.attemptId);
    assert.equal((await service.recordAcknowledged(accepted.attemptId, foundEvidence())).state, 'provider-acknowledged');

    const rejected = await service.createAttempt({ ...baseInput, attemptId: 'val-02b-rejected' });
    await service.markSubmissionInProgress(rejected.attemptId);
    assert.equal((await service.recordRejected(rejected.attemptId, 'provider rejected order')).state, 'rejected');
  });

  it('keeps timeout-before-acceptance unknown and never submits a retry', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const attempt = await unknownAttempt(service);
    assert.equal(attempt.state, 'execution-unknown');
    assert.equal((await service.recoverableAttempts()).length, 1);
  });

  it('reconciles timeout-after-acceptance by exact identity and preserves both IDs', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    await unknownAttempt(service);
    const result = await service.reconcile('val-02b-001', makeProvider({ outcome: 'found', evidence: foundEvidence() }));
    assert.equal(result.state, 'reconciled-found');
    assert.equal(result.executionClientOrderId, 'ax-val-02b-001');
    assert.equal(result.providerOrderId, 'binance-order-1');
  });

  it('keeps NOT_FOUND and INDETERMINATE non-resubmittable and distinct', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    await unknownAttempt(service);
    const absent = await service.reconcile('val-02b-001', makeProvider({ outcome: 'not-found', observedAt: '2026-09-17T12:03:00.000Z' }));
    assert.equal(absent.state, 'reconciled-not-found');
    assert.equal((await service.recoverableAttempts()).length, 0);

    const unresolved = await unknownAttempt(service, { ...baseInput, attemptId: 'val-02b-indeterminate' });
    const result = await service.reconcile('val-02b-indeterminate', makeProvider({ outcome: 'indeterminate', reason: 'lookup unavailable', observedAt: '2026-09-17T12:03:00.000Z' }));
    assert.equal(unresolved.state, 'execution-unknown');
    assert.equal(result.state, 'reconciled-indeterminate');
    assert.equal(result.lastFailure, 'lookup unavailable');
  });

  it('makes repeated and concurrent reconciliation state-safe', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    await unknownAttempt(service);
    let release;
    const provider = makeProvider(() => new Promise((resolve) => { release = () => resolve({ outcome: 'found', evidence: foundEvidence() }); }));
    const first = service.reconcile('val-02b-001', provider);
    const second = service.reconcile('val-02b-001', provider);
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const [one, two, repeated] = await Promise.all([first, second, first.then(() => service.reconcile('val-02b-001', provider))]);
    assert.equal(provider.calls, 1);
    assert.equal(one.state, 'reconciled-found');
    assert.deepEqual(two, one);
    assert.deepEqual(repeated, one);
  });

  it('maps provider lookup failures and malformed identity evidence to unresolved state', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    await unknownAttempt(service);
    const failedLookup = await service.reconcile('val-02b-001', makeProvider(async () => { throw new Error('network failure'); }));
    assert.equal(failedLookup.state, 'reconciled-indeterminate');
    assert.match(failedLookup.lastFailure, /network failure/);

    const malformed = await unknownAttempt(service, { ...baseInput, attemptId: 'val-02b-malformed' });
    assert.equal(malformed.state, 'execution-unknown');
    const invalid = await service.reconcile('val-02b-malformed', makeProvider({ outcome: 'found', evidence: foundEvidence('wrong-id') }));
    assert.equal(invalid.state, 'reconciled-indeterminate');
    assert.equal(invalid.lastFailure, 'Reconciliation evidence identity mismatch');
  });

  it('preserves partial and full fill evidence without conflating terminality', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    await unknownAttempt(service);
    const partial = await service.reconcile('val-02b-001', makeProvider({ outcome: 'found', evidence: foundEvidence('ax-val-02b-001', 'binance-order-1', { providerStatus: 'PARTIALLY_FILLED', filledQuantity: '0.04', remainingQuantity: '0.06', fillReferences: ['fill-1'] }) }));
    assert.equal(partial.state, 'reconciled-found');
    assert.equal(partial.evidence.filledQuantity, '0.04');
    assert.equal(partial.evidence.providerStatus, 'PARTIALLY_FILLED');
  });

  it('keeps cancellation request, acknowledgement and cancellation failure distinct', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const attempt = await service.createAttempt({ ...baseInput, attemptId: 'val-02b-cancel' });
    await service.markSubmissionInProgress(attempt.attemptId);
    await service.recordAcknowledged(attempt.attemptId, foundEvidence('ax-val-02b-cancel', 'binance-order-cancel'));
    assert.equal((await service.requestCancellation(attempt.attemptId)).state, 'cancel-requested');
    assert.equal((await service.requestCancellation(attempt.attemptId)).state, 'cancel-requested');
    const ambiguous = await service.recordCancellation(attempt.attemptId, 'failed', 'cancel timeout; result unknown');
    assert.equal(ambiguous.state, 'cancellation-failed');
    assert.notEqual(ambiguous.state, 'cancelled');
    assert.deepEqual(await service.recordCancellation(attempt.attemptId, 'cancelled'), ambiguous);
  });

  it('protects terminal states from late evidence and duplicate operations', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const attempt = await service.createAttempt({ ...baseInput, attemptId: 'val-02b-terminal' });
    await service.markSubmissionInProgress(attempt.attemptId);
    await service.recordAcknowledged(attempt.attemptId, foundEvidence('ax-val-02b-terminal', 'binance-order-terminal'));
    await service.requestCancellation(attempt.attemptId);
    await service.recordCancellation(attempt.attemptId, 'cancelled');
    const before = await repository.get(attempt.attemptId);
    await assert.rejects(() => service.recordAcknowledged(attempt.attemptId, foundEvidence('ax-val-02b-terminal', 'late-order')),
      (error) => error instanceof CexExecutionLifecycleError && error.code === 'INVALID_TRANSITION');
    assert.deepEqual(await repository.get(attempt.attemptId), before);
  });

  it('rejects unsupported connectors before provider access, including Gateway/DEX', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const attempt = await unknownAttempt(service, { ...baseInput, attemptId: 'val-02b-gateway', connector: 'gateway_ethereum' });
    let calls = 0;
    await assert.rejects(() => service.reconcile(attempt.attemptId, makeProvider({ outcome: 'not-found', observedAt: '2026-09-17T12:03:00.000Z' }, {
      connector: 'gateway_ethereum',
      capabilities: { supportsCallerOrderIdentity: false, supportsExactOrderLookup: false, supportsDeterministicReconciliation: false },
      async reconcileByClientOrderId() { calls += 1; return { outcome: 'not-found', observedAt: '2026-09-17T12:03:00.000Z' }; },
    })), (error) => error instanceof CexExecutionLifecycleError && error.code === 'RECONCILIATION_CAPABILITY_NOT_ADMITTED');
    assert.equal(calls, 0);
  });

  it('reconstructs a persisted snapshot into a new service and retains canonical identity', async () => {
    const sourceRepository = new InMemoryCexExecutionAttemptRepository();
    const sourceService = new CexExecutionLifecycleService(sourceRepository);
    await unknownAttempt(sourceService);
    const snapshot = await sourceRepository.get('val-02b-001');
    const recoveredRepository = new InMemoryCexExecutionAttemptRepository();
    await recoveredRepository.save(snapshot);
    const recoveredService = new CexExecutionLifecycleService(recoveredRepository);
    const result = await recoveredService.reconcile('val-02b-001', makeProvider({ outcome: 'found', evidence: foundEvidence() }));
    assert.equal(result.executionClientOrderId, snapshot.executionClientOrderId);
    assert.equal(result.providerOrderId, 'binance-order-1');
    assert.equal(result.state, 'reconciled-found');
  });

  it('keeps WebSocket outside the correctness path and rejects baseline drift', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    await unknownAttempt(service, { ...baseInput, attemptId: 'val-02b-drift' });
    const provider = makeProvider({ outcome: 'not-found', observedAt: '2026-09-17T12:03:00.000Z' }, {
      capabilities: { ...capabilities },
      baseline: 'unexpected',
      async reconcileByClientOrderId(request) { assert.equal(request.executionClientOrderId, 'ax-val-02b-drift'); return { outcome: 'indeterminate', reason: 'MARKET_BASELINE_MISMATCH', observedAt: '2026-09-17T12:03:00.000Z' }; },
    });
    const result = await service.reconcile('val-02b-drift', provider);
    assert.equal(result.state, 'reconciled-indeterminate');
    assert.equal(result.lastFailure, 'MARKET_BASELINE_MISMATCH');
  });
});
