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

// Load env
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

  const transport = new Val04B2LiveTransport();
  const credentialSource = new Val04B2CredentialSource(env);
  const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport, {
    environment: 'testnet',
    timeoutMs: 5000,
  });

  // 1. Reconcile existing BTCUSDT position
  const risks = await adapter.getPositionRisk('BTCUSDT');
  const btcRisk = risks.find(r => r.symbol === 'BTCUSDT');
  const activeQty = Number(btcRisk?.positionAmt ?? '0');
  const entryPrice = Number(btcRisk?.entryPrice ?? '0');

  console.log(`[Reconcile] Found active BTC position: ${activeQty} BTC @ ${entryPrice} USDT`);

  if (Math.abs(activeQty - 0.002) > 0.0001) {
    throw new Error(`Position quantity mismatch! Expected 0.002 BTC, got: ${activeQty}`);
  }

  // Check if Algo order already exists
  const existingAlgos = await adapter.getOpenProtectionOrders('BTCUSDT');
  console.log(`[Reconcile] Open Algo orders count: ${existingAlgos.length}`);

  const triggerPrice = (entryPrice * 0.90).toFixed(1); // 10% below entry (e.g. 75866.6)
  const planId = `axd_dpln_01e_${Date.now().toString(36)}`;
  const ruleId = `axd_drule_01e_${Date.now().toString(36)}`;
  const clientAlgoId = `ax_01e_stop_${Date.now()}`;

  // 2. Create durable plan in PostgreSQL
  console.log(`[Plan] Creating durable plan ${planId} with rule ${ruleId}...`);
  const createdPlan = await protectionRepo.createPlan({
    id: planId,
    environment: 'testnet',
    provider: 'binance-perpetual-futures',
    instrument: 'BTCUSDT',
    positionMode: 'ONE_WAY',
    positionSide: 'LONG',
    executionIntentId: `intent-01e-${Date.now()}`,
    sourceEntryAttemptId: 'ax-01e-entry-1789780515152',
    strategyId: 'strategy-safety-01e',
    confirmedExposureQuantity: String(activeQty),
    entryReferencePrice: String(entryPrice),
    lifecycleState: 'EXPOSURE_CONFIRMED',
    correlationId: `corr-01e-${Date.now()}`,
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

  console.log(`[Plan] Durable plan created in DB (version=${createdPlan.version}, state=${createdPlan.lifecycleState})`);

  // 3. Submit Algo Order via adapter
  console.log(`[Algo] Submitting STOP_MARKET to Binance Futures Testnet via /fapi/v1/algoOrder...`);
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
      tradingIntentId: 'trading-intent-01e',
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

  if (!subResult.success) {
    throw new Error(`Algo order submission failed: ${subResult.errorMessage}`);
  }

  const algoId = subResult.providerProtectionOrderId;
  if (!algoId) throw new Error('Missing providerProtectionOrderId in submission result');
  console.log(`[Algo] Submitted successfully. algoId=${algoId}, clientAlgoId=${clientAlgoId}`);

  // 4. Register provider identity in PostgreSQL
  console.log(`[Plan] Registering provider identity...`);
  await protectionRepo.registerProviderIdentity({
    ruleId: ruleId,
    providerAlgoId: algoId,
    providerStatus: 'NEW',
    canonicalStatus: 'ARMED_ON_EXCHANGE',
  });

  // 5. Allow Safety Supervisor to discover and acquire ownership
  console.log(`[Supervisor] Waiting 7 seconds for Safety Supervisor to acquire fenced ownership...`);
  await new Promise(r => setTimeout(r, 7000));

  // 6. Query health and verification state
  const healthRes = await fetch('http://127.0.0.1:9108/health').then(r => r.json());
  const freshOwnership = await protectionRepo.getOwnershipRecord(planId);
  const freshPlan = await protectionRepo.getPlan(planId);
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
      closePosition: true,
      verifiedByFreshProviderQuery: Boolean(algoMatch),
    },
    durableState: {
      protectionPlanId: planId,
      ruleId,
      lifecycle: freshPlan?.lifecycleState,
      version: freshPlan?.version,
      providerIdentityPersisted: Boolean(freshPlan?.rules[0]?.providerAlgoId),
      ownerId: freshOwnership?.ownerId,
      fencingToken: freshOwnership?.fencingToken,
      leaseExpiresAt: freshOwnership?.leaseExpiresAt,
      leaseActive: Boolean(freshOwnership && new Date(freshOwnership.leaseExpiresAt) > new Date()),
    },
    supervisorHealth: healthRes,
  };

  console.log('--- 01E PRE-KILL FREEZE RESULT ---');
  console.log(JSON.stringify(freezeData, null, 2));

  await dbClient.close();
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
