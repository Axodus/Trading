import type { PostgresQueryResult } from './PostgresClient.js';

export interface PgPoolLike {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<T>>;
  connect?(): Promise<PgClientLike>;
  end(): Promise<void>;
}

export interface PgClientLike {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<T>>;
  release(): void | Promise<void>;
}

export interface PgPoolConstructor {
  new(config: Record<string, unknown>): PgPoolLike;
}

export interface PostgresConnectionPoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export async function createPostgresConnectionPool(config: PostgresConnectionPoolConfig): Promise<PgPoolLike> {
  const { Pool } = await importPg();
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ?? false,
    max: config.max ?? 5,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 10000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 3000,
  });
}

async function importPg(): Promise<{ Pool: PgPoolConstructor }> {
  const moduleName = 'pg';
  try {
    return normalizePgModule(await import(moduleName));
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }
    const cwd = (globalThis as { process?: { cwd(): string } }).process?.cwd();
    if (!cwd) {
      throw error;
    }
    const candidatePaths = [
      `file://${cwd.replace(/\/$/, '')}/node_modules/pg/lib/index.js`,
      `file://${cwd.replace(/\/$/, '')}/trading-core/services/trading-core/node_modules/pg/lib/index.js`,
    ];
    for (const candidate of candidatePaths) {
      try {
        return normalizePgModule(await import(candidate));
      } catch {
        // try next
      }
    }
    throw error;
  }
}

function normalizePgModule(moduleValue: unknown): { Pool: PgPoolConstructor } {
  const moduleRecord = moduleValue as { Pool?: PgPoolConstructor; default?: { Pool?: PgPoolConstructor } };
  const Pool = moduleRecord.Pool ?? moduleRecord.default?.Pool;
  if (!Pool) {
    throw new Error('Unable to resolve pg Pool constructor.');
  }
  return { Pool };
}
