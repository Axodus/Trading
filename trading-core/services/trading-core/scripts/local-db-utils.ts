import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createLocalTradingDatabaseConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/TradingDatabaseConfig.js';
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
  const envFile = resolve(process.cwd(), '../../..', '.env');
  if (!existsSync(envFile)) {
    return;
  }
  const content = readFileSync(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const [key, ...valueParts] = trimmed.split('=');
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = valueParts.join('=').trim();
  }
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
