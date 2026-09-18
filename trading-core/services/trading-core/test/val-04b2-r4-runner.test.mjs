import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  VAL_04B2_BASE_URL,
  VAL_04B2_EXECUTE_CONFIRMATION,
  VAL_04B2_EXECUTE_CONFIRMATION_VARIABLE,
  Val04B2CredentialSource,
  Val04B2LiveTransport,
  assertVal04B2TestnetUrl,
  assertVal04B2ExecutionTarget,
  resolveVal04B2Mode,
  runVal04B2Execute,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

test('R4 credential source is lazy and uses the approved variable names', async () => {
  let resolved = false;
  const source = new Val04B2CredentialSource({
    TRADING_BINANCE_API_KEY: 'test-key',
    TRADING_BINANCE_API_SECRET: 'test-secret',
  });
  assert.deepEqual(source.metadata().scopes, ['account-info', 'futures-trading']);
  assert.equal(resolved, false);
  assert.deepEqual(await source.resolveEphemeralMaterial(), {
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  });
  resolved = true;
  assert.equal(resolved, true);
});

test('R4 credential source fails closed without complete material', async () => {
  const source = new Val04B2CredentialSource({ TRADING_BINANCE_API_KEY: 'only-key' });
  await assert.rejects(() => source.resolveEphemeralMaterial(), /credential material is unavailable/i);
});

test('R4 transport admits only the fixed Futures Testnet endpoint', () => {
  assert.doesNotThrow(() => assertVal04B2TestnetUrl(VAL_04B2_BASE_URL));
  assert.throws(() => assertVal04B2TestnetUrl('https://fapi.binance.com'), /Testnet HTTPS endpoint/);
  assert.throws(() => assertVal04B2TestnetUrl('https://testnet.binance.com'), /Testnet HTTPS endpoint/);
});

test('R4 live transport performs no automatic retry for POST', async () => {
  const transport = new Val04B2LiveTransport();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('simulated ambiguous transport failure');
  };
  try {
    await assert.rejects(() => transport.post('/fapi/v1/order', {}, {}, 100), /ambiguous transport failure/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('R4 runner default invocation fails closed before credential resolution', () => {
  assert.throws(() => resolveVal04B2Mode([]), /exactly one explicit mode/);
});

test('R4 public mode is distinct from execute mode', () => {
  assert.equal(resolveVal04B2Mode(['--public']), 'public');
  assert.equal(resolveVal04B2Mode(['--execute']), 'execute');
  assert.throws(() => resolveVal04B2Mode(['--execute', '--public']), /exactly one explicit mode/);
});

test('R4 execute mode rejects missing or incorrect operational confirmation without creating a harness', async () => {
  let factoryCalls = 0;
  const factory = () => {
    factoryCalls += 1;
    throw new Error('harness must not be created');
  };

  await assert.rejects(
    () => runVal04B2Execute({}, factory),
    new RegExp(`${VAL_04B2_EXECUTE_CONFIRMATION_VARIABLE}=`),
  );
  await assert.rejects(
    () => runVal04B2Execute({ [VAL_04B2_EXECUTE_CONFIRMATION_VARIABLE]: 'WRONG' }, factory),
    new RegExp(`${VAL_04B2_EXECUTE_CONFIRMATION_VARIABLE}=`),
  );
  assert.equal(factoryCalls, 0);
});

test('R4 execute mode delegates exactly once with the technical approval token and sanitized result', async () => {
  let calls = 0;
  let receivedOptions;
  const providerOrderId = 'provider-order-1';
  const fakeResult = {
    environment: 'binance_perpetual_testnet',
    symbol: 'BTCUSDT',
    instrument: 'BTC-USDT-PERPETUAL',
    executionClientOrderId: 'axd_v04b2_123',
    providerOrderId,
    submittedPrice: 100,
    submittedQuantity: 0.5,
    submittedNotional: 50,
    preflightPassed: true,
    submissionStatus: 'NEW',
    lookupStatusAfterSubmit: 'NEW',
    identityPreserved: true,
    cancellationStatus: 'CANCELED',
    terminalReconciliationStatus: 'CANCELED',
    residualActiveOrdersCount: 0,
    residualPositionAmount: 0,
    blindRetries: 0,
    ordersSubmitted: 1,
    websocketUsed: false,
    mainnetExcluded: true,
    secretsExposed: false,
    cleanupPassed: true,
  };

  const result = await runVal04B2Execute(
    { [VAL_04B2_EXECUTE_CONFIRMATION_VARIABLE]: VAL_04B2_EXECUTE_CONFIRMATION },
    () => ({
      async executeControlledOrderLifecycle(options) {
        calls += 1;
        receivedOptions = options;
        return fakeResult;
      },
    }),
  );

  assert.equal(calls, 1);
  assert.equal(receivedOptions.approval, 'VAL-04B-EXTERNAL-EXECUTION-APPROVED');
  assert.equal(receivedOptions.maxOrderNotional, 250);
  assert.deepEqual(result.result, fakeResult);
  assert.equal(JSON.stringify(result).includes('TRADING_BINANCE_API_SECRET'), false);
});

test('R4 runner rejects non-Testnet execution targets', () => {
  assert.doesNotThrow(() => assertVal04B2ExecutionTarget(VAL_04B2_BASE_URL));
  assert.throws(() => assertVal04B2ExecutionTarget('https://fapi.binance.com'), /Futures Testnet endpoint/);
});

test('R4 package entrypoints target built output rather than source TypeScript', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(packageJson.scripts['val:04b2:r4:public'], /dist\/services\/trading-core\/trading-core\/services\/trading-core\/src\/external\/val-04b2-live-runner\.js/);
  assert.match(packageJson.scripts['val:04b2:r4:execute'], /dist\/services\/trading-core\/trading-core\/services\/trading-core\/src\/external\/val-04b2-live-runner\.js/);
  assert.doesNotMatch(packageJson.scripts['val:04b2:r4:public'], /src\/external\/val-04b2-live-runner\.ts/);
  assert.doesNotMatch(packageJson.scripts['val:04b2:r4:execute'], /src\/external\/val-04b2-live-runner\.ts/);
});
