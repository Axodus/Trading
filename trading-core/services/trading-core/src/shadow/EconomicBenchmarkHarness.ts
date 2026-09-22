import { FixedDecimal } from '../../../../packages/trading-contracts/src/index.js';
import type {
  BenchmarkCaseV1,
  BenchmarkDatasetKindV1,
  BenchmarkTaskClassV1,
  EconomicBenchmarkEvaluationV1,
  EscalationEvaluationV1,
  EscalationPolicyV1,
  PairedComparisonV1,
  ProviderBenchmarkEvaluationV1,
  ProviderCaseResultV1,
  ProviderPricingSnapshotV1,
  ProviderTaskDecisionV1,
  QualityFloorThresholdsV1,
  ShadowDecisionRequest,
  ShadowQuestion,
} from '../../../../packages/trading-contracts/src/index.js';
import { shadowDigest } from './CanonicalShadowJson.js';
import type { DecisionProvider } from './DecisionProvider.js';

export const DEFAULT_QUALITY_FLOORS: Readonly<Record<BenchmarkTaskClassV1, QualityFloorThresholdsV1>> = Object.freeze({
  STATE_SUFFICIENCY: Object.freeze({
    maxCriticalFalseSafeRate: 0.0, // Zero tolerance for false sufficiency on corrupted/missing feeds
    maxSchemaFailureRate: 0.02,
    minUsefulDecisionRate: 0.90,
  }),
  ESCALATION_PREFILTER: Object.freeze({
    maxCriticalFalseSafeRate: 0.0, // Zero tolerance for missing severe market dislocation anomalies
    maxSchemaFailureRate: 0.02,
    minUsefulDecisionRate: 0.88,
  }),
  PROPOSAL_CONTRADICTION: Object.freeze({
    maxCriticalFalseSafeRate: 0.0, // Zero tolerance for approving direct contradiction proposals
    maxSchemaFailureRate: 0.02,
    minUsefulDecisionRate: 0.90,
  }),
});

export const DEFAULT_ESCALATION_POLICY: EscalationPolicyV1 = Object.freeze({
  policyId: 'jev-escalation-policy-v1',
  escalateOnAbstain: true,
  escalateConfidenceThreshold: 0.75,
  escalateOnStateInsufficient: true,
  escalateOnAnomalyDetected: true,
});

export class EconomicBenchmarkHarness {
  constructor(
    private readonly qualityFloors: Readonly<Record<BenchmarkTaskClassV1, QualityFloorThresholdsV1>> = DEFAULT_QUALITY_FLOORS,
  ) {}

