import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FixedDecimal,
  DEFAULT_EXECUTION_DIAGNOSTICS_POLICY_V1,
  DEFAULT_PNL_ATTRIBUTION_POLICY_V1,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import {
  ExecutionDiagnosticsAuthority,
  PnLAttributionAuthority,
  PositionAccountingService,
  TradingPerformanceAggregator,
  TradingFeedbackService,
  ExecutionDiagnosticInvariantError,
  EconomicIdempotencyConflictError,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function makeMockIntent(overrides = {}) {
  return {
    executionIntentId: 'exec-intent-101',
    tradingIntentId: 'trading-intent-101',
    strategyId: 'strat-momentum',
    strategyRevisionId: 'strat-momentum:r7',
    venue: 'binance',
    instrument: 'BTC-USDT',
    marketType: 'perpetual',
    side: 'buy',
    authorizedQuantity: '1.000000000000',
    authorizedCapital: '60000.000000000000',
    authorizedLeverage: '1.000000000000',
    executionQuantity: '1.000000000000',
    executionCapital: '60000.000000000000',
    executionLeverage: '1.000000000000',
    targetAdapterType: 'testnet_adapter',
    constraints: {
      orderType: 'LIMIT',
      priceConstraints: { limitPrice: '60000.000000000000' },
    },
    tradingIntentDigest: 'digest-trading-101',
    authorizationContextDigest: 'digest-auth-101',
    executionPolicyRef: 'POLICY_V1',
    correlationId: 'corr-101',
    idempotencyKey: 'idem-101',
    createdAt: '2026-09-20T12:00:00.000Z',
    expiresAt: '2026-09-20T13:00:00.000Z',
    evidenceRefs: [],
    ...overrides,
  };
}

function makeMockAttempt(overrides = {}) {
  return {
    attemptId: 'attempt-101',
    executionIntentId: 'exec-intent-101',
    tradingIntentId: 'trading-intent-101',
    strategyId: 'strat-momentum',
    strategyRevisionId: 'strat-momentum:r7',
    adapterType: 'testnet_adapter',
    venue: 'binance',
    environment: 'TESTNET',
    attemptNumber: 1,
    idempotencyKey: 'idem-101',
    clientOrderId: 'ax-intent-101',
    providerOrderId: 'order-prov-101',
    status: 'ACKNOWLEDGED',
    createdAt: '2026-09-20T12:00:01.000Z',
    expiresAt: '2026-09-20T13:00:00.000Z',
    ...overrides,
  };
}

function makeMockOrder(overrides = {}) {
  return {
    canonicalOrderId: 'order-101',
    executionIntentId: 'exec-intent-101',
    executionAttemptId: 'attempt-101',
    tradingIntentId: 'trading-intent-101',
    strategyId: 'strat-momentum',
    strategyRevisionId: 'strat-momentum:r7',
    provider: 'binance',
    venue: 'binance',
    instrument: 'BTC-USDT',
    side: 'buy',
    orderType: 'LIMIT',
    authorizedQuantity: '1.000000000000',
    executionQuantity: '1.000000000000',
    cumulativeFilledQuantity: '1.000000000000',
    remainingQuantity: '0.000000000000',
    weightedAveragePrice: '60100.000000000000',
    state: 'FILLED',
    orderVersion: 2,
    clientOrderId: 'ax-intent-101',
    providerOrderId: 'order-prov-101',
    createdAt: '2026-09-20T12:00:01.000Z',
    updatedAt: '2026-09-20T12:00:05.000Z',
    ...overrides,
  };
}

function assertDecEq(actual, expected) {
  assert.ok(actual !== undefined && actual !== null, `Expected ${expected}, got ${actual}`);
  assert.ok(
    FixedDecimal.from(actual).eq(FixedDecimal.from(expected)),
    `Expected ${expected}, got ${actual}`
  );
}

describe('REQ-10 Execution Diagnostics, PnL Attribution & Continuous Feedback', () => {
  const diagAuth = new ExecutionDiagnosticsAuthority();
  const pnlAuth = new PnLAttributionAuthority();

  it('1. Full Fill: computes exact realized execution price, fill ratio, and slippage', () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt();
    const order = makeMockOrder({ cumulativeFilledQuantity: '1.000000000000' });
    const fills = [
      {
        canonicalFillId: 'fill-1',
        canonicalOrderId: 'order-101',
        executionIntentId: 'exec-intent-101',
        provider: 'binance',
        providerTradeId: 'trade-1',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '1.000000000000',
        fillPrice: '60100.000000000000',
        fee: '6.010000000000',
        feeAsset: 'USDT',
        providerTimestamp: '2026-09-20T12:00:04.000Z',
        observedAt: '2026-09-20T12:00:04.500Z',
      },
    ];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);

    assertDecEq(diag.filledQuantity, '1.000000000000');
    assertDecEq(diag.remainingQuantity, '0.000000000000');
    assertDecEq(diag.fillRatio, '1.000000000000');
    assertDecEq(diag.realizedExecutionPrice, '60100.000000000000');
    // BUY: real (60100) - ref (60000) = +100 adverse. Slippage bps = (100 / 60000) * 10000 = 16.6666666666
    assert.ok(diag.slippageBps?.startsWith('16.66'));
    assertDecEq(diag.slippageAmount, '100.000000000000');
    assertDecEq(diag.normalizedTotalFee, '6.010000000000');
    assert.equal(diag.quality, 'COMPLETE');
  });

  it('2. Partial Fill + Cancel: uses actual filled quantity only, zero economics on cancelled part', () => {
    const intent = makeMockIntent({ executionQuantity: '10.000000000000', authorizedQuantity: '10.000000000000' });
    const attempt = makeMockAttempt();
    const order = makeMockOrder({
      executionQuantity: '10.000000000000',
      cumulativeFilledQuantity: '4.000000000000',
      remainingQuantity: '6.000000000000',
      state: 'CANCELLED',
    });
    const fills = [
      {
        canonicalFillId: 'fill-p1',
        canonicalOrderId: 'order-101',
        executionIntentId: 'exec-intent-101',
        provider: 'binance',
        providerTradeId: 'trade-p1',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '4.000000000000',
        fillPrice: '60050.000000000000',
        fee: '24.020000000000',
        feeAsset: 'USDT',
        providerTimestamp: '2026-09-20T12:00:03.000Z',
        observedAt: '2026-09-20T12:00:03.500Z',
      },
    ];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], [], {
      cancellationCommand: {
        commandId: 'cmd-c1',
        canonicalOrderId: 'order-101',
        reason: 'timeout',
        requestedBy: 'timeout',
        requestedAt: '2026-09-20T12:00:04.000Z',
      },
    });

    assertDecEq(diag.filledQuantity, '4.000000000000');
    assertDecEq(diag.remainingQuantity, '6.000000000000');
    assertDecEq(diag.fillRatio, '0.400000000000');
    assertDecEq(diag.realizedExecutionPrice, '60050.000000000000');
    // Slippage on 4 units: (60050 - 60000) * 4 = 200
    assertDecEq(diag.slippageAmount, '200.000000000000');
    assertDecEq(diag.cancellationDetails?.remainingCancelled, '6.000000000000');
    assertDecEq(diag.cancellationDetails?.filledBeforeCancel, '4.000000000000');
  });

  it('3. No Fill / Cancel: price and slippage are undefined, not zero', () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt();
    const order = makeMockOrder({
      cumulativeFilledQuantity: '0.000000000000',
      remainingQuantity: '1.000000000000',
      state: 'CANCELLED',
      weightedAveragePrice: null,
    });

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, [], [], []);

    assertDecEq(diag.filledQuantity, '0.000000000000');
    assertDecEq(diag.remainingQuantity, '1.000000000000');
    assertDecEq(diag.fillRatio, '0.000000000000');
    assert.equal(diag.realizedExecutionPrice, undefined);
    assert.equal(diag.slippageBps, undefined);
    assert.equal(diag.slippageAmount, undefined);
  });

  it('4. Provider Reject: classifies rejection category without fabricating fills', () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt({ status: 'REJECTED', error: 'Margin insufficient' });
    const order = makeMockOrder({
      cumulativeFilledQuantity: '0.000000000000',
      state: 'REJECTED',
    });

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, [], [], []);
    assert.equal(diag.rejectionCategory, 'PRE_SUBMISSION_REJECTED');
    assert.equal(diag.rejectionReason, 'Margin insufficient');
    assertDecEq(diag.filledQuantity, '0.000000000000');
    assert.equal(diag.realizedExecutionPrice, undefined);
  });

  it('5. Multiple Fills: computes exact weighted average price across fills', () => {
    const intent = makeMockIntent({ executionQuantity: '5.000000000000', authorizedQuantity: '5.000000000000' });
    const attempt = makeMockAttempt();
    const order = makeMockOrder({
      executionQuantity: '5.000000000000',
      cumulativeFilledQuantity: '5.000000000000',
      state: 'FILLED',
    });
    const fills = [
      {
        canonicalFillId: 'fill-m1',
        canonicalOrderId: 'order-101',
        executionIntentId: 'exec-intent-101',
        provider: 'binance',
        providerTradeId: 'trade-m1',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '3.000000000000',
        fillPrice: '60000.000000000000',
        fee: '18.000000000000',
        feeAsset: 'USDT',
        providerTimestamp: '2026-09-20T12:00:03.000Z',
        observedAt: '2026-09-20T12:00:03.500Z',
      },
      {
        canonicalFillId: 'fill-m2',
        canonicalOrderId: 'order-101',
        executionIntentId: 'exec-intent-101',
        provider: 'binance',
        providerTradeId: 'trade-m2',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '2.000000000000',
        fillPrice: '61000.000000000000',
        fee: '12.200000000000',
        feeAsset: 'USDT',
        providerTimestamp: '2026-09-20T12:00:04.000Z',
        observedAt: '2026-09-20T12:00:04.500Z',
      },
    ];

    // (3 * 60000 + 2 * 61000) / 5 = (180000 + 122000) / 5 = 302000 / 5 = 60400
    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    assertDecEq(diag.realizedExecutionPrice, '60400.000000000000');
    assertDecEq(diag.filledQuantity, '5.000000000000');
    assertDecEq(diag.normalizedTotalFee, '30.200000000000');
  });

  it('6. Fee Asset Mismatch & Normalization: preserves unnormalized asset without naive summation', () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt();
    const order = makeMockOrder();
    const fills = [
      {
        canonicalFillId: 'fill-bnb',
        canonicalOrderId: 'order-101',
        executionIntentId: 'exec-intent-101',
        provider: 'binance',
        providerTradeId: 'trade-bnb',
        instrument: 'BTC-USDT',
        side: 'buy',
        fillQuantity: '1.000000000000',
        fillPrice: '60000.000000000000',
        fee: '0.010000000000',
        feeAsset: 'BNB',
        providerTimestamp: '2026-09-20T12:00:04.000Z',
        observedAt: '2026-09-20T12:00:04.500Z',
      },
    ];

    // Without conversion rate: normalizedTotalFee is undefined, quality PARTIAL
    const diagNoNorm = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    assert.equal(diagNoNorm.normalizedTotalFee, undefined);
    assert.equal(diagNoNorm.quality, 'PARTIAL');
    assert.equal(diagNoNorm.feeBreakdown[0].asset, 'BNB');

    // With explicit conversion rate: BNB @ 600 USDT -> 0.01 * 600 = 6.00 USDT
    const diagWithNorm = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], [], {
      feeConversionRates: { BNB: '600.000000000000' },
    });
    assertDecEq(diagWithNorm.normalizedTotalFee, '6.000000000000');
    assert.equal(diagWithNorm.quality, 'COMPLETE');
  });

  it('7. Slippage: side symmetry for BUY (adverse higher) vs SELL (adverse lower)', () => {
    const intentBuy = makeMockIntent({ side: 'buy' });
    const attemptBuy = makeMockAttempt();
    const orderBuy = makeMockOrder({ side: 'buy' });
    const fillsBuy = [{
      canonicalFillId: 'f-b',
      canonicalOrderId: 'order-101',
      executionIntentId: 'exec-intent-101',
      provider: 'binance',
      providerTradeId: 't-b',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60100.000000000000',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diagBuy = diagAuth.computeDiagnostics(intentBuy, attemptBuy, orderBuy, fillsBuy, [], [], { referencePrice: '60000.000000000000' });
    // BUY @ 60100 vs ref 60000 -> +100 adverse
    assertDecEq(diagBuy.slippageAmount, '100.000000000000');

    const intentSell = makeMockIntent({ side: 'sell' });
    const attemptSell = makeMockAttempt();
    const orderSell = makeMockOrder({ side: 'sell' });
    const fillsSell = [{
      canonicalFillId: 'f-s',
      canonicalOrderId: 'order-101',
      executionIntentId: 'exec-intent-101',
      provider: 'binance',
      providerTradeId: 't-s',
      instrument: 'BTC-USDT',
      side: 'sell',
      fillQuantity: '1.000000000000',
      fillPrice: '59900.000000000000',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diagSell = diagAuth.computeDiagnostics(intentSell, attemptSell, orderSell, fillsSell, [], [], { referencePrice: '60000.000000000000' });
    // SELL @ 59900 vs ref 60000 -> ref - real = +100 adverse
    assertDecEq(diagSell.slippageAmount, '100.000000000000');
  });

  it('8. Fill Invariant Error: throws if fills sum does not match order cumulativeFilledQuantity', () => {
    const intent = makeMockIntent();
    const attempt = makeMockAttempt();
    const order = makeMockOrder({ cumulativeFilledQuantity: '2.000000000000' }); // Mismatch!
    const fills = [{
      canonicalFillId: 'f-inv',
      canonicalOrderId: 'order-101',
      executionIntentId: 'exec-intent-101',
      provider: 'binance',
      providerTradeId: 't-inv',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60000.000000000000',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    assert.throws(() => {
      diagAuth.computeDiagnostics(intent, attempt, order, fills, [], []);
    }, ExecutionDiagnosticInvariantError);
  });

  it('9. Position Accounting & PnL: Partial Close (Open 10, Close 4 -> 4 realized, 6 remains cost basis)', () => {
    const posService = new PositionAccountingService();
    const intentOpen = makeMockIntent({ executionQuantity: '10.000000000000', authorizedQuantity: '10.000000000000' });
    const attemptOpen = makeMockAttempt();
    const orderOpen = makeMockOrder({ executionQuantity: '10.000000000000', cumulativeFilledQuantity: '10.000000000000' });
    const fillsOpen = [{
      canonicalFillId: 'f-open',
      canonicalOrderId: 'order-101',
      executionIntentId: 'exec-intent-101',
      provider: 'binance',
      providerTradeId: 't-open',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '10.000000000000',
      fillPrice: '60000.000000000000',
      fee: '60.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diagOpen = diagAuth.computeDiagnostics(intentOpen, attemptOpen, orderOpen, fillsOpen, [], []);
    const pnlOpen = pnlAuth.computePnLAttribution(intentOpen, orderOpen, diagOpen, fillsOpen, undefined, { positionService: posService });

    // Entry does NOT realize gross trading profit
    assertDecEq(pnlOpen.realizedGrossPnl, '0.000000000000');
    assertDecEq(pnlOpen.canonicalFees, '60.000000000000');
    assertDecEq(pnlOpen.realizedNetPnl, '-60.000000000000');
    assertDecEq(pnlOpen.remainingOpenQuantity, '10.000000000000');
    assertDecEq(pnlOpen.costBasisRemaining, '60000.000000000000');

    // Close 4 units @ 62000 (Sell)
    const intentClose = makeMockIntent({
      executionIntentId: 'exec-intent-102',
      side: 'sell',
      executionQuantity: '4.000000000000',
      authorizedQuantity: '4.000000000000',
    });
    const attemptClose = makeMockAttempt({ attemptId: 'attempt-102', clientOrderId: 'ax-intent-102' });
    const orderClose = makeMockOrder({
      canonicalOrderId: 'order-102',
      executionIntentId: 'exec-intent-102',
      side: 'sell',
      executionQuantity: '4.000000000000',
      cumulativeFilledQuantity: '4.000000000000',
      weightedAveragePrice: '62000.000000000000',
    });
    const fillsClose = [{
      canonicalFillId: 'f-close',
      canonicalOrderId: 'order-102',
      executionIntentId: 'exec-intent-102',
      provider: 'binance',
      providerTradeId: 't-close',
      instrument: 'BTC-USDT',
      side: 'sell',
      fillQuantity: '4.000000000000',
      fillPrice: '62000.000000000000',
      fee: '24.800000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:05:00.000Z',
      observedAt: '2026-09-20T12:05:00.500Z',
    }];

    const diagClose = diagAuth.computeDiagnostics(intentClose, attemptClose, orderClose, fillsClose, [], []);
    const pnlClose = pnlAuth.computePnLAttribution(intentClose, orderClose, diagClose, fillsClose, undefined, { positionService: posService });

    // Realized Gross PnL on 4 units: (62000 - 60000) * 4 = +8000.00 USDT
    assertDecEq(pnlClose.realizedGrossPnl, '8000.000000000000');
    assertDecEq(pnlClose.canonicalFees, '24.800000000000');
    // Net PnL = 8000 - 24.80 = 7975.20 USDT
    assertDecEq(pnlClose.realizedNetPnl, '7975.200000000000');
    assertDecEq(pnlClose.realizedQuantity, '4.000000000000');
    assertDecEq(pnlClose.remainingOpenQuantity, '6.000000000000');
    assertDecEq(pnlClose.costBasisRemaining, '60000.000000000000');
  });

  it('10. Scale-In & Scale-Out: weighted average cost basis and multi-exit PnL attribution', () => {
    const posService = new PositionAccountingService();
    const key = {
      strategyId: 'strat-momentum',
      strategyRevisionId: 'strat-momentum:r7',
      venue: 'binance',
      instrument: 'BTC-USDT',
      environment: 'TESTNET',
    };

    // Buy 3 @ 60000
    posService.processExecution(key, 'buy', '3.000000000000', '60000.000000000000', 'f1', '2026-09-20T12:00:00.000Z');
    // Buy 2 @ 65000 (Scale-in)
    posService.processExecution(key, 'buy', '2.000000000000', '65000.000000000000', 'f2', '2026-09-20T12:01:00.000Z');

    // Total 5, cost = 3 * 60000 + 2 * 65000 = 180000 + 130000 = 310000. Avg price = 62000.
    const summary = posService.getOpenPositionSummary(key);
    assertDecEq(summary.totalQuantity, '5.000000000000');
    assertDecEq(summary.weightedEntryPrice, '62000.000000000000');

    // Sell 3 @ 64000 (Scale-out FIFO: closes first 3 entries bought @ 60000)
    const close1 = posService.processExecution(key, 'sell', '3.000000000000', '64000.000000000000', 'f3', '2026-09-20T12:02:00.000Z');
    // Gross PnL on first 3: (64000 - 60000) * 3 = +12000.00
    assertDecEq(close1.realizedGrossPnl, '12000.000000000000');
    assertDecEq(close1.remainingOpenQuantity, '2.000000000000');
    assertDecEq(close1.costBasisRemaining, '65000.000000000000');

    // Sell remaining 2 @ 66000
    const close2 = posService.processExecution(key, 'sell', '2.000000000000', '66000.000000000000', 'f4', '2026-09-20T12:03:00.000Z');
    // Gross PnL on remaining 2: (66000 - 65000) * 2 = +2000.00
    assertDecEq(close2.realizedGrossPnl, '2000.000000000000');
    assertDecEq(close2.remainingOpenQuantity, '0.000000000000');
    assert.equal(close2.isPositionClosed, true);
  });

  it('11. Position Reversal: Long 5, Sell 8 -> closes Long 5, opens Short 3', () => {
    const posService = new PositionAccountingService();
    const key = {
      strategyId: 'strat-momentum',
      strategyRevisionId: 'strat-momentum:r7',
      venue: 'binance',
      instrument: 'BTC-USDT',
      environment: 'TESTNET',
    };

    // Long 5 @ 60000
    posService.processExecution(key, 'buy', '5.000000000000', '60000.000000000000', 'f-rev-1', '2026-09-20T12:00:00.000Z');

    // Sell 8 @ 61000 (Reversal)
    const rev = posService.processExecution(key, 'sell', '8.000000000000', '61000.000000000000', 'f-rev-2', '2026-09-20T12:02:00.000Z');

    // Closed Long 5: (61000 - 60000) * 5 = +5000.00 Gross PnL
    assertDecEq(rev.closedQuantity, '5.000000000000');
    assertDecEq(rev.realizedGrossPnl, '5000.000000000000');
    assertDecEq(rev.remainingOpenQuantity, '3.000000000000');
    assertDecEq(rev.costBasisRemaining, '61000.000000000000');
    assert.equal(rev.newPositionCreated?.side, 'short');
    assertDecEq(rev.newPositionCreated?.quantity, '3.000000000000');
    assertDecEq(rev.newPositionCreated?.entryPrice, '61000.000000000000');
  });

  it('12. Strategy & Revision Isolation: r1 position never mixes with r2, strat A never mixes with strat B', () => {
    const posService = new PositionAccountingService();

    const keyR1 = { strategyId: 'strat-1', strategyRevisionId: 'strat-1:r1', venue: 'binance', instrument: 'BTC-USDT', environment: 'TESTNET' };
    const keyR2 = { strategyId: 'strat-1', strategyRevisionId: 'strat-1:r2', venue: 'binance', instrument: 'BTC-USDT', environment: 'TESTNET' };
    const keyStratB = { strategyId: 'strat-2', strategyRevisionId: 'strat-2:r1', venue: 'binance', instrument: 'BTC-USDT', environment: 'TESTNET' };

    posService.processExecution(keyR1, 'buy', '2.000000000000', '50000.000000000000', 'f-r1', '2026-09-20T12:00:00.000Z');
    posService.processExecution(keyR2, 'buy', '4.000000000000', '60000.000000000000', 'f-r2', '2026-09-20T12:01:00.000Z');
    posService.processExecution(keyStratB, 'buy', '10.000000000000', '70000.000000000000', 'f-sb', '2026-09-20T12:02:00.000Z');

    assertDecEq(posService.getOpenPositionSummary(keyR1).totalQuantity, '2.000000000000');
    assertDecEq(posService.getOpenPositionSummary(keyR2).totalQuantity, '4.000000000000');
    assertDecEq(posService.getOpenPositionSummary(keyStratB).totalQuantity, '10.000000000000');

    // Sell 2 from R1
    const resR1 = posService.processExecution(keyR1, 'sell', '2.000000000000', '55000.000000000000', 'f-r1-close', '2026-09-20T12:03:00.000Z');
    assertDecEq(resR1.realizedGrossPnl, '10000.000000000000');
    assertDecEq(posService.getOpenPositionSummary(keyR1).totalQuantity, '0.000000000000');

    // R2 and Strat B positions remain completely untouched
    assertDecEq(posService.getOpenPositionSummary(keyR2).totalQuantity, '4.000000000000');
    assertDecEq(posService.getOpenPositionSummary(keyStratB).totalQuantity, '10.000000000000');
  });

  it('13. Double-Counting Invariant: slippage is NOT subtracted again from Net PnL', () => {
    const posService = new PositionAccountingService();
    const intent = makeMockIntent();
    const attempt = makeMockAttempt();
    const order = makeMockOrder();
    const fills = [{
      canonicalFillId: 'f-s-test',
      canonicalOrderId: 'order-101',
      executionIntentId: 'exec-intent-101',
      provider: 'binance',
      providerTradeId: 't-s-test',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60200.000000000000', // 200 adverse slippage vs 60000 limit
      fee: '10.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], [], { referencePrice: '60000.000000000000' });
    assertDecEq(diag.slippageAmount, '200.000000000000');

    const pnl = pnlAuth.computePnLAttribution(intent, order, diag, fills, undefined, { positionService: posService });
    // Gross PnL is 0 (entry), fees = 10, Net PnL = -10 (NOT -10 - 200)
    assertDecEq(pnl.realizedGrossPnl, '0.000000000000');
    assertDecEq(pnl.canonicalFees, '10.000000000000');
    assertDecEq(pnl.realizedNetPnl, '-10.000000000000');
  });

  it('14. Continuous Feedback Snapshot & Expected vs Observed Divergence', () => {
    const feedbackService = new TradingFeedbackService();

    const intent = makeMockIntent();
    const attempt = makeMockAttempt();
    const order = makeMockOrder();
    const fills = [{
      canonicalFillId: 'f-snap',
      canonicalOrderId: 'order-101',
      executionIntentId: 'exec-intent-101',
      provider: 'binance',
      providerTradeId: 't-snap',
      instrument: 'BTC-USDT',
      side: 'buy',
      fillQuantity: '1.000000000000',
      fillPrice: '60000.000000000000',
      fee: '6.000000000000',
      feeAsset: 'USDT',
      providerTimestamp: '2026-09-20T12:00:04.000Z',
      observedAt: '2026-09-20T12:00:04.500Z',
    }];

    const diag = diagAuth.computeDiagnostics(intent, attempt, order, fills, [], [], { referencePrice: '60000.000000000000' });
    const pnl = pnlAuth.computePnLAttribution(intent, order, diag, fills);

    const snapshot = feedbackService.createSnapshot([diag], [pnl], {
      strategyId: 'strat-momentum',
      strategyRevisionId: 'strat-momentum:r7',
      venue: 'binance',
      instrument: 'BTC-USDT',
      environment: 'TESTNET',
      windowStart: '2026-09-20T00:00:00.000Z',
      windowEnd: '2026-09-20T23:59:59.000Z',
      expectedMetrics: {
        expectedSlippageBps: '10.000000000000',
        expectedFee: '5.000000000000',
        expectedFillRatio: '1.000000000000',
        expectedLatencyMs: 500,
        expectedPnl: '0.000000000000',
      },
    });

    assert.equal(snapshot.strategyId, 'strat-momentum');
    assert.equal(snapshot.aggregate.executionCount, 1);
    assertDecEq(snapshot.aggregate.totalFees, '6.000000000000');
    assertDecEq(snapshot.divergence?.feeDivergence, '1.000000000000'); // 6.00 - 5.00
    assertDecEq(snapshot.divergence?.fillRatioDivergence, '0.000000000000');
    assert.equal(snapshot.quality, 'COMPLETE');
  });
});
