import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EconomicBenchmarkHarness,
  MockEconomicDecisionProvider,
  createDatasetANaturalWorkload,
  createDatasetBDiagnosticChallenge,
  DEFAULT_QUALITY_FLOORS,
  DEFAULT_ESCALATION_POLICY,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import { FixedDecimal } from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';

describe('AXODUS-TRADING-IMP-03A Provider-Neutral Economic Benchmark Foundations', () => {
  const harness = new EconomicBenchmarkHarness();
  const datasetA = createDatasetANaturalWorkload();
  const datasetB = createDatasetBDiagnosticChallenge();

  const pricingSnapshot = Object.freeze({
    'cheap-parity-candidate': {
      providerId: 'cheap-parity-candidate',
      modelId: 'jev-mock-1.13.0',
      pricingVersion: '1.0',
      snapshotDate: '2026-09-22',
      inputPricePerMillionTokensUsd: '0.040',
      outputPricePerMillionTokensUsd: '0.000',
      fixedPerRequestSurchargeUsd: '0.00005',
      structuredOutputsSupported: true,
      isReferenceProvider: false,
    },
    'cheap-inferior-candidate': {
      providerId: 'cheap-inferior-candidate',
      modelId: 'cheap-flawed-v1',
      pricingVersion: '1.0',
      snapshotDate: '2026-09-22',
      inputPricePerMillionTokensUsd: '0.030',
      outputPricePerMillionTokensUsd: '0.000',
      structuredOutputsSupported: true,
      isReferenceProvider: false,
    },
    'reference-standard-llm': {
      providerId: 'reference-standard-llm',
      modelId: 'gpt-4o-mini-mock',
      pricingVersion: '1.0',
      snapshotDate: '2026-09-22',
      inputPricePerMillionTokensUsd: '0.150',
      outputPricePerMillionTokensUsd: '0.600',
      structuredOutputsSupported: true,
      isReferenceProvider: true,
    },
    'deterministic-baseline': {
      providerId: 'deterministic-baseline',
      modelId: 'exact-rule-v1',
      pricingVersion: '1.0',
      snapshotDate: '2026-09-22',
      inputPricePerMillionTokensUsd: '0.000',
      outputPricePerMillionTokensUsd: '0.000',
      structuredOutputsSupported: true,
      isReferenceProvider: false,
    },
  });

  it('proves that ground truth is strictly inaccessible in provider request payload', async () => {
    let capturedRequest = null;
    const inspectProvider = {
      providerId: 'inspect-provider',
      configured: true,
      async evaluate(req) {
        capturedRequest = req;
        return {
          observationId: 'obs-1',
          requestId: req.requestId,
          snapshotId: req.snapshot.snapshotId,
          correlationId: req.snapshot.correlationId,
          provider: 'inspect-provider',
          requestedModel: req.snapshot.requestedModel,
          status: 'SUCCEEDED',
          answers: [{ questionId: 'state_sufficiency', type: 'CHOICE', value: 'SUFFICIENT' }],
          attemptCount: 1,
          attempts: [],
          totalProviderWallTimeMs: 10,
          usage: { inputTokens: 100, outputTokens: 10 },
          observedAt: new Date().toISOString(),
          inputDigest: 'digest',
        };
      },
    };

    const singleCase = datasetA.slice(0, 1);
    await harness.evaluateBenchmark('NATURAL_WORKLOAD', singleCase, [inspectProvider], pricingSnapshot);

    assert.ok(capturedRequest !== null);
    assert.equal(capturedRequest.groundTruth, undefined);
    assert.equal(capturedRequest.snapshot.groundTruth, undefined);
    assert.equal(capturedRequest.snapshot.providerState.groundTruth, undefined);
    assert.equal(capturedRequest.snapshot.providerState.expectedSufficiency, undefined);
  });

  it('preserves provider failures and timeouts in denominators without inflating accuracy', async () => {
    const timeoutProvider = new MockEconomicDecisionProvider({
      providerId: 'timeout-provider',
      modelId: 'timeout-v1',
      profile: 'TIMEOUT_SIMULATOR',
      inputPricePerMillionTokensUsd: '0.10',
      outputPricePerMillionTokensUsd: '0.10',
    });

    const evalResult = await harness.evaluateBenchmark(
      'NATURAL_WORKLOAD',
      datasetA.slice(0, 10),
      [timeoutProvider],
      { 'timeout-provider': pricingSnapshot['cheap-parity-candidate'] }
    );

    const providerEval = evalResult.providerEvaluations[0];
    assert.equal(providerEval.totalCases, 10);
    assert.equal(providerEval.failedCases, 10);
    assert.equal(providerEval.successfulCases, 0);
    assert.equal(providerEval.usefulDecisionRate, 0.0);
    assert.equal(providerEval.qualityFloorPassed, false);
    assert.equal(providerEval.qualityAdjustedCostPerThousandUsd, 'INF');
  });

  it('separates abstentions from schema errors and verifies task-aware useful decision criteria', async () => {
    const abstainProvider = new MockEconomicDecisionProvider({
      providerId: 'abstain-provider',
      modelId: 'abstain-v1',
      profile: 'ABSTAINING_CANDIDATE',
      inputPricePerMillionTokensUsd: '0.040',
      outputPricePerMillionTokensUsd: '0.000',
    });

    const schemaErrorProvider = new MockEconomicDecisionProvider({
      providerId: 'schema-err-provider',
      modelId: 'schema-err-v1',
      profile: 'SCHEMA_ERROR_SIMULATOR',
      inputPricePerMillionTokensUsd: '0.040',
      outputPricePerMillionTokensUsd: '0.000',
    });

    const evalResult = await harness.evaluateBenchmark(
      'NATURAL_WORKLOAD',
      datasetA.slice(0, 10),
      [abstainProvider, schemaErrorProvider],
      {
        'abstain-provider': pricingSnapshot['cheap-parity-candidate'],
        'schema-err-provider': pricingSnapshot['cheap-parity-candidate'],
      }
    );

    const abstainEval = evalResult.providerEvaluations.find((e) => e.providerId === 'abstain-provider');
    const schemaEval = evalResult.providerEvaluations.find((e) => e.providerId === 'schema-err-provider');

    assert.ok(abstainEval);
    assert.ok(schemaEval);
    assert.equal(abstainEval.abstentionCount, 10);
    assert.equal(abstainEval.schemaCompliantCount, 10);
    assert.equal(schemaEval.schemaCompliantCount, 0);
    assert.equal(schemaEval.schemaComplianceRate, 0.0);
    assert.equal(schemaEval.qualityFloorPassed, false);
  });

  it('Scenario 1: Cheap provider ≈ Reference quality -> Confirms Economic Advantage', async () => {
    const parityProvider = new MockEconomicDecisionProvider({
      providerId: 'cheap-parity-candidate',
      modelId: 'jev-mock-1.13.0',
      profile: 'PARITY_CANDIDATE',
      inputPricePerMillionTokensUsd: '0.040',
      outputPricePerMillionTokensUsd: '0.000',
      fixedSurchargeUsd: '0.00005',
    });

    const referenceProvider = new MockEconomicDecisionProvider({
      providerId: 'reference-standard-llm',
      modelId: 'gpt-4o-mini-mock',
      profile: 'REFERENCE_STANDARD',
      inputPricePerMillionTokensUsd: '0.150',
      outputPricePerMillionTokensUsd: '0.600',
    });

    const evalResult = await harness.evaluateBenchmark(
      'NATURAL_WORKLOAD',
      datasetA,
      [parityProvider, referenceProvider],
      pricingSnapshot
    );

    const parityEval = evalResult.providerEvaluations.find((e) => e.providerId === 'cheap-parity-candidate');
    const refEval = evalResult.providerEvaluations.find((e) => e.providerId === 'reference-standard-llm');

    assert.ok(parityEval);
    assert.ok(refEval);
    assert.equal(parityEval.qualityFloorPassed, true);
    assert.equal(refEval.qualityFloorPassed, true);
    assert.ok(parityEval.usefulDecisionRate >= 0.95);
    assert.ok(refEval.usefulDecisionRate >= 0.95);

    // Verify exact FixedDecimal cost advantage
    const parityCost = FixedDecimal.from(parityEval.totalCostUsd);
    const refCost = FixedDecimal.from(refEval.totalCostUsd);
    assert.ok(parityCost.lt(refCost));

    // Paired comparison confirms equivalence and massive cost reduction
    const paired = evalResult.pairedComparisons[0];
    assert.ok(paired);
    assert.ok(paired.statisticallyEquivalentOrSuperior);
    assert.ok(paired.costReductionRatio > 0.65); // >65% cost reduction
    assert.equal(evalResult.economicConclusion, 'ECONOMIC_ADVANTAGE_CONFIRMED');
  });

  it('Scenario 2: Cheap provider << Reference quality -> Disqualified by Quality Floor despite low cost', async () => {
    const inferiorProvider = new MockEconomicDecisionProvider({
      providerId: 'cheap-inferior-candidate',
      modelId: 'cheap-flawed-v1',
      profile: 'INFERIOR_CANDIDATE',
      inputPricePerMillionTokensUsd: '0.010',
      outputPricePerMillionTokensUsd: '0.000',
    });

    const referenceProvider = new MockEconomicDecisionProvider({
      providerId: 'reference-standard-llm',
      modelId: 'gpt-4o-mini-mock',
      profile: 'REFERENCE_STANDARD',
      inputPricePerMillionTokensUsd: '0.150',
      outputPricePerMillionTokensUsd: '0.600',
    });

    const evalResult = await harness.evaluateBenchmark(
      'DIAGNOSTIC_CHALLENGE',
      datasetB,
      [inferiorProvider, referenceProvider],
      pricingSnapshot
    );

    const inferiorEval = evalResult.providerEvaluations.find((e) => e.providerId === 'cheap-inferior-candidate');
    assert.ok(inferiorEval);
    assert.ok(inferiorEval.criticalFalseSafeCount > 0);
    assert.equal(inferiorEval.qualityFloorPassed, false);
    assert.equal(evalResult.economicConclusion, 'DISQUALIFIED_BY_QUALITY_FLOOR');
  });

  it('Scenario 3: Deterministic baseline dominates both -> Confirms NO_LLM_JUSTIFIED at $0 cost', async () => {
    const deterministicProvider = new MockEconomicDecisionProvider({
      providerId: 'deterministic-baseline',
      modelId: 'exact-rule-v1',
      profile: 'DETERMINISTIC_BASELINE',
      inputPricePerMillionTokensUsd: '0.000',
      outputPricePerMillionTokensUsd: '0.000',
    });

    const referenceProvider = new MockEconomicDecisionProvider({
      providerId: 'reference-standard-llm',
      modelId: 'gpt-4o-mini-mock',
      profile: 'REFERENCE_STANDARD',
      inputPricePerMillionTokensUsd: '0.150',
      outputPricePerMillionTokensUsd: '0.600',
    });

    const evalResult = await harness.evaluateBenchmark(
      'NATURAL_WORKLOAD',
      datasetA,
      [deterministicProvider, referenceProvider],
      pricingSnapshot
    );

    const detEval = evalResult.providerEvaluations.find((e) => e.providerId === 'deterministic-baseline');
    assert.ok(detEval);
    assert.equal(detEval.totalCostUsd, '0');
    assert.equal(detEval.qualityAdjustedCostPerThousandUsd, '0');
    assert.equal(detEval.qualityFloorPassed, true);
    assert.equal(evalResult.economicConclusion, 'NO_LLM_JUSTIFIED');
  });

  it('simulates tiered escalation with exact FixedDecimal cost reduction tracking', async () => {
    const parityProvider = new MockEconomicDecisionProvider({
      providerId: 'cheap-parity-candidate',
      modelId: 'jev-mock-1.13.0',
      profile: 'PARITY_CANDIDATE',
      inputPricePerMillionTokensUsd: '0.040',
      outputPricePerMillionTokensUsd: '0.000',
      fixedSurchargeUsd: '0.00005',
    });

    const referenceProvider = new MockEconomicDecisionProvider({
      providerId: 'reference-standard-llm',
      modelId: 'gpt-4o-mini-mock',
      profile: 'REFERENCE_STANDARD',
      inputPricePerMillionTokensUsd: '0.150',
      outputPricePerMillionTokensUsd: '0.600',
    });

    const evalResult = await harness.evaluateBenchmark(
      'NATURAL_WORKLOAD',
      datasetA,
      [parityProvider, referenceProvider],
      pricingSnapshot,
      DEFAULT_ESCALATION_POLICY
    );

    const escEval = evalResult.escalationEvaluations[0];
    assert.ok(escEval);
    assert.equal(escEval.tier1ProviderId, 'cheap-parity-candidate');
    assert.equal(escEval.tier2ProviderId, 'reference-standard-llm');
    assert.ok(escEval.tier1HandledCount > 0);
    assert.ok(escEval.combinedUsefulRate >= 0.95);
    assert.equal(escEval.combinedCriticalFalseSafeCount, 0);
    assert.ok(escEval.costReductionVsReferencePercent > 40);
    assert.equal(escEval.qualityFloorPassed, true);
  });
});
