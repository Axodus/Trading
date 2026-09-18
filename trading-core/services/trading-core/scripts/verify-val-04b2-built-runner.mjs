import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const builtRoot = resolve(
  new URL('.', import.meta.url).pathname,
  '../../../../dist/services/trading-core/trading-core/services/trading-core/src/external',
);
const runnerPath = resolve(builtRoot, 'val-04b2-live-runner.js');
const harnessPath = resolve(builtRoot, 'Val04B2ControlledOrderHarness.js');
const preCredentialPath = resolve(builtRoot, 'Val04BPreCredentialHarness.js');

for (const path of [runnerPath, harnessPath, preCredentialPath]) {
  assert.equal(existsSync(path), true, `built dependency is missing: ${path}`);
}

const runner = await import(`file://${runnerPath}`);
assert.equal(runner.resolveVal04B2Mode(['--public']), 'public');
assert.equal(runner.resolveVal04B2Mode(['--execute']), 'execute');
await assert.rejects(
  () => runner.runVal04B2Execute({}, () => { throw new Error('harness must not be created'); }),
  /AXODUS_VAL_04B2_EXECUTE_CONFIRMATION=/,
);

console.log(JSON.stringify({
  builtRunner: runnerPath,
  builtDependencies: 'resolved',
  publicMode: 'available',
  executeWithoutOperationalGate: 'fail-closed',
  credentialsLoaded: 0,
  privateCalls: 0,
  postAttempts: 0,
  deleteAttempts: 0,
}));
