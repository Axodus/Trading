import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VAL_04B1_ACCOUNT_PATH,
  VAL_04B1_BASE_URL,
  Val04B1AuthenticatedReadHarness,
  Val04B1BoundaryError,
  assertVal04B1CredentialMetadata,
  assertVal04B1Environment,
  createVal04B1EnvironmentReport,
  redactVal04B1,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function source(scopes = ['account-info', 'futures-trading']) {
  return {
    metadata() {
      return { environment: 'binance_perpetual_testnet', providerId: 'binance', scopes, vaultRefId: 'vault-testnet-b1' };
    },
    async resolveEphemeralMaterial() {
      return { apiKey: 'synthetic-key', apiSecret: 'synthetic-secret' };
    },
  };
}

test('B1 authenticates only the fixed testnet account-read path and returns a sanitized summary', async () => {
  const calls = [];
  const harness = new Val04B1AuthenticatedReadHarness(source(), {
    async get(url, query, headers, timeoutMs) {
      calls.push({ url, query, headers, timeoutMs });
      return {
        status: 200,
        async json() { return { accountType: 'FUTURES', canTrade: true, assets: [{ asset: 'USDT', walletBalance: '1' }], updateTime: 123 }; },
      };
    },
  }, VAL_04B1_BASE_URL, 4000, () => 1700000000000);

  const result = await harness.readAccount();
  assert.deepEqual(result, {
    environment: 'binance_perpetual_testnet',
    authenticated: true,
    accountType: 'FUTURES',
    canTrade: true,
    assetCount: 1,
    serverTime: 123,
    privateCallsMade: true,
    mutatingCallsMade: false,
    websocketUsed: false,
    redactionVerified: true,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${VAL_04B1_BASE_URL}${VAL_04B1_ACCOUNT_PATH}`);
  assert.equal(calls[0].headers['X-MBX-APIKEY'], 'synthetic-key');
  assert.equal(calls[0].timeoutMs, 4000);
  assert.equal(calls[0].query.timestamp, '1700000000000');
  assert.equal(typeof calls[0].query.signature, 'string');
});

test('B1 rejects mainnet, forbidden scopes, and incomplete material before transport', async () => {
  assert.throws(() => assertVal04B1Environment('https://fapi.binance.com'), Val04B1BoundaryError);
  assert.throws(() => assertVal04B1CredentialMetadata({
    environment: 'binance_perpetual_testnet', providerId: 'binance', scopes: ['account-info', 'withdraw'], vaultRefId: 'v',
  }), Val04B1BoundaryError);
  assert.throws(() => assertVal04B1CredentialMetadata({
    environment: 'binance_perpetual_testnet', providerId: 'binance', scopes: ['account-info'], vaultRefId: 'v',
  }), Val04B1BoundaryError);
  const harness = new Val04B1AuthenticatedReadHarness({
    metadata: () => ({ environment: 'binance_perpetual_testnet', providerId: 'binance', scopes: ['account-info', 'futures-trading'], vaultRefId: 'v' }),
    async resolveEphemeralMaterial() { return { apiKey: '', apiSecret: '' }; },
  }, { async get() { throw new Error('transport must not be called'); } });
  await assert.rejects(() => harness.readAccount(), Val04B1BoundaryError);
});

test('B1 has no mutating transport surface and redacts both credential fields', () => {
  const report = createVal04B1EnvironmentReport({});
  assert.equal(report.status, 'BLOCKED');
  assert.equal(report.secretPresent, false);
  assert.equal(report.privateCallsMade, false);
  assert.equal(report.mutatingCallsMade, false);
  assert.equal(redactVal04B1('key=synthetic-key secret=synthetic-secret', ['synthetic-key', 'synthetic-secret']), 'key=[REDACTED] secret=[REDACTED]');
});
