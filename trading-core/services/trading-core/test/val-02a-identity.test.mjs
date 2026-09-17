import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HummingbotHttpExecutionProvider,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import { ExecutionProviderBoundaryError } from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';

const baseline = {
  condorRevision: 'd89e74f2e3e273bea102c64e4977118e6a88084f',
  apiClientRevision: 'dae015a3c513879ed06a55cf2b2c10e5772c0962',
  apiClientVersion: 'v1.5.9',
  apiServerRevision: '2494e847538bb7b819495cbc30eb4ef828feaacd',
};

function request(overrides = {}) {
  return {
    requestId: 'req-val-02a',
    intentId: 'intent-val-02a',
    correlationId: 'corr-val-02a',
    providerId: 'hummingbot-http',
    market: 'BTC-USDT',
    side: 'buy',
    orderType: 'limit',
    quantity: '0.25',
    price: '100',
    authorization: {
      authorizationId: 'auth-val-02a',
      policyVersion: 'risk-v1',
      approvedAt: '2026-09-17T00:00:00.000Z',
    },
    ...overrides,
  };
}

function createProvider(
  transport,
  auth = { getHeaders: async () => ({ authorization: 'Basic test' }) },
  dependencyBaseline = baseline,
) {
  return new HummingbotHttpExecutionProvider({
    accountName: 'axodus-paper',
    connectorName: 'binance_paper_trade',
    transport,
    auth,
    dependencyBaseline,
  });
}

function captureTransport() {
  const calls = [];
  return {
    calls,
    transport: {
      async post(path, body, headers) {
        calls.push({ path, body, headers });
        return { status: 201, body: { order_id: 'hb-order-id', status: 'submitted' } };
      },
    },
  };
}

