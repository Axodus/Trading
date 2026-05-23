import { assertSafeLocalSeedConfig } from '../../config/TradingDatabaseConfig.js';
import type { TradingDbCliContext, TradingDbCliPayload } from '../trading-db.js';

export async function seedLocal(context: TradingDbCliContext): Promise<TradingDbCliPayload> {
  assertSafeLocalSeedConfig(context.runtime);
  const result = context.seedLocal
    ? await context.seedLocal()
    : {
        seeded: false,
        mock: true,
        simulationOnly: true,
      };
  return {
    ok: true,
    command: 'seed-local',
    ...result,
  };
}