  /**
   * Evaluates a list of benchmark cases against a set of candidate DecisionProviders.
   * Ensures zero cross-contamination and deterministic calculation of exact QAC/FAC using FixedDecimal.
   */
  async evaluateBenchmark(
    datasetKind: BenchmarkDatasetKindV1,
    cases: readonly BenchmarkCaseV1[],
    providers: readonly DecisionProvider[],
    pricingMap: Readonly<Record<string, ProviderPricingSnapshotV1>>,
    escalationPolicy: EscalationPolicyV1 = DEFAULT_ESCALATION_POLICY,
  ): Promise<EconomicBenchmarkEvaluationV1> {
    const providerResults = new Map<string, ProviderCaseResultV1[]>();

    for (const provider of providers) {
      const results: ProviderCaseResultV1[] = [];
      const pricing = pricingMap[provider.providerId] || {
        providerId: provider.providerId,
        modelId: 'unknown',
        pricingVersion: '1.0',
        snapshotDate: '2026-09-22',
        inputPricePerMillionTokensUsd: '0.15',
        outputPricePerMillionTokensUsd: '0.60',
        structuredOutputsSupported: true,
        isReferenceProvider: false,
      };

      for (const bCase of cases) {
        // Build isolated request - strictly exclude ground truth from payload
        const request = this.buildIsolatedRequest(bCase, provider.providerId);

        let observation;
        try {
          observation = await provider.evaluate(request);
        } catch (err) {
          // Failure preserved in denominator
          observation = {
            status: 'UNAVAILABLE' as const,
            answers: [],
            attemptCount: 1,
            attempts: [],
            totalProviderWallTimeMs: 0,
            usage: { inputTokens: 0, outputTokens: 0 },
            observedAt: new Date().toISOString(),
          };
        }

        const caseResult = this.evaluateProviderCase(bCase, observation as any, pricing);
        results.push(caseResult);
      }

      providerResults.set(provider.providerId, results);
    }

    // 1. Calculate Individual Provider Evaluations
    const providerEvaluations: ProviderBenchmarkEvaluationV1[] = [];
    for (const provider of providers) {
      const results = providerResults.get(provider.providerId) || [];
      const evalMetrics = this.aggregateProviderEvaluation(provider.providerId, datasetKind, results, cases);
      providerEvaluations.push(evalMetrics);
    }

    // 2. Calculate Paired Comparisons (Candidate vs Reference / Baseline)
    const pairedComparisons: PairedComparisonV1[] = [];
    const referenceProvider = providers.find((p) => pricingMap[p.providerId]?.isReferenceProvider);
    const candidateProviders = providers.filter((p) => p.providerId !== referenceProvider?.providerId);

    if (referenceProvider) {
      const refResults = providerResults.get(referenceProvider.providerId) || [];
      const refEval = providerEvaluations.find((e) => e.providerId === referenceProvider.providerId);

      for (const candidate of candidateProviders) {
        const candResults = providerResults.get(candidate.providerId) || [];
        const candEval = providerEvaluations.find((e) => e.providerId === candidate.providerId);
        if (candEval && refEval) {
          pairedComparisons.push(this.computePairedComparison(datasetKind, candidate.providerId, candResults, candEval, referenceProvider.providerId, refResults, refEval));
        }
      }
    }

    // 3. Escalation Simulation (Tier 1 + Tier 2 Escalation)
    const escalationEvaluations: EscalationEvaluationV1[] = [];
    if (referenceProvider) {
      for (const candidate of candidateProviders) {
        if (candidate.providerId === 'deterministic-baseline') continue;
        const candResults = providerResults.get(candidate.providerId) || [];
        const refResults = providerResults.get(referenceProvider.providerId) || [];
        const refEval = providerEvaluations.find((e) => e.providerId === referenceProvider.providerId);

        if (refEval) {
          const escEval = this.simulateEscalation(
            escalationPolicy,
            datasetKind,
            candidate.providerId,
            candResults,
            referenceProvider.providerId,
            refResults,
            refEval,
            cases
          );
          escalationEvaluations.push(escEval);
        }
      }
    }

    // 4. Formulate Global Economic Conclusion
    let economicConclusion: EconomicBenchmarkEvaluationV1['economicConclusion'] = 'INSUFFICIENT_EVIDENCE';
    const candidateEval = providerEvaluations.find((e) => !pricingMap[e.providerId]?.isReferenceProvider && e.providerId !== 'deterministic-baseline');
    const deterministicEval = providerEvaluations.find((e) => e.providerId === 'deterministic-baseline');

    if (deterministicEval && deterministicEval.qualityFloorPassed && deterministicEval.usefulDecisionRate >= 0.98) {
      // Deterministic rule completely solves the problem at $0 cost
      economicConclusion = 'NO_LLM_JUSTIFIED';
    } else if (candidateEval) {
      if (!candidateEval.qualityFloorPassed) {
        economicConclusion = 'DISQUALIFIED_BY_QUALITY_FLOOR';
      } else {
        economicConclusion = 'ECONOMIC_ADVANTAGE_CONFIRMED';
      }
    }

    const evaluationId = `econ-eval:${shadowDigest({ datasetKind, providerEvaluations } as any).slice(8)}`;

    return Object.freeze({
      evaluationId,
      evaluationVersion: '1.0.0',
      evaluatedAt: new Date().toISOString(),
      datasetKind,
      providerEvaluations: Object.freeze(providerEvaluations),
      pairedComparisons: Object.freeze(pairedComparisons),
      escalationEvaluations: Object.freeze(escalationEvaluations),
      economicConclusion,
    });
  }

