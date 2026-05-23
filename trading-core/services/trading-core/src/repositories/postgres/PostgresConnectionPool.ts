import type { PostgresQueryResult } from './PostgresClient.js';

export interface PgPoolLike {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<T>>;
  end(): Promise<void>;
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
  return import(moduleName) as Promise<{ Pool: PgPoolConstructor }>;
}