describe('VAL-02A: Offline End-to-End Execution Identity Validation', () => {

  // ─── 12.1 Axodus → Adapter: exact propagation ───
  describe('12.1 Axodus → Adapter identity propagation', () => {
    it('propagates caller-provided clientOrderId exactly into HTTP body', async () => {
      const { calls, transport } = captureTransport();
      const provider = createProvider(transport);
      const requestWithId = request({ clientOrderId: 'axodus-attempt-001' });
      await provider.executeOrder(requestWithId);
      assert.equal(calls[0].body.client_order_id, 'axodus-attempt-001');
    });

    it('omits client_order_id from HTTP body when not provided', async () => {
      const { calls, transport } = captureTransport();
      const provider = createProvider(transport);
      await provider.executeOrder(request());
      assert.equal(calls[0].body.client_order_id, undefined);
    });
  });

  // ─── 12.8 Multiple Attempts ───
  describe('12.8 Multiple submission attempts carry distinct identities', () => {
    it('two requests with distinct clientOrderIds produce distinct HTTP payloads', async () => {
      const { calls, transport } = captureTransport();
      const provider = createProvider(transport);
      await provider.executeOrder(request({ clientOrderId: 'attempt-1', requestId: 'r1' }));
      await provider.executeOrder(request({ clientOrderId: 'attempt-2', requestId: 'r2' }));
      assert.equal(calls[0].body.client_order_id, 'attempt-1');
      assert.equal(calls[1].body.client_order_id, 'attempt-2');
      assert.notEqual(calls[0].body.client_order_id, calls[1].body.client_order_id);
    });
  });

  // ─── 12.9 Ambiguous submission / PROVIDER_EXECUTION_UNKNOWN ───
  describe('12.9 Ambiguous submission preserves UNKNOWN without retry', () => {
    it('transport timeout yields PROVIDER_EXECUTION_UNKNOWN and no retry', async () => {
      let calls = 0;
      const provider = createProvider({
        async post() {
          calls += 1;
          throw new Error('request timed out');
        },
      });
      await assert.rejects(
        () => provider.executeOrder(request({ clientOrderId: 'axodus-unknown-test' })),
        (error) => error instanceof ExecutionProviderBoundaryError
          && error.failure.code === 'PROVIDER_EXECUTION_UNKNOWN'
          && error.failure.retryable === false,
      );
      assert.equal(calls, 1, 'No automatic retry should have occurred');
    });
  });

  // ─── 12.11 Existing Execution Regression ───
  describe('12.11 IMP-01 execution behavior regression', () => {
    it('maps valid request without clientOrderId correctly (IMP-01 baseline)', async () => {
      const { calls, transport } = captureTransport();
      const provider = createProvider(transport);
      const result = await provider.executeOrder(request());
      assert.deepEqual(result, { requestId: 'req-val-02a', providerOrderId: 'hb-order-id', status: 'submitted' });
      assert.deepEqual(calls[0].body, {
        account_name: 'axodus-paper',
        connector_name: 'binance_paper_trade',
        trading_pair: 'BTC-USDT',
        trade_type: 'BUY',
        amount: 0.25,
        order_type: 'LIMIT',
        price: 100,
      });
    });

    it('preserves authorization injection', async () => {
      const authContexts = [];
      const provider = createProvider(
        { post: async () => ({ status: 201, body: { order_id: 'hb', status: 'submitted' } }) },
        {
          async getHeaders(ctx) {
            authContexts.push(ctx);
            return { authorization: 'Basic injected' };
          },
        },
      );
      await provider.executeOrder(request());
      assert.deepEqual(authContexts, [{ correlationId: 'corr-val-02a', intentId: 'intent-val-02a' }]);
    });

    it('4xx rejection still maps to PROVIDER_REJECTED', async () => {
      const provider = createProvider({
        async post() { return { status: 422, body: { error_code: 'BAD' } }; },
      });
      await assert.rejects(
        () => provider.executeOrder(request()),
        (error) => error instanceof ExecutionProviderBoundaryError
          && error.failure.code === 'PROVIDER_REJECTED'
          && error.failure.retryable === false,
      );
    });

    it('5xx failure still maps to PROVIDER_UNAVAILABLE retryable', async () => {
      const provider = createProvider({
        async post() { return { status: 503, body: {} }; },
      });
      await assert.rejects(
        () => provider.executeOrder(request()),
        (error) => error instanceof ExecutionProviderBoundaryError
          && error.failure.code === 'PROVIDER_UNAVAILABLE'
          && error.failure.retryable === true,
      );
    });
  });

  // ─── 12.12 Market Data Regression ───
  describe('12.12 Market-data contract isolation', () => {
    it('HummingbotHttpExecutionProvider has no market-data methods', () => {
      const provider = createProvider({ post: async () => ({ status: 201, body: {} }) });
      assert.equal('getOrderBook' in provider, false);
      assert.equal('getTickerPrice' in provider, false);
      assert.equal('subscribe' in provider, false);
    });
  });

  // ─── 12.13 WebSocket Isolation ───
  describe('12.13 WebSocket isolation', () => {
    it('no WebSocket execution path exists on the adapter', () => {
      const provider = createProvider({ post: async () => ({ status: 201, body: {} }) });
      assert.equal('connectWebSocket' in provider, false);
      assert.equal('ws' in provider, false);
      assert.equal('stream' in provider, false);
    });
  });

  // ─── 12.6 exchange_order_id coexistence ───
  describe('12.6 Exchange ID does not corrupt client order ID in adapter response', () => {
    it('response with exchange-generated order_id preserves the caller identity in the request', async () => {
      const { calls, transport } = captureTransport();
      const provider = createProvider(transport);
      const req = request({ clientOrderId: 'axodus-coid-persist' });
      const result = await provider.executeOrder(req);
      // The adapter returns providerOrderId (the exchange ID) without touching the caller's client identity
      assert.equal(result.providerOrderId, 'hb-order-id');
      // The caller identity was sent in the request payload
      assert.equal(calls[0].body.client_order_id, 'axodus-coid-persist');
    });
  });
});