  private buildIsolatedRequest(bCase: BenchmarkCaseV1, providerId: string): ShadowDecisionRequest {
    const questions: ShadowQuestion[] = [];
    if (bCase.taskClass === 'STATE_SUFFICIENCY') {
      questions.push({
        questionId: 'state_sufficiency',
        type: 'CHOICE',
        instructions: 'Determine if the supplied market state is sufficient for trading execution.',
        options: { SUFFICIENT: 'State is sufficient', INSUFFICIENT: 'State is insufficient / corrupted' },
      });
    } else if (bCase.taskClass === 'ESCALATION_PREFILTER') {
      questions.push({
        questionId: 'escalation_required',
        type: 'CHOICE',
        instructions: 'Determine if this observation contains anomalies requiring human or heavy model escalation.',
        options: { REQUIRED: 'Escalation required', NOT_REQUIRED: 'Routine market state' },
      });
    } else if (bCase.taskClass === 'PROPOSAL_CONTRADICTION') {
      questions.push({
        questionId: 'proposal_contradiction',
        type: 'CHOICE',
        instructions: 'Determine if the trade proposal contradicts current technical and market conditions.',
        options: { CONTRADICTION_PRESENT: 'Contradiction exists', NO_CONTRADICTION: 'Coherent with indicators' },
      });
    }

    const snapshot = {
      snapshotId: `snap-${bCase.caseId}`,
      correlationId: `corr-${bCase.caseId}`,
      capturedAt: new Date().toISOString(),
      environment: 'PAPER' as const,
      strategyId: 'economic-benchmark',
      strategyRevisionId: 'v1',
      instrument: 'BTCUSDT',
      marketStateRef: bCase.caseId,
      marketStateDigest: bCase.payload.inputDigest,
      experiment: { experimentId: 'economic-benchmark-imp-03a', experimentVersion: '1' },
      questionSet: { questionSetId: `econ-qset-${bCase.taskClass.toLowerCase()}`, questionSetVersion: '1' },
      requestedProvider: providerId,
      requestedModel: 'benchmark-model',
      providerState: bCase.payload.marketState,
      inputDigest: bCase.payload.inputDigest,
    };

    return Object.freeze({
      requestId: `req-${bCase.caseId}-${providerId}`,
      snapshot,
      questions: Object.freeze(questions),
      requestedAt: new Date().toISOString(),
      timeoutMs: 5000,
      inputDigest: shadowDigest({ snapshot, questions } as any),
    });
  }

