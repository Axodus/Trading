import fs from 'node:fs';
import { NodePostgresClient } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/PostgresEnvConfig.js';

const envContent = fs.readFileSync('/opt/Axodus/Trading/.env.local', 'utf8');
const env = { ...process.env };
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
}

async function reconcileStalePlan() {
  const dbConfig = createNodePostgresEnvConfig(env);
  const dbClient = await NodePostgresClient.create(dbConfig);

  // Mark the aborted plan from earlier as TERMINAL_CLOSED
  await dbClient.query(
    'UPDATE trading_position_protection_plans SET lifecycle_state = $1, last_reconciled_at = $2 WHERE id = $3',
    ['TERMINAL_CLOSED', new Date().toISOString(), 'axd_dpln_01e_p2_muecj0hr']
  );

  console.log('Stale plan axd_dpln_01e_p2_muecj0hr reconciled to TERMINAL_CLOSED.');
  await dbClient.close();
}

reconcileStalePlan().catch(console.error);