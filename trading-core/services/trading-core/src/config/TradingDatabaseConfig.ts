import type { TradingDatabaseConfig, TradingMigration } from '../repositories/postgres/TradingDatabaseConfig.js';

export interface TradingLocalDatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: false;
}

export interface TradingLocalDatabaseRuntimeConfig {
  environment: TradingDatabaseConfig['environment'];
  connection: TradingLocalDatabaseConnectionConfig;
  database: TradingDatabaseConfig;
}

export type TradingDatabaseEnv = Record<string, string | undefined>;

export class TradingDatabaseConfigError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_ENV' | 'INVALID_ENV' | 'UNSAFE_SEED_ENVIRONMENT',
  ) {
    super(message);
    this.name = 'TradingDatabaseConfigError';
  }
}

export function createLocalTradingDatabaseConfig(env: TradingDatabaseEnv, migrations: TradingMigration[] = []): TradingLocalDatabaseRuntimeConfig {
  const environment = readEnvironment(env.TRADING_ENV);
  const connection: TradingLocalDatabaseConnectionConfig = {
    host: requireEnv(env, 'TRADING_DB_HOST'),
    port: readPort(requireEnv(env, 'TRADING_DB_PORT')),
    database: requireEnv(env, 'TRADING_DB_NAME'),
    user: requireEnv(env, 'TRADING_DB_USER'),
    password: requireEnv(env, 'TRADING_DB_PASSWORD'),
    ssl: false,
  };

  return {
    environment,
    connection,
    database: {
      environment,
      schemaName: env.TRADING_DB_SCHEMA ?? 'public',
      minimumSchemaVersion: env.TRADING_DB_MIN_SCHEMA_VERSION,
      migrations,
    },
  };
}

export function assertSafeLocalSeedConfig(config: TradingLocalDatabaseRuntimeConfig): void {
  if (config.environment !== 'local' && config.environment !== 'test') {
    throw new TradingDatabaseConfigError('Local Trading seed data is allowed only for local or test environments.', 'UNSAFE_SEED_ENVIRONMENT');
  }

  const inspected = [
    config.connection.host,
    config.connection.database,
    config.connection.user,
  ].join(' ').toLowerCase();

  if (inspected.includes('prod') || inspected.includes('production')) {
    throw new TradingDatabaseConfigError('Local Trading seed data refused production-like database configuration.', 'UNSAFE_SEED_ENVIRONMENT');
  }
}

function requireEnv(env: TradingDatabaseEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new TradingDatabaseConfigError(`Missing required Trading database env: ${key}.`, 'MISSING_ENV');
  }
  return value;
}

function readEnvironment(value: string | undefined): TradingDatabaseConfig['environment'] {
  const environment = value ?? 'local';
  if (environment === 'local' || environment === 'test' || environment === 'staging' || environment === 'production') {
    return environment;
  }
  throw new TradingDatabaseConfigError(`Invalid TRADING_ENV: ${environment}.`, 'INVALID_ENV');
}

function readPort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new TradingDatabaseConfigError(`Invalid TRADING_DB_PORT: ${value}.`, 'INVALID_ENV');
  }
  return port;
}
