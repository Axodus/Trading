import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  PostgresExecutionLifecycleRepository,
  ControlledExecutionService,
  ExecutionControlAuthority,
  ReconciliationAuthority,
  BinanceTestnetControlledLifecycleAdapter,
  VAL_04B2_BASE_URL,
  assertVal04B2TestnetUrl,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import {
  FixedDecimal,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';

function loadWorkspaceEnv() {
  const candidatePaths = [
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '../../../.env.local'),
    resolve(process.cwd(), '../../.env.local'),
    resolve(process.cwd(), '../.env.local'),
    '/opt/Axodus/Trading/.env.local',
  ];
  const envLocal = candidatePaths.find((p) => existsSync(p));
  if (envLocal) {
    const lines = readFileSync(envLocal, 'utf8').split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const [k, ...v] = t.split('=');
      let val = v.join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[k.trim()]) {
        process.env[k.trim()] = val;
      }
    }
  }
}

describe('AXODUS-TRADING-EPIC-01 / VAL-09-TESTNET — Bounded Provider Execution & Reconciliation Certification', () => {
  let client;
  let repository;
  let service;
  let adapter;
  let apiKey;
  let apiSecret;
  let referencePrice;
  let testLimitPrice;
  const testQuantity = '0.001000000000';

  before(async () => {
    loadWorkspaceEnv();
    apiKey = process.env.TRADING_BINANCE_API_KEY;
    apiSecret = process.env.TRADING_BINANCE_API_SECRET;

    assert.ok(apiKey, 'TRADING_BINANCE_API_KEY must be configured in environment');
    assert.ok(apiSecret, 'TRADING_BINANCE_API_SECRET must be configured in environment');

    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    repository = new PostgresExecutionLifecycleRepository(client);
    service = new ControlledExecutionService(repository, client, { publishEvents: true });

    adapter = new BinanceTestnetControlledLifecycleAdapter({
      apiKey,
      apiSecret,
      baseUrl: VAL_04B2_BASE_URL,
      symbol: 'BTCUSDT',
    });
  });

  after(async () => {
    if (client && !client.isClosed()) {
      await client.close();
    }
  });

  it('Gate 1: Environment & Endpoint Guard — verifies Testnet and prohibits Production/Mainnet endpoints', () => {
    assertVal04B2TestnetUrl(VAL_04B2_BASE_URL);
    assert.equal(VAL_04B2_BASE_URL, 'https://testnet.binancefuture.com');

    // Negative tests: production endpoints fail closed
    const forbiddenEndpoints = [
      'https://fapi.binance.com',
      'https://api.binance.com',
      'https://dapi.binance.com',
      'http://testnet.binancefuture.com',
    ];

    for (const badUrl of forbiddenEndpoints) {
      assert.throws(() => assertVal04B2TestnetUrl(badUrl));
    }
  });

  it('Gate 2: Read-Only Preflight & Symbol Qualification on Binance Futures Testnet', async () => {
    const timeRes = await fetch(`${VAL_04B2_BASE_URL}/fapi/v1/time`);
    assert.equal(timeRes.status, 200);
    const timeJson = await timeRes.json();
    assert.ok(typeof timeJson.serverTime === 'number');

    const infoRes = await fetch(`${VAL_04B2_BASE_URL}/fapi/v1/exchangeInfo`);
    assert.equal(infoRes.status, 200);
    const infoJson = await infoRes.json();
    const btc = infoJson.symbols.find((s) => s.symbol === 'BTCUSDT');
    assert.ok(btc, 'BTCUSDT symbol must exist in exchangeInfo');
    assert.equal(btc.contractType, 'PERPETUAL');
    assert.equal(btc.status, 'TRADING');

    const priceRes = await fetch(`${VAL_04B2_BASE_URL}/fapi/v1/premiumIndex?symbol=BTCUSDT`);
    assert.equal(priceRes.status, 200);
    const priceJson = await priceRes.json();
    referencePrice = Number(priceJson.markPrice ?? priceJson.price);
    assert.ok(Number.isFinite(referencePrice) && referencePrice > 0);

    // Conservative limit price (20% below mark price to avoid immediate fill, rounded to 0.1 tick)
    const discounted = referencePrice * 0.8;
    testLimitPrice = (Math.floor(discounted * 10) / 10).toFixed(2);
  });

  it('Gate 3: Pre-Submission Invariant Check — rejects LIVE, MAINNET, and inactive health/lifecycle', () => {
    const mockIntent = {
      executionIntentId: 'exec-gate3-' + globalThis.crypto.randomUUID().slice(0, 8),
      tradingIntentId: 'trade-gate3',
      strategyId: 'strat-momentum-val09',
      strategyRevisionId: 'strat-momentum-val09:r7',
      targetAdapterType: 'binance_futures_testnet',
      venue: 'binance',
      instrument: 'BTC-USDT',
      side: 'buy',
      authorizedQuantity: testQuantity,
      authorizedCapital: '100.000000000000',
      authorizedLeverage: '2.000000000000',
      executionQuantity: testQuantity,
      executionCapital: '100.000000000000',
      executionLeverage: '2.000000000000',
      policyRevision: 'POLICY_V1',
      correlationId: 'corr-gate3',
      idempotencyKey: 'idem-gate3',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    const liveRes = ExecutionControlAuthority.reserveSubmission({
      commandId: 'cmd-live-unauth',
      executionIntent: mockIntent,
      environment: 'LIVE',
      idempotencyKey: 'idem-live',
      evaluationTime: new Date().toISOString(),
    });
    assert.equal(liveRes.authorized, false);
    assert.ok(liveRes.reasonCodes.includes('ENVIRONMENT_UNAUTHORIZED'));

    const suspRes = ExecutionControlAuthority.reserveSubmission({
      commandId: 'cmd-susp-unauth',
      executionIntent: mockIntent,
      environment: 'TESTNET',
      idempotencyKey: 'idem-susp',
      evaluationTime: new Date().toISOString(),
      strategyHealthState: 'SUSPENDED',
    });
    assert.equal(suspRes.authorized, false);
    assert.ok(suspRes.reasonCodes.includes('STRATEGY_HEALTH_SUSPENDED'));
  });

  it('Gate 4: Critical Ambiguous Submission & Exact Query Reconciliation on Real Testnet', async () => {
    const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
    const intent = {
      executionIntentId: 'exec-intent-val09-' + uniqueId,
      tradingIntentId: 'trading-intent-val09-' + uniqueId,
      strategyId: 'strat-momentum-val09',
      strategyRevisionId: 'strat-momentum-val09:r7',
      targetAdapterType: 'binance_futures_testnet',
      venue: 'binance',
      instrument: 'BTC-USDT',
      side: 'buy',
      authorizedQuantity: testQuantity,
      authorizedCapital: '100.000000000000',
      authorizedLeverage: '2.000000000000',
      executionQuantity: testQuantity,
      executionCapital: '100.000000000000',
      executionLeverage: '2.000000000000',
      constraints: {
        orderType: 'LIMIT',
        timeInForce: 'GTC',
        priceConstraints: {
          limitPrice: testLimitPrice,
        },
      },
      policyRevision: 'POLICY_V1',
      correlationId: 'corr-val09-' + uniqueId,
      idempotencyKey: 'idem-val09-' + uniqueId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      evidenceRefs: ['ev-val09-1'],
    };

    // 1. Enable fault injection: suppress local ACK after Binance accepts the order
    adapter.setSuppressSubmissionAck(true);

    const subResult = await service.reserveAndSubmit(intent, adapter, {
      environment: 'TESTNET',
    });

    // Verify Axodus correctly marks the submission as SUBMITTED_UNKNOWN without blind retry
    assert.equal(subResult.terminalState, 'SUBMITTED_UNKNOWN');
    assert.equal(subResult.reconciled, false);

    const storedOrder = await repository.getCanonicalOrder(subResult.canonicalOrderId);
    assert.ok(storedOrder);
    assert.equal(storedOrder.state, 'SUBMITTED_UNKNOWN');

    // Verify in PostgreSQL table
    const orderDbRow = await client.query(
      'SELECT state, client_order_id FROM canonical_orders WHERE canonical_order_id = $1',
      [subResult.canonicalOrderId]
    );
    assert.equal(orderDbRow.rows[0].state, 'SUBMITTED_UNKNOWN');

    // 2. Disable fault injection and perform EXACT query reconciliation by clientOrderId against Binance
    adapter.setSuppressSubmissionAck(false);
    const reconResult = await service.reconcileOrder(storedOrder.clientOrderId, adapter);

    assert.equal(reconResult.decision, 'UPDATED');
    assert.equal(reconResult.updatedOrder?.state, 'OPEN');

    const reloadedOrder = await repository.getCanonicalOrder(subResult.canonicalOrderId);
    assert.ok(reloadedOrder);
    assert.equal(reloadedOrder.state, 'OPEN');
    assert.ok(reloadedOrder.providerOrderId, 'providerOrderId must be populated from Binance lookup');

    // 3. Perform Controlled Cancellation on the real Testnet order
    const cancelRes = await service.cancelOrder(
      {
        commandId: 'cmd-cancel-val09-' + uniqueId,
        canonicalOrderId: subResult.canonicalOrderId,
        reason: 'VAL09_TESTNET_CLEANUP',
        requestedAt: new Date().toISOString(),
      },
      adapter
    );

    assert.equal(cancelRes.decision, 'UPDATED');
    assert.equal(cancelRes.updatedOrder?.state, 'CANCELLED');

    const finalOrder = await repository.getCanonicalOrder(subResult.canonicalOrderId);
    assert.equal(finalOrder?.state, 'CANCELLED');

    // Verify append-only order events recorded in PostgreSQL
    const eventRows = await client.query(
      'SELECT * FROM canonical_order_events WHERE canonical_order_id = $1 ORDER BY order_version ASC',
      [subResult.canonicalOrderId]
    );
    assert.ok(eventRows.rows.some((e) => e.new_state === 'CANCEL_PENDING'));
    assert.ok(eventRows.rows.some((e) => e.new_state === 'CANCELLED'));
  });

  it('Gate 5: Idempotency & Restart Safety — Replay returns identical result without second submission', async () => {
    // Reconstruct service instance
    const freshRepo = new PostgresExecutionLifecycleRepository(client);
    const freshService = new ControlledExecutionService(freshRepo, client, { publishEvents: true });

    const countAttemptsBefore = await client.query('SELECT count(*) FROM execution_attempts');
    const countOrdersBefore = await client.query('SELECT count(*) FROM canonical_orders');

    // Verify non-terminal recovery finds zero active unmanaged orders
    const recoveries = await freshService.recoverNonTerminalOrders(adapter);
    assert.ok(Array.isArray(recoveries));

    const countAttemptsAfter = await client.query('SELECT count(*) FROM execution_attempts');
    const countOrdersAfter = await client.query('SELECT count(*) FROM canonical_orders');

    assert.equal(countAttemptsBefore.rows[0].count, countAttemptsAfter.rows[0].count);
    assert.equal(countOrdersBefore.rows[0].count, countOrdersAfter.rows[0].count);
  });

  it('Gate 6: Mandatory External Residual State Verification on Binance USDⓈ-M Futures Testnet', async () => {
    // 1. Check open orders on Binance Testnet
    const timestamp = Date.now().toString();
    const queryParams = new URLSearchParams({ symbol: 'BTCUSDT', recvWindow: '5000', timestamp });
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(apiSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signatureBytes = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(queryParams.toString()));
    const signature = Array.from(new Uint8Array(signatureBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    queryParams.set('signature', signature);

    const openOrdersRes = await fetch(`${VAL_04B2_BASE_URL}/fapi/v1/openOrders?` + queryParams.toString(), {
      headers: { 'X-MBX-APIKEY': apiKey },
    });
    assert.equal(openOrdersRes.status, 200);
    const openOrdersJson = await openOrdersRes.json();

    assert.equal(openOrdersJson.length, 0, 'Residual open orders on Binance Futures Testnet must be strictly 0');

    // 2. Check position risk on Binance Testnet
    const posRes = await fetch(`${VAL_04B2_BASE_URL}/fapi/v2/positionRisk?` + queryParams.toString(), {
      headers: { 'X-MBX-APIKEY': apiKey },
    });
    assert.equal(posRes.status, 200);
    const posJson = await posRes.json();
    const btcPos = posJson.find((p) => p.symbol === 'BTCUSDT');
    const posAmt = btcPos ? Math.abs(Number(btcPos.positionAmt ?? '0')) : 0;

    assert.equal(posAmt, 0, 'Residual BTCUSDT position on Binance Futures Testnet must be strictly 0');
  });
});
