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
    requestId: 'req-01b-1',
    intentId: 'intent-01b-1',
    correlationId: 'corr-01b-1',
    providerId: 'hummingbot-http',
    market: 'BTC-USDT',
    side: 'buy',
    orderType: 'limit',
    quantity: '0.25',
    price: '100',
    authorization: {
      authorizationId: 'auth-01b-1',
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

describe('IMP-01B Hummingbot HTTP adapter', () => {
  it('maps a valid Axodus request to the admitted HTTP order surface', async () => {
    const calls = [];
    const provider = createProvider({
      async post(path, body, headers) {
        calls.push({ path, body, headers });
        return { status: 201, body: { order_id: 'hb-order-1', status: 'submitted' } };
      },
    });

    const result = await provider.executeOrder(request());

    assert.deepEqual(result, { requestId: 'req-01b-1', providerOrderId: 'hb-order-1', status: 'submitted' });
    assert.deepEqual(calls[0].path, '/trading/orders');
    assert.deepEqual(calls[0].body, {
      account_name: 'axodus-paper',
      connector_name: 'binance_paper_trade',
      trading_pair: 'BTC-USDT',
      trade_type: 'BUY',
      amount: 0.25,
      order_type: 'LIMIT',
      price: 100,
    });
    assert.equal(calls[0].headers['x-axodus-correlation-id'], 'corr-01b-1');
    assert.equal(calls[0].headers.authorization, 'Basic test');
  });

  it('maps a valid upstream response to Axodus semantics', async () => {
    const provider = createProvider({
      async post() {
        return {
          status: 201,
          body: {
            order_id: 'hb-order-2',
            status: 'accepted',
            account_name: 'upstream-only',
            executor: { id: 'must-not-leak' },
          },
        };
      },
    });
    const serializedRequest = JSON.parse(JSON.stringify(request({ orderType: 'market', price: undefined })));
    assert.deepEqual(await provider.executeOrder(serializedRequest), {
      requestId: 'req-01b-1',
      providerOrderId: 'hb-order-2',
      status: 'accepted',
    });
  });

  it('maps a non-retryable upstream 4xx rejection without leaking upstream errors', async () => {
    const provider = createProvider({
      async post() {
        return { status: 422, body: { error_code: 'INVALID_ORDER', detail: 'upstream detail' } };
      },
    });
    await assert.rejects(
      () => provider.executeOrder(request()),
      (error) => error instanceof ExecutionProviderBoundaryError
        && error.failure.code === 'PROVIDER_REJECTED'
        && error.failure.upstreamStatus === 422
        && error.failure.upstreamCode === 'INVALID_ORDER'
        && error.failure.retryable === false
        && !('detail' in error.failure),
    );
  });

  it('maps upstream HTTP failures to a typed retryable Axodus failure', async () => {
    const provider = createProvider({
      async post() {
        return { status: 503, body: { code: 'SERVICE_UNAVAILABLE' } };
      },
    });
    await assert.rejects(
      () => provider.executeOrder(request()),
      (error) => error instanceof ExecutionProviderBoundaryError
        && error.failure.code === 'PROVIDER_UNAVAILABLE'
        && error.failure.upstreamStatus === 503
        && error.failure.upstreamCode === 'SERVICE_UNAVAILABLE'
        && error.failure.retryable === true,
    );
  });

  it('preserves unknown execution state after timeout without blindly retrying', async () => {
    let calls = 0;
    const provider = createProvider({
      async post() {
        calls += 1;
        throw new Error('request timed out');
      },
    });
    await assert.rejects(
      () => provider.executeOrder(request()),
      (error) => error instanceof ExecutionProviderBoundaryError
        && error.failure.code === 'PROVIDER_EXECUTION_UNKNOWN'
        && error.failure.retryable === false,
    );
    assert.equal(calls, 1);
  });

  it('preserves unknown execution state after a non-timeout transport failure', async () => {
    let calls = 0;
    const provider = createProvider({
      async post() {
        calls += 1;
        throw new Error('socket closed after request write');
      },
    });
    await assert.rejects(
      () => provider.executeOrder(request()),
      (error) => error instanceof ExecutionProviderBoundaryError
        && error.failure.code === 'PROVIDER_EXECUTION_UNKNOWN'
        && error.failure.retryable === false,
    );
    assert.equal(calls, 1);
  });

  it('injects authorization through the boundary without passing credentials to the provider', async () => {
    const authContexts = [];
    const provider = createProvider(
      { post: async () => ({ status: 201, body: { order_id: 'hb-order-auth', status: 'submitted' } }) },
      {
        async getHeaders(context) {
          authContexts.push(context);
          return { authorization: 'Basic injected-at-boundary' };
        },
      },
    );

    await provider.executeOrder(request());

    assert.deepEqual(authContexts, [{ correlationId: 'corr-01b-1', intentId: 'intent-01b-1' }]);
    assert.equal(Object.prototype.hasOwnProperty.call(provider, 'username'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(provider, 'password'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(provider, 'apiKey'), false);
  });

  it('maps malformed success responses to a typed protocol failure', async () => {
    const provider = createProvider({
      async post() {
        return { status: 201, body: { status: 'submitted' } };
      },
    });
    await assert.rejects(
      () => provider.executeOrder(request()),
      (error) => error instanceof ExecutionProviderBoundaryError
        && error.failure.code === 'PROVIDER_PROTOCOL_ERROR'
        && error.failure.retryable === false,
    );
  });

  it('does not expose a WebSocket execution path', () => {
    const provider = createProvider({ post: async () => ({ status: 201, body: {} }) });
    assert.equal('connectWebSocket' in provider, false);
    assert.equal('ws' in provider, false);
  });

  it('rejects capabilities outside the admitted boundary before HTTP', async () => {
    let called = false;
    const provider = createProvider({
      async post() {
        called = true;
        return { status: 201, body: { order_id: 'unexpected', status: 'submitted' } };
      },
    });
    await assert.rejects(
      () => provider.executeOrder(request({ orderType: 'stop' })),
      (error) => error instanceof ExecutionProviderBoundaryError && error.failure.code === 'INVALID_REQUEST',
    );
    assert.equal(called, false);
  });

  it('rejects dependency drift before any request can cross the boundary', () => {
    assert.throws(
      () => createProvider({ post: async () => ({ status: 201, body: {} }) }, undefined, {
        ...baseline,
        apiClientVersion: 'v-next',
      }),
      /client version v-next/,
    );
  });
});
