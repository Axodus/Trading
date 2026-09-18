import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VAL_04B2_APPROVAL_TOKEN,
  VAL_04B2_BASE_URL,
  VAL_04B2_ENVIRONMENT,
  VAL_04B2_EXCHANGE_INFO_PATH,
  VAL_04B2_OPEN_ORDERS_PATH,
  VAL_04B2_ORDER_PATH,
  VAL_04B2_POSITION_RISK_PATH,
  VAL_04B2_PREMIUM_INDEX_PATH,
  VAL_04B2_SYMBOL,
  Val04B2BoundaryError,
  Val04B2ControlledOrderHarness,
  generateVal04B2ClientOrderId,
  signVal04B2Query,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function mockExchangeInfo() {
  return {
    timezone: 'UTC',
    serverTime: 1700000000000,
    symbols: [
      {
        symbol: 'BTCUSDT',
        pair: 'BTCUSDT',
        contractType: 'PERPETUAL',
        status: 'TRADING',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        marginAsset: 'USDT',
        pricePrecision: 2,
        quantityPrecision: 3,
        filters: [
          {
            filterType: 'PRICE_FILTER',
            minPrice: '0.10',
            maxPrice: '1000000',
            tickSize: '0.10',
          },
          {
            filterType: 'LOT_SIZE',
            minQty: '0.001',
            maxQty: '1000',
            stepSize: '0.001',
          },
          {
            filterType: 'MIN_NOTIONAL',
            notional: '5.0',
          },
        ],
      },
    ],
  };
}

function mockSource(scopes = ['account-info', 'futures-trading']) {
  return {
    metadata() {
      return {
        environment: 'binance_perpetual_testnet',
        providerId: 'binance',
        scopes,
        vaultRefId: 'vault-testnet-b2',
      };
    },
    async resolveEphemeralMaterial() {
      return { apiKey: 'mock-testnet-key', apiSecret: 'mock-testnet-secret' };
    },
  };
}

test('Val04B2 helper functions generate valid clientOrderId and signatures', async () => {
  const cid = generateVal04B2ClientOrderId(1700000000000);
  assert.ok(cid.startsWith('axd_v04b2_1700000000000_'));
  assert.ok(cid.length <= 32);

  const signed = await signVal04B2Query({ symbol: 'BTCUSDT', timestamp: '1700000000000' }, 'my-secret');
  assert.equal(signed.symbol, 'BTCUSDT');
  assert.equal(signed.timestamp, '1700000000000');
  assert.equal(typeof signed.signature, 'string');
  assert.equal(signed.signature.length, 64);
});

