import fs from 'node:fs';
import assert from 'node:assert/strict';
import { NodePostgresClient } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/config/PostgresEnvConfig.js';
import { PostgresPositionProtectionRepository } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/PostgresPositionProtectionRepository.js';
import {
  ProtectionLeaseExpiredError,
  ProtectionFencingRejectedError,
} from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/protection/DurablePositionProtectionContracts.js';

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

async function runLocalVerification() {
  console.log('=== RUNNING LOCAL HARNESS & FENCING CONTRACT VERIFICATION ===');
  const dbConfig = createNodePostgresEnvConfig(env);
  const dbClient = await NodePostgresClient.create(dbConfig);
  const protectionRepo = new PostgresPositionProtectionRepository(dbClient);

  const testSuffix = Date.now().toString(36);

  // PATH 1: Valid Sequencing & Arguments (createPlan -> acquireOwnership -> registerProviderIdentity)
  console.log('\n[Test 1] Valid Sequencing: createPlan -> acquireOwnership -> registerProviderIdentity...');
  const planId1 = `plan_val1_${testSuffix}`;
  const ruleId1 = `rule_val1_${testSuffix}`;
  const ownerId1 = `runtime_val1_${testSuffix}`;

  await protectionRepo.createPlan({
    id: planId1,
    environment: 'testnet',
    provider: 'binance-perpetual-futures',
    instrument: 'BTCUSDT',
    positionMode: 'ONE_WAY',
    positionSide: 'LONG',
    executionIntentId: `intent_val1_${testSuffix}`,
    confirmedExposureQuantity: '0.002',
    entryReferencePrice: '84000.0',
    lifecycleState: 'EXPOSURE_CONFIRMED',
    correlationId: `corr_val1_${testSuffix}`,
    rules: [{
      id: ruleId1,
      generation: 1,
      ruleType: 'HARD_STOP',
      executionMode: 'CLOSE_ALL',
      triggerPrice: '75000.0',
      triggerPriceSource: 'MARK_PRICE',
      enablePriceProtection: true,
      providerClientAlgoId: `client_algo_${testSuffix}`,
    }],
  });

  const lease1 = await protectionRepo.acquireOwnership({
    protectionPlanId: planId1,
    ownerId: ownerId1,
    ownerType: 'TRADING_RUNTIME',
    leaseDurationMs: 30000,
  });

  assert.equal(lease1.fencingToken, 1);
  assert.equal(lease1.ownerId, ownerId1);

  await protectionRepo.registerProviderIdentity({
    ruleId: ruleId1,
    protectionPlanId: planId1,
    fencingToken: lease1.fencingToken,
    ownerId: ownerId1,
    providerAlgoId: '1000000001',
    providerStatus: 'NEW',
    canonicalStatus: 'ARMED_ON_EXCHANGE',
    lastProviderObservationAt: new Date().toISOString(),
  });

  const planAfter1 = await protectionRepo.getPlan(planId1);
  assert.equal(planAfter1?.rules[0]?.providerAlgoId, '1000000001');
  assert.equal(planAfter1?.rules[0]?.canonicalStatus, 'ARMED_ON_EXCHANGE');
  console.log('-> Test 1 PASS: Valid sequencing and provider registration succeeded.');

  // PATH 2: No ownership -> registerProviderIdentity -> ProtectionLeaseExpiredError
  console.log('\n[Test 2] Missing Ownership: createPlan -> registerProviderIdentity without lease...');
  const planId2 = `plan_val2_${testSuffix}`;
  const ruleId2 = `rule_val2_${testSuffix}`;

  await protectionRepo.createPlan({
    id: planId2,
    environment: 'testnet',
    provider: 'binance-perpetual-futures',
    instrument: 'BTCUSDT',
    positionMode: 'ONE_WAY',
    positionSide: 'LONG',
    executionIntentId: `intent_val2_${testSuffix}`,
    confirmedExposureQuantity: '0.002',
    entryReferencePrice: '84000.0',
    lifecycleState: 'EXPOSURE_CONFIRMED',
    correlationId: `corr_val2_${testSuffix}`,
    rules: [{
      id: ruleId2,
      generation: 1,
      ruleType: 'HARD_STOP',
      executionMode: 'CLOSE_ALL',
      triggerPrice: '75000.0',
      triggerPriceSource: 'MARK_PRICE',
      enablePriceProtection: true,
      providerClientAlgoId: `client_algo2_${testSuffix}`,
    }],
  });

  let error2 = null;
  try {
    await protectionRepo.registerProviderIdentity({
      ruleId: ruleId2,
      protectionPlanId: planId2,
      fencingToken: 1,
      ownerId: 'unauthorized_owner',
      providerAlgoId: '1000000002',
      lastProviderObservationAt: new Date().toISOString(),
    });
  } catch (err) {
    error2 = err;
  }

  assert.ok(error2 instanceof ProtectionLeaseExpiredError, `Expected ProtectionLeaseExpiredError, got ${error2}`);
  console.log(`-> Test 2 PASS: Threw expected ProtectionLeaseExpiredError: ${error2?.message}`);

  // PATH 3: Stale fence (fence N rotates to N+1 -> register with N -> ProtectionFencingRejectedError)
  console.log('\n[Test 3] Stale Fence: owner A acquires fence 1, lease expires / rotates to owner B fence 2 -> owner A attempts mutation with fence 1...');
  const planId3 = `plan_val3_${testSuffix}`;
  const ruleId3 = `rule_val3_${testSuffix}`;
  const ownerA = `owner_a_${testSuffix}`;
  const ownerB = `owner_b_${testSuffix}`;

  await protectionRepo.createPlan({
    id: planId3,
    environment: 'testnet',
    provider: 'binance-perpetual-futures',
    instrument: 'BTCUSDT',
    positionMode: 'ONE_WAY',
    positionSide: 'LONG',
    executionIntentId: `intent_val3_${testSuffix}`,
    confirmedExposureQuantity: '0.002',
    entryReferencePrice: '84000.0',
    lifecycleState: 'EXPOSURE_CONFIRMED',
    correlationId: `corr_val3_${testSuffix}`,
    rules: [{
      id: ruleId3,
      generation: 1,
      ruleType: 'HARD_STOP',
      executionMode: 'CLOSE_ALL',
      triggerPrice: '75000.0',
      triggerPriceSource: 'MARK_PRICE',
      enablePriceProtection: true,
      providerClientAlgoId: `client_algo3_${testSuffix}`,
    }],
  });

  // Owner A acquires fence 1 with 1ms lease
  const leaseA = await protectionRepo.acquireOwnership({
    protectionPlanId: planId3,
    ownerId: ownerA,
    ownerType: 'TRADING_RUNTIME',
    leaseDurationMs: 1,
  });
  assert.equal(leaseA.fencingToken, 1);

  // Wait 10ms for lease A to expire
  await new Promise(r => setTimeout(r, 10));

  // Owner B acquires lease, getting fence 2
  const leaseB = await protectionRepo.acquireOwnership({
    protectionPlanId: planId3,
    ownerId: ownerB,
    ownerType: 'SAFETY_SUPERVISOR',
    leaseDurationMs: 30000,
  });
  assert.equal(leaseB.fencingToken, 2);

  // Owner A attempts mutation with stale fence 1
  let error3 = null;
  try {
    await protectionRepo.registerProviderIdentity({
      ruleId: ruleId3,
      protectionPlanId: planId3,
      fencingToken: leaseA.fencingToken,
      ownerId: ownerA,
      providerAlgoId: '1000000003',
      lastProviderObservationAt: new Date().toISOString(),
    });
  } catch (err) {
    error3 = err;
  }

  assert.ok(error3 instanceof ProtectionFencingRejectedError, `Expected ProtectionFencingRejectedError, got ${error3}`);
  console.log(`-> Test 3 PASS: Threw expected ProtectionFencingRejectedError: ${error3?.message}`);

  // Cleanup test plans
  await dbClient.query(`DELETE FROM trading_position_protection_rules WHERE protection_plan_id IN ($1, $2, $3)`, [planId1, planId2, planId3]);
  await dbClient.query(`DELETE FROM trading_position_protection_ownership WHERE protection_plan_id IN ($1, $2, $3)`, [planId1, planId2, planId3]);
  await dbClient.query(`DELETE FROM trading_position_protection_plans WHERE id IN ($1, $2, $3)`, [planId1, planId2, planId3]);

  await dbClient.close();
  console.log('\n=== ALL 3 LOCAL FENCING & SEQUENCING TESTS PASSED PERFECTLY ===');
}

runLocalVerification().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
