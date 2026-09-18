import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MigrationRunner,
  NodePostgresClient,
  PostgresDurableExecutionRepository,
  DurableExecutionConcurrencyError,
  createLocalTradingDatabaseConfig,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const enabled = process.env.TRADING_POSTGRES_E2E === '1';
const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(testDir, '..', 'migrations', '0003_durable_execution_primitives.sql');

function attempt(id, overrides = {}) {
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
    executionClientOrderId: `${id}-client-order`,
    state: 'execution-unknown',
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('IMP-02C0 durable PostgreSQL primitives', { skip: !enabled }, () => {
  let client;
  let repository;

  it('proves persistence, rollback atomicity, CAS, outbox atomicity and restart visibility', async () => {
    const env = withTradingLocalDatabaseDefaults(process.env);
    const runtime = createLocalTradingDatabaseConfig(env, [{
      id: '0003_durable_execution_primitives.sql',
      sql: readFileSync(migrationPath, 'utf8'),
    }]);
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(env));
    const migrations = new MigrationRunner(client);
    await migrations.run(runtime.database);
    repository = new PostgresDurableExecutionRepository(client);

    const id = `c0-${Date.now()}`;
    const original = attempt(id);
    await client.query('DELETE FROM trading_execution_outbox WHERE aggregate_id = $1', [id]);
    await client.query('DELETE FROM trading_submission_attempts WHERE attempt_id = $1', [id]);

    await assert.rejects(
      () => client.transaction(async (tx) => {
        await repository.create(original, tx);
        await repository.appendOutbox({
          outboxId: `${id}-rollback-event`,
          aggregateId: id,
          aggregateVersion: 0,
          eventType: 'submission-attempt-created',
          correlationId: original.correlationId,
          payload: { attemptId: id },
          createdAt: original.createdAt,
        }, tx);
        throw new Error('injected rollback');
      }),
    );
    assert.equal(await repository.get(id), undefined);
    assert.equal((await client.query('SELECT * FROM trading_execution_outbox WHERE aggregate_id = $1', [id])).rows.length, 0);

    const created = await repository.create(original);
    const writerA = await repository.get(id);
    const writerB = await repository.get(id);
    assert.equal(created.version, 0);
    assert.equal(writerA?.version, 0);
    assert.equal(writerB?.version, 0);

    await repository.updateWithCas({ ...writerA, state: 'reconciling', updatedAt: '2026-09-17T00:00:01.000Z' }, 0);
    await assert.rejects(
      () => repository.updateWithCas({ ...writerB, state: 'reconciled-indeterminate' }, 0),
      (error) => error instanceof DurableExecutionConcurrencyError,
    );

    const persisted = await repository.get(id);
    assert.equal(persisted?.version, 1);
    assert.equal(persisted?.state, 'reconciling');
    assert.deepEqual((await repository.listRecoveryCandidates()).map((row) => row.attemptId), [id]);

    const restartedRepository = new PostgresDurableExecutionRepository(client);
    const recovered = await restartedRepository.get(id);
    assert.equal(recovered?.executionClientOrderId, original.executionClientOrderId);
    assert.equal(recovered?.version, 1);

    await client.transaction(async (tx) => {
      const reconciled = {
        ...recovered,
        state: 'reconciled-found',
        providerOrderId: `${id}-provider-order`,
        evidence: { source: 'rest-exact-lookup', matched: true },
        updatedAt: '2026-09-17T00:00:02.000Z',
      };
      await restartedRepository.persistAttemptAndOutbox(reconciled, recovered.version, {
        outboxId: `${id}-committed-event`,
        aggregateId: id,
        aggregateVersion: recovered.version + 1,
        eventType: 'submission-attempt-reconciled',
        correlationId: recovered.correlationId,
        payload: { attemptId: id, state: reconciled.state },
        createdAt: reconciled.updatedAt,
      }, tx);
    });
    assert.equal((await client.query('SELECT * FROM trading_execution_outbox WHERE outbox_id = $1', [`${id}-committed-event`])).rows.length, 1);
    const committed = await restartedRepository.get(id);
    assert.equal(committed?.version, 2);
    assert.equal(committed?.state, 'reconciled-found');
  });

  it('closes the real PostgreSQL client', async () => {
    await client?.close();
    assert.equal(client?.isClosed(), true);
  });
});
