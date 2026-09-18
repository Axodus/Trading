import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ContinuousKillSwitch,
  ContinuousPositionReconciliationService,
  ContinuousRiskEnvelopeService,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

test('IMP-05C: ContinuousKillSwitch state machine and triggers', () => {
  const killSwitch = new ContinuousKillSwitch(() => '2026-09-18T12:00:00.000Z');
  assert.equal(killSwitch.isActive(), false);

  const triggered = killSwitch.trigger('POSITION_DIVERGENCE', 'Venue position does not match local state');
  assert.equal(triggered.active, true);
  assert.equal(triggered.reason, 'POSITION_DIVERGENCE');
  assert.equal(triggered.triggeredAt, '2026-09-18T12:00:00.000Z');
  assert.equal(killSwitch.isActive(), true);

  const cleared = killSwitch.clear('Investigation completed and positions verified', 'risk-officer-1');
  assert.equal(cleared.active, false);
  assert.equal(killSwitch.isActive(), false);
});

test('IMP-05C: ContinuousPositionReconciliationService matches equal positions', () => {
  const service = new ContinuousPositionReconciliationService();
  const local = [{
    market: 'BTCUSDT',
    symbol: 'BTCUSDT',
    side: 'long',
    quantity: '0.001',
    entryPrice: '60000',
    updatedAt: '2026-09-18T12:00:00.000Z',
  }];
  const venue = [{
    market: 'BTCUSDT',
    symbol: 'BTCUSDT',
    side: 'long',
    quantity: '0.001',
    entryPrice: '60000',
    updatedAt: '2026-09-18T12:00:00.000Z',
  }];

  const result = service.reconcile(local, venue);
  assert.equal(result.divergent, false);
  assert.equal(result.status, 'MATCH');
  assert.equal(result.findings.length, 0);
});

test('IMP-05C: ContinuousPositionReconciliationService detects unexpected venue position', () => {
  const service = new ContinuousPositionReconciliationService();
  const local = [];
  const venue = [{
    market: 'BTCUSDT',
    symbol: 'BTCUSDT',
    side: 'long',
    quantity: '0.002',
    entryPrice: '60000',
    updatedAt: '2026-09-18T12:00:00.000Z',
  }];

  const result = service.reconcile(local, venue);
  assert.equal(result.divergent, true);
  assert.equal(result.status, 'DIVERGENT');
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].message, /Unexpected venue position/);
});

test('IMP-05C: ContinuousPositionReconciliationService detects missing venue position (local only)', () => {
  const service = new ContinuousPositionReconciliationService();
  const local = [{
    market: 'BTCUSDT',
    symbol: 'BTCUSDT',
    side: 'short',
    quantity: '0.005',
    updatedAt: '2026-09-18T12:00:00.000Z',
  }];
  const venue = [];

  const result = service.reconcile(local, venue);
  assert.equal(result.divergent, true);
  assert.equal(result.status, 'DIVERGENT');
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].message, /Local position exists.*not found on venue/);
});

test('IMP-05C: ContinuousRiskEnvelopeService blocks when kill switch active', () => {
  const killSwitch = new ContinuousKillSwitch();
  killSwitch.trigger('OPERATOR_STOP', 'Emergency manual pause');

  const risk = new ContinuousRiskEnvelopeService({
    environment: 'testnet',
    allowedSymbols: ['BTCUSDT'],
    maxOrderNotional: 250,
    maxPositionNotional: 1000,
    maxTotalRunNotional: 5000,
    maxOutstandingOrders: 1,
    maxMarketDataAgeMs: 5000,
    maxPriceDeviationFraction: 0.05,
  }, killSwitch);

  const evalResult = risk.evaluate({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.001,
    price: 60000,
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 0,
  });

  assert.equal(evalResult.approved, false);
  assert.equal(evalResult.violationCode, 'KILL_SWITCH_ACTIVE');
});

test('IMP-05C: ContinuousRiskEnvelopeService blocks when position divergence present', () => {
  const killSwitch = new ContinuousKillSwitch();
  const risk = new ContinuousRiskEnvelopeService({
    environment: 'testnet',
    allowedSymbols: ['BTCUSDT'],
    maxOrderNotional: 250,
    maxPositionNotional: 1000,
    maxTotalRunNotional: 5000,
    maxOutstandingOrders: 1,
    maxMarketDataAgeMs: 5000,
    maxPriceDeviationFraction: 0.05,
  }, killSwitch);

  const evalResult = risk.evaluate({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.001,
    price: 60000,
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 0,
    positionReconciliationResult: {
      divergent: true,
      status: 'DIVERGENT',
      findings: [{
        type: 'position-divergence',
        state: 'divergent',
        severity: 'critical',
        message: 'Discrepancy found',
      }],
      localPositions: [],
      venuePositions: [],
    },
  });

  assert.equal(evalResult.approved, false);
  assert.equal(evalResult.violationCode, 'POSITION_DIVERGENCE_UNRESOLVED');
});

