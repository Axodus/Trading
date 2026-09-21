import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { comparePaperR3Direction } from '../../../../dist/services/trading-core/trading-core/services/trading-core/src/index.js';

const reportDirectory = resolve(process.cwd(), '../../../.instructions/reports');
const files = readdirSync(reportDirectory)
  .filter((file) => /^AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3-r3e?-window-.+-RESULTS\.json$/.test(file))
  .sort();
if (!files.length) throw new Error('R3_WINDOW_RESULTS_NOT_FOUND');

const windows = files.map((file) => ({ file, value: JSON.parse(readFileSync(resolve(reportDirectory, file), 'utf8')) }));
validateCohortIdentity(windows.map((window) => window.value));
const principal = windows.flatMap((window) => window.value.records.filter((record) => record.cohort === 'PRINCIPAL'));
const stability = windows.flatMap((window) => window.value.records.filter((record) => record.cohort === 'STABILITY_PROBE'));
const output = {
  scope: 'PAPER_SHADOW_R3_COMBINED_COHORT_READ_MODEL',
  caveat: 'Descriptive combination of version-compatible PAPER SHADOW windows. It is not a fitted model, statistical significance result, or authority surface.',
  policyIdentity: policyIdentity(windows[0].value),
  windows: windows.map((window) => ({
    file: window.file,
    windowId: window.value.windowId,
    principalObservations: window.value.analysis.volume.principalObservations,
    completedOutcomes: window.value.analysis.volume.completedOutcomes,
    capturedAtRange: capturedAtRange(window.value.records),
  })),
  volume: {
    windows: windows.length,
    principalObservations: principal.length,
    completedOutcomes: principal.filter((record) => record.outcomeProvenance === 'MARKET_DERIVED_COUNTERFACTUAL').length,
    stabilityObservations: stability.length,
    providerFailures: [...principal, ...stability].filter((record) => record.observation.status !== 'SUCCEEDED').length,
  },
  distributions: {
    jevRegime: count(principal.map((record) => answer(record, 'market_regime') ?? 'failure')),
    jevDirectionalPressure: count(principal.map((record) => answer(record, 'directional_pressure') ?? 'failure')),
    deterministicRegime: count(principal.map((record) => record.deterministicComparator?.marketRegime ?? 'missing')),
    deterministicDirectionalPressure: count(principal.map((record) => record.deterministicComparator?.directionalPressure ?? 'missing')),
  },
  comparatorComparison: {
    '1m': comparePaperR3Direction(principal, 1),
    '3m': comparePaperR3Direction(principal, 3),
  },
  disposition: principal.length < 100
    ? 'COLLECTION_CONTINUES_INSUFFICIENT_DIVERSITY_AND_N'
    : 'EVALUATION_REVIEW_REQUIRED_HOLDOUT_AND_REGIME_DIVERSITY_CHECK',
};
const outputPath = resolve(reportDirectory, 'AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3-COMBINED-COHORT.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
console.log(`Saved to ${outputPath}`);

function validateCohortIdentity(results) {
  const expected = JSON.stringify(policyIdentity(results[0]));
  for (const result of results.slice(1)) {
    if (JSON.stringify(policyIdentity(result)) !== expected) throw new Error('R3_COHORT_POLICY_MISMATCH');
  }
}
function policyIdentity(result) {
  return {
    questionSet: result.policies.questionSet,
    samplingPolicyId: result.policies.samplingPolicyId,
    featurePolicyId: result.policies.featurePolicyId,
    outcomeHorizonPolicy: result.policies.outcomeHorizonPolicy.policyId,
    referencePricePolicyId: result.policies.referencePricePolicyId,
    requestedModel: result.policies.model.requestedModel,
    comparatorPolicyId: result.policies.deterministicComparatorPolicy.policyId,
  };
}
function capturedAtRange(records) {
  const values = records.filter((record) => record.cohort === 'PRINCIPAL').map((record) => record.capturedAt).sort();
  return { first: values.at(0) ?? null, last: values.at(-1) ?? null };
}
function answer(record, questionId) { return record.observation.answers.find((answer) => answer.questionId === questionId)?.value; }
function count(values) { return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length])); }
