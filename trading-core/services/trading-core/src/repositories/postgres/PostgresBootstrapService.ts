import { DatabaseConnectionManager } from './DatabaseConnectionManager.js';
import { DatabaseHealthService, type DatabaseHealthState } from './DatabaseHealthService.js';
import { MigrationRunner, type MigrationRunResult } from './MigrationRunner.js';
import type { TradingDatabaseConfig } from './TradingDatabaseConfig.js';

export interface PostgresBootstrapResult {
  migrations: MigrationRunResult;
  health: DatabaseHealthState;
  schemaVersion?: string;
}

export class PostgresBootstrapService {
  constructor(
    private readonly connection: DatabaseConnectionManager,
    private readonly migrations: MigrationRunner,
    private readonly health: DatabaseHealthService = new DatabaseHealthService(connection, migrations),
  ) {}

  async bootstrap(config: TradingDatabaseConfig = this.connection.getDatabaseConfig()): Promise<PostgresBootstrapResult> {
    await this.connection.connect();
    this.migrations.validateMigrations(config);
    const migrations = await this.migrations.run(config);
    const health = await this.health.check(config);
    if (health.status === 'unhealthy') {
      throw new Error(`Trading database bootstrap failed health check: ${health.issues.join('; ')}`);
    }
    return {
      migrations,
      health,
      schemaVersion: health.schemaVersion,
    };
  }

  async shutdown(): Promise<void> {
    await this.connection.shutdown();
  }
}
