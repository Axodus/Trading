import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(__dirname, '..');
const testDir = resolve(serviceRoot, 'test');
const manifestPath = resolve(testDir, 'test-classification.manifest.json');
const MUTATION_OPT_IN_ENV = 'AXODUS_TRADING_ALLOW_TESTNET_MUTATION';
const requested = process.argv[2] ?? 'SAFE';
const allowed = new Set(['SAFE', 'NETWORK_READONLY', 'TESTNET_MUTATING']);

if (!allowed.has(requested)) {
  fail(`Unknown test classification ${requested}`);
}
if (!existsSync(manifestPath)) {
  fail(`Missing test classification manifest at ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entries = new Map(manifest.classifications.map((entry) => [entry.file, entry]));
const discovered = readdirSync(testDir).filter((name) => name.endsWith('.test.mjs')).sort();
const missing = discovered.filter((name) => !entries.has(name));
const stale = [...entries.keys()].filter((name) => !discovered.includes(name));
if (missing.length > 0 || stale.length > 0) {
  fail(`Test classification drift: missing=${JSON.stringify(missing)} stale=${JSON.stringify(stale)}`);
}

const selected = discovered.filter((name) => entries.get(name).classification === requested);
if (selected.length === 0) fail(`No tests classified as ${requested}`);

if (requested === 'SAFE') {
  const unsafe = discovered.filter((name) => entries.get(name).externalMutation === true);
  if (unsafe.some((name) => selected.includes(name))) fail(`SAFE suite contains external-mutating tests: ${unsafe.join(', ')}`);
}

if (requested === 'TESTNET_MUTATING') {
  if (process.env[MUTATION_OPT_IN_ENV] !== 'true') {
    fail(`TESTNET_MUTATING tests require explicit runtime opt-in ${MUTATION_OPT_IN_ENV}=true. Credential presence is not authorization.`);
  }
}

const testPaths = selected.map((name) => resolve(testDir, name));
const child = spawn(process.execPath, ['--test', ...testPaths], {
  cwd: serviceRoot,
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

function fail(message) {
  process.stderr.write(`[classified-test-runner] ${message}\n`);
  process.exit(2);
}
