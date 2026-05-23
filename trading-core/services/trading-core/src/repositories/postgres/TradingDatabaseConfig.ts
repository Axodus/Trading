import type { PostgresQueryClient } from './PostgresClient.js';

export interface TradingMigration {
  id: string;
  sql: string;
  checksum?: string;
}

export interface TradingDatabaseConfig {
  environment: 'local' | 'test' | 'staging' | 'production';
  schemaName?: string;
  minimumSchemaVersion?: string;
  migrations: TradingMigration[];
}

export interface ManagedPostgresQueryClient extends PostgresQueryClient {
  close?(): Promise<void> | void;
}

export interface DatabaseConnectionManagerConfig {
  client: ManagedPostgresQueryClient;
  database: TradingDatabaseConfig;
}
