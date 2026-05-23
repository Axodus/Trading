import {
  DatabaseConnectionManager,
} from '../../../../dist/services/trading-core/services/trading-core/src/repositories/postgres/DatabaseConnectionManager.js';
import {
  DatabaseHealthService,
} from '../../../../dist/services/trading-core/services/trading-core/src/repositories/postgres/DatabaseHealthService.js';
import {
  MigrationRunner,
} from '../../../../dist/services/trading-core/services/trading-core/src/repositories/postgres/MigrationRunner.js';
import {
  PostgresBootstrapService,
} from '../../../../dist/services/trading-core/services/trading-core/src/repositories/postgres/PostgresBootstrapService.js';
import { createLocalNodePostgresClient, loadLocalRuntimeConfig, printJson } from './local-db-utils.ts';

const runtime = loadLocalRuntimeConfig();
const client = await createLocalNodePostgresClient();
const connection = new DatabaseConnectionManager({ client, database: runtime.database });
const migrations = new MigrationRunner(client);
const health = new DatabaseHealthService(connection, migrations);
const bootstrap = new PostgresBootstrapService(connection, migrations, health);

try {
  const result = await bootstrap.bootstrap();
  printJson({
    ok: true,
    environment: runtime.environment,
    database: {
      host: runtime.connection.host,
      port: runtime.connection.port,
      database: runtime.connection.database,
      user: runtime.connection.user,
    },
    schemaVersion: result.schemaVersion,
    applied: result.migrations.applied.map((migration) => migration.id),
    skipped: result.migrations.skipped.map((migration) => migration.id),
    health: result.health,
  });
} finally {
  await bootstrap.shutdown();
}
