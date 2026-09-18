import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ExternalExecutionGate,
  Val04BPreCredentialHarness,
  deriveMinimumValidLimitOrder,
  deriveRuntimeVenueRules,
  verifyPublicExchangeInfo,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const exchangeInfo = {
  symbols: [{
    symbol: 'BTCUSDT',
    status: 'TRADING',
    filters: [
      { filterType: 'PRICE_FILTER', tickSize: '0.10' },
      { filterType: 'LOT_SIZE', minQty: '0.001', maxQty: '100', stepSize: '0.001' },
      { filterType: 'MIN_NOTIONAL', minNotional: '100' },
    ],
  }],
};

describe('VAL-04B pre-credential harness', () => {
  it('derives venue rules and the minimum valid LIMIT order from runtime filters', () => {
    const rules = deriveRuntimeVenueRules(exchangeInfo);
    const order = deriveMinimumValidLimitOrder(rules, 50000.27, 250, 'ax-val04b-001');
    assert.equal(rules.tickSize, 0.1);
    assert.equal(rules.stepSize, 0.001);
    assert.equal(order.type, 'LIMIT');
    assert.equal(order.price, 50000.2);
    assert.equal(order.quantity, 0.002);
    assert.equal(order.notional, 100.0004);
  });

  it('fails closed when the venue minimum exceeds the Axodus hard ceiling', () => {
    const rules = deriveRuntimeVenueRules(exchangeInfo);
    assert.throws(
      () => deriveMinimumValidLimitOrder(rules, 50000, 99, 'ax-val04b-002'),
      /hard notional ceiling/,
    );
  });

  it('keeps the external execution gate closed by default and rejects submission', () => {
    const harness = new Val04BPreCredentialHarness();
    const result = harness.prepare({
      exchangeInfo,
      referencePrice: 50000,
      clientOrderId: 'ax-val04b-003',
      maxOrderNotional: 250,
      credentialCapability: 'ABSENT',
    });
    assert.equal(result.passed, true);
    assert.equal(result.externalExecutionGate, 'CLOSED');
    assert.equal(result.privateCallsMade, false);
    assert.equal(result.websocketUsed, false);
    assert.throws(() => harness.assertNoSubmission(), /gate is CLOSED/);
  });

  it('rejects any credential capability during pre-credential preparation', () => {
    const harness = new Val04BPreCredentialHarness();
    const result = harness.prepare({
      exchangeInfo,
      referencePrice: 50000,
      clientOrderId: 'ax-val04b-004',
      maxOrderNotional: 250,
      credentialCapability: 'PRESENT_BUT_NOT_AUTHORIZED',
    });
    assert.equal(result.passed, false);
    assert.match(result.failures.join(' '), /not admitted during the pre-credential gate/);
  });

  it('requires an explicit approval token before the gate can open', () => {
    const gate = new ExternalExecutionGate();
    assert.equal(gate.getState(), 'CLOSED');
    assert.throws(() => gate.open({ approval: 'wrong' }), /explicit VAL-04B approval token/);
    gate.open({ approval: 'VAL-04B-EXTERNAL-EXECUTION-APPROVED' });
    assert.equal(gate.getState(), 'OPEN');
  });

  it('uses only the public exchange-info path and preserves finite timeout', async () => {
    const calls = [];
    const result = await verifyPublicExchangeInfo({
      async get(path, timeoutMs) {
        calls.push({ path, timeoutMs });
        return { status: 200, async json() { return exchangeInfo; } };
      },
    }, 3000);
    assert.equal(result.symbols[0].symbol, 'BTCUSDT');
    assert.deepEqual(calls, [{ path: '/fapi/v1/exchangeInfo', timeoutMs: 3000 }]);
  });

  it('rejects malformed or unavailable public exchange-info without private fallback', async () => {
    await assert.rejects(
      verifyPublicExchangeInfo({ async get() { return { status: 503, async json() { return {}; } }; } }),
      /HTTP 503/,
    );
  });
});