test('Val04B2 executes full 7-phase controlled order lifecycle under explicit approval token', async () => {
  const calls = [];
  let submittedClientOrderId = '';

  const mockTransport = {
    async get(url, query, headers, timeoutMs) {
      calls.push({ method: 'GET', url, query, headers, timeoutMs });
      if (url.endsWith(VAL_04B2_EXCHANGE_INFO_PATH)) {
        return {
          status: 200,
          async json() { return mockExchangeInfo(); },
        };
      }
      if (url.endsWith(VAL_04B2_PREMIUM_INDEX_PATH)) {
        return {
          status: 200,
          async json() {
            return {
              symbol: 'BTCUSDT',
              markPrice: '50000.00',
            };
          },
        };
      }
      if (url.endsWith(VAL_04B2_ORDER_PATH)) {
        assert.equal(query.origClientOrderId, submittedClientOrderId);
        const isTerminalLookup = calls.filter((c) => c.method === 'DELETE').length > 0;
        return {
          status: 200,
          async json() {
            return {
              symbol: 'BTCUSDT',
              orderId: 987654321,
              clientOrderId: submittedClientOrderId,
              price: '40000.00',
              origQty: '0.001',
              executedQty: '0.000',
              status: isTerminalLookup ? 'CANCELED' : 'NEW',
              timeInForce: 'GTC',
              type: 'LIMIT',
              side: 'BUY',
            };
          },
        };
      }
      if (url.endsWith(VAL_04B2_OPEN_ORDERS_PATH)) {
        return {
          status: 200,
          async json() { return []; },
        };
      }
      if (url.endsWith(VAL_04B2_POSITION_RISK_PATH)) {
        return {
          status: 200,
          async json() { return [{ symbol: 'BTCUSDT', positionAmt: '0.000' }]; },
        };
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    },
    async post(url, query, headers, timeoutMs) {
      calls.push({ method: 'POST', url, query, headers, timeoutMs });
      if (url.endsWith(VAL_04B2_ORDER_PATH)) {
        submittedClientOrderId = query.newClientOrderId;
        return {
          status: 200,
          async json() {
            return {
              symbol: 'BTCUSDT',
              orderId: 987654321,
              clientOrderId: submittedClientOrderId,
              status: 'NEW',
              price: query.price,
              origQty: query.quantity,
              type: 'LIMIT',
              side: 'BUY',
            };
          },
        };
      }
      throw new Error(`Unexpected POST URL: ${url}`);
    },
    async delete(url, query, headers, timeoutMs) {
      calls.push({ method: 'DELETE', url, query, headers, timeoutMs });
      if (url.endsWith(VAL_04B2_ORDER_PATH)) {
        assert.equal(query.origClientOrderId, submittedClientOrderId);
        return {
          status: 200,
          async json() {
            return {
              symbol: 'BTCUSDT',
              orderId: 987654321,
              clientOrderId: submittedClientOrderId,
              status: 'CANCELED',
            };
          },
        };
      }
      throw new Error(`Unexpected DELETE URL: ${url}`);
    },
  };

  const harness = new Val04B2ControlledOrderHarness(
    mockSource(),
    mockTransport,
    VAL_04B2_BASE_URL,
    5000,
    () => 170000000000,
  );

  const result = await harness.executeControlledOrderLifecycle({
    approval: VAL_04B2_APPROVAL_TOKEN,
    priceDiscountFactor: 0.8,
    maxOrderNotional: 250,
  });

  assert.equal(result.environment, VAL_04B2_ENVIRONMENT);
  assert.equal(result.symbol, VAL_04B2_SYMBOL);
  assert.equal(result.ordersSubmitted, 1);
  assert.equal(result.blindRetries, 0);
  assert.equal(result.preflightPassed, true);
  assert.equal(result.identityPreserved, true);
  assert.equal(result.submissionStatus, 'NEW');
  assert.equal(result.lookupStatusAfterSubmit, 'NEW');
  assert.equal(result.cancellationStatus, 'CANCELED');
  assert.equal(result.terminalReconciliationStatus, 'CANCELED');
  assert.equal(result.residualActiveOrdersCount, 0);
  assert.equal(result.residualPositionAmount, 0);
  assert.equal(result.cleanupPassed, true);
  assert.equal(result.websocketUsed, false);
  assert.equal(result.mainnetExcluded, true);
  assert.equal(result.secretsExposed, false);

  const postCalls = calls.filter((c) => c.method === 'POST');
  assert.equal(postCalls.length, 1);
  const deleteCalls = calls.filter((c) => c.method === 'DELETE');
  assert.equal(deleteCalls.length, 1);
});

test('Val04B2 fails closed if approval token is missing or invalid', async () => {
  const harness = new Val04B2ControlledOrderHarness(
    mockSource(),
    { async get() {}, async post() {}, async delete() {} },
  );

  // @ts-expect-error test invalid approval
  await assert.rejects(() => harness.executeControlledOrderLifecycle({ approval: 'INVALID' }), Val04B2BoundaryError);
  // @ts-expect-error test missing approval
  await assert.rejects(() => harness.executeControlledOrderLifecycle({}), Val04B2BoundaryError);
});

test('Val04B2 fails closed on identity mismatch during exact lookup', async () => {
  const mockTransport = {
    async get(url) {
      if (url.endsWith(VAL_04B2_EXCHANGE_INFO_PATH)) {
        return { status: 200, async json() { return mockExchangeInfo(); } };
      }
      if (url.endsWith(VAL_04B2_PREMIUM_INDEX_PATH)) {
        return {
          status: 200,
          async json() {
            return {
              symbol: 'BTCUSDT',
              markPrice: '50000.00',
            };
          },
        };
      }
      if (url.endsWith(VAL_04B2_ORDER_PATH)) {
        return {
          status: 200,
          async json() {
            return {
              symbol: 'BTCUSDT',
              orderId: 987654321,
              clientOrderId: 'mismatched_client_order_id',
              status: 'NEW',
            };
          },
        };
      }
      return { status: 200, async json() { return []; } };
    },
    async post() {
      return {
        status: 200,
        async json() {
          return { symbol: 'BTCUSDT', orderId: 987654321, status: 'NEW' };
        },
      };
    },
    async delete() {
      return { status: 200, async json() { return { status: 'CANCELED' }; } };
    },
  };

  const harness = new Val04B2ControlledOrderHarness(
    mockSource(),
    mockTransport,
    VAL_04B2_BASE_URL,
    5000,
    () => 170000000000,
  );

  await assert.rejects(
    () => harness.executeControlledOrderLifecycle({ approval: VAL_04B2_APPROVAL_TOKEN }),
    (err) => err instanceof Val04B2BoundaryError && err.message.includes('Identity continuity broken'),
  );
});

test('Val04B2 fails closed on transport network failure during submit without resubmitting', async () => {
  let submitAttempts = 0;
  const mockTransport = {
    async get(url) {
      if (url.endsWith(VAL_04B2_EXCHANGE_INFO_PATH)) {
        return { status: 200, async json() { return mockExchangeInfo(); } };
      }
      if (url.endsWith(VAL_04B2_PREMIUM_INDEX_PATH)) {
        return {
          status: 200,
          async json() {
            return {
              symbol: 'BTCUSDT',
              markPrice: '50000.00',
            };
          },
        };
      }
      return { status: 200, async json() { return []; } };
    },
    async post() {
      submitAttempts++;
      throw new Error('ETIMEDOUT');
    },
    async delete() {
      return { status: 200, async json() { return { status: 'CANCELED' }; } };
    },
  };

  const harness = new Val04B2ControlledOrderHarness(
    mockSource(),
    mockTransport,
    VAL_04B2_BASE_URL,
    5000,
    () => 170000000000,
  );

  await assert.rejects(
    () => harness.executeControlledOrderLifecycle({ approval: VAL_04B2_APPROVAL_TOKEN }),
    (err) =>
      err instanceof Val04B2BoundaryError &&
      err.message.includes('ambiguous network failure') &&
      err.message.includes('Resubmission prohibited'),
  );
  assert.equal(submitAttempts, 1);
});
