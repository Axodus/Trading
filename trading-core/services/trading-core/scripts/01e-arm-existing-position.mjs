import fs from 'node:fs';
import { NodePostgresClient } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/PostgresEnvConfig.js';
import { PostgresPositionProtectionRepository } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/PostgresPositionProtectionRepository.js';
import { BinanceConditionalProtectionAdapter } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/BinanceConditionalProtectionAdapter.js';
import { Val04B2LiveTransport } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2LiveTransport.js';
import { Val04B2CredentialSource } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external/Val04B2CredentialSource.js';

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

async function runArmExistingPosition() {
  console.log('=== EXECUTING OPTION A: ARMING EXISTING CONFIRMED EXPOSURE VIA ADAPTER ===');

  const dbConfig = createNodePostgresEnvConfig(env);
  const dbClient = await NodePostgresClient.create(dbConfig);
  const protectionRepo = new PostgresPositionProtectionRepository(dbClient);

  const transport = new Val04B2LiveTransport();
  const credentialSource = new Val04B2CredentialSource(env);
  const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport, {
    environment: 'testnet',
    timeoutMs: 5000,
  });

  // 1. Reconcile existing confirmed exposure on venue
  console.log('[Step 1] Reconciling existing confirmed exposure on Binance Testnet...');
  const risks = await adapter.getPositionRisk('BTCUSDT');
  const btcRisk = risks.find(r => r.symbol === 'BTCUSDT');
  const activeQty = Number(btcRisk?.positionAmt ?? '0');
  const entryPrice = Number(btcRisk?.entryPrice ?? '0');

  console.log(`[Step 1] Confirmed live exposure: ${activeQty} BTC @ ${entryPrice} USDT`);
  if (Math.abs(activeQty - 0.002) > 0.0001) {
    throw new Error(`Expected exactly 0.002 BTC exposure, found: ${activeQty}`);
  }

  const existingAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');
  if (existingAlgos.length > 0) {
    throw new Error(`Unexpected existing open Algo orders: ${existingAlgos.length}`);
  }

  // 2. Compute protective trigger price (10% stop loss)
  const triggerPrice = (entryPrice * 0.90).toFixed(1);
  const planId = `axd_dpln_01e_p2_${Date.now().toString(36)}`;
  const ruleId = `axd_drule_01e_p2_${Date.now().toString(36)}`;
  const clientAlgoId = `ax_01e_stop_p2_${Date.now()}`;
  const runtimeOwnerId = `trinity_runtime_p2_${Date.now().toString(36)}`;

  // 3. Create durable protection plan in PostgreSQL
  console.log(`[Step 3] Creating durable plan ${planId} in PostgreSQL...`);
  const createdPlan = await protectionRepo.createPlan({
    id: planId,
    environment: 'testnet',
    provider: 'binance-perpetual-futures',
    instrument: 'BTCUSDT',
    positionMode: 'ONE_WAY',
    positionSide: 'LONG',
    executionIntentId: `intent-01e-p2-${Date.now()}`,
    sourceEntryAttemptId: 'ax_01e_entry_p2_existing',
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

  // 4. Acquire initial leased ownership by TRADING_RUNTIME
  console.log(`[Step 4] Acquiring initial leased ownership for plan ${planId} (owner: ${runtimeOwnerId})...`);
  const initialLease = await protectionRepo.acquireOwnership({
    protectionPlanId: planId,
    ownerId: runtimeOwnerId,
    ownerType: 'TRADING_RUNTIME',
    leaseDurationMs: 15000,
  });
  console.log(`[Step 4] Leased ownership acquired. fencingToken=${initialLease.fencingToken}`);

  // 5. Submit venue hard stop via adapter.submitProtectionRule
  console.log(`[Step 5] Submitting STOP_MARKET protection via adapter (clientAlgoId=${clientAlgoId}, trigger=${triggerPrice})...`);
  const subResult = await adapter.submitProtectionRule(
    {
      ruleId: ruleId,
      ruleType: 'HARD_STOP',
      executionMode: 'CLOSE_ALL',
      triggerPrice: triggerPrice,
      triggerPriceSource: 'MARK_PRICE',
      enablePriceProtection: true,
      clientProtectionOrderId: clientAlgoId,
      status: 'PENDING',
    },
    {
      planId: planId,
      executionIntentId: createdPlan.executionIntentId,
      tradingIntentId: 'trading-intent-01e-p2',
      strategyId: 'strategy-safety-01e',
      strategyRevisionId: 'rev-01e-1',
      symbol: 'BTCUSDT',
      environment: 'testnet',
      provider: 'binance-perpetual-futures',
      positionMode: 'ONE_WAY',
      positionSide: 'LONG',
      state: 'EXPOSURE_CONFIRMED',
      exposureState: 'EXPOSURE_CONFIRMED',
      activeExposureQuantity: String(activeQty),
      entryPrice: String(entryPrice),
      rules: [],
      version: 1,
      createdAt: createdPlan.createdAt,
      updatedAt: createdPlan.updatedAt,
    },
  );

  if (!subResult.success || !subResult.providerProtectionOrderId) {
    throw new Error(`Algo submission failed: ${subResult.error ?? JSON.stringify(subResult)}`);
  }

  const algoId = subResult.providerProtectionOrderId;
  console.log(`[Step 5] Venue hard stop accepted by Binance. algoId=${algoId}, clientAlgoId=${clientAlgoId}`);

  // 6. Register provider identity in PostgreSQL under valid fencing token
  console.log(`[Step 6] Registering provider identity in DB (fence=${initialLease.fencingToken})...`);
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
  console.log('[Step 6] Provider identity registered successfully.');

  // 7. Transition plan state CAS to TRADE_FULLY_ARMED
  console.log('[Step 7] Transitioning plan lifecycle to TRADE_FULLY_ARMED via CAS...');
  const armedPlan = await protectionRepo.transitionPlanStateCas({
    protectionPlanId: planId,
    expectedState: 'EXPOSURE_CONFIRMED',
    targetState: 'TRADE_FULLY_ARMED',
    expectedVersion: 1,
    fencingToken: initialLease.fencingToken,
    ownerId: runtimeOwnerId,
    lastReconciledAt: new Date().toISOString(),
  });
  console.log(`[Step 7] Plan successfully transitioned to TRADE_FULLY_ARMED (version=${armedPlan.version})`);

  // 8. Release ownership so Safety Supervisor takes over supervision
  console.log('[Step 8] Releasing initial runtime lease so Safety Supervisor takes over supervision...');
  await protectionRepo.releaseOwnership({
    protectionPlanId: planId,
    ownerId: runtimeOwnerId,
    leaseId: initialLease.leaseId,
    fencingToken: initialLease.fencingToken,
  });

  // 9. Wait for Safety Supervisor to discover and acquire ownership
  console.log('[Step 9] Waiting 7 seconds for Safety Supervisor to acquire leased ownership and reconcile...');
  await new Promise(r => setTimeout(r, 7000));

  // 10. Query fresh live state for PRE-KILL FREEZE
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

runArmExistingPosition().catch(err => {
  console.error('Fatal Arming Error:', err);
  process.exit(1);
});
