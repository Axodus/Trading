import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DurableCexExecutionLifecycleService,
  MigrationRunner,
  NodePostgresClient,
  PostgresDurableExecutionRepository,
  createLocalTradingDatabaseConfig,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const enabled = process.env.TRADING_POSTGRES_E2E === '1';
const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(testDir, '..', 'migrations', '0003_durable_execution_primitives.sql');
const capabilities = {
  supportsCallerOrderIdentity: true,
  supportsExactOrderLookup: true,
  supportsDeterministicReconciliation: true,
};

function attemptInput(id) {
  return {
    attemptId: id,
    intentId: `${id}-intent`,
    correlationId: `${id}-correlation`,
    providerId: 'binance',
    connector: 'binance-spot',
    market: 'BTC-USDT',
    side: 'buy',
    orderType: 'limit',
    quantity: '0.01',
    price: '100',
    now: '2026-09-18T00:00:00.000Z',
  };
}

function foundEvidence(executionClientOrderId, providerOrderId, extra = {}) {
  return {
    executionClientOrderId,
    providerOrderId,
    providerStatus: 'NEW',
    filledQuantity: '0',
    remainingQuantity: '0.01',
    observedAt: '2026-09-18T00:01:00.000Z',
    source: 'rest-exact-lookup',
    ...extra,
  };
}

function provider(result, overrides = {}) {
  let calls = 0;
  return {
    providerId: 'binance',
    connector: 'binance-spot',
    capabilities,
    ...overrides,
    get calls() { return calls; },
    async reconcileByClientOrderId(request) {
      calls += 1;
      return typeof result === 'function' ? result(request) : result;
    },
  };
}

async function setup() {
  const env = withTradingLocalDatabaseDefaults(process.env);
  const runtime = createLocalTradingDatabaseConfig(env, [{
    id: '0003_durable_execution_primitives.sql',
    sql: readFileSync(migrationPath, 'utf8'),
  }]);
  const client = await NodePostgresClient.create(createNodePostgresEnvConfig(env));
  await new MigrationRunner(client).run(runtime.database);
  return { client, repository: new PostgresDurableExecutionRepository(client) };
}

async function remove(client, id) {
  await client.query('DELETE FROM trading_execution_outbox WHERE aggregate_id = $1', [id]);
  await client.query('DELETE FROM trading_submission_attempts WHERE attempt_id = $1', [id]);
}

async function unknown(service, id) {
  const created = await service.createAttempt(attemptInput(id));
  await service.markSubmissionInProgress(id);
  return service.recordUnknown(id, 'provider result was ambiguous');
}

