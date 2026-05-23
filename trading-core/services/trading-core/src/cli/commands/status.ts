import type { TradingDbCliContext, TradingDbCliPayload } from '../trading-db.js';

export async function status(context: TradingDbCliContext): Promise<TradingDbCliPayload> {
  await context.connection.connect();
  const applied = await context.migrations.listApplied();
  const appliedIds = new Set(applied.map((migration) => migration.id));
  const pending = context.runtime.database.migrations
    .map((migration) => migration.id)
    .filter((id) => !appliedIds.has(id))
    .sort((left, right) => left.localeCompare(right));
  const schemaVersion = applied.at(-1)?.id;
  return {
    ok: true,
    command: 'status',
    schemaVersion,
    applied: applied.map((migration) => migration.id),
    pending,
  };
}
