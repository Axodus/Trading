import type { PostgresConnectionPoolConfig } from '../repositories/postgres/PostgresConnectionPool.js';
import type { TradingDatabaseEnv } from './TradingDatabaseConfig.js';
import { createLocalTradingDatabaseConfig } from './TradingDatabaseConfig.js';

export interface NodePostgresEnvConfig extends PostgresConnectionPoolConfig {
  queryTimeoutMs: number;
  maxRetries: number;
}

export function createNodePostgresEnvConfig(env: TradingDatabaseEnv): NodePostgresEnvConfig {
  const local = createLocalTradingDatabaseConfig(env);
  return {
    host: local.connection.host,
    port: local.connection.port,
    database: local.connection.database,
    user: local.connection.user,
    password: local.connection.password,
    ssl: false,
    max: readInteger(env.TRADING_DB_POOL_MAX, 5),
    idleTimeoutMillis: readInteger(env.TRADING_DB_IDLE_TIMEOUT_MS, 10000),
    connectionTimeoutMillis: readInteger(env.TRADING_DB_CONNECTION_TIMEOUT_MS, 3000),
    queryTimeoutMs: readInteger(env.TRADING_DB_QUERY_TIMEOUT_MS, 5000),
    maxRetries: readInteger(env.TRADING_DB_MAX_RETRIES, 1),
  };
}

export function redactPostgresEnvConfig(config: NodePostgresEnvConfig): Omit<NodePostgresEnvConfig, 'password'> & { password: '[redacted]' } {
  return {
    ...config,
    password: '[redacted]',
  };
}

function readInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