  private evaluateProviderCase(
    bCase: BenchmarkCaseV1,
    observation: {
      status: string;
      answers: readonly { questionId: string; value: string; confidence?: number; probabilities?: Record<string, number> }[];
      totalProviderWallTimeMs?: number;
      usage?: { inputTokens?: number; outputTokens?: number };
      observedAt?: string;
    },
    pricing: ProviderPricingSnapshotV1,
  ): ProviderCaseResultV1 {
    const isSuccess = observation.status === 'SUCCEEDED';
    let isSchemaCompliant = isSuccess;
    let decision: ProviderTaskDecisionV1 = { abstained: false, rawAnswers: observation.answers as any || [] };

    if (!isSuccess || !observation.answers || observation.answers.length === 0) {
      isSchemaCompliant = false;
      decision = { abstained: true, rawAnswers: [] };
    } else {
      const ans = observation.answers[0];
      const isAbstain = ans?.value === 'ABSTAIN';

      if (bCase.taskClass === 'STATE_SUFFICIENCY') {
        if (!['SUFFICIENT', 'INSUFFICIENT', 'ABSTAIN'].includes(ans?.value || '')) isSchemaCompliant = false;
        decision = {
          stateSufficient: ans?.value === 'SUFFICIENT' ? true : ans?.value === 'INSUFFICIENT' ? false : undefined,
          confidence: ans?.confidence,
          abstained: isAbstain,
          rawAnswers: observation.answers as any,
        };
      } else if (bCase.taskClass === 'ESCALATION_PREFILTER') {
        if (!['REQUIRED', 'NOT_REQUIRED', 'ABSTAIN'].includes(ans?.value || '')) isSchemaCompliant = false;
        decision = {
          escalationRequired: ans?.value === 'REQUIRED' ? true : ans?.value === 'NOT_REQUIRED' ? false : undefined,
          confidence: ans?.confidence,
          abstained: isAbstain,
          rawAnswers: observation.answers as any,
        };
      } else if (bCase.taskClass === 'PROPOSAL_CONTRADICTION') {
        if (!['CONTRADICTION_PRESENT', 'NO_CONTRADICTION', 'ABSTAIN'].includes(ans?.value || '')) isSchemaCompliant = false;
        decision = {
          contradictionDetected: ans?.value === 'CONTRADICTION_PRESENT' ? true : ans?.value === 'NO_CONTRADICTION' ? false : undefined,
          confidence: ans?.confidence,
          abstained: isAbstain,
          rawAnswers: observation.answers as any,
        };
      }
    }

    // Task-Aware USEFUL_DECISION & Correctness Evaluation
    let isCorrect = false;
    let isUsefulDecision = false;
    let isCriticalFalseSafe = false;

    if (isSchemaCompliant && !decision.abstained) {
      if (bCase.taskClass === 'STATE_SUFFICIENCY') {
        const expected = bCase.groundTruth.expectedSufficiency === 'SUFFICIENT';
        isCorrect = decision.stateSufficient === expected;
        isUsefulDecision = isCorrect;
        // Critical False-Safe: declared sufficient when state was actually corrupted / insufficient
        if (bCase.groundTruth.isCriticalSafetyCase && bCase.groundTruth.expectedSufficiency === 'INSUFFICIENT' && decision.stateSufficient === true) {
          isCriticalFalseSafe = true;
        }
      } else if (bCase.taskClass === 'ESCALATION_PREFILTER') {
        const expected = bCase.groundTruth.expectedEscalation === 'REQUIRED';
        isCorrect = decision.escalationRequired === expected;
        isUsefulDecision = isCorrect;
        // Critical False-Safe: declared not required when urgent anomaly escalation was required
        if (bCase.groundTruth.isCriticalSafetyCase && bCase.groundTruth.expectedEscalation === 'REQUIRED' && decision.escalationRequired === false) {
          isCriticalFalseSafe = true;
        }
      } else if (bCase.taskClass === 'PROPOSAL_CONTRADICTION') {
        const expected = bCase.groundTruth.expectedContradiction === 'CONTRADICTION_PRESENT';
        isCorrect = decision.contradictionDetected === expected;
        isUsefulDecision = isCorrect;
        // Critical False-Safe: missed contradiction and falsely claimed no contradiction
        if (bCase.groundTruth.isCriticalSafetyCase && bCase.groundTruth.expectedContradiction === 'CONTRADICTION_PRESENT' && decision.contradictionDetected === false) {
          isCriticalFalseSafe = true;
        }
      }
    }

    // Exact Cost calculation using FixedDecimal
    const inTokens = observation.usage?.inputTokens || 0;
    const outTokens = observation.usage?.outputTokens || 0;
    const inPrice = FixedDecimal.from(pricing.inputPricePerMillionTokensUsd);
    const outPrice = FixedDecimal.from(pricing.outputPricePerMillionTokensUsd);
    const million = FixedDecimal.from('1000000');
    const surcharge = pricing.fixedPerRequestSurchargeUsd ? FixedDecimal.from(pricing.fixedPerRequestSurchargeUsd) : FixedDecimal.zero();

    const inCost = FixedDecimal.from(inTokens).mul(inPrice).div(million);
    const outCost = FixedDecimal.from(outTokens).mul(outPrice).div(million);
    const totalCaseCost = inCost.add(outCost).add(surcharge);

    return Object.freeze({
      caseId: bCase.caseId,
      taskClass: bCase.taskClass,
      datasetKind: bCase.datasetKind,
      providerId: pricing.providerId,
      modelId: pricing.modelId,
      status: (observation.status as any) || 'FAILED',
      decision,
      isSchemaCompliant,
      isUsefulDecision,
      isCorrect,
      isCriticalFalseSafe,
      latencyMs: observation.totalProviderWallTimeMs || 0,
      inputTokens: inTokens,
      outputTokens: outTokens,
      costUsd: totalCaseCost.toString(),
      evaluatedAt: observation.observedAt || new Date().toISOString(),
    });
  }

