import fs from 'node:fs';
import { BinanceConditionalProtectionAdapter } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/BinanceConditionalProtectionAdapter.js';
import { Val04B2LiveTransport } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2LiveTransport.js';
import { Val04B2CredentialSource } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2CredentialSource.js';
import { NodePostgresClient } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/PostgresEnvConfig.js';
import { PostgresPositionProtectionRepository } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/PostgresPositionProtectionRepository.js';

if (process.env.AXODUS_TRADING_ALLOW_TESTNET_MUTATION !== 'true') {
  console.error(JSON.stringify({ error: 'AXODUS_TRADING_ALLOW_TESTNET_MUTATION must be true' }));
  process.exit(1);
}

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

async function resolve() {
  const dbConfig = createNodePostgresEnvConfig(env);
  const dbClient = await NodePostgresClient.create(dbConfig);
  const protectionRepo = new PostgresPositionProtectionRepository(dbClient);

  const transport = new Val04B2LiveTransport();
  const credentialSource = new Val04B2CredentialSource(env);
  const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport, {
    environment: 'testnet',
    timeoutMs: 5000,
  });

  console.log('[Fallback 1] Executing emergency close for 0.002 BTC long position (QUANTITY_BOUNDED with reduceOnly=true)...');
  const closeResult = await adapter.executeEmergencyClose({
    commandId: `cmd_emg_${Date.now()}`,
    symbol: 'BTCUSDT',
    positionSide: 'LONG',
    positionMode: 'ONE_WAY',
    executionMode: 'QUANTITY_BOUNDED',
    quantity: '0.002',
    reason: 'CTO Fallback: Close exposure after lease expiration during arming',
  });

  console.log(`[Fallback 1] Close result: ${JSON.stringify(closeResult)}`);

  console.log('[Fallback 2] Cancelling any open Algo protection orders...');
  const openAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');
  for (const algo of openAlgos) {
    console.log(`Cancelling Algo order: algoId=${algo.providerProtectionOrderId}, clientAlgoId=${algo.clientProtectionOrderId}`);
    const cancelRes = await adapter.cancelProtectionOrder(
      'BTCUSDT',
      algo.clientProtectionOrderId,
      algo.providerProtectionOrderId,
    );
    console.log(`Cancel result: ${JSON.stringify(cancelRes)}`);
  }

  // Wait 2 seconds for settlement
  await new Promise(r => setTimeout(r, 2000));

  // Reconcile terminal state
  const risks = await adapter.getPositionRisk('BTCUSDT');
  const btcRisk = risks.find(r => r.symbol === 'BTCUSDT');
  const remainingQty = Number(btcRisk?.positionAmt ?? '0');
  const remainingAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');

  console.log('--- RECONCILED TERMINAL STATE ---');
  console.log(JSON.stringify({
    btcPositionAmt: remainingQty,
    positionFlat: Math.abs(remainingQty) < 0.00001,
    openAlgoCount: remainingAlgos.length,
    openAlgos: remainingAlgos,
  }, null, 2));

  await dbClient.close();
}

resolve().catch(console.error);
