import type { TradingDbCliContext, TradingDbCliPayload } from '../trading-db.js';

export async function health(context: TradingDbCliContext): Promise<TradingDbCliPayload> {
  await context.connection.connect();
  const state = await context.health.check(context.runtime.database);
  return {
    ok: state.status !== 'unhealthy',
    command: 'health',
    schemaVersion: state.schemaVersion,
    health: state,
  };
}