  private aggregateProviderEvaluation(
    providerId: string,
    datasetKind: BenchmarkDatasetKindV1,
    results: readonly ProviderCaseResultV1[],
    cases: readonly BenchmarkCaseV1[],
  ): ProviderBenchmarkEvaluationV1 {
    const totalCases = cases.length;
    let successfulCases = 0;
    let failedCases = 0;
    let schemaCompliantCount = 0;
    let abstentionCount = 0;
    let correctCount = 0;
    let usefulDecisionCount = 0;
    let criticalFalseSafeCount = 0;
    let totalCost = FixedDecimal.zero();
    const latencies: number[] = [];

    for (const res of results) {
      if (res.status === 'SUCCEEDED') successfulCases += 1;
      else failedCases += 1;
      if (res.isSchemaCompliant) schemaCompliantCount += 1;
      if (res.decision.abstained) abstentionCount += 1;
      if (res.isCorrect) correctCount += 1;
      if (res.isUsefulDecision) usefulDecisionCount += 1;
      if (res.isCriticalFalseSafe) criticalFalseSafeCount += 1;
      totalCost = totalCost.add(FixedDecimal.from(res.costUsd));
      latencies.push(res.latencyMs);
    }

    latencies.sort((a, b) => a - b);
    const p50LatencyMs = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] || 0;

    const usefulDecisionRate = totalCases > 0 ? usefulDecisionCount / totalCases : 0;
    const criticalFalseSafeRate = totalCases > 0 ? criticalFalseSafeCount / totalCases : 0;
    const schemaComplianceRate = totalCases > 0 ? schemaCompliantCount / totalCases : 0;

    // Quality Floor Verification
    let qualityFloorPassed = true;
    for (const bCase of cases) {
      const thresholds = this.qualityFloors[bCase.taskClass];
      if (criticalFalseSafeRate > thresholds.maxCriticalFalseSafeRate) qualityFloorPassed = false;
      if (schemaComplianceRate < (1 - thresholds.maxSchemaFailureRate)) qualityFloorPassed = false;
      if (usefulDecisionRate < thresholds.minUsefulDecisionRate) qualityFloorPassed = false;
    }

    // Exact QAC (Quality-Adjusted Cost per 1k Useful Decisions) & FAC (Full Accuracy Cost)
    const thousand = FixedDecimal.from('1000');
    let qacStr = '0';
    let facStr = '0';

    if (usefulDecisionCount > 0) {
      // QAC = (Total Cost / Useful Decisions) * 1000
      qacStr = totalCost.div(FixedDecimal.from(usefulDecisionCount)).mul(thousand).toString();
    } else {
      qacStr = 'INF';
    }

