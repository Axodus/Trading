import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  PostgresExecutionLifecycleRepository,
  ControlledExecutionService,
  ExecutionControlAuthority,
  ReconciliationAuthority,
  SimulatedControlledLifecycleAdapter,
  MigrationRunner,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import {
  FixedDecimal,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

function loadMigrations() {
  const packageMigrationsDir = resolve(process.cwd(), 'migrations');
  const workspaceMigrationsDir = resolve(process.cwd(), 'trading-core/services/trading-core/migrations');
  const migrationsDir = existsSync(packageMigrationsDir) ? packageMigrationsDir : workspaceMigrationsDir;
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      id: name,
      sql: readFileSync(join(migrationsDir, name), 'utf8'),
    }));
}

function makeValidExecutionIntent(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date(Date.now() - 60000).toISOString();
  const expiresAt = new Date(Date.now() + 3600000).toISOString();

  return {
    executionIntentId: 'exec-intent-pg-' + uniqueId,
    tradingIntentId: 'trading-intent-pg-' + uniqueId,
    strategyId: 'strat-momentum-pg',
    strategyRevisionId: 'strat-momentum-pg:r7',
    targetAdapterType: 'testnet_adapter',
    venue: 'binance',
    instrument: 'BTC-USDT',
    side: 'buy',
    authorizedQuantity: '0.005000000000',
    authorizedCapital: '100.000000000000',
    authorizedLeverage: '2.000000000000',
    executionQuantity: '0.005000000000',
    executionCapital: '100.000000000000',
    executionLeverage: '2.000000000000',
    constraints: {
      orderType: 'LIMIT',
      timeInForce: 'GTC',
      limitPrice: '60000.000000000000',
    },
    policyRevision: 'POLICY_V1',
    correlationId: 'corr-pg-' + uniqueId,
    idempotencyKey: 'idem-pg-' + uniqueId,
    createdAt: now,
    expiresAt,
    evidenceRefs: ['ev-exec-pg-1'],
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / VAL-09-PG — Real PostgreSQL Durable Execution Lifecycle & Reconciliation Acceptance', () => {
  let client;
  let repository;
  let service;
  let adapter;

  before(async () => {
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const runner = new MigrationRunner(client);
    const migrations = loadMigrations();
    await runner.run({ environment: 'local', schemaName: 'public', migrations });
    repository = new PostgresExecutionLifecycleRepository(client);
    service = new ControlledExecutionService(repository, client, { publishEvents: true });
    adapter = new SimulatedControlledLifecycleAdapter();
  });

  after(async () => {
    if (client && !client.isClosed()) {
      await client.close();
    }
  });

  it('Gate 1: Migration 0008 applies cleanly and all 6 tables exist in PostgreSQL', async () => {
    const tableRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('execution_attempts', 'canonical_orders', 'canonical_order_events', 'canonical_fills', 'provider_observations', 'reconciliation_records') ORDER BY table_name;"
    );
    const tableNames = tableRes.rows.map((r) => r.table_name);
    assert.deepEqual(tableNames, [
      'canonical_fills',
      'canonical_order_events',
      'canonical_orders',
      'execution_attempts',
      'provider_observations',
      'reconciliation_records',
    ]);

    const indexRes = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'execution_attempts' AND indexname = 'idx_execution_attempts_intent_attempt';"
    );
    assert.equal(indexRes.rows.length, 1);
  });

  it('Gate 2: ExecutionAttempt & CanonicalOrder persistence & exact column mapping in real PostgreSQL', async () => {
    adapter.setBehavior({ mode: 'immediate_fill', fillPrice: '61000.000000000000' });
    const intent = makeValidExecutionIntent();
    const result = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });

    assert.equal(result.terminalState, 'FILLED');
    assert.equal(result.reconciled, true);

    const orderRes = await client.query(
      'SELECT * FROM canonical_orders WHERE canonical_order_id = $1',
      [result.canonicalOrderId]
    );
    assert.equal(orderRes.rows.length, 1);
    const orderRow = orderRes.rows[0];
    assert.equal(orderRow.execution_intent_id, intent.executionIntentId);
    assert.equal(orderRow.trading_intent_id, intent.tradingIntentId);
    assert.equal(orderRow.strategy_id, intent.strategyId);
    assert.equal(orderRow.strategy_revision_id, intent.strategyRevisionId);
    assert.equal(orderRow.instrument, intent.instrument);
    assert.equal(orderRow.side, 'buy');
    assert.equal(orderRow.state, 'FILLED');
    assert.ok(FixedDecimal.from(orderRow.cumulative_filled_quantity).eq(FixedDecimal.from(intent.executionQuantity)));
    assert.ok(FixedDecimal.from(orderRow.remaining_quantity).eq(FixedDecimal.from('0')));
    assert.ok(FixedDecimal.from(orderRow.weighted_average_price).eq(FixedDecimal.from('61000')));

    const attemptRes = await client.query(
      'SELECT * FROM execution_attempts WHERE execution_intent_id = $1',
      [intent.executionIntentId]
    );
    assert.equal(attemptRes.rows.length, 1);
    assert.equal(attemptRes.rows[0].status, 'ACKNOWLEDGED');
    assert.equal(attemptRes.rows[0].environment, 'TESTNET');
  });

  it('Gate 3: Durable idempotent replay returns existing execution result without duplicate insert', async () => {
    adapter.setBehavior({ mode: 'immediate_fill' });
    const intent = makeValidExecutionIntent();
    const idempotencyKey = 'idem-pg-replay-' + globalThis.crypto.randomUUID().slice(0, 8);

    const countBefore = await client.query('SELECT count(*) FROM execution_attempts');
    const first = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET', idempotencyKey });
    const countAfterFirst = await client.query('SELECT count(*) FROM execution_attempts');

    const second = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET', idempotencyKey });
    const countAfterSecond = await client.query('SELECT count(*) FROM execution_attempts');

    assert.equal(first.canonicalOrderId, second.canonicalOrderId);
    assert.equal(first.terminalState, second.terminalState);
    assert.equal(Number(countAfterFirst.rows[0].count), Number(countBefore.rows[0].count) + 1);
    assert.equal(countAfterFirst.rows[0].count, countAfterSecond.rows[0].count);
  });

  it('Gate 4: Two-worker concurrency & PostgreSQL optimistic locking protection', async () => {
    adapter.setBehavior({ mode: 'immediate_fill' });
    const intent = makeValidExecutionIntent();

    const outcomes = await Promise.allSettled([
      service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
        idempotencyKey: 'idem-worker-A-' + globalThis.crypto.randomUUID().slice(0, 8),
      }),
      service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
        idempotencyKey: 'idem-worker-B-' + globalThis.crypto.randomUUID().slice(0, 8),
      }),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    assert.ok(fulfilled.length >= 1);

    const orderCount = await client.query(
      'SELECT count(*) FROM canonical_orders WHERE execution_intent_id = $1',
      [intent.executionIntentId]
    );
    assert.equal(orderCount.rows[0].count, '1');
  });

  it('Gate 5: Transaction rollback / failure injection leaves zero partial state in PostgreSQL', async () => {
    const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
    const intent = makeValidExecutionIntent({ executionIntentId: 'exec-fail-' + uniqueId });

    await assert.rejects(
      async () => {
        await client.transaction(async (txClient) => {
          const res = ExecutionControlAuthority.reserveSubmission({
            commandId: 'cmd-fail-' + uniqueId,
            executionIntent: intent,
            environment: 'TESTNET',
            idempotencyKey: 'idem-fail-' + uniqueId,
            evaluationTime: intent.createdAt,
          });

          await repository.saveAttempt(res.attempt, txClient);
          // Simulate crash before saving canonical order
          throw new Error('SIMULATED_DB_CRASH_BEFORE_ORDER_SAVE');
        });
      },
      /SIMULATED_DB_CRASH_BEFORE_ORDER_SAVE/
    );

    const attemptRows = await client.query(
      'SELECT * FROM execution_attempts WHERE execution_intent_id = $1',
      [intent.executionIntentId]
    );
    const orderRows = await client.query(
      'SELECT * FROM canonical_orders WHERE execution_intent_id = $1',
      [intent.executionIntentId]
    );
    assert.equal(attemptRows.rows.length, 0);
    assert.equal(orderRows.rows.length, 0);
  });

  it('Gate 6: Outbox atomicity — ExecutionAttemptReserved and ProviderSubmissionObserved in PostgreSQL', async () => {
    adapter.setBehavior({ mode: 'immediate_fill' });
    const intent = makeValidExecutionIntent();
    const result = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });

    assert.equal(result.terminalState, 'FILLED');

    const outboxRes1 = await client.query(
      "SELECT * FROM trading_execution_outbox WHERE correlation_id = $1 AND event_type = 'ExecutionAttemptReserved'",
      [intent.correlationId]
    );
    assert.equal(outboxRes1.rows.length, 1);

    const outboxRes2 = await client.query(
      "SELECT * FROM trading_execution_outbox WHERE correlation_id = $1 AND event_type = 'ProviderSubmissionObserved'",
      [intent.correlationId]
    );
    assert.equal(outboxRes2.rows.length, 1);
  });

  it('Gate 7: Disconnect + Reconnect — state survives across pool lifecycle', async () => {
    adapter.setBehavior({ mode: 'immediate_fill' });
    const intent = makeValidExecutionIntent();
    const result = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });

    await client.close();

    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    repository = new PostgresExecutionLifecycleRepository(client);
    service = new ControlledExecutionService(repository, client, { publishEvents: true });

    const loadedOrder = await repository.getCanonicalOrder(result.canonicalOrderId);
    assert.ok(loadedOrder);
    assert.equal(loadedOrder.canonicalOrderId, result.canonicalOrderId);
    assert.equal(loadedOrder.state, 'FILLED');
  });

  it('Gate 8: Process / Repository restart — non-terminal recovery discovers and reconciles without duplicate submissions', async () => {
    adapter.setBehavior({ mode: 'ack_only' });
    const intent = makeValidExecutionIntent();
    const sub = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });
    assert.equal(sub.terminalState, 'ACKNOWLEDGED');

    const storedSub = await repository.getCanonicalOrder(sub.canonicalOrderId);
    assert.ok(storedSub);

    // Reconstruct service instance
    const freshRepo = new PostgresExecutionLifecycleRepository(client);
    const freshService = new ControlledExecutionService(freshRepo, client, { publishEvents: true });

    adapter.setBehavior({ mode: 'immediate_fill' });
    adapter.setOrder(storedSub.clientOrderId, {
      status: 'FILLED',
      filled: intent.executionQuantity,
      total: intent.executionQuantity,
      price: '60000.000000000000',
    });

   const recoveries = await freshService.recoverNonTerminalOrders(adapter);
    assert.ok(recoveries.length >= 1);
    const rec = recoveries.find((r) => r.record?.clientOrderId === storedSub.clientOrderId);
    assert.ok(rec);
    assert.equal(rec.decision, 'UPDATED');

   const reloaded = await freshRepo.getCanonicalOrder(sub.canonicalOrderId);
    assert.equal(reloaded?.state, 'FILLED');
  });

  it('Gate 9: Multi-step partial fills, weighted average price & fill conservation in real PostgreSQL', async () => {
    adapter.setBehavior({
      mode: 'partial_fill_then_fill',
      fillPrice: '62000.000000000000',
      firstFillQuantity: '0.002000000000',
      secondFillQuantity: '0.003000000000',
    });

    const intent = makeValidExecutionIntent({ executionQuantity: '0.005000000000' });
    const result = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });

    assert.equal(result.terminalState, 'FILLED');

   const fillRows = await client.query(
     'SELECT * FROM canonical_fills WHERE canonical_order_id = $1 ORDER BY observed_at ASC',
     [result.canonicalOrderId]
   );
    assert.equal(fillRows.rows.length, 2);
    assert.ok(FixedDecimal.from(fillRows.rows[0].fill_quantity).eq(FixedDecimal.from('0.002')));
    assert.ok(FixedDecimal.from(fillRows.rows[1].fill_quantity).eq(FixedDecimal.from('0.003')));

    const sumFills = FixedDecimal.from(fillRows.rows[0].fill_quantity).add(FixedDecimal.from(fillRows.rows[1].fill_quantity));
   assert.ok(sumFills.eq(FixedDecimal.from(intent.executionQuantity)));

    const orderRow = await client.query(
      'SELECT * FROM canonical_orders WHERE canonical_order_id = $1',
      [result.canonicalOrderId]
    );
    assert.ok(FixedDecimal.from(orderRow.rows[0].weighted_average_price).eq(FixedDecimal.from('62000')));
  });

  it('Gate 10: Controlled cancellation on OPEN order transitioning to CANCELLED in real PostgreSQL', async () => {
    adapter.setBehavior({ mode: 'ack_only' });
    const intent = makeValidExecutionIntent();
    const sub = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });

    assert.equal(sub.terminalState, 'ACKNOWLEDGED');

    const cancelRes = await service.cancelOrder(
      {
        commandId: 'cancel-cmd-pg-1',
        canonicalOrderId: sub.canonicalOrderId,
        reason: 'MANUAL_OPERATOR_REQUEST',
        requestedAt: new Date().toISOString(),
      },
      adapter
    );

    assert.equal(cancelRes.decision, 'UPDATED');
    assert.equal(cancelRes.updatedOrder?.state, 'CANCELLED');

    const orderRow = await client.query(
      'SELECT state FROM canonical_orders WHERE canonical_order_id = $1',
      [sub.canonicalOrderId]
    );
    assert.equal(orderRow.rows[0].state, 'CANCELLED');

    const eventRows = await client.query(
      'SELECT * FROM canonical_order_events WHERE canonical_order_id = $1 ORDER BY order_version ASC',
      [sub.canonicalOrderId]
    );
    assert.ok(eventRows.rows.some((e) => e.new_state === 'CANCEL_PENDING'));
    assert.ok(eventRows.rows.some((e) => e.new_state === 'CANCELLED'));
  });

  it('Gate 11: Timeout & ambiguous submission (SUBMITTED_UNKNOWN) followed by exact reconciliation in real PostgreSQL', async () => {
    adapter.setBehavior({ mode: 'timeout' });
    const intent = makeValidExecutionIntent();
    const result = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });

    assert.equal(result.terminalState, 'SUBMITTED_UNKNOWN');
    assert.equal(result.reconciled, false);

    const storedOrder = await repository.getCanonicalOrder(result.canonicalOrderId);
    assert.equal(storedOrder?.state, 'SUBMITTED_UNKNOWN');

    adapter.setBehavior({ mode: 'ack_only' });
    adapter.setOrder(storedOrder.clientOrderId, {
      status: 'OPEN',
      total: intent.executionQuantity,
      price: '60000.000000000000',
    });

    const reconResult = await service.reconcileOrder(storedOrder.clientOrderId, adapter);
    assert.equal(reconResult.decision, 'UPDATED');
    assert.equal(reconResult.updatedOrder?.state, 'OPEN');

    const reloaded = await client.query(
      'SELECT state FROM canonical_orders WHERE canonical_order_id = $1',
      [result.canonicalOrderId]
    );
    assert.equal(reloaded.rows[0].state, 'OPEN');
  });

  it('Gate 12: Exact arithmetic boundaries in real PostgreSQL', async () => {
    const boundaries = ['0.000100000000', '0.100000000000', '1.234567890123', '999999999.999999999999'];
    for (const val of boundaries) {
      adapter.setBehavior({ mode: 'immediate_fill', fillPrice: '50000.000000000000' });
      const intent = makeValidExecutionIntent({
        executionQuantity: val,
        authorizedQuantity: val,
      });

      const res = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });
      assert.equal(res.terminalState, 'FILLED');

      const dbRow = await client.query(
        'SELECT cumulative_filled_quantity, execution_quantity FROM canonical_orders WHERE canonical_order_id = $1',
        [res.canonicalOrderId]
      );
      assert.equal(dbRow.rows.length, 1);
      assert.ok(FixedDecimal.from(dbRow.rows[0].cumulative_filled_quantity).eq(FixedDecimal.from(val)));
      assert.ok(FixedDecimal.from(dbRow.rows[0].execution_quantity).eq(FixedDecimal.from(val)));
    }
  });
});
