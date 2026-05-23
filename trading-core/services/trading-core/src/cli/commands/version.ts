import type { TradingDbCliContext, TradingDbCliPayload } from '../trading-db.js';

export async function version(context: TradingDbCliContext): Promise<TradingDbCliPayload> {
  await context.connection.connect();
  const schemaVersion = await context.migrations.getSchemaVersion();
  return {
    ok: true,
    command: 'version',
    schemaVersion: schemaVersion?.id,
  };
}
