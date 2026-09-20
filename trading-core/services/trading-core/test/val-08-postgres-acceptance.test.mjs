import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  PostgresExecutionBoundaryRepository,
  ExecutionBoundaryService,
  ExecutionIntentTranslator,
  DryRunExecutionAdapter,
  HummingbotDryRunAdapter,
  CondorDryRunAdapter,
  DEFAULT_DRY_RUN_CAPABILITIES,
  ExecutionIdempotencyConflictError,
  MigrationRunner,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import {
  FixedDecimal,
  DEFAULT_EXECUTION_POLICY_V1,
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

function makeValidTradingIntent(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date(Date.now() - 60000).toISOString();
  const expiresAt = new Date(Date.now() + 3600000).toISOString();

  return {
    intentId: 'intent-pg-' + uniqueId,
    strategyId: 'strat-momentum-pg',
    strategyRevisionId: 'strat-momentum-pg:r7',
    marketStateId: 'ms-pg-' + uniqueId,
    opportunityId: 'opp-pg-' + uniqueId,
    proposalId: 'prop-pg-' + uniqueId,
    portfolioDecisionId: 'port-pg-' + uniqueId,
    riskDecisionId: 'risk-pg-' + uniqueId,
    eligibilityId: 'elig-pg-' + uniqueId,
    instrument: 'BTC-USDT',
    venue: 'binance',
    action: 'buy',
    approvedQuantity: '0.005000000000',
    approvedCapital: '100.000000000000',
    approvedLeverage: '2.000000000000',
    executionPolicyRef: 'RISK_POLICY_V1',
    correlationId: 'corr-pg-' + uniqueId,
    idempotencyKey: 'idem-intent-pg-' + uniqueId,
    createdAt: now,
    expiresAt,
    evidenceRefs: ['ev-quant-01', 'ev-risk-01'],
    ...overrides,
  };
}

function makeTranslationCommand(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const tradingIntent = overrides.tradingIntent ?? makeValidTradingIntent();

  return {
    commandId: 'cmd-exec-pg-' + uniqueId,
    tradingIntent,
    targetAdapterType: 'dry_run',
    adapterCapabilities: DEFAULT_DRY_RUN_CAPABILITIES,
    policy: DEFAULT_EXECUTION_POLICY_V1,
    evaluationTime: new Date().toISOString(),
    idempotencyKey: 'idem-exec-pg-' + uniqueId,
    correlationId: 'corr-exec-pg-' + uniqueId,
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / VAL-08-PG — Real PostgreSQL Durable Execution Boundary Acceptance', () => {
  let client;
  let repository;
  let service;

  before(async () => {
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const runner = new MigrationRunner(client);
    const migrations = loadMigrations();
    await runner.run({ environment: 'local', schemaName: 'public', migrations });
    repository = new PostgresExecutionBoundaryRepository(client);
    service = new ExecutionBoundaryService(repository, client, { publishEvents: true });
  });

  after(async () => {
    if (client && !client.isClosed()) {
      await client.close();
    }
  });

  it('Gate 1: Migration 0007 applies cleanly and tables exist in PostgreSQL', async () => {
    const tableRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('execution_intents', 'execution_translations', 'execution_results', 'trading_execution_outbox') ORDER BY table_name;"
    );
    const tableNames = tableRes.rows.map((r) => r.table_name);
    assert.deepEqual(tableNames, ['execution_intents', 'execution_results', 'execution_translations', 'trading_execution_outbox']);

    const indexRes = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'execution_intents' AND indexname = 'idx_execution_intents_trading_intent';"
    );
    assert.equal(indexRes.rows.length, 1);
  });

  it('Gate 2: ExecutionIntent persistence & exact column mapping in real PostgreSQL', async () => {
    const cmd = makeTranslationCommand();
    const result = await service.translateAndAuthorize(cmd);

    assert.equal(result.decision, 'AUTHORIZED');
    assert.ok(result.executionIntent);
    assert.ok(FixedDecimal.from(result.effectiveCapital).eq(cmd.tradingIntent.approvedCapital));
    assert.ok(FixedDecimal.from(result.effectiveQuantity).eq(cmd.tradingIntent.approvedQuantity));
    assert.ok(FixedDecimal.from(result.effectiveLeverage).eq(cmd.tradingIntent.approvedLeverage));

    const intentRes = await client.query(
      'SELECT * FROM execution_intents WHERE execution_intent_id = $1',
      [result.executionIntent.executionIntentId]
    );
    assert.equal(intentRes.rows.length, 1);
    const row = intentRes.rows[0];
    assert.equal(row.trading_intent_id, cmd.tradingIntent.intentId);
    assert.equal(row.strategy_id, cmd.tradingIntent.strategyId);
    assert.equal(row.strategy_revision_id, cmd.tradingIntent.strategyRevisionId);
    assert.equal(row.instrument, cmd.tradingIntent.instrument);
    assert.equal(row.side, 'buy');
    assert.equal(row.market_type, 'perpetual');
    assert.equal(row.target_adapter_type, 'dry_run');

    const transRes = await client.query(
      'SELECT * FROM execution_translations WHERE translation_id = $1',
      [result.translationId]
    );
    assert.equal(transRes.rows.length, 1);
    assert.equal(transRes.rows[0].decision, 'AUTHORIZED');
    assert.equal(transRes.rows[0].execution_intent_id, result.executionIntent.executionIntentId);
  });

  it('Gate 3: Durable idempotent replay returns existing ExecutionIntent without duplicate insert', async () => {
    const cmd = makeTranslationCommand();
    const first = await service.translateAndAuthorize(cmd);
    const countBefore = await client.query('SELECT count(*) FROM execution_intents');

    const second = await service.translateAndAuthorize(cmd);
    const countAfter = await client.query('SELECT count(*) FROM execution_intents');

    assert.equal(first.executionIntent?.executionIntentId, second.executionIntent?.executionIntentId);
    assert.equal(first.translationId, second.translationId);
    assert.equal(countBefore.rows[0].count, countAfter.rows[0].count);
  });

  it('Gate 4: Idempotency conflict throws ExecutionIdempotencyConflictError on differing payload', async () => {
    const cmd = makeTranslationCommand();
    await service.translateAndAuthorize(cmd);

    const conflictingCmd = {
      ...cmd,
      tradingIntent: {
        ...cmd.tradingIntent,
        approvedCapital: '999.000000000000',
      },
    };

    await assert.rejects(
      async () => service.translateAndAuthorize(conflictingCmd),
      (err) => err instanceof ExecutionIdempotencyConflictError
    );
  });

  it('Gate 5: Single-use TradingIntent prevents re-consumption by another translation command', async () => {
    const cmd1 = makeTranslationCommand();
    const res1 = await service.translateAndAuthorize(cmd1);
    assert.equal(res1.decision, 'AUTHORIZED');

    const cmd2 = makeTranslationCommand({
      commandId: 'cmd-exec-second-' + globalThis.crypto.randomUUID().slice(0, 8),
      idempotencyKey: 'idem-exec-second-' + globalThis.crypto.randomUUID().slice(0, 8),
      tradingIntent: cmd1.tradingIntent,
    });

    const res2 = await service.translateAndAuthorize(cmd2);
    assert.equal(res2.decision, 'CONFLICT');
    assert.ok(res2.reasonCodes.includes('TRADING_INTENT_ALREADY_CONSUMED'));
    assert.equal(res2.executionIntent, undefined);
  });

  it('Gate 6: Two-worker concurrency & PostgreSQL unique constraint protection', async () => {
    const tradingIntent = makeValidTradingIntent();
    const cmdA = makeTranslationCommand({
      tradingIntent,
      commandId: 'cmd-worker-A-' + globalThis.crypto.randomUUID().slice(0, 8),
      idempotencyKey: 'idem-worker-A-' + globalThis.crypto.randomUUID().slice(0, 8),
    });
    const cmdB = makeTranslationCommand({
      tradingIntent,
      commandId: 'cmd-worker-B-' + globalThis.crypto.randomUUID().slice(0, 8),
      idempotencyKey: 'idem-worker-B-' + globalThis.crypto.randomUUID().slice(0, 8),
    });

    const outcomes = await Promise.allSettled([
      service.translateAndAuthorize(cmdA),
      service.translateAndAuthorize(cmdB),
    ]);

    const successes = outcomes.filter((o) => o.status === 'fulfilled');
    assert.equal(successes.length, 2);

    const decisions = successes.map((s) => s.value.decision);
    assert.ok(decisions.includes('AUTHORIZED'));
    assert.ok(decisions.includes('CONFLICT'));

    const intentCountRes = await client.query(
      'SELECT count(*) FROM execution_intents WHERE trading_intent_id = $1',
      [tradingIntent.intentId]
    );
    assert.equal(intentCountRes.rows[0].count, '1');
  });

  it('Gate 7: Transaction rollback / failure injection leaves zero partial state in PostgreSQL', async () => {
    const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
    const tradingIntent = makeValidTradingIntent({ intentId: 'intent-fail-' + uniqueId });
    const cmd = makeTranslationCommand({ tradingIntent, idempotencyKey: 'idem-fail-' + uniqueId });

    let countIntentsBefore = await client.query('SELECT count(*) FROM execution_intents');
    let countTransBefore = await client.query('SELECT count(*) FROM execution_translations');

    await assert.rejects(
      async () => {
        await client.transaction(async (txClient) => {
          const outcome = ExecutionIntentTranslator.translate(cmd);
          await repository.saveTranslation({
            translationId: 'trans-fail-' + uniqueId,
            tradingIntentId: tradingIntent.intentId,
            strategyId: tradingIntent.strategyId,
            strategyRevisionId: tradingIntent.strategyRevisionId,
            targetAdapterType: 'dry_run',
            decision: outcome.decision,
            reasonCodes: outcome.reasonCodes,
            executionIntentId: outcome.intent?.executionIntentId,
            effectiveCapital: outcome.effectiveCapital,
            effectiveQuantity: outcome.effectiveQuantity,
            effectiveLeverage: outcome.effectiveLeverage,
            policyRevision: 'DEFAULT_EXECUTION_POLICY_V1',
            idempotencyKey: cmd.idempotencyKey,
            commandHash: 'hash-test',
            rationale: outcome.rationale,
            evaluatedAt: cmd.evaluationTime,
            createdAt: new Date().toISOString(),
          }, txClient);

          if (outcome.intent) {
            await repository.saveExecutionIntent(outcome.intent, txClient);
          }

          throw new Error('Simulated transient crash before commit');
        });
      },
      (err) => err.message === 'Simulated transient crash before commit'
    );

    let countIntentsAfter = await client.query('SELECT count(*) FROM execution_intents');
    let countTransAfter = await client.query('SELECT count(*) FROM execution_translations');

    assert.equal(countIntentsBefore.rows[0].count, countIntentsAfter.rows[0].count);
    assert.equal(countTransBefore.rows[0].count, countTransAfter.rows[0].count);
  });

  it('Gate 8: Outbox atomicity — ExecutionIntentCreated and DryRunExecutionAccepted in PostgreSQL', async () => {
    const cmd = makeTranslationCommand();
    const transResult = await service.translateAndAuthorize(cmd);

    assert.equal(transResult.decision, 'AUTHORIZED');
    assert.ok(transResult.executionIntent);

    const outboxRes1 = await client.query(
      "SELECT * FROM trading_execution_outbox WHERE aggregate_id = $1 AND event_type = 'ExecutionIntentCreated'",
      [transResult.executionIntent.executionIntentId]
    );
    assert.equal(outboxRes1.rows.length, 1);
    assert.equal(outboxRes1.rows[0].event_type, 'ExecutionIntentCreated');

    const adapter = new DryRunExecutionAdapter();
    const dryRunResult = await service.executeDryRun(transResult.executionIntent, adapter);

    assert.equal(dryRunResult.status, 'DRY_RUN_ACCEPTED');

    const outboxRes2 = await client.query(
      "SELECT * FROM trading_execution_outbox WHERE aggregate_id = $1 AND event_type = 'DryRunExecutionAccepted'",
      [dryRunResult.executionResultId]
    );
    assert.equal(outboxRes2.rows.length, 1);
    assert.equal(outboxRes2.rows[0].event_type, 'DryRunExecutionAccepted');
  });

  it('Gate 9: Disconnect + Reconnect — state survives across pool lifecycle', async () => {
    const cmd = makeTranslationCommand();
    const transResult = await service.translateAndAuthorize(cmd);
    const intentId = transResult.executionIntent.executionIntentId;

    await client.close();

    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    repository = new PostgresExecutionBoundaryRepository(client);
    service = new ExecutionBoundaryService(repository, client, { publishEvents: true });

    const loadedIntent = await repository.getExecutionIntent(intentId);
    assert.ok(loadedIntent);
    assert.equal(loadedIntent.executionIntentId, intentId);
    assert.equal(loadedIntent.tradingIntentId, cmd.tradingIntent.intentId);
  });

  it('Gate 10: Process / Repository restart — service reconstruction preserves replay & lookup', async () => {
    const cmd = makeTranslationCommand();
    const original = await service.translateAndAuthorize(cmd);

    const freshRepo = new PostgresExecutionBoundaryRepository(client);
    const freshService = new ExecutionBoundaryService(freshRepo, client, { publishEvents: true });

    const replayed = await freshService.translateAndAuthorize(cmd);
    assert.equal(original.executionIntent?.executionIntentId, replayed.executionIntent?.executionIntentId);
    assert.equal(original.translationId, replayed.translationId);
  });

  it('Gate 11: Multi-adapter dry-run execution (DryRun, Hummingbot, Condor) with ExecutionResult in PostgreSQL', async () => {
    const adapters = [
      { type: 'dry_run', adapter: new DryRunExecutionAdapter() },
      { type: 'hummingbot_dry_run', adapter: new HummingbotDryRunAdapter() },
      { type: 'condor_dry_run', adapter: new CondorDryRunAdapter() },
    ];

    for (const { type, adapter } of adapters) {
      const cmd = makeTranslationCommand({
        targetAdapterType: type,
        adapterCapabilities: adapter.getCapabilities(),
      });
      const auth = await service.translateAndAuthorize(cmd);
      assert.equal(auth.decision, 'AUTHORIZED');
      assert.ok(auth.executionIntent);

      const execRes = await service.executeDryRun(auth.executionIntent, adapter);
      assert.equal(execRes.status, 'DRY_RUN_ACCEPTED');
      assert.equal(execRes.mode, 'DRY_RUN');
      assert.equal(execRes.adapterType, type);

      const dbRes = await client.query(
        'SELECT * FROM execution_results WHERE execution_result_id = $1',
        [execRes.executionResultId]
      );
      assert.equal(dbRes.rows.length, 1);
      assert.equal(dbRes.rows[0].status, 'DRY_RUN_ACCEPTED');
      assert.equal(dbRes.rows[0].mode, 'DRY_RUN');
      assert.equal(dbRes.rows[0].adapter_type, type);
    }
  });

  it('Gate 12: Exact arithmetic & boundary monotonicity persistence in real PostgreSQL', async () => {
    const boundaries = ['0.000100000000', '0.100000000000', '1.234567890123', '999999999.999999999999'];
    for (const val of boundaries) {
      const cmd = makeTranslationCommand({
        tradingIntent: makeValidTradingIntent({
          approvedCapital: val,
          approvedQuantity: val,
        }),
      });

      const res = await service.translateAndAuthorize(cmd);
      assert.ok(res.decision === 'AUTHORIZED' || res.decision === 'REDUCED');
      assert.ok(res.executionIntent);

      const dbRow = await client.query(
        'SELECT execution_capital, execution_quantity FROM execution_intents WHERE execution_intent_id = $1',
        [res.executionIntent.executionIntentId]
      );
      assert.equal(dbRow.rows.length, 1);
      assert.ok(FixedDecimal.from(dbRow.rows[0].execution_capital).lte(FixedDecimal.from(val)));
      assert.ok(FixedDecimal.from(dbRow.rows[0].execution_quantity).lte(FixedDecimal.from(val)));
    }
  });
});
