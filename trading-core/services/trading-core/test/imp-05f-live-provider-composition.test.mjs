import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ContinuousBinanceTestnetProvider,
  ContinuousExecutionRuntime,
  ContinuousIntentAdmissionService,
  ContinuousKillSwitch,
  ContinuousObservabilityCollector,
  ContinuousOrderRecoveryService,
  ContinuousPositionReconciliationService,
  ContinuousRiskEnvelopeService,
  DurableCexExecutionLifecycleService,
  InMemoryPostgresClient,
  PostgresDurableExecutionRepository,
  PostgresVal05SessionBudgetStore,
  Val05ContinuousRunner,
  createVal05ContinuousRuntime,
  VAL_05_SESSION_ENVELOPE,
  VAL_05_EXECUTION_CONFIRMATION,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function createMockTransport(handlers = {}) {
  let getCalls = 0;
  let postCalls = 0;
  let deleteCalls = 0;
  const callLog = [];

  return {
    get getCalls() { return getCalls; },
    get postCalls() { return postCalls; },
    get deleteCalls() { return deleteCalls; },
    get callLog() { return [...callLog]; },
    async get(url, query = {}, headers = {}, timeoutMs = 5000) {
      getCalls += 1;
      callLog.push({ method: 'GET', url, query, headers });
      if (handlers.onGet) return handlers.onGet(url, query, headers);
      if (url.includes('/fapi/v1/exchangeInfo')) {
        return {
          status: 200,
          json: async () => ({
            symbols: [{
              symbol: 'BTCUSDT',
              status: 'TRADING',
              contractType: 'PERPETUAL',
              filters: [
                { filterType: 'PRICE_FILTER', tickSize: '0.10' },
                { filterType: 'LOT_SIZE', minQty: '0.001', stepSize: '0.001' },
                { filterType: 'MIN_NOTIONAL', notional: '5' },
              ],
            }],
          }),
        };
      }
      if (url.includes('/fapi/v1/premiumIndex')) {
        return {
          status: 200,
          json: async () => ({ symbol: 'BTCUSDT', markPrice: '60000.00' }),
        };
      }
      if (url.includes('/fapi/v1/openOrders')) {
        return {
          status: 200,
          json: async () => [],
        };
      }
      if (url.includes('/fapi/v2/positionRisk')) {
        return {
          status: 200,
          json: async () => [{ symbol: 'BTCUSDT', positionAmt: '0.000', positionSide: 'BOTH' }],
        };
      }
      if (url.includes('/fapi/v1/order')) {
        return {
          status: 200,
          json: async () => ({
            orderId: '987654321',
            clientOrderId: query.origClientOrderId,
            status: 'NEW',
            symbol: 'BTCUSDT',
            origQty: '0.001',
            executedQty: '0.000',
          }),
        };
      }
      return { status: 404, json: async () => ({ code: -2013, msg: 'Order does not exist' }) };
    },
    async post(url, query = {}, headers = {}, timeoutMs = 5000) {
      postCalls += 1;
      callLog.push({ method: 'POST', url, query, headers });
      if (handlers.onPost) return handlers.onPost(url, query, headers);
      return {
        status: 200,
        json: async () => ({
          orderId: '987654321',
          clientOrderId: query.newClientOrderId,
          symbol: 'BTCUSDT',
          status: 'NEW',
          origQty: query.quantity ?? '0.001',
          executedQty: '0.000',
        }),
      };
    },
    async delete(url, query = {}, headers = {}, timeoutMs = 5000) {
      deleteCalls += 1;
      callLog.push({ method: 'DELETE', url, query, headers });
      if (handlers.onDelete) return handlers.onDelete(url, query, headers);
      return {
        status: 200,
        json: async () => ({
          orderId: query.orderId ?? '987654321',
          clientOrderId: query.origClientOrderId,
          symbol: 'BTCUSDT',
          status: 'CANCELED',
          origQty: '0.001',
          executedQty: '0.000',
        }),
      };
    },
  };
}

function createMockCredentialSource(material = { apiKey: 'test-api-key', apiSecret: 'test-api-secret' }) {
  return {
    metadata() {
      return {
        environment: 'binance_perpetual_testnet',
        providerId: 'binance',
        scopes: ['account-info', 'futures-trading'],
        vaultRefId: 'env:test-credentials',
      };
    },
    async resolveEphemeralMaterial() {
      return { ...material };
    },
  };
}