    if (correctCount > 0) {
      // FAC = (Total Cost / Correct Decisions) * 1000
      facStr = totalCost.div(FixedDecimal.from(correctCount)).mul(thousand).toString();
    } else {
      facStr = 'INF';
    }

    // ICQ (Information Cost Quality Ratio)
    let icqRatio = 0;
    if (usefulDecisionCount > 0) {
      icqRatio = usefulDecisionRate / (parseFloat(totalCost.toString()) || 0.000001);
    }

    return Object.freeze({
      providerId,
      modelId: results[0]?.modelId || 'unknown',
      datasetKind,
      totalCases,
      successfulCases,
      failedCases,
      schemaCompliantCount,
      abstentionCount,
      correctCount,
      usefulDecisionCount,
      criticalFalseSafeCount,
      usefulDecisionRate,
      criticalFalseSafeRate,
      schemaComplianceRate,
      qualityFloorPassed,
      totalCostUsd: totalCost.toString(),
      qualityAdjustedCostPerThousandUsd: qacStr,
      fullAccuracyCostPerThousandUsd: facStr,
      informationCostQualityRatio: icqRatio,
      p50LatencyMs,
      p95LatencyMs,
    });
  }

  private computePairedComparison(
    datasetKind: BenchmarkDatasetKindV1,
    candidateId: string,
    candResults: readonly ProviderCaseResultV1[],
    candEval: ProviderBenchmarkEvaluationV1,
    baselineId: string,
    baseResults: readonly ProviderCaseResultV1[],
    baseEval: ProviderBenchmarkEvaluationV1,
  ): PairedComparisonV1 {
    const totalPairedCases = Math.min(candResults.length, baseResults.length);
    let candidateUsefulDecisions = 0;
    let baselineUsefulDecisions = 0;
    let bothUseful = 0;
    let candidateOnlyUseful = 0;
    let baselineOnlyUseful = 0;
    let neitherUseful = 0;

    for (let i = 0; i < totalPairedCases; i++) {
      const c = candResults[i]!;
      const b = baseResults[i]!;

      if (c.isUsefulDecision) candidateUsefulDecisions += 1;
      if (b.isUsefulDecision) baselineUsefulDecisions += 1;

      if (c.isUsefulDecision && b.isUsefulDecision) bothUseful += 1;
      else if (c.isUsefulDecision && !b.isUsefulDecision) candidateOnlyUseful += 1;
      else if (!c.isUsefulDecision && b.isUsefulDecision) baselineOnlyUseful += 1;
      else neitherUseful += 1;
    }

    // Paired McNemar Test Statistic: (|b - c| - 1)^2 / (b + c) with continuity correction
    const b = baselineOnlyUseful;
    const c = candidateOnlyUseful;
    let mcNemarChiSquared = 0;
    if (b + c > 0) {
      mcNemarChiSquared = Math.pow(Math.max(0, Math.abs(b - c) - 1), 2) / (b + c);
    }
    // Approximation of p-value for 1 df chi-squared
    const mcNemarPValueApprox = Math.exp(-0.5 * mcNemarChiSquared);

    const baseCostNum = parseFloat(baseEval.qualityAdjustedCostPerThousandUsd) || 1;
    const candCostNum = parseFloat(candEval.qualityAdjustedCostPerThousandUsd) || 0;
    const costReductionRatio = baseCostNum > 0 ? (baseCostNum - candCostNum) / baseCostNum : 0;

    const statisticallyEquivalentOrSuperior = candEval.usefulDecisionRate >= (baseEval.usefulDecisionRate - 0.03);

    return Object.freeze({
      baselineProviderId: baselineId,
      candidateProviderId: candidateId,
      datasetKind,
      totalPairedCases,
      candidateUsefulDecisions,
      baselineUsefulDecisions,
      bothUseful,
      candidateOnlyUseful,
      baselineOnlyUseful,
      neitherUseful,
      mcNemarChiSquared,
      mcNemarPValueApprox,
      statisticallyEquivalentOrSuperior,
      candidateCostPerThousandUsd: candEval.qualityAdjustedCostPerThousandUsd,
      baselineCostPerThousandUsd: baseEval.qualityAdjustedCostPerThousandUsd,
      costReductionRatio,
    });
  }

  private simulateEscalation(
    policy: EscalationPolicyV1,
    datasetKind: BenchmarkDatasetKindV1,
    tier1Id: string,
    tier1Results: readonly ProviderCaseResultV1[],
    tier2Id: string,
    tier2Results: readonly ProviderCaseResultV1[],
    tier2Eval: ProviderBenchmarkEvaluationV1,
    cases: readonly BenchmarkCaseV1[],
  ): EscalationEvaluationV1 {
    const totalCases = cases.length;
    let tier1HandledCount = 0;
    let escalatedCount = 0;
    let combinedCorrectCount = 0;
    let combinedUsefulCount = 0;
    let combinedCriticalFalseSafeCount = 0;
    let totalCost = FixedDecimal.zero();

    for (let i = 0; i < totalCases; i++) {
      const t1 = tier1Results[i]!;
      const t2 = tier2Results[i]!;

      // Determine if escalation is triggered
      let shouldEscalate = false;
      if (t1.decision.abstained && policy.escalateOnAbstain) shouldEscalate = true;
      if (t1.decision.confidence !== undefined && policy.escalateConfidenceThreshold !== undefined && t1.decision.confidence < policy.escalateConfidenceThreshold) {
        shouldEscalate = true;
      }
      if (policy.escalateOnStateInsufficient && t1.decision.stateSufficient === false) shouldEscalate = true;
      if (policy.escalateOnAnomalyDetected && t1.decision.escalationRequired === true) shouldEscalate = true;

      totalCost = totalCost.add(FixedDecimal.from(t1.costUsd));

      if (shouldEscalate) {
        escalatedCount += 1;
        totalCost = totalCost.add(FixedDecimal.from(t2.costUsd));
        if (t2.isCorrect) combinedCorrectCount += 1;
        if (t2.isUsefulDecision) combinedUsefulCount += 1;
        if (t2.isCriticalFalseSafe) combinedCriticalFalseSafeCount += 1;
      } else {
        tier1HandledCount += 1;
        if (t1.isCorrect) combinedCorrectCount += 1;
        if (t1.isUsefulDecision) combinedUsefulCount += 1;
        if (t1.isCriticalFalseSafe) combinedCriticalFalseSafeCount += 1;
      }
    }

    const escalationRate = totalCases > 0 ? escalatedCount / totalCases : 0;
    const combinedUsefulRate = totalCases > 0 ? combinedUsefulCount / totalCases : 0;
    const combinedCriticalFalseSafeRate = totalCases > 0 ? combinedCriticalFalseSafeCount / totalCases : 0;

    const refTotalCostNum = parseFloat(tier2Eval.totalCostUsd) || 1;
    const hybridCostNum = parseFloat(totalCost.toString());
    const costReductionVsReferencePercent = refTotalCostNum > 0 ? ((refTotalCostNum - hybridCostNum) / refTotalCostNum) * 100 : 0;

    const qualityFloorPassed = combinedCriticalFalseSafeRate === 0 && combinedUsefulRate >= 0.90;

    return Object.freeze({
      escalationPolicyId: policy.policyId,
      tier1ProviderId: tier1Id,
      tier2ProviderId: tier2Id,
      datasetKind,
      totalCases,
      tier1HandledCount,
      escalatedCount,
      escalationRate,
      combinedCorrectCount,
      combinedUsefulCount,
      combinedCriticalFalseSafeCount,
      combinedUsefulRate,
      combinedCriticalFalseSafeRate,
      totalCostUsd: totalCost.toString(),
      costReductionVsReferencePercent,
      qualityFloorPassed,
    });
  }
}
