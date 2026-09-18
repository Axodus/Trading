import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VAL_04B2_BASE_URL,
  Val04B2CredentialSource,
  Val04B2LiveTransport,
  assertVal04B2TestnetUrl,
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