describe('IMP-02C: durable CEX lifecycle and crash recovery orchestration', { skip: !enabled }, () => {
  let client;

  it('recovers an ambiguous submission after a service restart using exact identity', async () => {
    ({ client } = await setup());
    const id = `imp-02c-restart-${Date.now()}`;
    await remove(client, id);
    const first = new DurableCexExecutionLifecycleService(new PostgresDurableExecutionRepository(client), client);
    await unknown(first, id);

    const restartedRepository = new PostgresDurableExecutionRepository(client);
    const restarted = new DurableCexExecutionLifecycleService(restartedRepository, client);
    assert.equal((await restarted.recoveryCandidates()).some((row) => row.attemptId === id), true);
    const current = await restarted.get(id);
    const result = await restarted.reconcile(id, provider({
      outcome: 'found',
      evidence: foundEvidence(current.executionClientOrderId, `${id}-provider-order`),
    }));

    assert.equal(result.state, 'reconciled-found');
    assert.equal(result.executionClientOrderId, current.executionClientOrderId);
    assert.equal(result.providerOrderId, `${id}-provider-order`);
    assert.equal((await restartedRepository.get(id)).version, 4);
  });

  it('makes concurrent recovery workers CAS-safe and emits one canonical reconciliation event', async () => {
    const id = `imp-02c-concurrent-${Date.now()}`;
    await remove(client, id);
    const repositoryA = new PostgresDurableExecutionRepository(client);
    const repositoryB = new PostgresDurableExecutionRepository(client);
    const serviceA = new DurableCexExecutionLifecycleService(repositoryA, client);
    const serviceB = new DurableCexExecutionLifecycleService(repositoryB, client);
    await unknown(serviceA, id);
    const current = await repositoryA.get(id);
    const sharedProvider = provider({
      outcome: 'found',
      evidence: foundEvidence(current.executionClientOrderId, `${id}-provider-order`),
    });

    const [one, two] = await Promise.all([
      serviceA.reconcile(id, sharedProvider),
      serviceB.reconcile(id, sharedProvider),
    ]);
    assert.equal(one.state, 'reconciled-found');
    assert.equal(two.state, one.state);
    assert.equal(two.executionClientOrderId, one.executionClientOrderId);
    assert.equal(two.providerOrderId, one.providerOrderId);
    assert.equal(two.version, one.version);
    assert.equal((await client.query(
      "SELECT count(*)::int AS count FROM trading_execution_outbox WHERE aggregate_id = $1 AND event_type = 'submission-reconciled'",
      [id],
    )).rows[0].count, 1);
  });

  it('persists cancellation ambiguity and resolves it after restart without a second cancel', async () => {
    const id = `imp-02c-cancel-${Date.now()}`;
    await remove(client, id);
    const repository = new PostgresDurableExecutionRepository(client);
    const service = new DurableCexExecutionLifecycleService(repository, client);
    const created = await service.createAttempt(attemptInput(id));
    await service.markSubmissionInProgress(id);
    await service.recordAcknowledged(id, foundEvidence(created.executionClientOrderId, `${id}-provider-order`, {
      source: 'rest-submission-response',
      cancellationState: 'not-requested',
    }));

    const cancelProvider = {
      providerId: 'binance',
      connector: 'binance-spot',
      async cancelByProviderOrderId() { throw new Error('cancel response lost'); },
    };
    const ambiguous = await service.cancel(id, cancelProvider);
    assert.equal(ambiguous.state, 'cancellation-unknown');

    const restarted = new DurableCexExecutionLifecycleService(new PostgresDurableExecutionRepository(client), client);
    const reconciled = await restarted.reconcile(id, provider({
      outcome: 'found',
      evidence: foundEvidence(ambiguous.executionClientOrderId, `${id}-provider-order`, {
        cancellationState: 'cancelled',
        providerStatus: 'CANCELED',
      }),
    }));
    assert.equal(reconciled.state, 'cancelled');
    assert.equal(reconciled.providerOrderId, `${id}-provider-order`);
  });

  it('keeps NOT_FOUND and INDETERMINATE unresolved without resubmission', async () => {
    const absentId = `imp-02c-a-${Date.now()}`;
    const indeterminateId = `imp-02c-i-${Date.now()}`;
    await remove(client, absentId);
    await remove(client, indeterminateId);
    const service = new DurableCexExecutionLifecycleService(new PostgresDurableExecutionRepository(client), client);
    await unknown(service, absentId);
    await unknown(service, indeterminateId);

    const absent = await service.reconcile(absentId, provider({ outcome: 'not-found', observedAt: '2026-09-18T00:02:00.000Z' }));
    const indeterminate = await service.reconcile(indeterminateId, provider({
      outcome: 'indeterminate',
      reason: 'lookup unavailable',
      observedAt: '2026-09-18T00:02:00.000Z',
    }));
    assert.equal(absent.state, 'reconciled-not-found');
    assert.equal(indeterminate.state, 'reconciled-indeterminate');
    assert.equal((await service.recoveryCandidates()).some((row) => row.attemptId === absentId), false);
    assert.equal((await service.recoveryCandidates()).some((row) => row.attemptId === indeterminateId), true);
  });

  it('closes the PostgreSQL client after durable lifecycle validation', async () => {
    await client?.close();
    assert.equal(client?.isClosed(), true);
  });
});
