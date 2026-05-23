import type { TradingDbCliContext, TradingDbCliPayload } from '../trading-db.js';

export async function validate(context: TradingDbCliContext): Promise<TradingDbCliPayload> {
  await context.connection.connect();
  context.migrations.validateMigrations(context.runtime.database);
  const state = await context.health.check(context.runtime.database);
  const compatible = state.status === 'healthy';
  return {
    ok: compatible,
    command: 'validate',
    compatible,
    schemaVersion: state.schemaVersion,
    minimumSchemaVersion: context.runtime.database.minimumSchemaVersion,
    health: state,
  };
}
