import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BinanceConditionalProtectionAdapter,
  PositionProtectionService,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function createMockTransport(handlers = {}) {
  const calls = {
    get: [],
    post: [],
    delete: [],
  };

  return {
    calls,
    async get(url, params, headers, timeoutMs) {
      calls.get.push({ url, params, headers, timeoutMs });
      if (handlers.get) {
        return handlers.get(url, params, headers, timeoutMs);
      }
      return {
        status: 200,
        headers: {},
        json: async () => ({}),
        text: async () => '{}',
      };
    },
    async post(url, params, headers, timeoutMs) {
      calls.post.push({ url, params, headers, timeoutMs });
      if (handlers.post) {
        return handlers.post(url, params, headers, timeoutMs);
      }
      return {
        status: 200,
        headers: {},
        json: async () => ({ algoId: 888123456, clientAlgoId: params.clientAlgoId, algoStatus: 'NEW' }),
        text: async () => JSON.stringify({ algoId: 888123456, clientAlgoId: params.clientAlgoId, algoStatus: 'NEW' }),
      };
    },
    async delete(url, params, headers, timeoutMs) {
      calls.delete.push({ url, params, headers, timeoutMs });
      if (handlers.delete) {
        return handlers.delete(url, params, headers, timeoutMs);
      }
      return {
        status: 200,
        headers: {},
        json: async () => ({ algoId: params.algoId ?? 888123456, status: 'CANCELED' }),
        text: async () => JSON.stringify({ algoId: params.algoId ?? 888123456, status: 'CANCELED' }),
      };
    },
  };
}

function createMockCredentialSource() {
  return {
    async resolveEphemeralMaterial() {
      return {
        apiKey: '***',
        apiSecret: 'test-api-secret-safe-mock-value',
      };
    },
  };
}

