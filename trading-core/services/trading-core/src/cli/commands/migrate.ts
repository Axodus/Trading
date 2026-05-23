import type { TradingDbCliContext, TradingDbCliPayload } from '../trading-db.js';

export async function migrate(context: TradingDbCliContext): Promise<TradingDbCliPayload> {
  const result = await context.bootstrap.bootstrap(context.runtime.database);
  return {
    ok: true,
    command: 'migrate',
    schemaVersion: result.schemaVersion,
    applied: result.migrations.applied.map((migration) => migration.id),
    skipped: result.migrations.skipped.map((migration) => migration.id),
    warnings: result.migrations.warnings,
    health: result.health,
  };
}
