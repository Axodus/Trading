import {
  DatabaseConnectionManager,
} from '../../../../dist/services/trading-core/services/trading-core/src/repositories/postgres/DatabaseConnectionManager.js';
import {
  DatabaseHealthService,
} from '../../../../dist/services/trading-core/services/trading-core/src/repositories/postgres/DatabaseHealthService.js';
import {
  MigrationRunner,
} from '../../../../dist/services/trading-core/services/trading-core/src/repositories/postgres/MigrationRunner.js';
import { createLocalNodePostgresClient, loadLocalRuntimeConfig, printJson } from './local-db-utils.ts';

const runtime = loadLocalRuntimeConfig();
const client = await createLocalNodePostgresClient();
const connection = new DatabaseConnectionManager({ client, database: runtime.database });
const migrations = new MigrationRunner(client);
const health = new DatabaseHealthService(connection, migrations);

try {
  await connection.connect();
  const state = await health.check();
  printJson({
    ok: state.status !== 'unhealthy',
    environment: runtime.environment,
    schemaVersion: state.schemaVersion,
    health: state,
  });
  if (state.status === 'unhealthy') {
    process.exitCode = 1;
  }
} finally {
  await connection.shutdown();
}
