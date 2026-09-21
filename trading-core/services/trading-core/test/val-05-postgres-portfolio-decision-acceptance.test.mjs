import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  MigrationRunner,
  PostgresPortfolioProposalDecisionRepository,
  PortfolioAllocationCoordinator,
  PortfolioProposalDecisionConflictError,
  PortfolioProposalDecisionRepositoryUnavailableError,
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

function buildProposal(id, overrides = {}) {
  const strategyId = overrides.strategyId ?? 'strat-swing-pg';
  const strategyRevisionId = overrides.strategyRevisionId ?? `${strategyId}:1`;
  const instrument = overrides.instrument ?? 'BTC-USDT';
  return {
    proposalId: id,
    strategyId,
    strategyRevisionId,
    strategyRevision: {
      strategy: {
        strategyId,
        family: 'spot-swing',
        name: 'Alpha Strategy',
        organizationId: 'org-axodus',
      },
      revision: 1,
      revisionId: strategyRevisionId,
    },
    opportunity: {
      opportunityId: `opp-${id}`,
      marketStateId: `ms-${id}`,
      instrument,
      venue: 'binance',
      timeframe: '1m',
    },
    marketState: {
      marketStateId: `ms-${id}`,
      schemaVersion: '1.0.0',
      validityContext: 'live',
    },
    action: 'buy',
    sizing: overrides.sizing ?? {
      requestedQuantity: '0.5',
      requestedCapital: '10000',
      leverage: '1.0',
    },
    expectedReturn: { alpha: '0.015' },
    expectedRisk: { stopLossBps: 50 },
    liquidityAssumptions: { depth: 'high' },
    duration: { horizon: '4h' },
    costAssumptions: { feeBps: 2 },
    confidence: 0.85,
    eligibility: {
      eligibilityId: `elig-${id}`,
      strategyRevisionId,
      decision: 'ELIGIBLE',
      policyVersion: '1.0.0',
    },
    correlationId: 'corr-alloc',
    idempotencyKey: `prop-idemp-${id}`,
    createdAt: '2026-09-19T12:00:01.000Z',
    expiresAt: '2026-09-19T12:05:00.000Z',
    evidenceRefs: [`ev-${id}`],
    ...overrides,
  };
}

function buildContext(overrides = {}) {
  return {
    portfolioSnapshot: {
      snapshotId: 'snap-pg-100',
      asOf: '2026-09-19T12:00:00.000Z',
      validityContext: 'live',
      totalCapital: '100000',
      availableCapital: '50000',
      reservedCapital: '10000',
      positions: [],
      drawdownContext: {
        currentDrawdownPct: '0.02',
        highWaterMark: '105000',
      },
      provenanceRef: 'ledger:snap-pg-100',
      ...(overrides.portfolioSnapshot ?? {}),
    },
    proposals: overrides.proposals ?? [],
    policy: {
      policyVersion: 'policy-cap-v1',
      maxTotalCapital: '100000',
      maxStrategyBudgetPct: {
        'strat-swing-pg': 0.4,
        'strat-scalp-pg': 0.3,
      },
      defaultMaxStrategyBudgetPct: 0.2,
      maxInstrumentConcentrationPct: {
        'BTC-USDT': 0.5,
        'ETH-USDT': 0.3,
      },
      defaultMaxInstrumentConcentrationPct: 0.25,
      maxTotalGrossLeverage: 3.0,
      ...(overrides.policy ?? {}),
    },
    environment: 'live',
    now: '2026-09-19T12:00:02.000Z',
    correlationId: overrides.correlationId ?? 'corr-alloc-pg-batch-1',
  };
}

