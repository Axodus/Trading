import type { DatabaseConnectionManagerConfig, ManagedPostgresQueryClient, TradingDatabaseConfig } from './TradingDatabaseConfig.js';

export class DatabaseConnectionManager {
  private connected = false;

  constructor(private readonly config: DatabaseConnectionManagerConfig) {}

  async connect(): Promise<ManagedPostgresQueryClient> {
    await this.config.client.query('SELECT 1');
    this.connected = true;
    return this.config.client;
  }

  async shutdown(): Promise<void> {
    if (this.config.client.close) {
      await this.config.client.close();
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getClient(): ManagedPostgresQueryClient {
    return this.config.client;
  }

  getDatabaseConfig(): TradingDatabaseConfig {
    return this.config.database;
  }
}
