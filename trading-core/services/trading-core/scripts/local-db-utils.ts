import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  createLocalTradingDatabaseConfig,
  withTradingLocalDatabaseDefaults,
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/TradingDatabaseConfig.js';
import { createNodePostgresEnvConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/PostgresEnvConfig.js';
import { NodePostgresClient } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.js';

export function loadLocalRuntimeConfig() {
  loadWorkspaceEnvFile();
  return createLocalTradingDatabaseConfig(process.env, loadMigrations());
}

export async function createLocalNodePostgresClient() {
  loadWorkspaceEnvFile();
  return NodePostgresClient.create(createNodePostgresEnvConfig(process.env));
}

export function loadWorkspaceEnvFile() {
  const workspaceRoot = resolve(process.cwd(), '../../..');
  const originalEnvKeys = new Set(Object.keys(process.env));
  const fileEnv = {
    ...readEnvFile(resolve(workspaceRoot, '.env.example')),
    ...readEnvFile(resolve(workspaceRoot, '.env')),
  };
  const localEnv = withTradingLocalDatabaseDefaults(fileEnv);
  for (const [key, value] of Object.entries(localEnv)) {
    if (!originalEnvKeys.has(key) && value !== undefined) {
      process.env[key] = value;
    }
  }
}

function readEnvFile(envFile) {
  if (!existsSync(envFile)) {
    return {};
  }
  const values = {};
  const content = readFileSync(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const normalized = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const [key, ...valueParts] = normalized.split('=');
    if (!key) {
      continue;
    }
    values[key] = unquoteEnvValue(valueParts.join('=').trim());
  }
  return values;
}

function unquoteEnvValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function loadMigrations() {
  const migrationsDir = resolve(process.cwd(), 'migrations');
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      id: name,
      sql: readFileSync(join(migrationsDir, name), 'utf8'),
    }));
}

export class PsqlCliClient {
  constructor(connection) {
    this.connection = connection;
  }

  async query(sql, params = []) {
    const materialized = materializeSql(sql, params);
    const result = spawnSync('psql', [
      '--host', this.connection.host,
      '--port', String(this.connection.port),
      '--username', this.connection.user,
      '--dbname', this.connection.database,
      '--tuples-only',
      '--no-align',
      '--field-separator', '\t',
      '--set', 'ON_ERROR_STOP=1',
      '--command', materialized,
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PGPASSWORD: this.connection.password,
      },
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || `psql exited with status ${String(result.status)}`);
    }

    return {
      rows: parseRows(materialized, result.stdout),
    };
  }
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function materializeSql(sql, params) {
  return params.reduce((current, value, index) => current.replaceAll(`$${index + 1}`, quoteSql(value)), sql);
}

function quoteSql(value) {
  if (value === undefined || value === null) {
    return 'NULL';
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseRows(sql, stdout) {
  const normalized = sql.toLowerCase();
  const lines = stdout.trim().split('\n').filter(Boolean);
  if (normalized.includes('from trading_schema_migrations')) {
    return lines.map((line) => {
      const [id, checksum, appliedAt] = line.split('\t');
      return {
        id,
        checksum,
        applied_at: appliedAt,
      };
    });
  }
  if (normalized === 'select 1') {
    return lines.map(() => ({ '?column?': 1 }));
  }
  return [];
}