test('IMP-05C: ContinuousRiskEnvelopeService blocks unapproved environments and symbols', () => {
  const killSwitch = new ContinuousKillSwitch();
  const risk = new ContinuousRiskEnvelopeService({
    environment: 'mainnet',
    allowedSymbols: ['BTCUSDT'],
    maxOrderNotional: 250,
    maxPositionNotional: 1000,
    maxTotalRunNotional: 5000,
    maxOutstandingOrders: 1,
    maxMarketDataAgeMs: 5000,
    maxPriceDeviationFraction: 0.05,
  }, killSwitch);

  const res1 = risk.evaluate({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.001,
    price: 60000,
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 0,
  });
  assert.equal(res1.approved, false);
  assert.equal(res1.violationCode, 'ENVIRONMENT_NOT_ALLOWED');

  const risk2 = new ContinuousRiskEnvelopeService({
    environment: 'testnet',
    allowedSymbols: ['BTCUSDT'],
    maxOrderNotional: 250,
    maxPositionNotional: 1000,
    maxTotalRunNotional: 5000,
    maxOutstandingOrders: 1,
    maxMarketDataAgeMs: 5000,
    maxPriceDeviationFraction: 0.05,
  }, killSwitch);

  const res2 = risk2.evaluate({
    symbol: 'ETHUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.01,
    price: 3000,
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 0,
  });
  assert.equal(res2.approved, false);
  assert.equal(res2.violationCode, 'SYMBOL_NOT_ALLOWED');
});

test('IMP-05C: ContinuousRiskEnvelopeService enforces stale quotes, price deviations, and notionals', () => {
  const killSwitch = new ContinuousKillSwitch();
  const risk = new ContinuousRiskEnvelopeService({
    environment: 'testnet',
    allowedSymbols: ['BTCUSDT'],
    maxOrderNotional: 250,
    maxPositionNotional: 500,
    maxTotalRunNotional: 1000,
    maxOutstandingOrders: 1,
    maxMarketDataAgeMs: 5000,
    maxPriceDeviationFraction: 0.05,
    minOrderNotional: 10,
  }, killSwitch);

  const nowMs = 1000000;

  // Stale quote
  const staleRes = risk.evaluate({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.001,
    price: 60000,
    quote: {
      symbol: 'BTCUSDT',
      price: 60000,
      timestampMs: nowMs - 10000,
    },
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 0,
    nowMs,
  });
  assert.equal(staleRes.approved, false);
  assert.equal(staleRes.violationCode, 'STALE_MARKET_DATA');

  // Price deviation
  const devRes = risk.evaluate({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.001,
    price: 70000,
    quote: {
      symbol: 'BTCUSDT',
      price: 60000,
      timestampMs: nowMs - 100,
    },
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 0,
    nowMs,
  });
  assert.equal(devRes.approved, false);
  assert.equal(devRes.violationCode, 'PRICE_DEVIATION_TOO_HIGH');

  // Max order notional
  const notionalRes = risk.evaluate({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.01,
    price: 60000, // 600 notional > 250 max
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 0,
    nowMs,
  });
  assert.equal(notionalRes.approved, false);
  assert.equal(notionalRes.violationCode, 'MAX_ORDER_NOTIONAL_EXCEEDED');

  // Position notional ceiling
  const posNotionalRes = risk.evaluate({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.003,
    price: 60000, // 180 notional + 400 existing = 580 > 500 max
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 400,
    nowMs,
  });
  assert.equal(posNotionalRes.approved, false);
  assert.equal(posNotionalRes.violationCode, 'MAX_POSITION_NOTIONAL_EXCEEDED');

  // Valid order passes
  const validRes = risk.evaluate({
    symbol: 'BTCUSDT',
    side: 'buy',
    orderType: 'limit',
    quantity: 0.001,
    price: 60000, // 60 notional
    quote: {
      symbol: 'BTCUSDT',
      price: 60000,
      timestampMs: nowMs - 200,
    },
    activeOrdersCount: 0,
    accumulatedNotional: 0,
    currentPositionNotional: 0,
    nowMs,
  });
  assert.equal(validRes.approved, true);
});
