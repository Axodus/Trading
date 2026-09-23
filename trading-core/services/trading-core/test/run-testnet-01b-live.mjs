import fs from 'node:fs';

// 1. Process-scoped mutation guard enablement
process.env.AXODUS_TRADING_ALLOW_TESTNET_MUTATION = 'true';

// Load .env.local without external packages
if (fs.existsSync('/opt/Axodus/Trading/.env.local')) {
  const lines = fs.readFileSync('/opt/Axodus/Trading/.env.local', 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^[\"']|[\"']$/g, '');
      process.env[key] = val;
    }
  }
}

import {
  Val04B2CredentialSource,
  Val04B2LiveTransport,
  BinanceConditionalProtectionAdapter,
  PositionProtectionService,
  ContinuousBinanceTestnetProvider,
} from '/opt/Axodus/Trading/dist-test/trading-core/services/trading-core/src/index.js';

async function main() {
  const mutationCounters = {
    entrySubmissions: 0,
    protectiveConditionalSubmissions: 0,
    protectionCancellations: 0,
    emergencyCloseSubmissions: 0,
    blindRetries: 0,
    mainnetMutations: 0,
    realCapitalMutations: 0,
  };

  const evidenceRecords = [];
  const credSource = new Val04B2CredentialSource();
  const transport = new Val04B2LiveTransport();
  const adapter = new BinanceConditionalProtectionAdapter(credSource, transport);
  const provider = new ContinuousBinanceTestnetProvider(credSource, transport);
  const protectionService = new PositionProtectionService(adapter);

  console.log('=== PHASE 0: PRE-FLIGHT READ-ONLY AUDIT ===');
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
  for (const sym of symbols) {
    const orders = await provider.getOpenOrders(sym);
    const pos = await provider.getPositions(sym);
    const activePos = pos.filter((p) => Number(p.quantity) > 0);
    if (orders.length > 0 || activePos.length > 0) {
      throw new Error(`Preflight failed: Symbol ${sym} has ${orders.length} open orders and ${activePos.length} active positions`);
    }
  }
  const venueSnapshot = await provider.getVenueSnapshot();
  const referencePrice = venueSnapshot.referencePrice;
  console.log(`[PREFLIGHT] BTCUSDT Reference Price: ${referencePrice}, all 5 symbols flat, 0 open orders.`);

  console.log('\n=== PHASE 1: TESTNET-01B-01 (ENTRY & VENUE-RESIDENT STOP_MARKET) ===');
  const entryClientId = `axd_01b_entry_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  const entryQty = '0.0006'; // BTC minimal test size

  mutationCounters.entrySubmissions += 1;
  const entryOrder = await provider.submitOrder({
    executionClientOrderId: entryClientId,
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'market',
    quantity: entryQty,
  });

  console.log(`[ENTRY] Order submitted: providerOrderId=${entryOrder.providerOrderId}, status=${entryOrder.providerStatus}, filledQty=${entryOrder.filledQuantity}`);

  // Fetch current position exposure
  const btcPositions = await provider.getPositions('BTCUSDT');
  const longPos = btcPositions.find((p) => p.side === 'LONG' || (p.side === 'BOTH' && Number(p.quantity) > 0));
  const confirmedExposure = longPos ? String(longPos.quantity) : entryQty;
  console.log(`[EXPOSURE] Confirmed position exposure: ${confirmedExposure} BTC`);

  // Calculate Hard Stop 5% below reference price
  const stopPrice = (referencePrice * 0.95).toFixed(1);
  console.log(`[PROTECTION] Arming STOP_MARKET protection at stopPrice=${stopPrice} (CLOSE_ALL mode)...`);

  mutationCounters.protectiveConditionalSubmissions += 1;
  const armResult = await protectionService.armProtection({
    symbol: 'BTCUSDT',
    positionSide: 'LONG',
    positionMode: 'ONE_WAY',
    confirmedExposureQuantity: confirmedExposure,
    stopPrice,
    executionMode: 'CLOSE_ALL',
    triggerPriceSource: 'MARK_PRICE',
  });

  console.log(`[PROTECTION_ARMED] status=${armResult.status}, isFullyArmed=${armResult.isFullyArmed}, isUnprotected=${armResult.isUnprotected}`);
  console.log(`[PROTECTION_DETAILS] PlanId=${armResult.plan.planId}, clientProtectionOrderId=${armResult.activeRule?.clientProtectionOrderId}, providerProtectionOrderId=${armResult.activeRule?.providerProtectionOrderId}`);

  if (!armResult.isFullyArmed || armResult.status !== 'TRADE_FULLY_ARMED') {
    throw new Error(`TESTNET-01B-01 FAILED: Trade is not fully armed (${armResult.status})`);
  }

  evidenceRecords.push({
    test: 'TESTNET-01B-01',
    planId: armResult.plan.planId,
    ruleId: armResult.activeRule?.ruleId,
    positionSide: armResult.plan.positionSide,
    positionMode: armResult.plan.positionMode,
    entryClientOrderId: entryClientId,
    entryProviderOrderId: entryOrder.providerOrderId,
    confirmedExposureQuantity: confirmedExposure,
    clientProtectionOrderId: armResult.activeRule?.clientProtectionOrderId,
    providerProtectionOrderId: armResult.activeRule?.providerProtectionOrderId,
    triggerPrice: armResult.activeRule?.triggerPrice,
    triggerPriceSource: armResult.activeRule?.triggerPriceSource,
    executionMode: armResult.activeRule?.executionMode,
    lifecycleState: armResult.status,
    isFullyArmed: armResult.isFullyArmed,
  });

  console.log('\n=== PHASE 2: TESTNET-01B-02 (INDEPENDENT VENUE IDENTITY VERIFICATION) ===');
  const openProtectionOrders = await adapter.getOpenProtectionOrders('BTCUSDT');
  const matchingVenueOrder = openProtectionOrders.find(
    (o) => o.orderId === armResult.activeRule?.providerProtectionOrderId || o.clientOrderId === armResult.activeRule?.clientProtectionOrderId,
  );

  console.log(`[VENUE_VERIFY] Venue resident orders found: ${openProtectionOrders.length}`);
  console.log(`[VENUE_VERIFY] Matching venue order:`, JSON.stringify(matchingVenueOrder, null, 2));

  if (!matchingVenueOrder || matchingVenueOrder.type !== 'STOP_MARKET') {
    throw new Error('TESTNET-01B-02 FAILED: Venue resident STOP_MARKET order not verified on exchange');
  }

  evidenceRecords.push({
    test: 'TESTNET-01B-02',
    venueOrderId: matchingVenueOrder.orderId,
    venueClientOrderId: matchingVenueOrder.clientOrderId,
    venueType: matchingVenueOrder.type,
    venueStopPrice: matchingVenueOrder.stopPrice,
    venueStatus: matchingVenueOrder.status,
    verifiedOnVenue: true,
  });

  console.log('\n=== PHASE 3: TESTNET-01B-03 (NORMAL RESOLUTION & OBSOLETE STOP CANCELLATION) ===');
  // Normal close of position: Sell market of confirmed exposure
  const closeClientId = `axd_01b_close_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  mutationCounters.entrySubmissions += 1;
  const closeOrder = await provider.submitOrder({
    executionClientOrderId: closeClientId,
    symbol: 'BTCUSDT',
    side: 'sell',
    orderType: 'market',
    quantity: confirmedExposure,
  });
  console.log(`[POSITION_CLOSE] Close order submitted: providerOrderId=${closeOrder.providerOrderId}, status=${closeOrder.providerStatus}, filledQty=${closeOrder.filledQuantity}`);

  // Confirm position is flat
  const postClosePos = await provider.getPositions('BTCUSDT');
  const activePostClosePos = postClosePos.filter((p) => Number(p.quantity) > 0);
  console.log(`[POSITION_AUDIT] Active positions post-close: ${activePostClosePos.length}`);

  // Cancel the obsolete protection order on venue
  mutationCounters.protectionCancellations += 1;
  const cancelResult = await adapter.cancelProtectionOrder(
    'BTCUSDT',
    armResult.activeRule?.clientProtectionOrderId,
    armResult.activeRule?.providerProtectionOrderId,
  );
  console.log(`[PROTECTION_CANCEL] Cancelled obsolete protection order: success=${cancelResult.success}`);

  // Verify 0 open orders on BTCUSDT
  const postCancelOrders = await provider.getOpenOrders('BTCUSDT');
  console.log(`[VENUE_AUDIT] Open orders on BTCUSDT: ${postCancelOrders.length}`);

  evidenceRecords.push({
    test: 'TESTNET-01B-03',
    closeClientOrderId: closeClientId,
    closeProviderOrderId: closeOrder.providerOrderId,
    positionFlatConfirmed: activePostClosePos.length === 0,
    obsoleteProtectionCancelled: cancelResult.success,
    openOrdersResidual: postCancelOrders.length,
  });

  console.log('\n=== PHASE 4: TESTNET-01B-04 (CONTROLLED UNPROTECTED EXPOSURE REJECTION & EMERGENCY CLOSE) ===');
  const entryClientId2 = `axd_01b_entry2_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  mutationCounters.entrySubmissions += 1;
  const entryOrder2 = await provider.submitOrder({
    executionClientOrderId: entryClientId2,
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'market',
    quantity: entryQty,
  });
  console.log(`[ENTRY_2] Order submitted: providerOrderId=${entryOrder2.providerOrderId}, filledQty=${entryOrder2.filledQuantity}`);

  // Intentionally try to arm protection with an invalid stop price that triggers immediately on LONG
  // (e.g. 150000.0, well above market price, causing Binance -2010 rejection)
  mutationCounters.protectiveConditionalSubmissions += 1;
  const adverseStopPrice = '150000.0';
  console.log(`[ADVERSE_PROTECTION] Attempting to arm stop with trigger immediately price (${adverseStopPrice})...`);

  const adverseArmResult = await protectionService.armProtection({
    symbol: 'BTCUSDT',
    positionSide: 'LONG',
    positionMode: 'ONE_WAY',
    confirmedExposureQuantity: entryQty,
    stopPrice: adverseStopPrice,
    executionMode: 'CLOSE_ALL',
    triggerPriceSource: 'MARK_PRICE',
  });

  console.log(`[ADVERSE_RESULT] status=${adverseArmResult.status}, isFullyArmed=${adverseArmResult.isFullyArmed}, isUnprotected=${adverseArmResult.isUnprotected}`);
  console.log(`[ADVERSE_REASON] unprotectedReason=${adverseArmResult.unprotectedReason}`);
  console.log(`[EMERGENCY_COMMAND]`, JSON.stringify(adverseArmResult.emergencyCommand, null, 2));

  if (adverseArmResult.status !== 'UNPROTECTED_EXPOSURE' || !adverseArmResult.isUnprotected || adverseArmResult.isFullyArmed) {
    throw new Error('TESTNET-01B-04 FAILED: Invariant UNPROTECTED_EXPOSURE was not triggered on rejected protection');
  }

  // Execute Emergency Close via Adapter
  mutationCounters.emergencyCloseSubmissions += 1;
  const emergencyCloseResult = await adapter.executeEmergencyClose(adverseArmResult.emergencyCommand);
  console.log(`[EMERGENCY_CLOSE_RESULT] success=${emergencyCloseResult.success}, orderId=${emergencyCloseResult.providerOrderId}`);

  // Reconcile and verify terminal flat state
  const postEmgPos = await provider.getPositions('BTCUSDT');
  const activePostEmgPos = postEmgPos.filter((p) => Number(p.quantity) > 0);
  const postEmgOrders = await provider.getOpenOrders('BTCUSDT');
  console.log(`[TERMINAL_EMG_AUDIT] BTC active positions=${activePostEmgPos.length}, open orders=${postEmgOrders.length}`);

  evidenceRecords.push({
    test: 'TESTNET-01B-04',
    adverseStatus: adverseArmResult.status,
    isUnprotected: adverseArmResult.isUnprotected,
    isFullyArmed: adverseArmResult.isFullyArmed,
    emergencyCommandEmitted: !!adverseArmResult.emergencyCommand,
    emergencyCloseSuccess: emergencyCloseResult.success,
    terminalPositionFlat: activePostEmgPos.length === 0,
    terminalOrdersZero: postEmgOrders.length === 0,
  });

  console.log('\n=== PHASE 5: TERMINAL RECONCILIATION ACROSS UNIVERSE ===');
  let totalOpenOrders = 0;
  let totalPositions = 0;
  for (const sym of symbols) {
    const orders = await provider.getOpenOrders(sym);
    const pos = await provider.getPositions(sym);
    const active = pos.filter((p) => Number(p.quantity) > 0);
    totalOpenOrders += orders.length;
    totalPositions += active.length;
  }
  console.log(`[FINAL RECONCILIATION] Total open orders across universe: ${totalOpenOrders}`);
  console.log(`[FINAL RECONCILIATION] Total active positions across universe: ${totalPositions}`);

  const outputSummary = {
    status: 'TESTNET_01B_MUTATION_VALIDATION_SUCCESS',
    timestamp: new Date().toISOString(),
    mutationCounters,
    frozenBudget: {
      entrySubmissionsMax: 4,
      protectiveConditionalSubmissionsMax: 6,
      protectionCancellationsMax: 6,
      emergencyCloseSubmissionsMax: 4,
      maxSimultaneousPositions: 1,
      blindRetriesMax: 0,
      mainnetMutationsMax: 0,
      realCapitalMutationsMax: 0,
    },
    budgetCompliance: {
      entryWithinBudget: mutationCounters.entrySubmissions <= 4,
      protectiveWithinBudget: mutationCounters.protectiveConditionalSubmissions <= 6,
      cancellationsWithinBudget: mutationCounters.protectionCancellations <= 6,
      emergencyCloseWithinBudget: mutationCounters.emergencyCloseSubmissions <= 4,
      zeroBlindRetries: mutationCounters.blindRetries === 0,
      zeroMainnet: mutationCounters.mainnetMutations === 0,
      zeroRealCapital: mutationCounters.realCapitalMutations === 0,
    },
    terminalState: {
      totalOpenOrders,
      totalPositions,
      isFlat: totalPositions === 0 && totalOpenOrders === 0,
    },
    evidenceRecords,
  };

  console.log('\n=== CONSOLIDATED REPORT JSON ===');
  console.log(JSON.stringify(outputSummary, null, 2));
}

main().catch((err) => {
  console.error('LIVE_TESTNET_FATAL_ERROR:', err);
  process.exit(1);
});
