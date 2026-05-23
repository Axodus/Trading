import {
  PostgresTradingEventRepository,
} from '../../../../dist/services/trading-core/services/trading-core/src/repositories/postgres/PostgresTradingEventRepository.js';
import {
  assertSafeLocalSeedConfig,
} from '../../../../dist/services/trading-core/services/trading-core/src/config/TradingDatabaseConfig.js';
import { createLocalNodePostgresClient, loadLocalRuntimeConfig, printJson } from './local-db-utils.ts';

const runtime = loadLocalRuntimeConfig();
assertSafeLocalSeedConfig(runtime);

const client = await createLocalNodePostgresClient();
const repository = new PostgresTradingEventRepository(client);
const occurredAt = new Date().toISOString();

try {
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

  printJson({
    ok: true,
    seeded: true,
    mock: true,
    simulationOnly: true,
    database: runtime.connection.database,
  });
} finally {
  await client.close();
}