function createTestHarness(transportHandlers = {}, options = {}) {
  const transport = createMockTransport(transportHandlers);
  const credentialSource = options.noCredentials ? undefined : createMockCredentialSource();
  const database = new InMemoryPostgresClient();
  const continuous = createVal05ContinuousRuntime({
    credentialSource,
    transport,
    database,
    now: () => '2026-09-18T12:00:00.000Z',
  });
  return { transport, credentialSource, database, continuous };
}

function createTestIntent(overrides = {}) {
  return {
    intentId: 'intent-val05-01',
    source: {
      type: 'agent',
      id: 'agent-continuous-test',
      correlationId: 'corr-val05-01',
    },
    market: 'BTCUSDT',
    symbol: 'BTCUSDT',
    instrument: 'BTC-USDT',
    side: 'buy',
    orderType: 'limit',
    quantity: '0.001',
    price: '50000',
    providerId: 'binance-perpetual-testnet',
    connector: 'binance-futures-testnet',
    environment: 'testnet',
    createdAt: '2026-09-18T12:00:00.000Z',
    ...overrides,
  };
}

describe('AXODUS-TRADING-IMP-05F: Continuous Live Provider Composition Integration Matrix', () => {
  it('Scenario 1: Normal accepted LIMIT submission through continuous runtime', async () => {
    const { continuous, transport } = createTestHarness();
    const intent = createTestIntent();
    const result = await continuous.admission.submitIntent(intent);

    assert.equal(result.admitted, true);
    assert.equal(result.executionResult?.status, 'SUBMITTED');
    assert.equal(result.executionResult?.providerOrderId, '987654321');
    assert.equal(result.durableAttempt?.state, 'provider-acknowledged');
    assert.equal(transport.postCalls, 1);
    assert.equal(transport.deleteCalls, 0);
  });

  it('Scenario 2: Provider rejection maps to fail-closed REJECTED state (POST = 1)', async () => {
    const { continuous, transport } = createTestHarness({
      onPost: async () => ({
        status: 400,
        json: async () => ({ code: -2010, msg: 'Account has insufficient balance' }),
      }),
    });
    const intent = createTestIntent();
    const result = await continuous.admission.submitIntent(intent);

    assert.equal(result.admitted, false);
    assert.equal(result.executionResult?.status, 'REJECTED');
    assert.equal(result.durableAttempt?.state, 'rejected');
    assert.equal(transport.postCalls, 1);
  });

  it('Scenario 3: Timeout before known response records UNKNOWN without blind retry (POST = 1)', async () => {
    const { continuous, transport } = createTestHarness({
      onPost: async () => {
        throw new Error('ETIMEDOUT while posting order');
      },
    });
    const intent = createTestIntent();
    const result = await continuous.admission.submitIntent(intent);

    assert.equal(result.admitted, true);
    assert.equal(result.executionResult?.status, 'UNKNOWN');
    assert.equal(result.executionResult?.reconciliationRequired, true);
    assert.equal(result.durableAttempt?.state, 'execution-unknown');
    assert.equal(transport.postCalls, 1);
  });

  it('Scenario 4 & 29: Response lost after provider acceptance reconciles via exact lookup (POST count = 1)', async () => {
    let postCount = 0;
    const { continuous, transport } = createTestHarness({
      onPost: async () => {
        postCount += 1;
        throw new Error('Socket hang up / connection reset by peer');
      },
      onGet: async (url, query) => {
        if (url.includes('/fapi/v1/order')) {
          return {
            status: 200,
            json: async () => ({
              orderId: 'recovered-order-777',
              clientOrderId: query.origClientOrderId,
              status: 'NEW',
              origQty: '0.001',
              executedQty: '0.000',
            }),
          };
        }
      },
    });

    const intent = createTestIntent();
    const result = await continuous.admission.submitIntent(intent);
    assert.equal(result.executionResult?.status, 'UNKNOWN');
    assert.equal(postCount, 1);
    assert.equal(transport.postCalls, 1);

    const recoveryResult = await continuous.recovery.recoverAll();
    assert.equal(recoveryResult.recoveredCount, 1);
    assert.equal(recoveryResult.outcomes[0].outcome, 'found');
    assert.equal(recoveryResult.outcomes[0].providerOrderId, 'recovered-order-777');
    assert.equal(transport.postCalls, 1); // Exact count = 1
  });

  it('Scenario 5: Exact lookup by client order ID recovers order when providerOrderId is unknown', async () => {
    const { continuous } = createTestHarness();
    const reconResult = await continuous.provider.reconcileByClientOrderId({
      attemptId: 'att-lookup-01',
      providerId: 'binance-perpetual-testnet',
      connector: 'binance-futures-testnet',
      market: 'BTCUSDT',
      executionClientOrderId: 'ax-lookup-exact-01',
      requestedAt: '2026-09-18T12:00:00.000Z',
    });

    assert.equal(reconResult.outcome, 'found');
    assert.equal(reconResult.evidence?.executionClientOrderId, 'ax-lookup-exact-01');
    assert.equal(reconResult.evidence?.providerOrderId, '987654321');
  });

  it('Scenario 6: Cancellation success transitions attempt to cancelled state', async () => {
    const { continuous, transport } = createTestHarness();
    const intent = createTestIntent();
    const admitted = await continuous.admission.submitIntent(intent);
    assert.equal(admitted.admitted, true);

    const cancelled = await continuous.runtime.cancel(intent.intentId);
    assert.equal(cancelled.state, 'cancelled');
    assert.equal(cancelled.providerOrderId, '987654321');
    assert.equal(transport.deleteCalls, 1);
  });

  it('Scenario 7: Cancellation ambiguity fails closed to cancellation-unknown', async () => {
    const { continuous } = createTestHarness({
      onDelete: async () => {
        throw new Error('Timeout waiting for cancellation ACK');
      },
    });
    const intent = createTestIntent();
    await continuous.admission.submitIntent(intent);

    const cancelled = await continuous.runtime.cancel(intent.intentId);
    assert.equal(cancelled.state, 'cancellation-unknown');
  });

  it('Scenario 8: Open orders read fetches and parses venue open orders correctly', async () => {
    const { continuous } = createTestHarness({
      onGet: async (url) => {
        if (url.includes('/fapi/v1/openOrders')) {
          return {
            status: 200,
            json: async () => [{
              symbol: 'BTCUSDT',
              orderId: '12345',
              clientOrderId: 'ax-open-order-1',
              status: 'NEW',
              side: 'BUY',
              type: 'LIMIT',
              origQty: '0.001',
              executedQty: '0.000',
              price: '50000',
            }],
          };
        }
      },
    });

    const openOrders = await continuous.provider.getOpenOrders('BTCUSDT');
    assert.equal(openOrders.length, 1);
    assert.equal(openOrders[0].clientOrderId, 'ax-open-order-1');
    assert.equal(openOrders[0].symbol, 'BTCUSDT');
  });

  it('Scenario 9: Zero position returns empty array and matches local zero position', async () => {
    const { continuous } = createTestHarness();
    const positions = await continuous.provider.getPositions('BTCUSDT');
    assert.equal(positions.length, 0);

    const recon = continuous.positionReconciliation.reconcile([], positions);
    assert.equal(recon.status, 'MATCH');
    assert.equal(recon.divergent, false);
  });

  it('Scenario 10: Non-zero position parses correctly and matches local position record', async () => {
    const { continuous } = createTestHarness({
      onGet: async (url) => {
        if (url.includes('/fapi/v2/positionRisk')) {
          return {
            status: 200,
            json: async () => [{
              symbol: 'BTCUSDT',
              positionAmt: '0.005',
              positionSide: 'LONG',
              entryPrice: '58000',
              unRealizedProfit: '10.5',
            }],
          };
        }
      },
    });

    const positions = await continuous.provider.getPositions('BTCUSDT');
    assert.equal(positions.length, 1);
    assert.equal(positions[0].quantity, '0.005');
    assert.equal(positions[0].side, 'long');

    const recon = continuous.positionReconciliation.reconcile([{
      market: 'BTCUSDT',
      symbol: 'BTCUSDT',
      side: 'long',
      quantity: '0.005',
      updatedAt: '2026-09-18T12:00:00.000Z',
    }], positions);
    assert.equal(recon.status, 'MATCH');
    assert.equal(recon.divergent, false);
  });

  it('Scenario 11: Position divergence blocks new risk admission', async () => {
    const { continuous } = createTestHarness();
    const divergence = continuous.positionReconciliation.reconcile(
      [{ market: 'BTCUSDT', symbol: 'BTCUSDT', side: 'long', quantity: '0.010', updatedAt: '2026-09-18T12:00:00.000Z' }],
      [] // Venue has zero position
    );
    assert.equal(divergence.divergent, true);

    const intent = createTestIntent();
    const result = await continuous.admission.submitIntent(intent, divergence);
    assert.equal(result.admitted, false);
    assert.equal(result.rejectionCode, 'POSITION_DIVERGENCE_UNRESOLVED');
  });

  it('Scenario 12: Stale market reference quote rejects intent (POST = 0)', async () => {
    const { continuous, transport } = createTestHarness();
    const intent = createTestIntent({
      quote: {
        symbol: 'BTCUSDT',
        price: 50000,
        timestampMs: new Date('2026-09-18T11:59:00.000Z').getTime(), // 60s old > 5s max age
      },
    });

    const result = await continuous.admission.submitIntent(intent);
    assert.equal(result.admitted, false);
    assert.equal(result.rejectionCode, 'RISK_REJECTED');
    assert.match(result.reason, /stale/i);
    assert.equal(transport.postCalls, 0);
  });

  it('Scenario 13 & 30: Persistence failure before POST produces POST count = 0', async () => {
    const brokenDb = {
      async transaction() { throw new Error('Database disk full / transaction aborted'); },
      async query() { throw new Error('Database disk full / query aborted'); },
    };
    const transport = createMockTransport();
    const continuous = createVal05ContinuousRuntime({
      credentialSource: createMockCredentialSource(),
      transport,
      database: brokenDb,
    });

    const intent = createTestIntent();
    await assert.rejects(async () => {
      await continuous.admission.submitIntent(intent);
    }, /disk full/);

    assert.equal(transport.postCalls, 0);
    assert.equal(transport.deleteCalls, 0);
  });

  it('Scenario 14: Kill switch active blocks intent admission (POST = 0)', async () => {
    const { continuous, transport } = createTestHarness();
    continuous.killSwitch.trigger('OPERATOR_STOP', 'Emergency manual stop triggered');
    assert.equal(continuous.killSwitch.isActive(), true);

    const intent = createTestIntent();
    const result = await continuous.admission.submitIntent(intent);
    assert.equal(result.admitted, false);
    assert.equal(result.rejectionCode, 'KILL_SWITCH_ACTIVE');
    assert.equal(transport.postCalls, 0);
  });

  it('Scenario 15: Risk violation (e.g. notional ceiling exceeded) blocks mutation (POST = 0)', async () => {
    const { continuous, transport } = createTestHarness();
    const intent = createTestIntent({
      quantity: '0.01', // 0.01 * 50000 = 500 USDT > 250 maxOrderNotional
    });

    const result = await continuous.admission.submitIntent(intent);
    assert.equal(result.admitted, false);
    assert.equal(result.rejectionCode, 'RISK_REJECTED');
    assert.match(result.reason, /exceeds maximum order ceiling/);
    assert.equal(transport.postCalls, 0);
  });

  it('Scenario 16: Duplicate intent returns existing execution and does not duplicate POST (POST = 1)', async () => {
    const { continuous, transport } = createTestHarness();
    const intent = createTestIntent();
    const first = await continuous.admission.submitIntent(intent);
    assert.equal(first.admitted, true);
    assert.equal(transport.postCalls, 1);

    const second = await continuous.admission.submitIntent(intent);
    assert.equal(second.admitted, true);
    assert.equal(transport.postCalls, 1); // Remains 1
  });

  it('Scenario 17: Active execution collision blocks conflicting second intent (POST = 1)', async () => {
    const { continuous, transport } = createTestHarness();
    const firstIntent = createTestIntent({ intentId: 'intent-first-01' });
    const first = await continuous.admission.submitIntent(firstIntent);
    assert.equal(first.admitted, true);
    assert.equal(transport.postCalls, 1);

    // With first execution active in runtime, second intent is blocked by collision guard
    const secondIntent = createTestIntent({ intentId: 'intent-second-02' });
    const second = await continuous.admission.submitIntent(secondIntent);
    assert.equal(second.admitted, false);
    assert.equal(second.rejectionCode, 'ACTIVE_EXECUTION_COLLISION');
    assert.equal(transport.postCalls, 1); // Still 1
  });

  it('Scenario 18: Repeated recovery calls remain idempotent', async () => {
    const { continuous, transport } = createTestHarness();
    const firstRecovery = await continuous.recovery.recoverAll();
    assert.equal(firstRecovery.recoveredCount, 0);

    const secondRecovery = await continuous.recovery.recoverAll();
    assert.equal(secondRecovery.recoveredCount, 0);
    assert.equal(transport.postCalls, 0);
  });

  it('Scenario 19 & 31: Mainnet configuration fails closed upon construction/preflight', async () => {
    assert.throws(() => {
      new ContinuousBinanceTestnetProvider(
        createMockCredentialSource(),
        createMockTransport(),
        'https://fapi.binance.com' // Prohibited mainnet URL
      );
    }, /Continuous provider admits only/);
  });

  it('Scenario 20: Observability redacts credential and secret material from details', async () => {
    const { continuous } = createTestHarness();
    const event = continuous.observability.record({
      eventType: 'INTENT_ADMITTED',
      correlationId: 'corr-sec-01',
      details: {
        apiKey: 'secret-api-key-123',
        apiSecret: 'secret-api-secret-456',
        token: 'auth-token-789',
        nested: {
          credentialMaterial: 'super-secret',
        },
        symbol: 'BTCUSDT',
      },
    });

    assert.equal(event.details.apiKey, '[REDACTED]');
    assert.equal(event.details.apiSecret, '[REDACTED]');
    assert.equal(event.details.token, '[REDACTED]');
    assert.equal(event.details.nested.credentialMaterial, '[REDACTED]');
    assert.equal(event.details.symbol, 'BTCUSDT');
  });

  it('VAL-05 Runner: Public preflight runs safely without credentials or mutation', async () => {
    const { continuous, transport } = createTestHarness({}, { noCredentials: true });
    const health = await continuous.runner.runPublicPreflight();

    assert.equal(health.mode, 'public');
    assert.equal(health.credentialsLoaded, false);
    assert.equal(health.postOrderCalls, 0);
    assert.equal(health.deleteOrderCalls, 0);
    assert.equal(health.venue.rules.symbol, 'BTCUSDT');
    assert.equal(health.venue.referencePrice, 60000);
    assert.equal(transport.postCalls, 0);
    assert.equal(transport.deleteCalls, 0);
  });

  it('VAL-05 Runner: Authenticated read-only preflight runs safely without mutation (POST = 0, DELETE = 0)', async () => {
    const { continuous, transport } = createTestHarness();
    const health = await continuous.runner.runAuthenticatedReadOnlyPreflight();

    assert.equal(health.mode, 'authenticated-read-only');
    assert.equal(health.credentialsLoaded, true);
    assert.equal(health.postOrderCalls, 0);
    assert.equal(health.deleteOrderCalls, 0);
    assert.equal(health.mutationAuthorized, false);
    assert.equal(health.failures.length, 0);
    assert.equal(transport.postCalls, 0);
    assert.equal(transport.deleteCalls, 0);
  });

  it('VAL-05 Runner: Controlled execute mode rejects without explicit confirmation gate and durable budget', async () => {
    const { continuous } = createTestHarness();
    const intent = createTestIntent();

    await assert.rejects(async () => {
      await continuous.runner.submitControlledIntent(intent, [], 'WRONG-TOKEN');
    }, /requires an explicit operational confirmation gate/);

    await assert.rejects(async () => {
      await continuous.runner.submitControlledIntent(intent, [], VAL_05_EXECUTION_CONFIRMATION);
    }, /requires durable session accounting/);
  });

  it('VAL-05 session budget: transactional durable store enforces 3 submissions and 1 active order', async () => {
    const database = new InMemoryPostgresClient();
    const store = new PostgresVal05SessionBudgetStore(database, () => '2026-09-18T12:00:00.000Z');
    const envelope = { ...VAL_05_SESSION_ENVELOPE, maxActiveExternalOrders: 1, maxOrderSubmissions: 3 };

    const first = await store.reserveSubmission('durable-session-01', envelope);
    assert.equal(first.submissions, 1);
    assert.equal(first.activeOrders, 1);
    await assert.rejects(() => store.reserveSubmission('durable-session-01', envelope), /active-order budget exhausted/);

    await store.releaseActiveOrder('durable-session-01');
    const second = await store.reserveSubmission('durable-session-01', envelope);
    assert.equal(second.submissions, 2);
    await store.releaseActiveOrder('durable-session-01');
    const third = await store.reserveSubmission('durable-session-01', envelope);
    assert.equal(third.submissions, 3);
    await store.releaseActiveOrder('durable-session-01');
    await assert.rejects(() => store.reserveSubmission('durable-session-01', envelope), /submission budget exhausted/);
  });
});
