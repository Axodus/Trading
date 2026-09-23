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

async function fixStalePlans() {
  const dbConfig = createNodePostgresEnvConfig(env);
  const dbClient = await NodePostgresClient.create(dbConfig);

  // Mark the aborted plan from earlier as TERMINAL_CLOSED
  await dbClient.query('UPDATE trading_position_protection_plans SET lifecycle_state = $1 WHERE id = $2', ['TERMINAL_CLOSED', 'axd_dpln_01e_p2_muecj0hr']);

  // Set the valid plan rule canonical_status to RECONCILED_ACTIVE
  await dbClient.query('UPDATE trading_position_protection_rules SET canonical_status = $1 WHERE protection_plan_id = $2', ['RECONCILED_ACTIVE', 'axd_dpln_01e_p2_mueckmsw']);

  // Set the valid plan lifecycle to TRADE_FULLY_ARMED
  await dbClient.query('UPDATE trading_position_protection_plans SET lifecycle_state = $1 WHERE id = $2', ['TRADE_FULLY_ARMED', 'axd_dpln_01e_p2_mueckmsw']);

  console.log('Updated plans and rules in DB successfully.');
  await dbClient.close();
}

fixStalePlans().catch(console.error);
