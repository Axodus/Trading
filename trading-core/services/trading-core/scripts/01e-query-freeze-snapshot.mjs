import fs from 'node:fs';
import { NodePostgresClient } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/PostgresEnvConfig.js';
import { PostgresPositionProtectionRepository } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/PostgresPositionProtectionRepository.js';
import { BinanceConditionalProtectionAdapter } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/BinanceConditionalProtectionAdapter.js';
import { Val04B2LiveTransport } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2LiveTransport.js';
import { Val04B2CredentialSource } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2CredentialSource.js';

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

async function verifyFreeze() {
  const dbConfig = createNodePostgresEnvConfig(env);
  const dbClient = await NodePostgresClient.create(dbConfig);
  const protectionRepo = new PostgresPositionProtectionRepository(dbClient);

  const transport = new Val04B2LiveTransport();
  const credentialSource = new Val04B2CredentialSource(env);
  const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport, {
    environment: 'testnet',
    timeoutMs: 5000,
  });

  const planId = 'axd_dpln_01e_p2_mueckmsw';
  const plan = await protectionRepo.getPlan(planId);
  const ownershipRes = await dbClient.query('SELECT * FROM trading_position_protection_ownership WHERE protection_plan_id = $1', [planId]);
  const ownership = ownershipRes.rows[0];

  const risks = await adapter.getPositionRisk('BTCUSDT');
  const btc = risks.find(r => r.symbol === 'BTCUSDT');
  const openAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');
  const supervisorHealth = await fetch('http://127.0.0.1:9108/health').then(r => r.json());

  const freezeData = {
    TRINITY_PID: 2083211,
    SAFETY_SUPERVISOR_PID: supervisorHealth.pid,
    SUPERVISOR_STATUS: supervisorHealth.status,
    POSITION: {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: Number(btc?.positionAmt ?? '0'),
      entryPrice: Number(btc?.entryPrice ?? '0'),
      markPrice: Number(btc?.markPrice ?? '0'),
      providerPositionConfirmed: Number(btc?.positionAmt ?? '0') > 0,
    },
    VENUE_PROTECTION: {
      clientAlgoId: openAlgos[0]?.clientProtectionOrderId,
      algoId: openAlgos[0]?.providerProtectionOrderId,
      algoStatus: openAlgos[0]?.state,
      triggerPrice: openAlgos[0]?.stopPrice,
      workingType: openAlgos[0]?.workingType,
      closePosition: openAlgos[0]?.closePosition,
      openAlgoCount: openAlgos.length,
      freshProviderLookup: openAlgos.length === 1,
    },
    DURABLE_STATE: {
      protectionPlanId: plan?.id,
      ruleId: plan?.rules[0]?.id,
      lifecycle: plan?.lifecycleState,
      version: plan?.version,
      providerIdentityPersisted: Boolean(plan?.rules[0]?.providerAlgoId),
      providerAlgoId: plan?.rules[0]?.providerAlgoId,
      canonicalStatus: plan?.rules[0]?.canonicalStatus,
    },
    OWNERSHIP: {
      ownerId: ownership?.owner_id,
      ownerType: ownership?.owner_type,
      leaseId: ownership?.lease_id,
      fencingToken: Number(ownership?.fencing_token),
      status: ownership?.status,
      leaseExpiresAt: ownership?.lease_expires_at,
      leaseActive: ownership?.status === 'ACTIVE' && new Date(ownership?.lease_expires_at) > new Date(),
    },
    SUPERVISOR_HEALTH: {
      supervisorId: supervisorHealth.supervisorId,
      pid: supervisorHealth.pid,
      uptimeSeconds: supervisorHealth.uptimeSeconds,
      activeSupervisedPlans: supervisorHealth.activeSupervisedPlans,
    },
    PROCESS_KILL_ELIGIBLE: Boolean(
      btc && Number(btc.positionAmt) > 0 &&
      openAlgos.length === 1 &&
      plan?.lifecycleState === 'TRADE_FULLY_ARMED' &&
      ownership?.status === 'ACTIVE'
    ),
  };

  console.log('=== 01E PRE-KILL FREEZE SNAPSHOT ===');
  console.log(JSON.stringify(freezeData, null, 2));

  await dbClient.close();
}

verifyFreeze().catch(console.error);
