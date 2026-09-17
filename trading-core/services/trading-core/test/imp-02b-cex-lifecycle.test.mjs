import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CexExecutionLifecycleError,
  CexExecutionLifecycleService,
  InMemoryCexExecutionAttemptRepository,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const input = {
  attemptId: 'attempt-001',
  intentId: 'intent-001',
  correlationId: 'corr-001',
  providerId: 'binance-http',
  connector: 'binance_spot',
  market: 'BTC-USDT',
  side: 'buy',
  orderType: 'limit',
  quantity: '0.1',
  price: '100',
  now: '2026-09-17T12:00:00.000Z',
};

function provider(result, capabilities = {
  supportsCallerOrderIdentity: true,
  supportsExactOrderLookup: true,
  supportsDeterministicReconciliation: true,
}) {
  return {
    providerId: 'binance-http',
    connector: 'binance_spot',
    capabilities,
    async reconcileByClientOrderId(request) {
      assert.match(request.executionClientOrderId, /^ax-attempt-/);
      return typeof result === 'function' ? result(request) : result;
    },
  };
}

describe('IMP-02B: CEX execution lifecycle and reconciliation', () => {
  it('creates an attempt-specific execution identity and preserves it through exact reconciliation', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository, () => '2026-09-17T12:01:00.000Z');
    const attempt = await service.createAttempt(input);

    assert.equal(attempt.state, 'attempt-created');
    assert.equal(attempt.executionClientOrderId, 'ax-attempt-001');

    await service.markSubmissionInProgress(attempt.attemptId);
    await service.recordUnknown(attempt.attemptId, 'transport closed after submission');
    const reconciled = await service.reconcile(attempt.attemptId, provider({
      outcome: 'found',
      evidence: {
        executionClientOrderId: 'ax-attempt-001',
        providerOrderId: 'binance-order-1',
        providerStatus: 'NEW',
        filledQuantity: '0',
        remainingQuantity: '0.1',
        observedAt: '2026-09-17T12:02:00.000Z',
        source: 'rest-exact-lookup',
      },
    }));

    assert.equal(reconciled.state, 'reconciled-found');
    assert.equal(reconciled.providerOrderId, 'binance-order-1');
  });

  it('keeps NOT_FOUND distinct from permission to resubmit', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const attempt = await service.createAttempt(input);
    await service.markSubmissionInProgress(attempt.attemptId);
    await service.recordUnknown(attempt.attemptId, 'unknown outcome');
    const result = await service.reconcile(attempt.attemptId, provider({
      outcome: 'not-found',
      observedAt: '2026-09-17T12:02:00.000Z',
    }));

    assert.equal(result.state, 'reconciled-not-found');
    assert.deepEqual(await service.recoverableAttempts(), []);
  });

  it('preserves INDETERMINATE evidence without retrying', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const attempt = await service.createAttempt({ ...input, attemptId: 'attempt-002' });
    await service.markSubmissionInProgress(attempt.attemptId);
    await service.recordUnknown(attempt.attemptId, 'transport failure');
    const result = await service.reconcile(attempt.attemptId, provider({
      outcome: 'indeterminate',
      reason: 'provider rate limit during exact lookup',
      observedAt: '2026-09-17T12:02:00.000Z',
    }));

    assert.equal(result.state, 'reconciled-indeterminate');
    assert.equal(result.lastFailure, 'provider rate limit during exact lookup');
  });

  it('rejects CEX reconciliation when the connector does not declare strong capabilities', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const attempt = await service.createAttempt({ ...input, attemptId: 'attempt-003' });
    await service.markSubmissionInProgress(attempt.attemptId);
    await service.recordUnknown(attempt.attemptId, 'unknown outcome');

    await assert.rejects(
      () => service.reconcile(attempt.attemptId, provider({ outcome: 'not-found', observedAt: '2026-09-17T12:02:00.000Z' }, {
        supportsCallerOrderIdentity: false,
        supportsExactOrderLookup: false,
        supportsDeterministicReconciliation: false,
      })),
      (error) => error instanceof CexExecutionLifecycleError
        && error.code === 'RECONCILIATION_CAPABILITY_NOT_ADMITTED',
    );
    assert.equal((await repository.get(attempt.attemptId)).state, 'execution-unknown');
  });

  it('models cancellation as a separate request and outcome', async () => {
    const repository = new InMemoryCexExecutionAttemptRepository();
    const service = new CexExecutionLifecycleService(repository);
    const attempt = await service.createAttempt({ ...input, attemptId: 'attempt-004' });
    await service.markSubmissionInProgress(attempt.attemptId);
    await service.recordAcknowledged(attempt.attemptId, {
      executionClientOrderId: 'ax-attempt-004',
      providerOrderId: 'binance-order-4',
      providerStatus: 'NEW',
      observedAt: '2026-09-17T12:02:00.000Z',
      source: 'rest-submission-response',
      cancellationState: 'not-requested',
    });
    assert.equal((await service.requestCancellation(attempt.attemptId)).state, 'cancel-requested');
    assert.equal((await service.recordCancellation(attempt.attemptId, 'cancelled')).state, 'cancelled');
  });
});
