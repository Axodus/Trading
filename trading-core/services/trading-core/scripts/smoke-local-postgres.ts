import {
  DatabaseConnectionManager,
  DatabaseHealthService,
  MigrationRunner,
  PostgresBootstrapService,
  PostgresRepositoryReadinessCheck,
  PostgresTradingEventRepository,
} from '../../../../dist/services/trading-core/services/trading-core/src/index.js';
import {
  assertSafeLocalSeedConfig,
} from '../../../../dist/services/trading-core/services/trading-core/src/config/TradingDatabaseConfig.js';
import { createLocalNodePostgresClient, loadLocalRuntimeConfig, printJson } from './local-db-utils.ts';

const runtime = loadLocalRuntimeConfig();
assertSafeLocalSeedConfig(runtime);

const client = await createLocalNodePostgresClient();
const connection = new DatabaseConnectionManager({ client, database: runtime.database });
const migrations = new MigrationRunner(client);
const health = new DatabaseHealthService(connection, migrations);
const bootstrap = new PostgresBootstrapService(connection, migrations, health);
const readiness = new PostgresRepositoryReadinessCheck(client);
const repository = new PostgresTradingEventRepository(client);
const unique = Date.now();

try {
  const bootstrapResult = await bootstrap.bootstrap();
  const readinessResult = await readiness.check();
  const replayResult = await validateReplay(repository, unique);
  const healthState = await health.check();

  const ok = bootstrapResult.health.status !== 'unhealthy'
    && healthState.status !== 'unhealthy'
    && readinessResult.ready
    && replayResult.ok;

  printJson({
    ok,
    environment: runtime.environment,
    database: {
      host: runtime.connection.host,
      port: runtime.connection.port,
      database: runtime.connection.database,
      user: runtime.connection.user,
    },
    schemaVersion: bootstrapResult.schemaVersion,
    migrations: {
      applied: bootstrapResult.migrations.applied.map((migration) => migration.id),
      skipped: bootstrapResult.migrations.skipped.map((migration) => migration.id),
    },
    health: healthState,
    repositoryReadiness: readinessResult,
    replay: replayResult,
    mock: true,
    simulationOnly: true,
    liveTradingEnabled: false,
  });

  if (!ok) {
    process.exitCode = 1;
  }
} finally {
  await bootstrap.shutdown();
}

async function validateReplay(repository, unique) {
  const occurredAt = new Date().toISOString();
  const userTenantId = `local-smoke-tenant-user-${unique}`;
  const treasuryTenantId = `local-smoke-dao-${unique}`;
  const userCorrelationId = `local-smoke-user-correlation-${unique}`;
  const treasuryCorrelationId = `local-smoke-treasury-correlation-${unique}`;

  await repository.append({
    id: `local-smoke-user-event:${unique}`,
    type: 'EXECUTION_REQUESTED',
    occurredAt,
    correlationId: userCorrelationId,
    source: 'core',
    userId: `local-smoke-user-${unique}`,
    strategyId: 'whiterabbit-v1',
    strategyProductId: 'whiterabbit-scalper-futures',
    runtimeInstanceId: `local-smoke-runtime-${unique}`,
    payload: {
      tenantId: userTenantId,
      providerId: 'simulation',
      mock: true,
      simulationOnly: true,
    },
  });
  await repository.append({
    id: `local-smoke-treasury-event:${unique}`,
    type: 'EXECUTION_REQUESTED',
    occurredAt,
    correlationId: treasuryCorrelationId,
    source: 'governance',
    daoId: treasuryTenantId,
    federationId: 'local-smoke-federation',
    strategyId: 'treasury-readiness-strategy',
    payload: {
      tenantId: treasuryTenantId,
      providerId: 'simulation',
      mock: true,
      simulationOnly: true,
    },
  });

  const userTrace = await repository.replayByCorrelationId(userCorrelationId);
  const treasuryTrace = await repository.replayByCorrelationId(treasuryCorrelationId);
  const userTenantTrace = await repository.replayByTenantId(userTenantId);
  const treasuryTenantTrace = await repository.replayByTenantId(treasuryTenantId);

  return {
    ok: userTrace.length === 1
      && treasuryTrace.length === 1
      && userTenantTrace.every((event) => event.userId?.startsWith('local-smoke-user-'))
      && treasuryTenantTrace.every((event) => event.daoId === treasuryTenantId)
      && userTrace[0]?.correlationId === userCorrelationId
      && treasuryTrace[0]?.correlationId === treasuryCorrelationId,
    userCorrelationId,
    treasuryCorrelationId,
    userTenantId,
    treasuryTenantId,
    userTraceCount: userTrace.length,
    treasuryTraceCount: treasuryTrace.length,
    userTenantTraceCount: userTenantTrace.length,
    treasuryTenantTraceCount: treasuryTenantTrace.length,
  };
}
