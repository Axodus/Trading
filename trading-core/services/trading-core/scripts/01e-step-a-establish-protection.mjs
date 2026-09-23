import fs from 'node:fs';
import path from 'node:path';
import { NodePostgresClient } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/PostgresEnvConfig.js';
import { PostgresPositionProtectionRepository } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/PostgresPositionProtectionRepository.js';
import { PostgresTradingSafetyStateRepository } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/PostgresTradingSafetyStateRepository.js';
import { BinanceConditionalProtectionAdapter } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/BinanceConditionalProtectionAdapter.js';
import { Val04B2LiveTransport } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2LiveTransport.js';
import { Val04B2CredentialSource } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2CredentialSource.js';
import { signVal04B2Query } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2ControlledOrderHarness.js';

if (process.env.AXODUS_TRADING_ALLOW_TESTNET_MUTATION !== 'true') {
  console.error(JSON.stringify({ error: 'AXODUS_TRADING_ALLOW_TESTNET_MUTATION must be true to run live test' }));
  process.exit(1);
}

// Load env from /opt/Axodus/Trading/.env.local
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

async function run() {
  const dbConfig = createNodePostgresEnvConfig(env);
  const dbClient = await NodePostgresClient.create(dbConfig);
  const protectionRepo = new PostgresPositionProtectionRepository(dbClient);
  const safetyStateRepo = new PostgresTradingSafetyStateRepository(dbClient);

  const transport = new Val04B2LiveTransport();
  const credentialSource = new Val04B2CredentialSource(env);
  const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport, {
    environment: 'testnet',
    timeoutMs: 5000,
  });

  const creds = await credentialSource.resolveEphemeralMaterial();
  if (!creds || !creds.apiKey || !creds.apiSecret) {
    throw new Error('Missing Binance Testnet credentials.');
  }

  // Preflight venue checks
  const positionMode = await adapter.getPositionMode();
  const initialRisks = await adapter.getPositionRisk('BTCUSDT');
  const btcRisk = initialRisks.find(r => r.symbol === 'BTCUSDT') ?? initialRisks[0];
  const initialQty = Number(btcRisk?.positionAmt ?? '0');

  if (Math.abs(initialQty) > 0.00001) {
    throw new Error(`Pre-test BTC position is not flat! Current qty: ${initialQty}`);
  }

  const openAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');
  if (openAlgos.length > 0) {
    throw new Error(`Pre-test open Algo orders exist! Count: ${openAlgos.length}`);
  }

  console.log('[Step 1] Preflight verified. Flat position, zero open orders.');

  // Step 2: Submit Market Entry for minimal valid size (0.002 BTC)
  const entryClientId = `ax-01e-entry-${Date.now()}`;
  const entryParams = {
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: '0.002',
    newClientOrderId: entryClientId,
    recvWindow: '5000',
    timestamp: String(Date.now()),
  };

  const signedEntryParams = await signVal04B2Query(entryParams, creds.apiSecret);

  const entryRes = await transport.post('https://testnet.binancefuture.com/fapi/v1/order', signedEntryParams, {
    'X-MBX-APIKEY': creds.apiKey,
    'Content-Type': 'application/json',
  });

  const entryData = await entryRes.json();

  if (entryRes.status < 200 || entryRes.status >= 300) {
    throw new Error(`Entry market order failed: HTTP ${entryRes.status} - ${JSON.stringify(entryData)}`);
  }

  console.log('[Step 2] Entry market order executed successfully.');

  // Wait 1s and query fresh position risk
  await new Promise(r => setTimeout(r, 1000));
  const postEntryRisks = await adapter.getPositionRisk('BTCUSDT');
  const activeBtcRisk = postEntryRisks.find(r => r.symbol === 'BTCUSDT');
  const activeQty = Number(activeBtcRisk?.positionAmt ?? '0');
  const entryPrice = Number(activeBtcRisk?.entryPrice ?? '0');

  if (activeQty <= 0) {
    throw new Error(`Expected active long position, found qty: ${activeQty}`);
  }

  console.log(`[Step 2] Position verified: ${activeQty} BTC @ ${entryPrice} USDT`);

  // Step 3: Establish venue-resident STOP_MARKET
  const triggerPrice = (entryPrice * 0.90).toFixed(1); // 10% below entry
  const planId = `plan-01e-${Date.now()}`;
  const ruleId = `rule-01e-${Date.now()}`;
  const clientAlgoId = `ax-01e-stop-${Date.now()}`;

  const planRecord = {
    planId,
    executionIntentId: `intent-01e-${Date.now()}`,
    tradingIntentId: `trade-intent-01e-${Date.now()}`,
    strategyId: 'strategy-safety-01e',
    strategyRevisionId: 'rev-01e-1',
    symbol: 'BTCUSDT',
    environment: 'testnet',
    provider: 'binance-perpetual-futures',
    positionMode: 'ONE_WAY',
    positionSide: 'LONG',
    state: 'PROPOSED',
    exposureState: 'EXPOSURE_CONFIRMED',
    activeExposureQuantity: String(activeQty),
    entryPrice: String(entryPrice),
    rules: [
      {
        ruleId,
        ruleType: 'HARD_STOP',
        executionMode: 'CLOSE_ALL',
        triggerPrice: triggerPrice,
        triggerPriceSource: 'MARK_PRICE',
        enablePriceProtection: true,
        clientProtectionOrderId: clientAlgoId,
        status: 'PENDING',
      },
    ],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await protectionRepo.createProtectionPlan(planRecord);

  // Submit STOP_MARKET through Algo API
  const subResult = await adapter.submitProtectionRule(
    planRecord.rules[0],
    planRecord,
  );

  if (!subResult.success) {
    throw new Error(`Protection submission failed: ${subResult.errorMessage}`);
  }

  const algoId = subResult.providerProtectionOrderId;
  console.log(`[Step 3] Venue STOP_MARKET submitted via Algo API: clientAlgoId=${clientAlgoId}, algoId=${algoId}, triggerPrice=${triggerPrice}`);

  // Transition durable plan to ARMED_ON_EXCHANGE / TRADE_FULLY_ARMED
  await protectionRepo.transitionProtectionPlanState(
    planId,
    1,
    'ARMED_ON_EXCHANGE',
    'TRADE_FULLY_ARMED',
    [
      {
        ruleId,
        ruleType: 'HARD_STOP',
        executionMode: 'CLOSE_ALL',
        triggerPrice: triggerPrice,
        triggerPriceSource: 'MARK_PRICE',
        enablePriceProtection: true,
        clientProtectionOrderId: clientAlgoId,
        status: 'ARMED',
        providerProtectionOrderId: algoId,
      },
    ],
  );

  console.log('[Step 4] Protection state persisted in PostgreSQL as TRADE_FULLY_ARMED.');

  // Wait 7 seconds to allow the Safety Supervisor background daemon to discover the plan and claim the lease
  console.log('Waiting for Safety Supervisor reconciliation and lease acquisition...');
  await new Promise(r => setTimeout(r, 7000));

  // Query Supervisor Health
  const healthRes = await fetch('http://127.0.0.1:9108/health').then(r => r.json());
  const ownership = await protectionRepo.getOwnershipRecord(planId);
  const freshPlan = await protectionRepo.getProtectionPlan(planId);
  const freshAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');
  const algoMatch = freshAlgos.find(a => String(a.clientProtectionOrderId) === clientAlgoId || String(a.providerProtectionOrderId) === algoId);

  const freezeData = {
    planId,
    ruleId,
    clientAlgoId,
    algoId,
    triggerPrice,
    position: {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: activeQty,
      entryPrice: entryPrice,
    },
    venueProtection: {
      clientAlgoId,
      algoId,
      algoStatus: algoMatch?.state ?? 'RECONCILED_ACTIVE',
      triggerPrice: triggerPrice,
      workingType: algoMatch?.workingType ?? 'MARK_PRICE',
      closePosition: 'true',
      verifiedByFreshProviderQuery: Boolean(algoMatch),
    },
    durableState: {
      protectionPlanId: planId,
      ruleId,
      lifecycle: 'TRADE_FULLY_ARMED',
      state: freshPlan?.state,
      ownerId: ownership?.ownerId,
      fencingToken: ownership?.fencingToken,
      leaseExpiresAt: ownership?.leaseExpiresAt,
      leaseActive: Boolean(ownership && new Date(ownership.leaseExpiresAt) > new Date()),
    },
    supervisorHealth: healthRes,
  };

  console.log('--- 01E PRE-KILL DATA ---');
  console.log(JSON.stringify(freezeData, null, 2));

  await dbClient.close();
}

run().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
