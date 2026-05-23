import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseTradingLocalE2eArgs,
  redactLocalE2eText,
  TradingLocalE2eCommand,
  type LocalE2eCommandResult,
} from '../../../../dist/services/trading-core/services/trading-core/src/index.js';
import {
  assertSafeLocalSeedConfig,
} from '../../../../dist/services/trading-core/services/trading-core/src/config/TradingDatabaseConfig.js';
import { loadLocalRuntimeConfig } from './local-db-utils.ts';
import { printLocalE2eReport } from './local-e2e-report.ts';
import { waitForLocalPostgres } from './wait-for-postgres.ts';

const serviceRoot = process.cwd();
const workspaceRoot = resolve(serviceRoot, '../../..');
const composeFile = resolve(workspaceRoot, 'docker-compose.trading.yml');
const envFile = resolve(workspaceRoot, '.env');
const options = parseTradingLocalE2eArgs(process.argv.slice(2));
const runtime = loadLocalRuntimeConfig();
assertSafeLocalSeedConfig(runtime);
const secrets = [
  runtime.connection.password,
  process.env.TRADING_DB_PASSWORD,
].filter(Boolean) as string[];

const command = new TradingLocalE2eCommand({
  validateSafety: async () => {
    assertSafeLocalSeedConfig(runtime);
    if (!existsSync(composeFile)) {
      throw new Error(`Missing local compose file: ${composeFile}`);
    }
  },
  composeUp: () => run('docker', ['compose', ...envArgs(), '-f', composeFile, 'up', '-d'], workspaceRoot, secrets),
  composeDown: () => run('docker', ['compose', ...envArgs(), '-f', composeFile, 'down'], workspaceRoot, secrets),
  waitForPostgres: async () => {
    const result = await waitForLocalPostgres({ json: true });
    return {
      exitCode: result.ok ? 0 : 1,
      stdout: JSON.stringify(result, null, 2),
      stderr: result.ok ? undefined : result.error,
    };
  },
  runTradingDb: (args) => run(process.execPath, ['--experimental-strip-types', 'scripts/trading-db.ts', ...args], serviceRoot, secrets),
  runSmoke: () => run(process.execPath, ['--experimental-strip-types', 'scripts/smoke-local-postgres.ts'], serviceRoot, secrets),
  resetLocal: () => run(process.execPath, ['--experimental-strip-types', 'scripts/reset-local-db.ts'], serviceRoot, secrets),
});

const report = await command.run({
  ...options,
  secrets,
});
printLocalE2eReport(report, options.json);
process.exitCode = report.ok ? 0 : 1;

function envArgs(): string[] {
  return existsSync(envFile) ? ['--env-file', envFile] : [];
}

function run(command: string, args: string[], cwd: string, secretsToRedact: string[]): Promise<LocalE2eCommandResult> {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      resolveResult({
        exitCode: 1,
        stderr: redactLocalE2eText(error.message, secretsToRedact),
      });
    });
    child.on('close', (code) => {
      resolveResult({
        exitCode: code ?? 1,
        stdout: redactLocalE2eText(stdout.trim(), secretsToRedact),
        stderr: redactLocalE2eText(stderr.trim(), secretsToRedact),
      });
    });
  });
}

