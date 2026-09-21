import type { PostgresQueryClient } from './PostgresClient.js';
import type { TradingDatabaseConfig, TradingMigration } from './TradingDatabaseConfig.js';

export interface AppliedMigration {
  id: string;
  checksum: string;
  appliedAt: string;
}

export interface MigrationRunResult {
  applied: AppliedMigration[];
  skipped: AppliedMigration[];
  schemaVersion?: string;
  warnings: string[];
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_MIGRATION' | 'CHECKSUM_MISMATCH' | 'EXECUTION_FAILED' | 'ORDERING_ERROR',
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class MigrationRunner {
  constructor(private readonly client: PostgresQueryClient) {}

  async run(config: TradingDatabaseConfig): Promise<MigrationRunResult> {
    const migrations = this.normalizeMigrations(config.migrations);
    await this.ensureHistoryTable();
    const appliedBefore = await this.listApplied();
    const appliedById = new Map(appliedBefore.map((migration) => [migration.id, migration]));
    const result: MigrationRunResult = {
      applied: [],
      skipped: [],
      warnings: [],
    };

    for (const migration of migrations) {
      const checksum = this.checksum(migration);
      const existing = appliedById.get(migration.id);
      if (existing) {
        if (existing.checksum !== checksum) {
          throw new MigrationError(`Migration ${migration.id} checksum mismatch. Rollback or mutation is not allowed.`, 'CHECKSUM_MISMATCH');
        }
        result.skipped.push(existing);
        continue;
      }

      try {
        for (const statement of this.splitStatements(migration.sql)) {
          await this.client.query(statement);
        }
        const record: AppliedMigration = {
          id: migration.id,
          checksum,
          appliedAt: new Date().toISOString(),
        };
        await this.client.query(
          'INSERT INTO trading_schema_migrations (id, checksum, applied_at) VALUES ($1, $2, $3)',
          [record.id, record.checksum, record.appliedAt],
        );
        result.applied.push(record);
      } catch (error) {
        // Concurrent services can observe the migration as absent, safely run
        // idempotent DDL, and then race on the history primary key. The winner's
        // matching durable record is authoritative; a different checksum still
        // fails closed.
        const concurrentlyApplied = (await this.listApplied()).find((item) => item.id === migration.id);
        if (concurrentlyApplied?.checksum === checksum) {
          result.skipped.push(concurrentlyApplied);
          appliedById.set(migration.id, concurrentlyApplied);
          continue;
        }
        throw new MigrationError(`Migration ${migration.id} failed: ${String(error)}`, 'EXECUTION_FAILED');
      }
    }

    result.schemaVersion = (await this.getSchemaVersion())?.id;
    if (config.minimumSchemaVersion && this.compareMigrationIds(result.schemaVersion, config.minimumSchemaVersion) < 0) {
      result.warnings.push(`Schema version ${result.schemaVersion ?? 'none'} is below required ${config.minimumSchemaVersion}.`);
    }
    return result;
  }

  async listApplied(): Promise<AppliedMigration[]> {
    const result = await this.client.query<{
      id: string;
      checksum: string;
      applied_at: string;
    }>('SELECT id, checksum, applied_at FROM trading_schema_migrations ORDER BY id ASC');
    return result.rows.map((row) => ({
      id: row.id,
      checksum: row.checksum,
      appliedAt: row.applied_at,
    }));
  }

  async getSchemaVersion(): Promise<AppliedMigration | undefined> {
    const applied = await this.listApplied();
    return applied.at(-1);
  }

  validateMigrations(config: TradingDatabaseConfig): void {
    this.normalizeMigrations(config.migrations);
  }

  private async ensureHistoryTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS trading_schema_migrations (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL
      )
    `);
  }

  private normalizeMigrations(migrations: TradingMigration[]): TradingMigration[] {
    const seen = new Set<string>();
    const sorted = [...migrations].sort((left, right) => left.id.localeCompare(right.id));
    for (const migration of sorted) {
      if (!migration.id || !migration.sql.trim()) {
        throw new MigrationError('Migration id and sql are required.', 'INVALID_MIGRATION');
      }
      if (seen.has(migration.id)) {
        throw new MigrationError(`Duplicate migration id ${migration.id}.`, 'INVALID_MIGRATION');
      }
      seen.add(migration.id);
    }
    return sorted;
  }

  private splitStatements(sql: string): string[] {
    return sql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
  }

  private checksum(migration: TradingMigration): string {
    return migration.checksum ?? this.hash(migration.sql);
  }

  private hash(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  private compareMigrationIds(left: string | undefined, right: string): number {
    if (!left) {
      return -1;
    }
    return left.localeCompare(right);
  }
}
