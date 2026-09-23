import fs from 'node:fs';
import { NodePostgresClient } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/PostgresEnvConfig.js';
import { PostgresPositionProtectionRepository } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/PostgresPositionProtectionRepository.js';
import { BinanceConditionalProtectionAdapter } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/BinanceConditionalProtectionAdapter.js';
import { Val04B2LiveTransport } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2LiveTransport.js';
import { Val04B2CredentialSource } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2CredentialSource.js';
import { signVal04B2Query } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2ControlledOrderHarness.js';

if (process.env.AXODUS_TRADING_ALLOW_TESTNET_MUTATION !== 'true') {
  console.error(JSON.stringify({ error: 'AXODUS_TRADING_ALLOW_TESTNET_MUTATION must be true to run' }));
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

async function runPass2Arming() {
  console.log('=== STARTING 01E CHECKPOINT A (PASS 2) LIVE ARMING SEQUENCE ===');

  const dbConfig = createNodePostgresEnvConfig(env);
  const dbClient = await NodePostgresClient.create(dbConfig);
  const protectionRepo = new PostgresPositionProtectionRepository(dbClient);

  const transport = new Val04B2LiveTransport();
  const credentialSource = new Val04B2CredentialSource(env);
  const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport, {
    environment: 'testnet',
    timeoutMs: 5000,
  });

  // 1. Preflight check: Ensure 100% flat
  console.log('[Step 1] Preflight venue check...');
  const initialRisks = await adapter.getPositionRisk('BTCUSDT');
  const initialBtc = initialRisks.find(r => r.symbol === 'BTCUSDT');
  const initialAmt = Number(initialBtc?.positionAmt ?? '0');
  const initialAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');

  if (Math.abs(initialAmt) > 0.00001 || initialAlgos.length > 0) {
    throw new Error(`Preflight check failed: positionAmt=${initialAmt}, openAlgos=${initialAlgos.length}. Expected 0.`);
  }
  console.log('[Step 1] Preflight clean: 0 position, 0 open algos.');

  // 2. Submit minimal Testnet Entry (+1 entry budget)
  console.log('[Step 2] Submitting minimal Testnet Entry: BUY 0.002 BTC (MARKET)...');
  const entryClientOrderId = `ax_01e_entry_p2_${Date.now()}`;
  const creds = await credentialSource.resolveEphemeralMaterial();
  const entryParams = await signVal04B2Query({
    symbol: 'BTCUSDT',
    side: 'BUY',
    positionSide: 'BOTH',
    type: 'MARKET',
    quantity: '0.002',
    newClientOrderId: entryClientOrderId,
    recvWindow: '5000',
    timestamp: String(Date.now()),
  }, creds.apiSecret);

  const entryRes = await transport.post(
    'https://testnet.binancefuture.com/fapi/v1/order',
    entryParams,
    { 'X-MBX-APIKEY': creds.apiKey },
    5000,
  );

  const entryBody = JSON.parse(entryRes.bodyText);
  if (entryRes.status < 200 || entryRes.status >= 300) {
    throw new Error(`Entry order failed with HTTP ${entryRes.status}: ${entryRes.bodyText}`);
  }
  console.log(`[Step 2] Entry order filled: orderId=${entryBody.orderId}, clientOrderId=${entryClientOrderId}`);

  // 3. Confirm exposure on venue
  const postEntryRisks = await adapter.getPositionRisk('BTCUSDT');
  const postBtc = postEntryRisks.find(r => r.symbol === 'BTCUSDT');
  const activeQty = Number(postBtc?.positionAmt ?? '0');
  const entryPrice = Number(postBtc?.entryPrice ?? '0');

  console.log(`[Step 3] Exposure confirmed on venue: ${activeQty} BTC @ ${entryPrice} USDT`);
  if (Math.abs(activeQty - 0.002) > 0.0001) {
    throw new Error(`Unexpected position quantity: ${activeQty}`);
  }

  // 4. Calculate protective trigger price (10% stop loss)
  const triggerPrice = (entryPrice * 0.90).toFixed(1);
  const planId = `axd_dpln_01e_p2_${Date.now().toString(36)}`;
  const ruleId = `axd_drule_01e_p2_${Date.now().toString(36)}`;
  const clientAlgoId = `ax_01e_stop_p2_${Date.now()}`;
  const runtimeOwnerId = `trinity_runtime_p2_${Date.now().toString(36)}`;

  // 5. Create durable protection plan in PostgreSQL
  console.log(`[Step 5] Creating durable plan ${planId} in PostgreSQL...`);
  const createdPlan = await protectionRepo.createPlan({
    id: planId,
    environment: 'testnet',
    provider: 'binance-perpetual-futures',
    instrument: 'BTCUSDT',
    positionMode: 'ONE_WAY',
    positionSide: 'LONG',
    executionIntentId: `intent-01e-p2-${Date.now()}`,
    sourceEntryAttemptId: entryClientOrderId,
    strategyId: 'strategy-safety-01e',
    confirmedExposureQuantity: String(activeQty),
    entryReferencePrice: String(entryPrice),
    lifecycleState: 'EXPOSURE_CONFIRMED',
    correlationId: `corr-01e-p2-${Date.now()}`,
    rules: [
      {
        id: ruleId,
        generation: 1,
        ruleType: 'HARD_STOP',
        executionMode: 'CLOSE_ALL',
        triggerPrice: triggerPrice,
        triggerPriceSource: 'MARK_PRICE',
        enablePriceProtection: true,
        protectedQuantity: String(activeQty),
        providerClientAlgoId: clientAlgoId,
        canonicalStatus: 'PENDING_SUBMISSION',
      },
    ],
  });

  // 6. Acquire initial leased ownership by TRADING_RUNTIME
  console.log(`[Step 6] Acquiring leased ownership for plan ${planId} (owner: ${runtimeOwnerId})...`);
  const initialLease = await protectionRepo.acquireOwnership({
    protectionPlanId: planId,
    ownerId: runtimeOwnerId,
    ownerType: 'TRADING_RUNTIME',
    leaseDurationMs: 15000,
  });
  console.log(`[Step 6] Leased ownership acquired. fencingToken=${initialLease.fencingToken}`);

  // 7. Submit venue hard stop via /fapi/v1/algoOrder (+1 algo submission budget)
  console.log(`[Step 7] Submitting STOP_MARKET protection to Binance Testnet (clientAlgoId=${clientAlgoId}, trigger=${triggerPrice})...`);
  const algoSubParams = await signVal04B2Query({
    symbol: 'BTCUSDT',
    side: 'SELL',
    positionSide: 'BOTH',
    algoType: 'STOP_MARKET',
    clientAlgoId: clientAlgoId,
    triggerPrice: triggerPrice,
    workingType: 'MARK_PRICE',
    closePosition: 'true',
    priceProtect: 'TRUE',
    recvWindow: '5000',
    timestamp: String(Date.now()),
  }, creds.apiSecret);

  const algoRes = await transport.post(
    'https://testnet.binancefuture.com/fapi/v1/algoOrder',
    algoSubParams,
    { 'X-MBX-APIKEY': creds.apiKey },
    5000,
  );

  const algoBody = JSON.parse(algoRes.bodyText);
  if (algoRes.status < 200 || algoRes.status >= 300) {
    throw new Error(`Algo submission failed with HTTP ${algoRes.status}: ${algoRes.bodyText}`);
  }
  const algoId = String(algoBody.algoId);
  console.log(`[Step 7] Venue hard stop accepted by Binance. algoId=${algoId}, clientAlgoId=${clientAlgoId}`);

  // 8. Register provider identity in PostgreSQL under valid fencing token
  console.log(`[Step 8] Registering provider identity in DB (fence=${initialLease.fencingToken})...`);
  await protectionRepo.registerProviderIdentity({
    ruleId: ruleId,
    protectionPlanId: planId,
    fencingToken: initialLease.fencingToken,
    ownerId: runtimeOwnerId,
    providerAlgoId: algoId,
    providerStatus: 'NEW',
    canonicalStatus: 'ARMED_ON_EXCHANGE',
    lastProviderObservationAt: new Date().toISOString(),
  });
  console.log('[Step 8] Provider identity registered successfully.');

  // 9. Transition plan state CAS to TRADE_FULLY_ARMED
  console.log('[Step 9] Transitioning plan lifecycle to TRADE_FULLY_ARMED via CAS...');
  const armedPlan = await protectionRepo.transitionPlanStateCas({
    protectionPlanId: planId,
    expectedState: 'EXPOSURE_CONFIRMED',
    targetState: 'TRADE_FULLY_ARMED',
    expectedVersion: 1,
    fencingToken: initialLease.fencingToken,
    ownerId: runtimeOwnerId,
    lastReconciledAt: new Date().toISOString(),
  });
  console.log(`[Step 9] Plan successfully transitioned to TRADE_FULLY_ARMED (version=${armedPlan.version})`);

  // 10. Release ownership so Safety Supervisor can smoothly take over supervision
  console.log('[Step 10] Releasing initial runtime lease so Safety Supervisor takes over supervision...');
  await protectionRepo.releaseOwnership({
    protectionPlanId: planId,
    ownerId: runtimeOwnerId,
    leaseId: initialLease.leaseId,
    fencingToken: initialLease.fencingToken,
  });

  // 11. Wait for Safety Supervisor to discover and acquire ownership
  console.log('[Step 11] Waiting 7 seconds for Safety Supervisor to acquire leased ownership and reconcile...');
  await new Promise(r => setTimeout(r, 7000));

  // 12. Query fresh live state for PRE-KILL FREEZE
  const supervisorHealth = await fetch('http://127.0.0.1:9108/health').then(r => r.json());
  const freshOwnership = await protectionRepo.getOwnershipRecord(planId);
  const freshPlan = await protectionRepo.getPlan(planId);
  const freshAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');
  const algoMatch = freshAlgos.find(a => String(a.clientProtectionOrderId) === clientAlgoId || String(a.providerProtectionOrderId) === algoId);
  const freshPositions = await adapter.getPositionRisk('BTCUSDT');
  const freshBtc = freshPositions.find(r => r.symbol === 'BTCUSDT');

  const preKillFreeze = {
    TRINITY_PID: 2083211,
    SAFETY_SUPERVISOR_PID: supervisorHealth.pid,
    POSITION: {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: Number(freshBtc?.positionAmt ?? '0'),
      entryPrice: Number(freshBtc?.entryPrice ?? '0'),
      markPrice: Number(freshBtc?.markPrice ?? '0'),
      providerPositionConfirmed: Number(freshBtc?.positionAmt ?? '0') > 0,
    },
    VENUE_PROTECTION: {
      clientAlgoId: clientAlgoId,
      algoId: algoId,
      algoStatus: algoMatch?.state ?? 'NEW',
      triggerPrice: triggerPrice,
      workingType: 'MARK_PRICE',
      closePosition: true,
      freshProviderLookup: Boolean(algoMatch),
    },
    DURABLE_STATE: {
      protectionPlanId: planId,
      ruleId: ruleId,
      lifecycle: freshPlan?.lifecycleState,
      version: freshPlan?.version,
      providerIdentityPersisted: Boolean(freshPlan?.rules[0]?.providerAlgoId === algoId),
    },
    OWNERSHIP: {
      ownerId: freshOwnership?.ownerId,
      ownerType: freshOwnership?.ownerType,
      leaseActive: Boolean(freshOwnership && freshOwnership.status === 'ACTIVE' && new Date(freshOwnership.leaseExpiresAt) > new Date()),
      fencingToken: freshOwnership?.fencingToken,
      leaseExpiresAt: freshOwnership?.leaseExpiresAt,
    },
    SUPERVISOR_HEALTH: {
      supervisorId: supervisorHealth.supervisorId,
      pid: supervisorHealth.pid,
      status: supervisorHealth.status,
      activeSupervisedPlans: supervisorHealth.activeSupervisedPlans,
    },
    PROCESS_KILL_ELIGIBLE: Boolean(
      freshBtc && Number(freshBtc.positionAmt) > 0 &&
      algoMatch &&
      freshPlan?.lifecycleState === 'TRADE_FULLY_ARMED' &&
      freshOwnership && freshOwnership.status === 'ACTIVE'
    ),
  };

  console.log('\n========================================');
  console.log('=== 01E PRE-KILL FREEZE SNAPSHOT ===');
  console.log('========================================');
  console.log(JSON.stringify(preKillFreeze, null, 2));

  await dbClient.close();
}

runPass2Arming().catch(err => {
  console.error('Fatal Pass 2 Arming Error:', err);
  process.exit(1);
});
