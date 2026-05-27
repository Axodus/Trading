import {
  assertSafeLocalSeedConfig,
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/TradingDatabaseConfig.js';
import { createLocalNodePostgresClient, loadLocalRuntimeConfig, printJson } from './local-db-utils.ts';

const runtime = loadLocalRuntimeConfig();
assertSafeLocalSeedConfig(runtime);

const client = await createLocalNodePostgresClient();

try {
  await client.query(`
    DROP TABLE IF EXISTS
      trading_runtime_audit,
      trading_provider_state,
      trading_runtime_instances,
      trading_portfolios,
      trading_positions,
      trading_fills,
      trading_orders,
      trading_events,
      trading_schema_migrations
    CASCADE
  `);

  printJson({
    ok: true,
    reset: true,
    environment: runtime.environment,
    database: runtime.connection.database,
    localOnly: true,
    message: 'Local Trading database schema was dropped. Run npm run db:bootstrap-local or npm run trading-db -- migrate before use.',
  });
} finally {
  await client.close();
}