describe('AXODUS-TRADING-DEBT-AUD-A-03 / VAL-05-PG — Real PostgreSQL Portfolio Decision Acceptance', () => {
  let client;
  let repository;
  let coordinator;

  before(async () => {
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const runner = new MigrationRunner(client);
    const migrations = loadMigrations();
    await runner.run({ environment: 'local', schemaName: 'public', migrations });
    repository = new PostgresPortfolioProposalDecisionRepository(client);
    coordinator = new PortfolioAllocationCoordinator(repository);
  });

  after(async () => {
    if (client && !client.isClosed()) {
      await client.close();
    }
  });

  it('Gate 1: Migration 0015 applies cleanly and table exists in PostgreSQL', async () => {
    const tableRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trading_portfolio_proposal_decisions';"
    );
    assert.equal(tableRes.rows.length, 1);
    assert.equal(tableRes.rows[0].table_name, 'trading_portfolio_proposal_decisions');

    const indexRes = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'trading_portfolio_proposal_decisions' AND indexname = 'idx_portfolio_proposal_decisions_recovery';"
    );
    assert.equal(indexRes.rows.length, 1);
  });

  it('Gate 2: First proposal allocation creates durable terminal decision in PostgreSQL', async () => {
    const unique = globalThis.crypto.randomUUID().slice(0, 8);
    const propId = `prop-pg-gate2-${unique}`;
    const prop = buildProposal(propId, { sizing: { requestedQuantity: '0.1', requestedCapital: '10000' } });
    const context = buildContext({ proposals: [prop] });

    const result = await coordinator.allocate(context);
    assert.equal(result.decisions.length, 1);
    assert.equal(result.decisions[0].outcome, 'APPROVED');
    assert.equal(result.decisions[0].approvedCapital, '10000');

    // Verify directly in PostgreSQL table
    const rowRes = await client.query(
      'SELECT * FROM trading_portfolio_proposal_decisions WHERE proposal_id = $1;',
      [propId]
    );
    assert.equal(rowRes.rows.length, 1);
    assert.equal(rowRes.rows[0].state, 'TERMINAL');
    assert.ok(rowRes.rows[0].decision_payload);
    assert.ok(rowRes.rows[0].evaluation_payload);
  });

  it('Gate 3: Restart Durability — new client/repository instance retrieves existing decision', async () => {
    const unique = globalThis.crypto.randomUUID().slice(0, 8);
    const propId = `prop-pg-restart-${unique}`;
    const prop = buildProposal(propId, { sizing: { requestedQuantity: '0.2', requestedCapital: '15000' } });

    // First coordinator run
    const res1 = await coordinator.allocate(buildContext({ proposals: [prop] }));
    const originalDecisionId = res1.decisions[0].portfolioDecisionId;

    // Simulate complete process restart with fresh Postgres client & fresh coordinator
    const freshClient = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    try {
      const freshRepo = new PostgresPortfolioProposalDecisionRepository(freshClient);
      const freshCoordinator = new PortfolioAllocationCoordinator(freshRepo);

      const res2 = await freshCoordinator.allocate(buildContext({ correlationId: 'restart-batch-2', proposals: [prop] }));
      assert.equal(res2.decisions.length, 1);
      assert.equal(res2.decisions[0].portfolioDecisionId, originalDecisionId);
      assert.equal(res2.decisions[0].approvedCapital, '15000');
      assert.equal(res2.decisions[0].outcome, 'APPROVED');
    } finally {
      await freshClient.close();
    }
  });

  it('Gate 4: Replay Semantics — identical proposal returns same decision without re-calculating', async () => {
    const unique = globalThis.crypto.randomUUID().slice(0, 8);
    const propId = `prop-pg-replay-${unique}`;
    const prop = buildProposal(propId, { sizing: { requestedQuantity: '0.1', requestedCapital: '8000' } });

    const res1 = await coordinator.allocate(buildContext({ correlationId: 'replay-run-1', proposals: [prop] }));
    const res2 = await coordinator.allocate(buildContext({ correlationId: 'replay-run-2', proposals: [prop] }));

    assert.equal(res1.decisions[0].portfolioDecisionId, res2.decisions[0].portfolioDecisionId);
    assert.equal(res1.decisions[0].approvedCapital, res2.decisions[0].approvedCapital);
    assert.equal(res1.totalApprovedCapital, res2.totalApprovedCapital);
  });

  it('Gate 5: Identity Conflict / Collision Detection fails closed', async () => {
    const unique = globalThis.crypto.randomUUID().slice(0, 8);
    const propId = `prop-pg-conflict-${unique}`;
    const prop1 = buildProposal(propId, { sizing: { requestedQuantity: '0.1', requestedCapital: '5000' } });
    const prop2 = buildProposal(propId, { sizing: { requestedQuantity: '0.9', requestedCapital: '90000' } });

    await coordinator.allocate(buildContext({ proposals: [prop1] }));
    await assert.rejects(
      () => coordinator.allocate(buildContext({ correlationId: 'conflict-batch', proposals: [prop2] })),
      (err) => err instanceof PortfolioProposalDecisionConflictError || err.code === 'PORTFOLIO_PROPOSAL_IDENTITY_CONFLICT'
    );
  });

  it('Gate 6: Concurrent Claims Race in PostgreSQL guarantees single winner', async () => {
    const unique = globalThis.crypto.randomUUID().slice(0, 8);
    const propId = `prop-pg-race-${unique}`;
    const prop = buildProposal(propId, { sizing: { requestedQuantity: '0.1', requestedCapital: '6000' } });

    const clientA = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const clientB = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    try {
      const repoA = new PostgresPortfolioProposalDecisionRepository(clientA);
      const repoB = new PostgresPortfolioProposalDecisionRepository(clientB);
      const coordA = new PortfolioAllocationCoordinator(repoA);
      const coordB = new PortfolioAllocationCoordinator(repoB);

      const [runA, runB] = await Promise.allSettled([
        coordA.allocate(buildContext({ correlationId: 'race-A', proposals: [prop] })),
        coordB.allocate(buildContext({ correlationId: 'race-B', proposals: [prop] })),
      ]);

      const fulfilled = [runA, runB].filter((r) => r.status === 'fulfilled');
      assert.ok(fulfilled.length >= 1);
      if (runA.status === 'fulfilled' && runB.status === 'fulfilled') {
        assert.equal(runA.value.decisions[0].portfolioDecisionId, runB.value.decisions[0].portfolioDecisionId);
      }
    } finally {
      await clientA.close();
      await clientB.close();
    }
  });

  it('Gate 7: Recovery from Expired Claim in PostgreSQL', async () => {
    const unique = globalThis.crypto.randomUUID().slice(0, 8);
    const propId = `prop-pg-expired-${unique}`;
    const prop = buildProposal(propId);
    const fingerprint = 'test-fp-expired';

    // Insert manual stale claimed row with past lease_until
    const past = new Date(Date.now() - 120_000).toISOString();
    await client.query(
      `INSERT INTO trading_portfolio_proposal_decisions
        (proposal_id, proposal_fingerprint, state, correlation_id, evidence_refs, claimed_at, lease_until)
       VALUES ($1, $2, 'CLAIMED', $3, '[]'::jsonb, $4, $5)`,
      [propId, fingerprint, 'c-stale', past, past]
    );

    const recovered = await repository.recoverExpiredClaim(propId, new Date().toISOString(), new Date(Date.now() + 60_000).toISOString());
    assert.equal(recovered, true);
  });

  it('Gate 8: Rejected Proposal is durably recorded and idempotent in PostgreSQL', async () => {
    const unique = globalThis.crypto.randomUUID().slice(0, 8);
    const propId = `prop-pg-rej-${unique}`;
    const expiredProp = buildProposal(propId, { expiresAt: '2026-09-19T11:59:00.000Z' });

    const res1 = await coordinator.allocate(buildContext({ proposals: [expiredProp] }));
    assert.equal(res1.decisions[0].outcome, 'REJECTED');
    assert.equal(res1.decisions[0].approvedCapital, '0');

    const res2 = await coordinator.allocate(buildContext({ correlationId: 'retry-batch', proposals: [expiredProp] }));
    assert.equal(res2.decisions[0].outcome, 'REJECTED');
    assert.equal(res2.decisions[0].portfolioDecisionId, res1.decisions[0].portfolioDecisionId);
  });
});
