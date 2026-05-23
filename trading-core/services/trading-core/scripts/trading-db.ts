import {
  DatabaseConnectionManager,
  DatabaseHealthService,
  MigrationRunner,
  PostgresBootstrapService,
  PostgresTradingEventRepository,
  runTradingDbCli,
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/index.js';
import { createLocalNodePostgresClient, loadLocalRuntimeConfig } from './local-db-utils.ts';

const runtime = loadLocalRuntimeConfig();
const client = await createLocalNodePostgresClient();
const connection = new DatabaseConnectionManager({ client, database: runtime.database });
const migrations = new MigrationRunner(client);
const health = new DatabaseHealthService(connection, migrations);
const bootstrap = new PostgresBootstrapService(connection, migrations, health);

const result = await runTradingDbCli(process.argv.slice(2), {
  runtime,
  connection,
  migrations,
  health,
  bootstrap,
  seedLocal: async () => {
    const repository = new PostgresTradingEventRepository(client);
    const occurredAt = new Date().toISOString();
    await repository.append({
      id: `local-seed:mock-simulation:${occurredAt}`,
      type: 'MARKET_DATA_RECEIVED',
      occurredAt,
      correlationId: 'local-seed-correlation',
      source: 'core',
      userId: 'local-mock-user',
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'local-mock-runtime',
      payload: {
        environment: runtime.environment,
        mock: true,
        simulationOnly: true,
        providerId: 'simulation',
        market: 'BTC-USDT',
        note: 'Local development seed data. No live execution, credentials, wallet keys, or treasury capital.',
      },
    });
    return {
      seeded: true,
      mock: true,
      simulationOnly: true,
      database: runtime.connection.database,
    };
  },
});

process.stdout.write(`${result.stdout}\n`);
if (result.stderr) {
  process.stderr.write(`${result.stderr}\n`);
}
process.exitCode = result.exitCode;
