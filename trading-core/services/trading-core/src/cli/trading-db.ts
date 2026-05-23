import type { TradingLocalDatabaseRuntimeConfig } from '../config/TradingDatabaseConfig.js';
import type { DatabaseConnectionManager } from '../repositories/postgres/DatabaseConnectionManager.js';
import type { DatabaseHealthService } from '../repositories/postgres/DatabaseHealthService.js';
import type { MigrationRunner } from '../repositories/postgres/MigrationRunner.js';
import type { PostgresBootstrapService } from '../repositories/postgres/PostgresBootstrapService.js';
import { health } from './commands/health.js';
import { migrate } from './commands/migrate.js';
import { seedLocal } from './commands/seed-local.js';
import { status } from './commands/status.js';
import { validate } from './commands/validate.js';
import { version } from './commands/version.js';
import { HumanOutput } from './output/HumanOutput.js';
import { JsonOutput } from './output/JsonOutput.js';

export type TradingDbCommand = 'migrate' | 'status' | 'health' | 'version' | 'validate' | 'seed-local';
export type TradingDbOutputMode = 'human' | 'json';

export interface TradingDbCliContext {
  runtime: TradingLocalDatabaseRuntimeConfig;
  connection: DatabaseConnectionManager;
  migrations: MigrationRunner;
  health: DatabaseHealthService;
  bootstrap: PostgresBootstrapService;
  seedLocal?: () => Promise<Record<string, unknown>>;
}

export interface TradingDbCliPayload {
  ok: boolean;
  command: TradingDbCommand | 'unknown';
  [key: string]: unknown;
}

export interface TradingDbCliResult {
  exitCode: number;
  stdout: string;
  stderr?: string;
  payload: TradingDbCliPayload;
}

export async function runTradingDbCli(argv: string[], context: TradingDbCliContext): Promise<TradingDbCliResult> {
  const parsed = parseArgs(argv);
  try {
    const payload = await execute(parsed.command, context);
    const exitCode = payload.ok ? 0 : 1;
    return {
      exitCode,
      stdout: render(payload, parsed.outputMode),
      payload,
    };
  } catch (error) {
    const payload: TradingDbCliPayload = {
      ok: false,
      command: parsed.command ?? 'unknown',
      error: redactSecrets(error instanceof Error ? error.message : String(error), context),
    };
    return {
      exitCode: 1,
      stdout: render(payload, parsed.outputMode),
      stderr: payload.error as string,
      payload,
    };
  } finally {
    await context.connection.shutdown();
  }
}

function parseArgs(argv: string[]): { command?: TradingDbCommand; outputMode: TradingDbOutputMode } {
  const outputMode: TradingDbOutputMode = argv.includes('--json') ? 'json' : 'human';
  const command = argv.find((value) => !value.startsWith('--')) as TradingDbCommand | undefined;
  return { command, outputMode };
}

async function execute(command: TradingDbCommand | undefined, context: TradingDbCliContext): Promise<TradingDbCliPayload> {
  if (command === 'migrate') {
    return migrate(context);
  }
  if (command === 'status') {
    return status(context);
  }
  if (command === 'health') {
    return health(context);
  }
  if (command === 'version') {
    return version(context);
  }
  if (command === 'validate') {
    return validate(context);
  }
  if (command === 'seed-local') {
    return seedLocal(context);
  }
  throw new Error(`Invalid trading-db command: ${command ?? 'none'}.`);
}

function render(payload: TradingDbCliPayload, mode: TradingDbOutputMode): string {
  const result: TradingDbCliResult = {
    exitCode: payload.ok ? 0 : 1,
    stdout: '',
    payload,
  };
  return mode === 'json' ? new JsonOutput().render(result) : new HumanOutput().render(result);
}

function redactSecrets(message: string, context: TradingDbCliContext): string {
  return message
    .replaceAll(context.runtime.connection.password, '[redacted]')
    .replaceAll(`:${context.runtime.connection.password}@`, ':[redacted]@');
}
