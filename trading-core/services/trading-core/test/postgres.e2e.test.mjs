import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  assertSafeLocalSeedConfig,
  createLocalTradingDatabaseConfig,
  createNodePostgresEnvConfig,
  DatabaseConnectionManager,
  DatabaseHealthService,
  MigrationRunner,
  NodePostgresClient,
  PostgresBootstrapService,
  PostgresRepositoryReadinessCheck,
  PostgresTradingEventRepository,
  runTradingDbCli,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const e2eEnabled = process.env.TRADING_POSTGRES_E2E === '1';

describe('Local Postgres end-to-end validation', () => {
  it('runs migrations, seed, readiness and replay against real local Postgres', { skip: !e2eEnabled }, async () => {
    const runtime = localRuntime();
    assertSafeLocalSeedConfig(runtime);

    const migrate = await runTradingDbCli(['migrate', '--json'], await cliContext(runtime));
    assert.equal(migrate.exitCode, 0);
    assert.equal(migrate.payload.ok, true);

    const health = await runTradingDbCli(['health', '--json'], await cliContext(runtime));
    assert.equal(health.exitCode, 0);
    assert.equal(health.payload.ok, true);

    const unique = Date.now();
    const seed = await runTradingDbCli(['seed-local', '--json'], await cliContext(runtime, async (client) => {
      const repository = new PostgresTradingEventRepository(client);
      await repository.append(mockEvent({
        id: `e2e-seed-user:${unique}`,
        correlationId: `e2e-seed-user-correlation-${unique}`,
        tenantId: `e2e-seed-user-tenant-${unique}`,
        userId: `e2e-seed-user-${unique}`,
        runtimeInstanceId: `e2e-seed-runtime-${unique}`,
      }));
      return {
        seeded: true,
        mock: true,
        simulationOnly: true,
      };
    }));
    assert.equal(seed.exitCode, 0);
    assert.equal(seed.payload.simulationOnly, true);

    const client = await createClient();
    try {
      const readiness = await new PostgresRepositoryReadinessCheck(client).check();
      assert.equal(readiness.ready, true);

      const repository = new PostgresTradingEventRepository(client);
      const userTenantId = `e2e-user-tenant-${unique}`;
      const treasuryTenantId = `e2e-dao-${unique}`;
      const userCorrelationId = `e2e-user-correlation-${unique}`;
      const treasuryCorrelationId = `e2e-treasury-correlation-${unique}`;

      await repository.append(mockEvent({
        id: `e2e-user-event:${unique}`,
        correlationId: userCorrelationId,
        tenantId: userTenantId,
        userId: `e2e-user-${unique}`,
        runtimeInstanceId: `e2e-runtime-${unique}`,
      }));
      await repository.append(mockEvent({
        id: `e2e-treasury-event:${unique}`,
        correlationId: treasuryCorrelationId,
        tenantId: treasuryTenantId,
        daoId: treasuryTenantId,
        userId: undefined,
        runtimeInstanceId: undefined,
      }));

      const userTrace = await repository.replayByCorrelationId(userCorrelationId);
      const treasuryTrace = await repository.replayByCorrelationId(treasuryCorrelationId);
      const userTenantTrace = await repository.replayByTenantId(userTenantId);
      const treasuryTenantTrace = await repository.replayByTenantId(treasuryTenantId);

      assert.equal(userTrace[0]?.correlationId, userCorrelationId);
      assert.equal(treasuryTrace[0]?.correlationId, treasuryCorrelationId);
      assert.equal(userTenantTrace.every((event) => event.userId?.startsWith('e2e-user-')), true);
      assert.equal(treasuryTenantTrace.every((event) => event.daoId === treasuryTenantId), true);
      assert.equal(userTenantTrace.some((event) => event.daoId === treasuryTenantId), false);
      assert.equal(treasuryTenantTrace.some((event) => event.userId?.startsWith('e2e-user-')), false);
    } finally {
      await client.close();
    }
  });
});

function localRuntime() {
  return createLocalTradingDatabaseConfig(process.env, loadMigrations());
}

async function createClient() {
  return NodePostgresClient.create(createNodePostgresEnvConfig(process.env));
}

async function cliContext(runtime, seedLocal) {
  const client = await createClient();
  const connection = new DatabaseConnectionManager({ client, database: runtime.database });
  const migrations = new MigrationRunner(client);
  const health = new DatabaseHealthService(connection, migrations);
  const bootstrap = new PostgresBootstrapService(connection, migrations, health);
  return {
    runtime,
    connection,
    migrations,
    health,
    bootstrap,
    seedLocal: seedLocal ? () => seedLocal(client) : undefined,
  };
}

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

function mockEvent(overrides) {
  const occurredAt = new Date().toISOString();
  return {
    id: overrides.id,
    type: 'EXECUTION_REQUESTED',
    occurredAt,
    correlationId: overrides.correlationId,
    source: overrides.daoId ? 'governance' : 'core',
    daoId: overrides.daoId,
    userId: overrides.userId,
    strategyId: 'whiterabbit-v1',
    strategyProductId: 'whiterabbit-scalper-futures',
    runtimeInstanceId: overrides.runtimeInstanceId,
    payload: {
      tenantId: overrides.tenantId,
      providerId: 'simulation',
      mock: true,
      simulationOnly: true,
      localPostgresE2E: true,
    },
  };
}
