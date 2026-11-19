// Documentation conformance vectors. No Lab runtime or dependency installation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = JSON.parse(readFileSync(new URL('./q0-contract-vectors.json', import.meta.url)));
const { manifest, specification, job, result, artifacts } = fixture.payloads;
const copy = structuredClone;
const without = (value, key) => Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));
const points = s => Array.from(s, c => c.codePointAt(0));
function compare(a, b) {
  const x = points(a), y = points(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}
function encode(x) {
  assert.notEqual(x, null);
  if (Array.isArray(x)) return `[${x.map(encode).join(',')}]`;
  if (typeof x === 'object') return `{${Object.keys(x).sort(compare).map(k => `${encode(k)}:${encode(x[k])}`).join(',')}}`;
  if (typeof x === 'number') assert(Number.isSafeInteger(x));
  if (typeof x === 'string') assert(x.isWellFormed());
  return JSON.stringify(x);
}
const sha = bytes => createHash('sha256').update(bytes, 'utf8').digest('hex');
const digest = value => sha(encode(value));
function decimal(s) {
  assert(typeof s === 'string' && /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(s) && !s.endsWith('\n'));
  if (/^-?0(?:\.0+)?$/.test(s)) return '0';
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}
const scaled = (s, precision) => {
  const [whole, fraction = ''] = decimal(s).replace('-', '').split('.');
  return (s.startsWith('-') ? -1n : 1n) * BigInt(whole + fraction.padEnd(precision, '0'));
};
const scale = (...values) => Math.max(...values.map(x => decimal(x).split('.')[1]?.length ?? 0));
const equalProduct = (amount, rate, result) => {
  const p = scale(amount, rate, result);
  return scaled(amount, p) * scaled(rate, p) === scaled(result, p) * 10n ** BigInt(p);
};
function time(s) {
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$/.exec(s);
  assert(m && m[0] === s && !m[1].startsWith('0000') && m[1].slice(11, 13) !== '24');
  const fraction = m[2] ?? '';
  assert(!/[1-9]/.test(fraction.slice(3)));
  const local = `${m[1]}.${fraction.padEnd(3, '0').slice(0, 3)}`;
  assert.equal(new Date(`${local}Z`).toISOString(), `${local}Z`);
  const out = new Date(`${local}${m[3]}`).toISOString();
  assert(/^[0-9]{4}-/.test(out) && !out.startsWith('0000'));
  return out;
}

function replayPreimage(r) {
  const content = values => Object.fromEntries(Object.entries(values).map(([k, v]) => [k,
    v.status === 'AVAILABLE' ? { status: v.status, rowCount: v.rowCount, ...without(v.artifact, 'id') } : v]));
  const { schemaVersion, dataOrigin, positionAtEnd, economics, limitations } = r;
  return { schemaVersion, specificationDigest: r.provenance.specification.specificationDigest,
    dataOrigin, positionAtEnd, economics, limitations, ledgers: content(r.ledgers), series: content(r.series) };
}
const preimages = {
  datasetContent: manifest.partitions.map(({ window, artifact, rowCount }) => ({ window, ...without(artifact, 'id'), rowCount })),
  datasetManifest: manifest, specification: without(specification, 'specificationDigest'), result: without(result, 'resultDigest'),
  replay: replayPreimage(result), ...artifacts, unicode: { a: 'café\n', '𐀀': 'supplementary', '': 'BMP' },
};
assert.deepEqual(Object.keys(preimages).sort(), Object.keys(fixture.hashVectors).sort());
for (const [id, value] of Object.entries(preimages)) {
  const vector = fixture.hashVectors[id];
  assert.equal(encode(value), vector.canonicalUtf8, `${id}: exact canonical UTF-8`);
  assert.equal(digest(value), vector.sha256, `${id}: SHA-256`);
}
assert.equal(digest(preimages.datasetContent), manifest.dataset.contentDigest);
assert.equal(digest(manifest), specification.datasetManifestDigest);
assert.equal(digest(preimages.specification), specification.specificationDigest);
assert.equal(digest(preimages.replay), result.replayDigest);
assert.equal(digest(preimages.result), result.resultDigest);
assert.equal(job.state.result.digest, result.resultDigest);
const spelling = copy(preimages.specification);
spelling.effectiveParameters.long_displacement_threshold_bps = decimal('0.4000');
spelling.execution.effectiveAssumptions.spreadBps = decimal('-0.00');
spelling.window.start = time('2023-12-31T21:00:00.0-03:00');
assert.equal(digest(spelling), specification.specificationDigest);
for (const bad of ['1e-5', 'NaN', '01', 0.1, '1\n']) assert.throws(() => decimal(bad));
for (const bad of ['2024-01-01T00:00:00.0001Z', '2024-01-01T00:00:00', '2024-02-30T00:00:00Z']) assert.throws(() => time(bad));
const retryJob = { ...job, jobId: 'job:fixture-b', submittedAt: '2026-11-18T12:04:00.000Z' };
const retryResult = copy(result);
retryResult.resultId = 'result:fixture-b';
retryResult.provenance.jobId = retryJob.jobId;
retryResult.ledgers.fills.artifact.id = 'fixture:relocated-fills';
assert.equal(digest(replayPreimage(retryResult)), result.replayDigest);
assert.notEqual(digest(without(retryResult, 'resultDigest')), result.resultDigest);
retryResult.ledgers.fills.artifact.digest = sha('different fills');
assert.notEqual(digest(replayPreimage(retryResult)), result.replayDigest);

const unit = (a, b) => a.kind === b.kind && a.code === b.code;
function validFee({ fillTime, fee, evidence, overrideEvidenceTime }) {
  const { original, reporting, conversion } = fee;
  if (unit(original.unit, reporting.unit))
    return reporting.status === 'KNOWN' && !conversion && decimal(original.value) === decimal(reporting.value);
  if (reporting.status === 'UNAVAILABLE') return !conversion && !!reporting.reason;
  if (!conversion || !evidence || reporting.status !== 'KNOWN') return false;
  if (overrideEvidenceTime) {
    evidence = { ...evidence, asOf: overrideEvidenceTime };
    conversion.asOf = overrideEvidenceTime;
    conversion.evidenceDigest = digest(evidence);
  }
  return unit(evidence.from, original.unit) && unit(evidence.to, reporting.unit) &&
    conversion.evidenceDigest === digest(evidence) && conversion.evidenceRecordId === evidence.recordId &&
    conversion.asOf === evidence.asOf && time(evidence.asOf) <= time(fillTime) &&
    decimal(evidence.rate) === decimal(conversion.rate) && scaled(evidence.rate, scale(evidence.rate)) > 0n &&
    equalProduct(original.value, evidence.rate, reporting.value);
}
for (const test of fixture.cases.fees) assert.equal(validFee(copy(test)), test.expected, test.id);
const seriesKeys = { GROSS_REALIZED: 'series.gross-realized', NET_REALIZED: 'series.net-realized',
  CUMULATIVE_FEES: 'series.cumulative-fees', EQUITY_MTM: 'series.equity-mtm' };
const recognition = { GROSS_REALIZED: 'CLOSED_TRADE_FINALIZATION', NET_REALIZED: 'CLOSED_TRADE_FINALIZATION',
  CUMULATIVE_FEES: 'FILL', EQUITY_MTM: 'MARK' };
const checkPoint = (id, p) => p.semantic === id && p.recognition === recognition[id] && unit(p.unit, result.economics.reportingUnit);
for (const [id, key] of Object.entries(seriesKeys)) {
  const a = artifacts[key];
  assert.equal(result.series[id].artifact.digest, digest(a));
  assert.equal(result.series[id].rowCount, a.rows.length);
  assert(a.rows.every((p, i) => checkPoint(id, p) && p.ordinal === i && time(p.time) === p.time && (i === 0 || a.rows[i - 1].time <= p.time)));
}
assert(!checkPoint('NET_REALIZED', artifacts['series.equity-mtm'].rows[0]));
const [trade] = artifacts['closed-trades'].rows;
const expectedNet = v => {
  const p = scale(trade.gross.value, trade.fees.value, v);
  return scaled(trade.gross.value, p) - scaled(trade.fees.value, p) === scaled(v, p);
};
assert(expectedNet(trade.net.value));
assert(!expectedNet('0.83930005'));
const fills = artifacts.fills.rows;
const fillFees = fills.flatMap(f => f.fees.map(v => v.reporting.value));
const feePoints = artifacts['series.cumulative-fees'].rows;
const p = scale(result.economics.totalFillFees.value, ...fillFees, ...feePoints.map(v => v.value));
let cumulative = 0n;
for (const [i, fill] of fills.entries()) {
  assert(artifacts.orders.rows.some(row => row.orderId === fill.orderId && row.time <= fill.time));
  assert(fill.fees.every(fee => validFee({ fillTime: fill.time, fee })));
  cumulative += fill.fees.reduce((sum, v) => sum + scaled(v.reporting.value, p), 0n);
  assert.deepEqual(feePoints[i].sourceRowIds, [fill.fillId]);
  assert.equal(feePoints[i].time, fill.time);
  assert.equal(cumulative, scaled(feePoints[i].value, p));
}
assert.deepEqual(trade.fillIds, fills.map(fill => fill.fillId));
assert.equal(cumulative, scaled(result.economics.totalFillFees.value, p));
assert.equal(result.economics.realizedFees.value, trade.fees.value);
assert.equal(result.economics.realizedGross.value, artifacts['series.gross-realized'].rows.at(-1).value);
assert.equal(result.economics.realizedNet.value, artifacts['series.net-realized'].rows.at(-1).value);
assert.equal(result.economics.finalEquity.value, artifacts['series.equity-mtm'].rows.at(-1).value);

function admission(test) {
  const { parents, protected: windows, currentSnapshot } = fixture.lineageFixture;
  if (test.snapshot !== currentSnapshot) return 'REGISTRY_UNVERIFIED';
  const ancestors = new Set(), visiting = new Set();
  function trace(id) {
    if (visiting.has(id) || !Object.hasOwn(parents, id)) return false;
    if (ancestors.has(id)) return true;
    visiting.add(id);
    if (!parents[id].every(trace)) return false;
    visiting.delete(id); ancestors.add(id);
    return true;
  }
  if (!trace(test.dataset)) return 'LINEAGE_UNVERIFIED';
  const { start, end } = test.inputWindow;
  return [...ancestors].some(id => windows[id] && time(start) < time(windows[id].end) && time(windows[id].start) < time(end))
    ? 'OOS_OVERLAP' : 'ALLOW';
}
for (const test of fixture.cases.lineage) assert.equal(admission(test), test.expected, test.id);
for (const test of fixture.cases.realization) {
  const coverage = test.nativeAllEvents || (test.noOtherRealizationProven && test.finalizedLedgerComplete)
    ? 'COMPLETE' : test.finalizedLedgerComplete ? 'FINALIZED_TRADES_ONLY' : 'UNAVAILABLE';
  assert.equal(coverage, test.expected, test.id);
}

const lab = fileURLToPath(new URL('../../../quants-lab/', import.meta.url));
const python = spawnSync('python3', ['-c', `
import json, sys
from core.quant_foundations.canonical import canonical_json, sha256_digest
packet = json.load(sys.stdin)
for name, value in packet['preimages'].items():
    vector = packet['vectors'][name]
    assert canonical_json(value) == vector['canonicalUtf8'], name
    assert sha256_digest(value) == vector['sha256'], name
`], { cwd: lab, input: JSON.stringify({ preimages, vectors: fixture.hashVectors }), encoding: 'utf8',
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
assert.equal(python.status, 0, python.stderr || String(python.error));
console.log(`${Object.keys(preimages).length} canonical byte/digest vectors: Node and Quants-Lab Python agree`);
console.log(`${Object.values(fixture.cases).flat().length} semantic cases passed; replay identity, normalization, series and exact PnL verified`);
