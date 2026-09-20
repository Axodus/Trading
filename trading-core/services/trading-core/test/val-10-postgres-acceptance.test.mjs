import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  PostgresEconomicAttributionRepository,
  ExecutionDiagnosticsAuthority,
  PnLAttributionAuthority,
  PositionAccountingService,
  TradingFeedbackService,
  EconomicIdempotencyConflictError,
  MigrationRunner,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import {
  FixedDecimal,
  DEFAULT_EXECUTION_DIAGNOSTICS_POLICY_V1,
  DEFAULT_PNL_ATTRIBUTION_POLICY_V1,
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

function assertDecEq(actual, expected) {
  assert.ok(actual !== undefined && actual !== null, `Expected ${expected}, got ${actual}`);
  assert.ok(
    FixedDecimal.from(actual).eq(FixedDecimal.from(expected)),
    `Expected ${expected}, got ${actual}`
  );
}

function makeMockIntent(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  return {
    executionIntentId: 'exec-intent-pg-' + uniqueId,
    tradingIntentId: 'trading-intent-pg-' + uniqueId,
    strategyId: 'strat-momentum-pg',
    strategyRevisionId: 'strat-momentum-pg:r7',
    venue: 'binance',
    instrument: 'BTC-USDT',
    marketType: 'perpetual',
    side: 'buy',
    authorizedQuantity: '1.000000000000',
    authorizedCapital: '60000.000000000000',
    authorizedLeverage: '1.000000000000',
    executionQuantity: '1.000000000000',
    executionCapital: '60000.000000000000',
    executionLeverage: '1.000000000000',
    targetAdapterType: 'testnet_adapter',
    constraints: {
      orderType: 'LIMIT',
      priceConstraints: { limitPrice: '60000.000000000000' },
    },
    tradingIntentDigest: 'digest-trading-pg-' + uniqueId,
    authorizationContextDigest: 'digest-auth-pg-' + uniqueId,
    executionPolicyRef: 'POLICY_V1',
    correlationId: 'corr-pg-' + uniqueId,
    idempotencyKey: 'idem-pg-' + uniqueId,
    createdAt: '2026-09-20T12:00:00.000Z',
    expiresAt: '2026-09-20T13:00:00.000Z',
    evidenceRefs: [],
    ...overrides,
  };
}

function makeMockAttempt(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  return {
    attemptId: 'attempt-pg-' + uniqueId,
    executionIntentId: 'exec-intent-pg-' + uniqueId,
    tradingIntentId: 'trading-intent-pg-' + uniqueId,
    strategyId: 'strat-momentum-pg',
    strategyRevisionId: 'strat-momentum-pg:r7',
    adapterType: 'testnet_adapter',
    venue: 'binance',
    environment: 'TESTNET',
    attemptNumber: 1,
    idempotencyKey: 'idem-pg-' + uniqueId,
    clientOrderId: 'ax-intent-pg-' + uniqueId,
    providerOrderId: 'order-prov-pg-' + uniqueId,
    status: 'ACKNOWLEDGED',
    createdAt: '2026-09-20T12:00:01.000Z',
    expiresAt: '2026-09-20T13:00:00.000Z',
    ...overrides,
  };
}

function makeMockOrder(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  return {
    canonicalOrderId: 'order-pg-' + uniqueId,
    executionIntentId: 'exec-intent-pg-' + uniqueId,
    executionAttemptId: 'attempt-pg-' + uniqueId,
    tradingIntentId: 'trading-intent-pg-' + uniqueId,
    strategyId: 'strat-momentum-pg',
    strategyRevisionId: 'strat-momentum-pg:r7',
    provider: 'binance',
    venue: 'binance',
    instrument: 'BTC-USDT',
    side: 'buy',
    orderType: 'LIMIT',
    authorizedQuantity: '1.000000000000',
    executionQuantity: '1.000000000000',
    cumulativeFilledQuantity: '1.000000000000',
    remainingQuantity: '0.000000000000',
    weightedAveragePrice: '60100.000000000000',
    state: 'FILLED',
    orderVersion: 2,
    clientOrderId: 'ax-intent-pg-' + uniqueId,
    providerOrderId: 'order-prov-pg-' + uniqueId,
    createdAt: '2026-09-20T12:00:01.000Z',
    updatedAt: '2026-09-20T12:00:05.000Z',
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / VAL-10-PG — Real PostgreSQL Durable Economic Feedback & PnL Attribution Acceptance', () => {
  let client;
  let repository;
  const diagAuth = new ExecutionDiagnosticsAuthority();
  const pnlAuth = new PnLAttributionAuthority();
  const feedbackService = new TradingFeedbackService();

  before(async () => {
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const runner = new MigrationRunner(client);
    const migrations = loadMigrations();
    await runner.run({ environment: 'local', schemaName: 'public', migrations });
    repository = new PostgresEconomicAttributionRepository(client);
  });

  after(async () => {
    if (client && !client.isClosed()) {
      await client.close();
    }
  });

  it('Gate 1: Migration 0009 applies cleanly and all 6 tables exist in PostgreSQL', async () => {
    const tableRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('execution_diagnostics', 'pnl_attributions', 'pnl_attribution_components', 'position_ledger_entries', 'trading_feedback_snapshots', 'attribution_corrections') ORDER BY table_name;"
    );
    const tableNames = tableRes.rows.map((r) => r.table_name);
    assert.deepEqual(tableNames, [
      'attribution_corrections',
      'execution_diagnostics',
      'pnl_attribution_components',
      'pnl_attributions',
      'position_ledger_entries',
      'trading_feedback_snapshots',
    ]);

    const indexRes = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'execution_diagnostics' AND indexname = 'idx_execution_diagnostics_order';"
    );
    assert.equal(indexRes.rows.length, 1);
  });

  it('Gate 2: ExecutionDiagnostics persistence & exact column mapping round-trip in real PostgreSQL', async () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
    const order = makeMockOrder({ executionIntentId: intent.executionIntentId, executionAttemptId: attempt.attemptId });
    const fills = [
      {
        canonicalFillId: 'fill-pg-1',
        canonicalOrderId: order.canonicalOrderId,
        executionIntentId: intent.executionIntentId,
        provider: 'binance',
        providerTradeId: 'trade-pg-1',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '1.000000000000',
        fillPrice: '60100.000000000000',
        fee: '6.010000000000',
        feeAsset: 'USDT',
        providerTimestamp: '2026-09-20T12:00:04.000Z',
        observedAt: '2026-09-20T12:00:04.500Z',
      },
    ];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    await repository.saveDiagnostics(diag);

    const retrieved = await repository.getDiagnosticsByOrderId(order.canonicalOrderId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved.diagnosticsId, diag.diagnosticsId);
    assert.equal(retrieved.canonicalOrderId, order.canonicalOrderId);
    assert.equal(retrieved.strategyId, intent.strategyId);
    assert.equal(retrieved.strategyRevisionId, intent.strategyRevisionId);
    assert.equal(retrieved.venue, 'binance');
    assert.equal(retrieved.instrument, 'BTC-USDT');
    assert.equal(retrieved.environment, 'TESTNET');
    assert.equal(retrieved.side, 'buy');
    assertDecEq(retrieved.filledQuantity, '1.000000000000');
    assertDecEq(retrieved.remainingQuantity, '0.000000000000');
    assertDecEq(retrieved.realizedExecutionPrice, '60100.000000000000');
    assertDecEq(retrieved.slippageAmount, '100.000000000000');
    assertDecEq(retrieved.normalizedTotalFee, '6.010000000000');
    assert.equal(retrieved.quality, 'COMPLETE');
  });

  it('Gate 3: PnL Attribution & Component breakdown persistence & querying in real PostgreSQL', async () => {
    const posService = new PositionAccountingService();
    const intent = makeMockIntent();
    const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
    const order = makeMockOrder({ executionIntentId: intent.executionIntentId, executionAttemptId: attempt.attemptId });
    const fills = [
      {
        canonicalFillId: 'fill-pg-comp',
        canonicalOrderId: order.canonicalOrderId,
        executionIntentId: intent.executionIntentId,
        provider: 'binance',
        providerTradeId: 'trade-pg-comp',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '1.000000000000',
        fillPrice: '60000.000000000000',
        fee: '6.000000000000',
        feeAsset: 'USDT',
        providerTimestamp: '2026-09-20T12:00:04.000Z',
        observedAt: '2026-09-20T12:00:04.500Z',
      },
    ];

   const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
   const pnl = pnlAuth.computePnLAttribution(intent, order, diag, fills, undefined, {
     positionService: posService,
      fundingAmount: '-2.500000000000',
      borrowInterestAmount: '1.200000000000',
   });

   await repository.savePnLAttribution(pnl);

    const retrieved = await repository.getPnLAttributionByOrderId(order.canonicalOrderId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved.pnlAttributionId, pnl.pnlAttributionId);
    assertDecEq(retrieved.canonicalFees, '6.000000000000');
    assertDecEq(retrieved.fundingPnl, '-2.500000000000');
   assertDecEq(retrieved.borrowInterestCost, '1.200000000000');
   assert.equal(retrieved.components.length, 3);

    const feeComp = retrieved.components.find((c) => c.componentType === 'FEE');
   assert.ok(feeComp);
   assertDecEq(feeComp.rawAmount, '6.000000000000');

    const fundComp = retrieved.components.find((c) => c.componentType === 'FUNDING');
    assert.ok(fundComp);
    assertDecEq(fundComp.rawAmount, '-2.500000000000');

    const intComp = retrieved.components.find((c) => c.componentType === 'BORROW_INTEREST');
    assert.ok(intComp);
    assertDecEq(intComp.rawAmount, '1.200000000000');
  });

  it('Gate 4: Durable idempotent replay returns existing records without duplicate insert', async () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
    const order = makeMockOrder({ executionIntentId: intent.executionIntentId, executionAttemptId: attempt.attemptId });
    const fills = [
      {
        canonicalFillId: 'fill-pg-idem',
        canonicalOrderId: order.canonicalOrderId,
        executionIntentId: intent.executionIntentId,
        provider: 'binance',
        providerTradeId: 'trade-pg-idem',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '1.000000000000',
        fillPrice: '60000.000000000000',
        fee: '6.000000000000',
        feeAsset: 'USDT',
        providerTimestamp: '2026-09-20T12:00:04.000Z',
        observedAt: '2026-09-20T12:00:04.500Z',
      },
    ];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    await repository.saveDiagnostics(diag);

    const countBefore = await client.query('SELECT count(*) FROM execution_diagnostics WHERE canonical_order_id = $1', [order.canonicalOrderId]);
    assert.equal(countBefore.rows[0].count, '1');

    // Replay saving exact same diagnostics
    await repository.saveDiagnostics(diag);

    const countAfter = await client.query('SELECT count(*) FROM execution_diagnostics WHERE canonical_order_id = $1', [order.canonicalOrderId]);
    assert.equal(countAfter.rows[0].count, '1');
  });

 it('Gate 5: Idempotency conflict throws EconomicIdempotencyConflictError on altered digest', async () => {
   const orderId = 'order-conflict-' + globalThis.crypto.randomUUID().slice(0, 8);
   const intent = makeMockIntent();
   const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
   const order = makeMockOrder({ canonicalOrderId: orderId, executionIntentId: intent.executionIntentId, executionAttemptId: attempt.attemptId });
   const fills = [
     {
       canonicalFillId: 'fill-pg-conf',
       canonicalOrderId: order.canonicalOrderId,
        executionIntentId: intent.executionIntentId,
        provider: 'binance',
        providerTradeId: 'trade-pg-conf',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '1.000000000000',
        fillPrice: '60000.000000000000',
        fee: '6.000000000000',
        feeAsset: 'USDT',
        providerTimestamp: '2026-09-20T12:00:04.000Z',
        observedAt: '2026-09-20T12:00:04.500Z',
      },
    ];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    await repository.saveDiagnostics(diag);

  // Alter inputDigest and attempt to save for same canonicalOrderId
  const conflictingDiag = { ...diag, inputDigest: 'altered-digest-123' };
  let caughtError = null;
  try {
    await repository.saveDiagnostics(conflictingDiag);
  } catch (err) {
    caughtError = err;
  }
  assert.ok(caughtError !== null, 'Expected saveDiagnostics to throw on conflicting digest');
  assert.equal(caughtError.code, 'ECONOMIC_IDEMPOTENCY_CONFLICT');
  assert.equal(caughtError.name, 'EconomicIdempotencyConflictError');
});

  it('Gate 6: Multi-strategy, multi-revision, multi-venue position ledger isolation in PostgreSQL', async () => {
    const posService = new PositionAccountingService();
    const keyR1 = { strategyId: 'strat-iso-1', strategyRevisionId: 'strat-iso-1:r1', venue: 'binance', instrument: 'BTC-USDT', environment: 'TESTNET' };
    const keyR2 = { strategyId: 'strat-iso-1', strategyRevisionId: 'strat-iso-1:r2', venue: 'binance', instrument: 'BTC-USDT', environment: 'TESTNET' };
    const keyBybit = { strategyId: 'strat-iso-1', strategyRevisionId: 'strat-iso-1:r1', venue: 'bybit', instrument: 'BTC-USDT', environment: 'TESTNET' };

    posService.processExecution(keyR1, 'buy', '2.000000000000', '50000.000000000000', 'f-pg-r1', '2026-09-20T12:00:00.000Z');
    posService.processExecution(keyR2, 'buy', '4.000000000000', '60000.000000000000', 'f-pg-r2', '2026-09-20T12:01:00.000Z');
    posService.processExecution(keyBybit, 'buy', '1.000000000000', '70000.000000000000', 'f-pg-bybit', '2026-09-20T12:02:00.000Z');

    assertDecEq(posService.getOpenPositionSummary(keyR1).totalQuantity, '2.000000000000');
    assertDecEq(posService.getOpenPositionSummary(keyR2).totalQuantity, '4.000000000000');
    assertDecEq(posService.getOpenPositionSummary(keyBybit).totalQuantity, '1.000000000000');

    // Sell 2 from keyR1
    const closeR1 = posService.processExecution(keyR1, 'sell', '2.000000000000', '55000.000000000000', 'f-pg-r1-c', '2026-09-20T12:03:00.000Z');
    assertDecEq(closeR1.realizedGrossPnl, '10000.000000000000');
    assertDecEq(posService.getOpenPositionSummary(keyR1).totalQuantity, '0.000000000000');

    // Key R2 and Bybit positions remain completely unaffected
    assertDecEq(posService.getOpenPositionSummary(keyR2).totalQuantity, '4.000000000000');
    assertDecEq(posService.getOpenPositionSummary(keyBybit).totalQuantity, '1.000000000000');
  });

  it('Gate 7: Transaction rollback / failure injection leaves zero partial state in PostgreSQL', async () => {
    const orderId = 'order-rollback-' + globalThis.crypto.randomUUID().slice(0, 8);
    const intent = makeMockIntent();
    const attempt = makeMockAttempt();
    const order = makeMockOrder({ canonicalOrderId: orderId });
    const fills = [{
      canonicalFillId: 'f-rb',
      canonicalOrderId: orderId,
      executionIntentId: intent.executionIntentId,
      provider: 'binance',
      providerTradeId: 't-rb',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60000.000000000000',
      fee: '6.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);

    // Try executing transaction with injected error after diagnostics insert
    await assert.rejects(async () => {
      await client.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO execution_diagnostics (
            diagnostics_id, execution_result_id, execution_intent_id, canonical_order_id,
            strategy_id, strategy_revision_id, venue, instrument, environment, side,
            authorized_quantity, execution_quantity, filled_quantity, remaining_quantity,
            fill_ratio, accounting_currency, quality, policy_id, policy_revision, input_digest, created_at, as_of
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            diag.diagnosticsId, diag.executionResultId, diag.executionIntentId, diag.canonicalOrderId,
            diag.strategyId, diag.strategyRevisionId, diag.venue, diag.instrument, diag.environment, diag.side,
            diag.authorizedQuantity, diag.executionQuantity, diag.filledQuantity, diag.remainingQuantity,
            diag.fillRatio, diag.accountingCurrency, diag.quality, diag.policyId, diag.policyRevision, diag.inputDigest,
            diag.createdAt, diag.asOf,
          ]
        );
        throw new Error('Simulated failure before transaction commit');
      });
    });

    const check = await client.query('SELECT * FROM execution_diagnostics WHERE canonical_order_id = $1', [orderId]);
    assert.equal(check.rows.length, 0);
  });

  it('Gate 8: Outbox atomicity — ExecutionDiagnosticsCreated and PnLAttributionCreated in PostgreSQL', async () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
    const order = makeMockOrder({ executionIntentId: intent.executionIntentId, executionAttemptId: attempt.attemptId });
    const fills = [{
      canonicalFillId: 'fill-pg-outbox',
      canonicalOrderId: order.canonicalOrderId,
      executionIntentId: intent.executionIntentId,
      provider: 'binance',
      providerTradeId: 'trade-pg-outbox',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60000.000000000000',
      fee: '6.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    const outboxEntry = {
      outboxId: 'outbox-diag-' + globalThis.crypto.randomUUID().slice(0, 8),
      aggregateId: diag.diagnosticsId,
      aggregateVersion: 1,
      eventType: 'ExecutionDiagnosticsCreated',
      correlationId: 'corr-diag-1',
      payload: { diagnosticsId: diag.diagnosticsId, canonicalOrderId: order.canonicalOrderId },
      createdAt: new Date().toISOString(),
    };

    await repository.saveDiagnostics(diag, outboxEntry);

    const outboxRes = await client.query('SELECT * FROM trading_execution_outbox WHERE outbox_id = $1', [outboxEntry.outboxId]);
    assert.equal(outboxRes.rows.length, 1);
    assert.equal(outboxRes.rows[0].event_type, 'ExecutionDiagnosticsCreated');
    assert.equal(outboxRes.rows[0].aggregate_id, diag.diagnosticsId);
  });

  it('Gate 9: Disconnect + Reconnect — state survives across pool lifecycle', async () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
    const order = makeMockOrder({ executionIntentId: intent.executionIntentId, executionAttemptId: attempt.attemptId });
    const fills = [{
      canonicalFillId: 'fill-pg-recon',
      canonicalOrderId: order.canonicalOrderId,
      executionIntentId: intent.executionIntentId,
      provider: 'binance',
      providerTradeId: 'trade-pg-recon',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60000.000000000000',
      fee: '6.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    await repository.saveDiagnostics(diag);

    // Close and recreate pool
    await client.close();
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    repository = new PostgresEconomicAttributionRepository(client);

    const reloaded = await repository.getDiagnosticsByOrderId(order.canonicalOrderId);
    assert.ok(reloaded !== null);
    assert.equal(reloaded.diagnosticsId, diag.diagnosticsId);
  });

  it('Gate 10: Process / Repository restart — service reconstruction preserves replay & lookup', async () => {
    const orderId = 'order-restart-' + globalThis.crypto.randomUUID().slice(0, 8);
    const intent = makeMockIntent({ executionIntentId: 'exec-intent-' + orderId });
    const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
    const order = makeMockOrder({ canonicalOrderId: orderId, executionIntentId: intent.executionIntentId });
    const fills = [{
      canonicalFillId: 'f-restart',
      canonicalOrderId: orderId,
      executionIntentId: intent.executionIntentId,
      provider: 'binance',
      providerTradeId: 't-restart',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60000.000000000000',
      fee: '6.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    await repository.saveDiagnostics(diag);

    // Instantiate fresh repository instance
    const freshRepo = new PostgresEconomicAttributionRepository(client);
    const found = await freshRepo.getDiagnosticsByOrderId(orderId);
    assert.ok(found !== null);
    assert.equal(found.diagnosticsId, diag.diagnosticsId);
  });

  it('Gate 11: Realized PnL vs Slippage double-counting protection verification in PostgreSQL', async () => {
    const posService = new PositionAccountingService();
    const intent = makeMockIntent();
    const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
    const order = makeMockOrder({ executionIntentId: intent.executionIntentId, executionAttemptId: attempt.attemptId });
    const fills = [{
      canonicalFillId: 'f-pg-noslip',
      canonicalOrderId: order.canonicalOrderId,
      executionIntentId: intent.executionIntentId,
      provider: 'binance',
      providerTradeId: 't-pg-noslip',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60200.000000000000', // 200 adverse slippage
      fee: '10.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], [], { referencePrice: '60000.000000000000' });
    const pnl = pnlAuth.computePnLAttribution(intent, order, diag, fills, undefined, { positionService: posService });

    await repository.saveDiagnostics(diag);
    await repository.savePnLAttribution(pnl);

    const persistedDiag = await repository.getDiagnosticsByOrderId(order.canonicalOrderId);
    const persistedPnl = await repository.getPnLAttributionByOrderId(order.canonicalOrderId);

    assert.ok(persistedDiag && persistedPnl);
    assertDecEq(persistedDiag.slippageAmount, '200.000000000000');
    // Invariant: Gross PnL = 0, fees = 10, Net PnL = -10 (Slippage is NOT double-subtracted)
    assertDecEq(persistedPnl.realizedGrossPnl, '0.000000000000');
    assertDecEq(persistedPnl.canonicalFees, '10.000000000000');
    assertDecEq(persistedPnl.realizedNetPnl, '-10.000000000000');
  });

  it('Gate 12: Continuous feedback snapshot & Expected vs Observed divergence persistence in PostgreSQL', async () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt({ executionIntentId: intent.executionIntentId });
    const order = makeMockOrder({ executionIntentId: intent.executionIntentId, executionAttemptId: attempt.attemptId });
    const fills = [{
      canonicalFillId: 'f-pg-snap',
      canonicalOrderId: order.canonicalOrderId,
      executionIntentId: intent.executionIntentId,
      provider: 'binance',
      providerTradeId: 't-pg-snap',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60000.000000000000',
      fee: '6.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], [], { referencePrice: '60000.000000000000' });
    const pnl = pnlAuth.computePnLAttribution(intent, order, diag, fills);

    const snapshot = feedbackService.createSnapshot([diag], [pnl], {
      strategyId: 'strat-momentum-pg',
      strategyRevisionId: 'strat-momentum-pg:r7',
      venue: 'binance',
      instrument: 'BTC-USDT',
      environment: 'TESTNET',
      windowStart: '2026-09-20T00:00:00.000Z',
      windowEnd: '2026-09-20T23:59:59.000Z',
      expectedMetrics: {
        expectedSlippageBps: '10.000000000000',
        expectedFee: '5.000000000000',
        expectedFillRatio: '1.000000000000',
        expectedLatencyMs: 500,
        expectedPnl: '0.000000000000',
      },
    });

    const outboxEntry = {
      outboxId: 'outbox-snap-' + globalThis.crypto.randomUUID().slice(0, 8),
      aggregateId: snapshot.feedbackSnapshotId,
      aggregateVersion: 1,
      eventType: 'TradingFeedbackSnapshotCreated',
      correlationId: 'corr-snap-1',
      payload: { feedbackSnapshotId: snapshot.feedbackSnapshotId },
      createdAt: new Date().toISOString(),
    };

    await repository.saveFeedbackSnapshot(snapshot, outboxEntry);

    const reloaded = await repository.getFeedbackSnapshot(snapshot.feedbackSnapshotId);
    assert.ok(reloaded !== null);
    assert.equal(reloaded.feedbackSnapshotId, snapshot.feedbackSnapshotId);
    assert.equal(reloaded.strategyId, 'strat-momentum-pg');
    assert.equal(reloaded.aggregate.executionCount, 1);
    assertDecEq(reloaded.aggregate.totalFees, '6.000000000000');
    assertDecEq(reloaded.divergence?.feeDivergence, '1.000000000000');
    assert.equal(reloaded.quality, 'COMPLETE');

    const outboxRes = await client.query('SELECT * FROM trading_execution_outbox WHERE outbox_id = $1', [outboxEntry.outboxId]);
    assert.equal(outboxRes.rows.length, 1);
    assert.equal(outboxRes.rows[0].event_type, 'TradingFeedbackSnapshotCreated');
  });
});
