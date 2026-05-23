import { createLocalNodePostgresClient, loadLocalRuntimeConfig, printJson } from './local-db-utils.ts';
import { assertSafeLocalSeedConfig } from '../../../../dist/services/trading-core/services/trading-core/src/config/TradingDatabaseConfig.js';

export interface WaitForPostgresOptions {
  timeoutMs?: number;
  intervalMs?: number;
  json?: boolean;
}

export async function waitForLocalPostgres(options: WaitForPostgresOptions = {}) {
  const runtime = loadLocalRuntimeConfig();
  assertSafeLocalSeedConfig(runtime);
  const timeoutMs = options.timeoutMs ?? Number(process.env.TRADING_LOCAL_E2E_WAIT_TIMEOUT_MS ?? 60000);
  const intervalMs = options.intervalMs ?? Number(process.env.TRADING_LOCAL_E2E_WAIT_INTERVAL_MS ?? 1000);
  const started = Date.now();
  let attempts = 0;
  let lastError = '';

  while (Date.now() - started <= timeoutMs) {
    attempts += 1;
    const client = await createLocalNodePostgresClient();
    try {
      await client.query('select 1');
      await client.close();
      return {
        ok: true,
        attempts,
        waitedMs: Date.now() - started,
        database: {
          host: runtime.connection.host,
          port: runtime.connection.port,
          database: runtime.connection.database,
          user: runtime.connection.user,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await client.close().catch(() => undefined);
      await sleep(intervalMs);
    }
  }

  return {
    ok: false,
    attempts,
    waitedMs: Date.now() - started,
    error: lastError || 'Postgres did not become ready before timeout.',
    database: {
      host: runtime.connection.host,
      port: runtime.connection.port,
      database: runtime.connection.database,
      user: runtime.connection.user,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const json = process.argv.includes('--json');
  const result = await waitForLocalPostgres({ json });
  if (json) {
    printJson(result);
  } else {
    process.stdout.write(result.ok
      ? `Postgres ready after ${String(result.attempts)} attempt(s).\n`
      : `Postgres not ready: ${result.error}\n`);
  }
  process.exitCode = result.ok ? 0 : 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