describe('AXODUS-TRADING-IMP-TRINITY-SAFETY-01B: Venue-Resident Position Protection Tests', () => {
  it('Scenario 1: Partial Fill Invariant — requested quantity != filled quantity -> protection uses filled quantity', async () => {
    let capturedPostParams = null;
    const transport = createMockTransport({
      post: async (url, params) => {
        capturedPostParams = params;
        return {
          status: 200,
          headers: {},
          json: async () => ({ algoId: 99112233, clientAlgoId: params.clientAlgoId, algoStatus: 'NEW' }),
          text: async () => JSON.stringify({ algoId: 99112233, clientAlgoId: params.clientAlgoId, algoStatus: 'NEW' }),
        };
      },
      get: async () => ({
        status: 200,
        headers: {},
        json: async () => [{ clientAlgoId: capturedPostParams?.clientAlgoId, algoId: 99112233, type: 'STOP_MARKET', algoStatus: 'NEW' }],
        text: async () => '[]',
      }),
    });

    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);
    const service = new PositionProtectionService(adapter);

    const requestedInitialQty = '0.0050';
    const confirmedFilledQty = '0.0020'; // Partial fill

    const result = await service.armProtection({
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: confirmedFilledQty, // Must use confirmed filled quantity, NOT requested
      stopPrice: '84000.0',
      executionMode: 'QUANTITY_BOUNDED',
    });

    assert.equal(result.isFullyArmed, true);
    assert.equal(result.status, 'TRADE_FULLY_ARMED');
    assert.equal(capturedPostParams.quantity, '0.0020', 'Protection quantity must match confirmed filled quantity exactly');
    assert.notEqual(capturedPostParams.quantity, requestedInitialQty, 'Protection must never use requested quantity when fill is partial');
    assert.equal(capturedPostParams.reduceOnly, 'true', 'ONE_WAY quantity bounded must specify reduceOnly=true');
    assert.equal(capturedPostParams.closePosition, undefined, 'QUANTITY_BOUNDED must not specify closePosition');
  });

  it('Scenario 2: CLOSE_ALL Execution Mode — quantity absent from exchange submission payload', async () => {
    let capturedPostParams = null;
    const transport = createMockTransport({
      post: async (url, params) => {
        capturedPostParams = params;
        return {
          status: 200,
          headers: {},
          json: async () => ({ algoId: 99112244, clientAlgoId: params.clientAlgoId, algoStatus: 'NEW' }),
          text: async () => JSON.stringify({ algoId: 99112244, clientAlgoId: params.clientAlgoId, algoStatus: 'NEW' }),
        };
      },
      get: async () => ({
        status: 200,
        headers: {},
        json: async () => [{ clientAlgoId: capturedPostParams?.clientAlgoId, algoId: 99112244, type: 'STOP_MARKET', algoStatus: 'NEW' }],
        text: async () => '[]',
      }),
    });

    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);
    const service = new PositionProtectionService(adapter);

    const result = await service.armProtection({
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: '0.0030',
      stopPrice: '83500.0',
      executionMode: 'CLOSE_ALL',
    });

    assert.equal(result.isFullyArmed, true);
    assert.equal(capturedPostParams.closePosition, 'true', 'closePosition must be "true" for CLOSE_ALL');
    assert.equal(capturedPostParams.quantity, undefined, 'Quantity must be absent for CLOSE_ALL');
    assert.equal(capturedPostParams.reduceOnly, undefined, 'reduceOnly must be absent for CLOSE_ALL');
  });

  it('Scenario 3: Hedge Mode Validation — rejects invalid combinations before network call', async () => {
    const transport = createMockTransport();
    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);

    const invalidPlan = {
      planId: 'plan_hedge_err',
      symbol: 'BTCUSDT',
      market: 'BTCUSDT',
      providerId: 'binance-perpetual-futures',
      positionSide: 'BOTH', // Invalid for Hedge Mode
      positionMode: 'HEDGE',
      confirmedExposureQuantity: '0.001',
      rules: [],
      tradeState: 'EXPOSURE_CONFIRMED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const rule = {
      ruleId: 'rule_hedge_err',
      ruleType: 'HARD_STOP',
      executionMode: 'QUANTITY_BOUNDED',
      triggerPrice: '84000.0',
      triggerPriceSource: 'CONTRACT_PRICE',
      clientProtectionOrderId: 'axd_stp_hedge_err',
      quantity: '0.001',
      state: 'PENDING_SUBMISSION',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.throws(
      () => adapter.validateRulePreflight(rule, invalidPlan),
      /Hedge Mode requires explicit LONG or SHORT positionSide/,
      'Must fail preflight validation without network attempt',
    );

    assert.equal(transport.calls.post.length, 0, 'No HTTP calls must be made on invalid Hedge configuration');
  });

  it('Scenario 4: Flat Position Invariant — position becomes flat during protection establishment -> aborts stale protection', async () => {
    const transport = createMockTransport();
    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);
    const service = new PositionProtectionService(adapter);

    const result = await service.armProtection({
      symbol: 'SOLUSDT',
      positionSide: 'LONG',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: '0', // Position is already flat
      stopPrice: '110.0',
    });

    assert.equal(result.isFullyArmed, false);
    assert.equal(result.status, 'TERMINAL_CLOSED');
    assert.equal(result.isUnprotected, false);
    assert.equal(transport.calls.post.length, 0, 'Must not submit protective order when position is flat');
  });

  it('Scenario 5: Timeout After Submit — lookup and reconcile by clientProtectionOrderId before retry', async () => {
    let postCalls = 0;
    let getCalls = 0;
    const transport = createMockTransport({
      post: async () => {
        postCalls += 1;
        throw new Error('Socket timeout after 5000ms');
      },
      get: async (url, params) => {
        getCalls += 1;
        // In the lookup, the algo order actually succeeded on the exchange before timeout
        if (params.clientAlgoId?.startsWith('axd_stp_')) {
          return {
            status: 200,
            headers: {},
            json: async () => ({
              algoId: 777666555,
              clientAlgoId: params.clientAlgoId,
              symbol: 'ETHUSDT',
              algoStatus: 'NEW',
              triggerPrice: '2200.0',
              orderType: 'STOP_MARKET',
            }),
            text: async () => '{}',
          };
        }
        return {
          status: 200,
          headers: {},
          json: async () => [],
          text: async () => '[]',
        };
      },
    });

    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);
    const service = new PositionProtectionService(adapter);

    const result = await service.armProtection({
      symbol: 'ETHUSDT',
      positionSide: 'LONG',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: '0.05',
      stopPrice: '2200.0',
    });

    assert.equal(postCalls, 1, 'Exactly one POST submission attempt');
    assert.equal(result.isFullyArmed, true, 'Recovered into fully armed state via clientOrderId lookup');
    assert.equal(result.activeRule?.providerProtectionOrderId, '777666555');
  });

  it('Scenario 6: Unprotected Exposure & Emergency Close Command — fail-closed handling', async () => {
    const transport = createMockTransport({
      post: async () => ({
        status: 400,
        headers: {},
        json: async () => ({ code: -2010, msg: 'Stop price would trigger immediately' }),
        text: async () => JSON.stringify({ code: -2010, msg: 'Stop price would trigger immediately' }),
      }),
      get: async () => ({
        status: 200,
        headers: {},
        json: async () => [],
        text: async () => '[]',
      }),
    });

    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);
    const service = new PositionProtectionService(adapter);

    const result = await service.armProtection({
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: '0.001',
      stopPrice: '89000.0', // Erroneous stop that triggers immediately
    });

    assert.equal(result.isFullyArmed, false);
    assert.equal(result.isUnprotected, true);
    assert.equal(result.status, 'UNPROTECTED_EXPOSURE');
    assert.ok(result.emergencyCommand, 'Must issue actionable emergency command on UNPROTECTED_EXPOSURE');
    assert.equal(result.emergencyCommand.reason.includes('UNPROTECTED_EXPOSURE'), true);
  });

  it('Scenario 7: Capability Snapshot Normalization', async () => {
    const transport = createMockTransport();
    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);

    const snapshot = adapter.getCapabilitySnapshot();
    assert.equal(snapshot.providerId, 'binance-perpetual-futures');
    assert.equal(snapshot.supportsStopMarket, true);
    assert.equal(snapshot.supportsCloseAll, true);
    assert.equal(snapshot.supportsQuantityBounded, true);
    assert.deepEqual(snapshot.supportedPositionModes, ['ONE_WAY', 'HEDGE']);
  });

  it('Scenario 8: Protection reconciliation by provider order identity (orderId)', async () => {
    const transport = createMockTransport({
      get: async (url, params) => {
        if (url.includes('/fapi/v1/openAlgoOrders')) {
          return {
            status: 200,
            headers: {},
            json: async () => [{
              clientAlgoId: 'axd_stp_provider_id_match',
              algoId: '88990011',
              symbol: 'ETHUSDT',
              orderType: 'STOP_MARKET',
              algoStatus: 'NEW',
              triggerPrice: '2150.0',
            }],
            text: async () => '[]',
          };
        }
        return { status: 200, headers: {}, json: async () => ({}), text: async () => '{}' };
      },
    });

    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);

    const reconciliation = await adapter.reconcileProtectionRule(
      'ETHUSDT',
      'axd_stp_provider_id_match',
      'rule_88990011',
    );

    assert.ok(reconciliation);
    assert.equal(reconciliation.providerProtectionOrderId, '88990011');
    assert.equal(reconciliation.state, 'RECONCILED_ACTIVE');
    assert.equal(reconciliation.stopPrice, '2150.0');
  });

  it('Scenario 9: Protection cancellation via adapter (cancelProtectionOrder)', async () => {
    let capturedDeleteParams = null;
    const transport = createMockTransport({
      delete: async (url, params) => {
        capturedDeleteParams = params;
        return {
          status: 200,
          headers: {},
          json: async () => ({ algoId: params.algoId, status: 'CANCELED' }),
          text: async () => JSON.stringify({ algoId: params.algoId, status: 'CANCELED' }),
        };
      },
    });

    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);

    const cancelResult = await adapter.cancelProtectionOrder('SOLUSDT', 'axd_stp_cancel_target', '778899');

    assert.equal(cancelResult.success, true);
    assert.equal(capturedDeleteParams.symbol, 'SOLUSDT');
    assert.equal(capturedDeleteParams.algoId, '778899');
    assert.equal(capturedDeleteParams.clientAlgoId, 'axd_stp_cancel_target');
  });

  it('Scenario 10: Duplicate canonical protection command -> idempotent handling', async () => {
    let postCallCount = 0;
    let capturedClientAlgoId = null;
    const transport = createMockTransport({
      post: async (url, params) => {
        postCallCount += 1;
        capturedClientAlgoId = params.clientAlgoId;
        return {
          status: 200,
          headers: {},
          json: async () => ({ algoId: 445566, clientAlgoId: params.clientAlgoId, algoStatus: 'NEW' }),
          text: async () => '{}',
        };
      },
      get: async (url, params) => {
        if (url.includes('/fapi/v1/openAlgoOrders')) {
          return {
            status: 200,
            headers: {},
            json: async () => [{
              clientAlgoId: capturedClientAlgoId,
              algoId: 445566,
              symbol: 'BTCUSDT',
              orderType: 'STOP_MARKET',
              algoStatus: 'NEW',
              triggerPrice: '84000.0',
            }],
            text: async () => '[]',
          };
        }
        return {
          status: 200,
          headers: {},
          json: async () => ({
            clientAlgoId: params.clientAlgoId,
            algoId: 445566,
            symbol: 'BTCUSDT',
            orderType: 'STOP_MARKET',
            algoStatus: 'NEW',
            triggerPrice: '84000.0',
          }),
          text: async () => '{}',
        };
      },
    });

    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);
    const service = new PositionProtectionService(adapter);

    const fixedPlanId = 'plan_idempotent_test';
    const firstCall = await service.armProtection({
      planId: fixedPlanId,
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: '0.0050',
      stopPrice: '84000.0',
    });

    assert.equal(firstCall.isFullyArmed, true);
    assert.equal(postCallCount, 1);

    const secondCall = await service.armProtection({
      planId: fixedPlanId,
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: '0.0050',
      stopPrice: '84000.0',
    });

    assert.equal(secondCall.isFullyArmed, true);
    assert.equal(postCallCount, 1, 'Duplicate protection command must not trigger second mutation');
  });

  it('Scenario 11: Position becomes flat between EXPOSURE_CONFIRMED and protection submission -> aborts stale protection', async () => {
    const transport = createMockTransport();
    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);
    const service = new PositionProtectionService(adapter);

    // Initial exposure was intended, but confirmed flat before arming
    const flatResult = await service.armProtection({
      symbol: 'BNBUSDT',
      positionSide: 'SHORT',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: '0.000',
      stopPrice: '590.0',
    });

    assert.equal(flatResult.isFullyArmed, false);
    assert.equal(flatResult.status, 'TERMINAL_CLOSED');
    assert.equal(transport.calls.post.length, 0, 'Must zero-out submissions on flat state');
  });

  it('Scenario 12: Protection exists at provider but original response was lost -> recover existing protection', async () => {
    let postAttempts = 0;
    const transport = createMockTransport({
      post: async () => {
        postAttempts += 1;
        // Simulates connection reset / network drop right after Binance accepted algo order
        throw new Error('ECONNRESET');
      },
      get: async (url, params) => {
        // Recovery finds the exact client algo ID on the exchange
        if (params.clientAlgoId) {
          return {
            status: 200,
            headers: {},
            json: async () => ({
              algoId: '55667788',
              clientAlgoId: params.clientAlgoId,
              symbol: 'BTCUSDT',
              algoStatus: 'NEW',
              triggerPrice: '83000.0',
              orderType: 'STOP_MARKET',
            }),
            text: async () => '{}',
          };
        }
        return { status: 200, headers: {}, json: async () => [], text: async () => '[]' };
      },
    });

    const credentialSource = createMockCredentialSource();
    const adapter = new BinanceConditionalProtectionAdapter(credentialSource, transport);
    const service = new PositionProtectionService(adapter);

    const recoveredResult = await service.armProtection({
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
      positionMode: 'ONE_WAY',
      confirmedExposureQuantity: '0.0010',
      stopPrice: '83000.0',
    });

    assert.equal(postAttempts, 1);
    assert.equal(recoveredResult.isFullyArmed, true);
    assert.equal(recoveredResult.status, 'TRADE_FULLY_ARMED');
    assert.equal(recoveredResult.activeRule?.providerProtectionOrderId, '55667788');
  });
});
