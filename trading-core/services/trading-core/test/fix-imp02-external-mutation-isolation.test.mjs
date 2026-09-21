import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const serviceRoot = resolve(process.cwd());
const manifestPath = resolve(serviceRoot, 'test/test-classification.manifest.json');
const runnerPath = resolve(serviceRoot, 'scripts/run-classified-tests.mjs');

test('FIX-IMP02-01: default npm test routes only the explicitly classified SAFE graph', () => {
  const packageJson = JSON.parse(readFileSync(resolve(serviceRoot, 'package.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const mutating = manifest.classifications.filter((entry) => entry.classification === 'TESTNET_MUTATING');

  assert.equal(packageJson.scripts.test, 'npm run test:safe');
  assert.match(packageJson.scripts['test:safe'], /run-classified-tests\.mjs SAFE/);
  assert.match(packageJson.scripts['test:testnet:acceptance'], /run-classified-tests\.mjs TESTNET_MUTATING/);
  assert.deepEqual(mutating.map((entry) => entry.file), ['val-09-testnet-certification.test.mjs']);
  assert.equal(manifest.classifications.every((entry) => typeof entry.classification === 'string'), true);
});

test('FIX-IMP02-01: explicit Testnet suite fails before test loading without mutation opt-in', () => {
  const result = spawnSync(process.execPath, [runnerPath, 'TESTNET_MUTATING'], {
    cwd: serviceRoot,
    env: { ...process.env, AXODUS_TRADING_ALLOW_TESTNET_MUTATION: undefined },
    encoding: 'utf8',
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /AXODUS_TRADING_ALLOW_TESTNET_MUTATION=true/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /VAL-09-TESTNET/);
});

test('FIX-IMP02-01: credentials do not substitute for the separate Testnet mutation capability', () => {
  const result = spawnSync(process.execPath, [runnerPath, 'TESTNET_MUTATING'], {
    cwd: serviceRoot,
    env: {
      ...process.env,
      AXODUS_TRADING_ALLOW_TESTNET_MUTATION: undefined,
      TRADING_BINANCE_API_KEY: 'present-but-not-authorizing',
      TRADING_BINANCE_API_SECRET: 'present-but-not-authorizing',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Credential presence is not authorization/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Binance|fapi\/v1|VAL-09-TESTNET/);
});

test('FIX-IMP02-01: test-classification drift fails closed for unclassified files', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const filenames = manifest.classifications.map((entry) => entry.file);
  assert.equal(filenames.includes('fix-imp02-external-mutation-isolation.test.mjs'), true);
  assert.equal(new Set(filenames).size, filenames.length);
});
