import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  PostgresPreExecutionAuthorizationRepository,
  PreExecutionAuthorizationService,
  PreExecutionIdempotencyConflictError,
  MigrationRunner,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
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

function makeValidCommand(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date('2026-09-20T10:00:00.000Z').toISOString();
  const expiresAt = new Date('2026-09-20T11:00:00.000Z').toISOString();

  return {
    commandId: 'cmd-pg-' + uniqueId,
    proposal: {
      proposalId: 'prop-pg-' + uniqueId,
      strategyId: 'strat-momentum-pg',
      strategyRevisionId: 'strat-momentum-pg:r7',
      strategyRevision: { strategy: 'strat-momentum-pg', revision: 'r7', revisionId: 'strat-momentum-pg:r7' },
      opportunity: {
        opportunityId: 'opp-pg-' + uniqueId,
        marketStateId: 'ms-pg-' + uniqueId,
        instrument: 'BTC-USDT',
        venue: 'binance',
        timeframe: '1m',
      },
      marketState: {
        marketStateId: 'ms-pg-' + uniqueId,
        schemaVersion: '1.0.0',
        validityContext: 'live',
      },
      action: 'buy',
      sizing: {
        requestedQuantity: '0.005000000000',
        requestedCapital: '100.000000000000',
        leverage: '2',
      },
      expectedReturn: {},
      expectedRisk: {},
      liquidityAssumptions: {},
      duration: {},
      costAssumptions: {},
      eligibility: {
        eligibilityId: 'elig-pg-' + uniqueId,
        strategyRevisionId: 'strat-momentum-pg:r7',
        decision: 'ELIGIBLE',
        policyVersion: '1.0.0',
      },
      correlationId: 'corr-pg-' + uniqueId,
      idempotencyKey: 'idem-prop-' + uniqueId,
      createdAt: now,
      expiresAt,
      evidenceRefs: ['ev-quant-01'],
    },
    portfolioDecision: {
      portfolioDecisionId: 'pd-pg-' + uniqueId,
      proposalIds: ['prop-pg-' + uniqueId],
      outcome: 'APPROVED',
      requestedCapital: '100.000000000000',
      approvedCapital: '80',
      currentExposure: {},
      correlatedExposure: {},
      concentration: {},
      leverage: {},
      liquidity: {},
      duration: {},
      drawdown: {},
      executionCost: {},
      modifications: {},
      rationale: 'Portfolio approved 80 USDT',
      evidenceRefs: ['ev-port-01'],
      createdAt: now,
      expiresAt,
    },
    riskDecision: {
      riskDecisionId: 'rd-pg-' + uniqueId,
      proposalId: 'prop-pg-' + uniqueId,
      portfolioDecisionId: 'pd-pg-' + uniqueId,
      marketStateId: 'ms-pg-' + uniqueId,
      strategyRevisionId: 'strat-momentum-pg:r7',
      outcome: 'ALLOW',
      policyVersion: 'risk-policy-v1',
      hardLimitEvaluation: {},
      killSwitch: { active: false },
      modifications: {},
      rationale: 'Risk allows execution',
      evidenceRefs: ['ev-risk-01'],
      decidedAt: now,
      expiresAt,
    },
    operationalSnapshot: {
      snapshotId: 'snap-pg-' + uniqueId,
      strategyId: 'strat-momentum-pg',
      strategyRevisionId: 'strat-momentum-pg:r7',
      lifecycleState: 'PRODUCTION',
      lifecycleVersion: 12,
      healthState: 'HEALTHY',
      healthVersion: 8,
      compatibility: 'FULL',
      effectiveAt: now,
      expiresAt,
      snapshotVersion: '1.0.0',
    },
    evaluationTime: now,
    idempotencyKey: 'idem-cmd-pg-' + uniqueId,
    correlationId: 'corr-pg-' + uniqueId,
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / VAL-07D-PG — Real PostgreSQL Durable Pre-Execution Acceptance', () => {
  let client;
  let repository;
  let service;

  before(async () => {
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const runner = new MigrationRunner(client);
    const migrations = loadMigrations();
    await runner.run({ environment: 'local', schemaName: 'public', migrations });
    repository = new PostgresPreExecutionAuthorizationRepository(client);
    service = new PreExecutionAuthorizationService(repository, client, { publishEvents: true });
  });

  after(async () => {
    if (client && !client.isClosed()) {
      await client.close();
    }
  });

  it('Gate 1: Migration 0006 applies cleanly and tables exist in PostgreSQL', async () => {
    const tableRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('trading_intents', 'pre_execution_authorizations', 'trading_execution_outbox') ORDER BY table_name;"
    );
    const tableNames = tableRes.rows.map((r) => r.table_name);
    assert.deepEqual(tableNames, ['pre_execution_authorizations', 'trading_execution_outbox', 'trading_intents']);

    const indexRes = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'trading_intents' AND indexname = 'idx_trading_intents_risk_decision';"
    );
    assert.equal(indexRes.rows.length, 1);
  });

  it('Gate 2: TradingIntent persistence & exact column mapping in real PostgreSQL', async () => {
    const cmd = makeValidCommand();
    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'AUTHORIZED');
    assert.ok(result.intent);
    assert.equal(result.effectiveCapital, '80');
    assert.equal(result.effectiveLeverage, '2');

    const intentRes = await client.query(
      'SELECT * FROM trading_intents WHERE intent_id = $1',
      [result.intent.intentId]
    );
    assert.equal(intentRes.rows.length, 1);
    const row = intentRes.rows[0];
    assert.equal(row.strategy_id, 'strat-momentum-pg');
    assert.equal(row.strategy_revision_id, 'strat-momentum-pg:r7');
    assert.equal(row.approved_capital, '80');
    assert.equal(row.approved_quantity, '0.004');
    assert.equal(row.approved_leverage, '2');
    assert.equal(row.risk_decision_id, cmd.riskDecision.riskDecisionId);

    const authRes = await client.query(
      'SELECT * FROM pre_execution_authorizations WHERE authorization_id = $1',
      [result.authorizationId]
    );
    assert.equal(authRes.rows.length, 1);
    assert.equal(authRes.rows[0].decision, 'AUTHORIZED');
    assert.equal(authRes.rows[0].intent_id, result.intent.intentId);
  });

  it('Gate 3: Durable idempotent replay returns existing intent without duplicate insert', async () => {
    const cmd = makeValidCommand();
    const first = await service.authorize(cmd);
    const countBefore = await client.query('SELECT count(*) FROM trading_intents');

    const second = await service.authorize(cmd);
    const countAfter = await client.query('SELECT count(*) FROM trading_intents');

    assert.equal(first.intent?.intentId, second.intent?.intentId);
    assert.equal(first.authorizationId, second.authorizationId);
    assert.equal(countBefore.rows[0].count, countAfter.rows[0].count);
  });

  it('Gate 4: Idempotency conflict throws PreExecutionIdempotencyConflictError on differing payload', async () => {
    const cmd = makeValidCommand();
    await service.authorize(cmd);

    const conflictingCmd = {
      ...cmd,
      proposal: {
        ...cmd.proposal,
        proposalId: 'prop-different-001',
      },
    };

    await assert.rejects(
      async () => service.authorize(conflictingCmd),
      (err) => err instanceof PreExecutionIdempotencyConflictError
    );
  });

  it('Gate 5: Single-use RiskDecision prevents re-consumption by another command', async () => {
    const cmd1 = makeValidCommand();
    const res1 = await service.authorize(cmd1);
    assert.equal(res1.decision, 'AUTHORIZED');

    const cmd2 = makeValidCommand({
      commandId: 'cmd-pg-second-attempt-' + globalThis.crypto.randomUUID().slice(0, 8),
      idempotencyKey: 'idem-pg-second-attempt-' + globalThis.crypto.randomUUID().slice(0, 8),
      riskDecision: cmd1.riskDecision,
    });

    const res2 = await service.authorize(cmd2);
    assert.equal(res2.decision, 'CONFLICT');
    assert.ok(res2.reasonCodes.includes('AUTHORIZATION_ALREADY_CONSUMED'));
    assert.equal(res2.intent, undefined);

    const intentsForRisk = await client.query(
      'SELECT count(*) FROM trading_intents WHERE risk_decision_id = $1',
      [cmd1.riskDecision.riskDecisionId]
    );
    assert.equal(intentsForRisk.rows[0].count, '1');
  });

  it('Gate 6: Two-worker concurrency & PostgreSQL unique constraint protection', async () => {
    const baseCmd = makeValidCommand();
    const cmdWorker1 = { ...baseCmd, commandId: baseCmd.commandId + '-w1', idempotencyKey: baseCmd.idempotencyKey + '-w1' };
    const cmdWorker2 = { ...baseCmd, commandId: baseCmd.commandId + '-w2', idempotencyKey: baseCmd.idempotencyKey + '-w2' };

    const [result1, result2] = await Promise.allSettled([
      service.authorize(cmdWorker1),
      service.authorize(cmdWorker2),
    ]);

    const fulfilled = [result1, result2].filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const authorized = fulfilled.filter((r) => r.decision === 'AUTHORIZED');
    assert.equal(authorized.length, 1);

    const intentCount = await client.query(
      'SELECT count(*) FROM trading_intents WHERE risk_decision_id = $1',
      [baseCmd.riskDecision.riskDecisionId]
    );
    assert.equal(intentCount.rows[0].count, '1');
  });

  it('Gate 7: Transaction rollback / failure injection leaves zero partial state in PostgreSQL', async () => {
    const cmd = makeValidCommand();
    const authCountBefore = await client.query('SELECT count(*) FROM pre_execution_authorizations');
    const intentCountBefore = await client.query('SELECT count(*) FROM trading_intents');
    const outboxCountBefore = await client.query('SELECT count(*) FROM trading_execution_outbox');

    const failingRepo = new PostgresPreExecutionAuthorizationRepository(client);
    failingRepo.saveTradingIntent = async () => {
      throw new Error('SIMULATED_DB_FAILURE_DURING_INTENT_INSERT');
    };
    const failingService = new PreExecutionAuthorizationService(failingRepo, client, { publishEvents: true });

    await assert.rejects(
      async () => failingService.authorize(cmd),
      /SIMULATED_DB_FAILURE_DURING_INTENT_INSERT/
    );

    const authCountAfter = await client.query('SELECT count(*) FROM pre_execution_authorizations');
    const intentCountAfter = await client.query('SELECT count(*) FROM trading_intents');
    const outboxCountAfter = await client.query('SELECT count(*) FROM trading_execution_outbox');

    assert.equal(authCountAfter.rows[0].count, authCountBefore.rows[0].count);
    assert.equal(intentCountAfter.rows[0].count, intentCountBefore.rows[0].count);
    assert.equal(outboxCountAfter.rows[0].count, outboxCountBefore.rows[0].count);
  });

  it('Gate 8: Outbox atomicity — TradingIntentCreated is committed atomically in outbox', async () => {
    const cmd = makeValidCommand();
    const result = await service.authorize(cmd);
    assert.equal(result.decision, 'AUTHORIZED');

    const outboxRes = await client.query(
      "SELECT * FROM trading_execution_outbox WHERE aggregate_id = $1 AND event_type = 'TradingIntentCreated'",
      [result.intent.intentId]
    );
    assert.equal(outboxRes.rows.length, 1);
    const outboxEntry = outboxRes.rows[0];
    const payload = typeof outboxEntry.payload === 'string' ? JSON.parse(outboxEntry.payload) : outboxEntry.payload;
    assert.equal(payload.intentId, result.intent.intentId);
    assert.equal(payload.strategyId, 'strat-momentum-pg');
    assert.equal(payload.approvedCapital, '80');
  });

  it('Gate 9: Disconnect + Reconnect — state survives across pool lifecycle', async () => {
    const cmd = makeValidCommand();
    const result = await service.authorize(cmd);
    assert.equal(result.decision, 'AUTHORIZED');

    await client.close();

    const newClient = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    try {
      const intentRes = await newClient.query(
        'SELECT * FROM trading_intents WHERE intent_id = $1',
        [result.intent.intentId]
      );
      assert.equal(intentRes.rows.length, 1);
      assert.equal(intentRes.rows[0].intent_id, result.intent.intentId);

      const authRes = await newClient.query(
        'SELECT * FROM pre_execution_authorizations WHERE authorization_id = $1',
        [result.authorizationId]
      );
      assert.equal(authRes.rows.length, 1);
      assert.equal(authRes.rows[0].decision, 'AUTHORIZED');
    } finally {
      client = newClient;
      repository = new PostgresPreExecutionAuthorizationRepository(client);
      service = new PreExecutionAuthorizationService(repository, client, { publishEvents: true });
    }
  });

  it('Gate 10: Process / Repository restart — service reconstruction preserves replay & lookup', async () => {
    const cmd = makeValidCommand();
    const result = await service.authorize(cmd);
    assert.equal(result.decision, 'AUTHORIZED');

    const freshRepo = new PostgresPreExecutionAuthorizationRepository(client);
    const freshService = new PreExecutionAuthorizationService(freshRepo, client, { publishEvents: true });

    const fetchedIntent = await freshRepo.getTradingIntent(result.intent.intentId);
    assert.ok(fetchedIntent);
    assert.equal(fetchedIntent.intentId, result.intent.intentId);
    assert.equal(fetchedIntent.approvedCapital, '80');

    const replayResult = await freshService.authorize(cmd);
    assert.equal(replayResult.intent?.intentId, result.intent.intentId);
    assert.equal(replayResult.decision, 'AUTHORIZED');
  });

  it('Gate 11: State survives across distinct strategies and complex MODIFY arithmetic in real PostgreSQL', async () => {
    const modUnique = globalThis.crypto.randomUUID().slice(0, 8);
    const cmd = makeValidCommand({
      riskDecision: {
        riskDecisionId: 'risk-pg-mod-' + modUnique,
        proposalId: 'prop-pg-mod-' + modUnique,
        portfolioDecisionId: 'pd-pg-mod-' + modUnique,
        marketStateId: 'ms-pg-mod-' + modUnique,
        strategyRevisionId: 'strat-momentum-pg:r7',
        outcome: 'MODIFY',
        policyVersion: 'risk-policy-v1',
        hardLimitEvaluation: {},
        killSwitch: { active: false },
        modifications: {
          capital: '40',
          leverage: '1.5',
        },
        rationale: 'Risk modifies capital to 40 USDT',
        evidenceRefs: ['ev-risk-mod'],
        decidedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
      portfolioDecision: {
        portfolioDecisionId: 'pd-pg-mod-' + modUnique,
        proposalIds: ['prop-pg-mod-' + modUnique],
        outcome: 'APPROVED',
        requestedCapital: '100.000000000000',
        approvedCapital: '80',
        currentExposure: {},
        correlatedExposure: {},
        concentration: {},
        leverage: {},
        liquidity: {},
        duration: {},
        drawdown: {},
        executionCost: {},
        modifications: {},
        rationale: 'Portfolio approved 80 USDT',
        evidenceRefs: ['ev-port-mod'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
      proposal: {
        ...makeValidCommand().proposal,
        proposalId: 'prop-pg-mod-' + modUnique,
        opportunity: {
          opportunityId: 'opp-pg-mod-' + modUnique,
          marketStateId: 'ms-pg-mod-' + modUnique,
          instrument: 'BTC-USDT',
          venue: 'binance',
          timeframe: '1m',
        },
        marketState: {
          marketStateId: 'ms-pg-mod-' + modUnique,
          schemaVersion: '1.0.0',
          validityContext: 'live',
        },
        sizing: {
          requestedQuantity: '0.005000000000',
          requestedCapital: '100.000000000000',
          leverage: '2',
        },
      },
    });

    const result = await service.authorize(cmd);
    assert.equal(result.decision, 'AUTHORIZED');
    assert.equal(result.effectiveCapital, '40');
    assert.equal(result.effectiveLeverage, '1.5');
    assert.equal(result.intent?.approvedQuantity, '0.002');

    const intentRes = await client.query(
      'SELECT * FROM trading_intents WHERE intent_id = $1',
      [result.intent.intentId]
    );
    assert.equal(intentRes.rows[0].approved_capital, '40');
    assert.equal(intentRes.rows[0].approved_quantity, '0.002');
    assert.equal(intentRes.rows[0].approved_leverage, '1.5');
  });
});
