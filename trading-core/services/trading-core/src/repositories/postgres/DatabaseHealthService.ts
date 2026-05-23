import type { TradingDatabaseConfig } from './TradingDatabaseConfig.js';
import { DatabaseConnectionManager } from './DatabaseConnectionManager.js';
import { MigrationRunner } from './MigrationRunner.js';

export interface DatabaseHealthState {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectivity: 'connected' | 'failed';
  migrationConsistency: 'consistent' | 'inconsistent' | 'unknown';
  repositoryReadiness: 'ready' | 'not-ready';
  schemaVersion?: string;
  expectedSchemaVersion?: string;
  issues: string[];
}

export class DatabaseHealthService {
  constructor(
    private readonly connection: DatabaseConnectionManager,
    private readonly migrations: MigrationRunner,
  ) {}

  async check(config: TradingDatabaseConfig = this.connection.getDatabaseConfig()): Promise<DatabaseHealthState> {
    const issues: string[] = [];
    let connectivity: DatabaseHealthState['connectivity'] = 'connected';
    let repositoryReadiness: DatabaseHealthState['repositoryReadiness'] = 'ready';
    let migrationConsistency: DatabaseHealthState['migrationConsistency'] = 'consistent';
    let schemaVersion: string | undefined;

    try {
      await this.connection.getClient().query('SELECT 1');
    } catch (error) {
      connectivity = 'failed';
      repositoryReadiness = 'not-ready';
      migrationConsistency = 'unknown';
      issues.push(`Database connectivity failed: ${String(error)}`);
    }

    if (connectivity === 'connected') {
      try {
        const version = await this.migrations.getSchemaVersion();
        schemaVersion = version?.id;
        if (config.minimumSchemaVersion && this.compareMigrationIds(schemaVersion, config.minimumSchemaVersion) < 0) {
          migrationConsistency = 'inconsistent';
          issues.push(`Schema version ${schemaVersion ?? 'none'} is below required ${config.minimumSchemaVersion}.`);
        }
      } catch (error) {
        migrationConsistency = 'unknown';
        repositoryReadiness = 'not-ready';
        issues.push(`Migration state unavailable: ${String(error)}`);
      }
    }

    const status = connectivity === 'failed' || repositoryReadiness === 'not-ready'
      ? 'unhealthy'
      : migrationConsistency === 'inconsistent'
        ? 'degraded'
        : 'healthy';

    return {
      status,
      connectivity,
      migrationConsistency,
      repositoryReadiness,
      schemaVersion,
      expectedSchemaVersion: config.minimumSchemaVersion,
      issues,
    };
  }

  private compareMigrationIds(left: string | undefined, right: string): number {
    if (!left) {
      return -1;
    }
    return left.localeCompare(right);
  }
}
