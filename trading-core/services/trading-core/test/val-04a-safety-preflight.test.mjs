import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TradingExternalSafetyPreflightPolicy,
  HummingbotHttpExecutionProvider,
  AXODUS_HUMMINGBOT_ADMITTED_TRANSPORTS,
  isAdmittedHummingbotTransport,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

describe('VAL-04 Phase A — External Safety Preflight & Governance Freeze', () => {
  const policy = new TradingExternalSafetyPreflightPolicy();

  const baseConfig = {
    environment: 'testnet',
    allowedInstruments: ['BTC-USDT', 'ETH-USDT'],
    maxOrderNotional: 1000,
    maxTotalRunNotional: 5000,
    maxOutstandingOrders: 3,
    tenantId: 'tenant-val04-alpha',
    runSessionId: 'session-val04-001',
    killSwitchActive: false,
  };

  const baseOrder = {
    instrument: 'BTC-USDT',
    quantity: 0.01,
    price: 50000, // Notional: 500
    clientOrderId: 'axodus-val04-order-1',
    tenantId: 'tenant-val04-alpha',
    runSessionId: 'session-val04-001',
  };

  it('1. Environment Admission: accepts testnet, sandbox, paper and rejects mainnet / production', () => {
    // Admitted environments
    for (const env of ['testnet', 'sandbox', 'paper']) {
      const res = policy.evaluate({
        config: { ...baseConfig, environment: env },
        order: { ...baseOrder },
        currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
      });
      assert.equal(res.passed, true);
    }

    // Rejected environments
    for (const env of ['mainnet', 'production', 'live', 'prod']) {
      const res = policy.evaluate({
        config: { ...baseConfig, environment: env },
        order: { ...baseOrder },
        currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
      });
      assert.equal(res.passed, false);
      assert.equal(res.violationCode, 'ENVIRONMENT_REJECTED');
      assert.match(res.reason, /not admitted for external preflight/);
    }
  });

  it('2. Credential-Capability Policy: strictly rejects withdrawal and transfer scopes (zero-withdrawal)', () => {
    // Allowed scopes
    const allowedRes = policy.evaluate({
      config: { ...baseConfig },
      order: { ...baseOrder },
      currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
      credentialScopes: ['read-only', 'trade', 'spot-trading'],
    });
    assert.equal(allowedRes.passed, true);

    // Forbidden scopes
    for (const badScope of ['withdraw', 'WITHDRAWAL', 'transfer', 'universal_transfer']) {
      const rejectedRes = policy.evaluate({
        config: { ...baseConfig },
        order: { ...baseOrder },
        currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
        credentialScopes: ['read-only', badScope],
      });
      assert.equal(rejectedRes.passed, false);
      assert.equal(rejectedRes.violationCode, 'CREDENTIAL_FORBIDDEN_SCOPE');
      assert.match(rejectedRes.reason, /Forbidden credential scope/);
    }
  });

  it('3. Instrument Allowlist: permits approved trading pairs and rejects unlisted instruments', () => {
    const validRes = policy.evaluate({
      config: { ...baseConfig },
      order: { ...baseOrder, instrument: 'ETH-USDT' },
      currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
    });
    assert.equal(validRes.passed, true);

    const invalidRes = policy.evaluate({
      config: { ...baseConfig },
      order: { ...baseOrder, instrument: 'DOGE-USDT' },
      currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
    });
    assert.equal(invalidRes.passed, false);
    assert.equal(invalidRes.violationCode, 'INSTRUMENT_NOT_ALLOWED');
    assert.match(invalidRes.reason, /not on the admitted preflight allowlist/);
  });

  it('4. Hard Limits — Per-order notional ceiling: enforces strict ceiling and rejects oversized orders', () => {
    // 0.01 * 50000 = 500 (within limit 1000)
    const validRes = policy.evaluate({
      config: { ...baseConfig, maxOrderNotional: 1000 },
      order: { ...baseOrder, quantity: 0.01, price: 50000 },
      currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
    });
    assert.equal(validRes.passed, true);

    // 0.03 * 50000 = 1500 (exceeds limit 1000)
    const exceededRes = policy.evaluate({
      config: { ...baseConfig, maxOrderNotional: 1000 },
      order: { ...baseOrder, quantity: 0.03, price: 50000 },
      currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
    });
    assert.equal(exceededRes.passed, false);
    assert.equal(exceededRes.violationCode, 'MAX_ORDER_NOTIONAL_EXCEEDED');
    assert.match(exceededRes.reason, /exceeds maximum allowed order ceiling/);
  });

  it('5. Hard Limits — Total run notional ceiling: prevents cumulative exposure from exceeding budget', () => {
    // Current accumulated: 4600. New order: 500. Total = 5100 > 5000 limit.
    const res = policy.evaluate({
      config: { ...baseConfig, maxTotalRunNotional: 5000 },
      order: { ...baseOrder, quantity: 0.01, price: 50000 },
      currentRunState: { accumulatedNotional: 4600, activeOrders: new Set() },
    });
    assert.equal(res.passed, false);
    assert.equal(res.violationCode, 'MAX_TOTAL_NOTIONAL_EXCEEDED');
    assert.match(res.reason, /exceeds maximum run ceiling/);
  });

  it('6. Hard Limits — Maximum outstanding concurrent orders: enforces concurrency cap', () => {
    const activeOrders = new Set(['order-1', 'order-2', 'order-3']);
    // maxOutstandingOrders is 3. Active is already 3.
    const res = policy.evaluate({
      config: { ...baseConfig, maxOutstandingOrders: 3 },
      order: { ...baseOrder, clientOrderId: 'order-4' },
      currentRunState: { accumulatedNotional: 1000, activeOrders },
    });
    assert.equal(res.passed, false);
    assert.equal(res.violationCode, 'MAX_OUTSTANDING_ORDERS_EXCEEDED');
    assert.match(res.reason, /reached the maximum allowed limit/);
  });

  it('7. Duplicate / Replay Protection: rejects submission when clientOrderId is already active', () => {
    const activeOrders = new Set(['order-1', 'order-2']);
    const res = policy.evaluate({
      config: { ...baseConfig },
      order: { ...baseOrder, clientOrderId: 'order-1' },
      currentRunState: { accumulatedNotional: 500, activeOrders },
    });
    assert.equal(res.passed, false);
    assert.equal(res.violationCode, 'DUPLICATE_CLIENT_ORDER_ID');
    assert.match(res.reason, /Duplicate active clientOrderId/);
  });

  it('8. Run Session Correlation: ensures order belongs strictly to the active run session', () => {
    const res = policy.evaluate({
      config: { ...baseConfig, runSessionId: 'session-val04-current' },
      order: { ...baseOrder, runSessionId: 'session-val04-stale' },
      currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
    });
    assert.equal(res.passed, false);
    assert.equal(res.violationCode, 'RUN_SESSION_MISMATCH');
    assert.match(res.reason, /Run session mismatch/);
  });

  it('9. Tenant Ownership Isolation: prevents cross-tenant execution pollution', () => {
    const res = policy.evaluate({
      config: { ...baseConfig, tenantId: 'tenant-a' },
      order: { ...baseOrder, tenantId: 'tenant-b' },
      currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
    });
    assert.equal(res.passed, false);
    assert.equal(res.violationCode, 'TENANT_MISMATCH');
    assert.match(res.reason, /Tenant mismatch/);
  });

  it('10. Kill Switch / Emergency Abort: immediately suspends dispatch when triggered', () => {
    const res = policy.evaluate({
      config: { ...baseConfig, killSwitchActive: true },
      order: { ...baseOrder },
      currentRunState: { accumulatedNotional: 0, activeOrders: new Set() },
    });
    assert.equal(res.passed, false);
    assert.equal(res.violationCode, 'KILL_SWITCH_ACTIVE');
    assert.match(res.reason, /Kill switch is active/);
  });

  it('11. Deterministic Cleanup Preflight: cleanly recovers and lists all active orders for cancellation', () => {
    const active = new Set(['ord-alpha', 'ord-beta', 'ord-gamma']);
    const cleanup = policy.performDeterministicCleanup(active);

    assert.equal(cleanup.cleanupCompleted, true);
    assert.deepEqual(cleanup.ordersToCancel, ['ord-alpha', 'ord-beta', 'ord-gamma']);
    assert.equal(active.size, 0);
  });

  it('12. WebSocket Independence: validates that external preflight relies solely on HTTP transport', () => {
    assert.deepEqual(AXODUS_HUMMINGBOT_ADMITTED_TRANSPORTS, ['http']);
    assert.equal(isAdmittedHummingbotTransport('http'), true);
    assert.equal(isAdmittedHummingbotTransport('websocket'), false);
  });
});

