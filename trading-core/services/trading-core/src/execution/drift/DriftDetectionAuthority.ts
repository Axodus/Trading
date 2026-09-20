import type {
  PerformanceEvaluation,
  DriftPolicy,
  PerformanceDriftAssessment,
  DriftClassification,
  DriftDimension,
  MetricAssessment,
  DriftPersistenceState,
} from '../../../../../packages/trading-contracts/src/index.js';
import {
  FixedDecimal,
  DEFAULT_DRIFT_POLICY_V1,
} from '../../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';

export interface AssessDriftOptions {
  policy?: DriftPolicy;
  priorPersistenceState?: DriftPersistenceState;
  asOf?: string;
}

export class DriftDetectionAuthority {
  public assessDrift(
    evaluation: PerformanceEvaluation,
    options: AssessDriftOptions = {}
  ): PerformanceDriftAssessment {
    const policy = options.policy ?? DEFAULT_DRIFT_POLICY_V1;
    const asOf = options.asOf ?? new Date().toISOString();
    const priorState = options.priorPersistenceState ?? {
      consecutiveDegradedWindows: 0,
      consecutiveNormalWindows: 0,
      isTriggered: false,
    };

    // 1. Mandatory Invariant: Insufficient Sample cannot be NORMAL
    if (evaluation.quality === 'INSUFFICIENT_DATA' || evaluation.sampleSize < policy.minSampleSize) {
      return {
        assessmentId: `drift-${evaluation.evaluationId}`,
        strategyId: evaluation.strategyId,
        strategyRevisionId: evaluation.strategyRevisionId,
        performanceEvaluationId: evaluation.evaluationId,
        driftPolicyId: policy.policyId,
        driftPolicyRevision: policy.policyRevision,
        classification: 'INSUFFICIENT_DATA',
        metricAssessments: [],
        driftDimensions: [],
        sampleSize: evaluation.sampleSize,
        persistenceState: {
          consecutiveDegradedWindows: 0,
          consecutiveNormalWindows: 0,
          previousClassification: 'INSUFFICIENT_DATA',
          isTriggered: false,
        },
        quality: 'INSUFFICIENT_DATA',
        createdAt: asOf,
        asOf,
        inputDigest: stableJson({
          evaluationId: evaluation.evaluationId,
          classification: 'INSUFFICIENT_DATA',
          sampleSize: evaluation.sampleSize,
          policyRevision: policy.policyRevision,
        }),
      };
    }

    // 2. Evaluate Individual Metric Deviations and Dimensions
    const metricAssessments: MetricAssessment[] = [];
    const driftDimensions = new Set<DriftDimension>();
    let hasCritical = false;
    let hasDegraded = false;

    for (const dev of evaluation.deviations) {
      let dimension: DriftDimension = 'ECONOMIC';
      let threshold = '0.000000000000';
      let isDegraded = false;
      let isCritical = false;

      if (dev.metricName === 'slippageBps') {
        dimension = 'EXECUTION';
        threshold = policy.slippageDriftThresholdBps ?? '20.000000000000';
        if (dev.absoluteDeviation && FixedDecimal.from(dev.absoluteDeviation).gt(FixedDecimal.from(threshold))) {
          isDegraded = true;
        }
      } else if (dev.metricName === 'fee') {
        dimension = 'COST';
        threshold = policy.feeDriftThresholdBps ?? '10.000000000000';
        if (dev.absoluteDeviation && FixedDecimal.from(dev.absoluteDeviation).gt(FixedDecimal.from(threshold))) {
          isDegraded = true;
        }
      } else if (dev.metricName === 'fillRatio') {
        dimension = 'FILL_QUALITY';
        threshold = policy.fillRatioDriftThreshold ?? '0.150000000000';
        if (dev.absoluteDeviation && FixedDecimal.from(dev.absoluteDeviation).gt(FixedDecimal.from(threshold))) {
          isDegraded = true;
        }
      } else if (dev.metricName === 'latencyMs') {
        dimension = 'LATENCY';
        threshold = String(policy.latencyDriftThresholdMs ?? 500);
        if (dev.absoluteDeviation && Number(dev.absoluteDeviation) > (policy.latencyDriftThresholdMs ?? 500)) {
          isDegraded = true;
        }
      } else if (dev.metricName === 'realizedNetPnl') {
        dimension = 'ECONOMIC';
        threshold = policy.economicDriftThresholdBps ?? '50.000000000000';
        if (dev.absoluteDeviation && FixedDecimal.from(dev.absoluteDeviation).gt(FixedDecimal.from(threshold))) {
          isDegraded = true;
        }
      }

      if (dev.status === 'UNAVAILABLE') {
        metricAssessments.push({
          metricName: dev.metricName,
          dimension,
          expected: dev.expectedValue,
          observed: dev.observedValue,
          severity: 'UNAVAILABLE',
          provenance: 'PerformanceEvaluation.deviations',
        });
      } else {
        if (isDegraded) {
          hasDegraded = true;
          driftDimensions.add(dimension);
        }
        metricAssessments.push({
          metricName: dev.metricName,
          dimension,
          expected: dev.expectedValue,
          observed: dev.observedValue,
          deviation: dev.absoluteDeviation,
          threshold,
          severity: isCritical ? 'CRITICAL' : (isDegraded ? 'DEGRADED' : 'NONE'),
          provenance: 'PerformanceEvaluation.deviations',
        });
      }
    }

    if (evaluation.quality === 'PARTIAL') {
      driftDimensions.add('DATA_QUALITY');
    }

    // 3. Determine Drift Classification with Persistence & Hysteresis
    let classification: DriftClassification = 'NORMAL';
    let nextPersistenceState: DriftPersistenceState;

    if (hasCritical) {
      classification = 'CRITICAL';
      nextPersistenceState = {
        consecutiveDegradedWindows: priorState.consecutiveDegradedWindows + 1,
        consecutiveNormalWindows: 0,
        previousClassification: 'CRITICAL',
        isTriggered: true,
      };
    } else if (hasDegraded) {
      const consecutiveDegraded = priorState.consecutiveDegradedWindows + 1;
      const isMaterial = consecutiveDegraded >= policy.persistenceWindowsRequired;
      classification = isMaterial ? 'MATERIAL' : 'DEGRADED';

      nextPersistenceState = {
        consecutiveDegradedWindows: consecutiveDegraded,
        consecutiveNormalWindows: 0,
        previousClassification: classification,
        isTriggered: isMaterial,
      };
    } else {
      // Current window is normal
      const consecutiveNormal = priorState.consecutiveNormalWindows + 1;
      const wasDegraded = priorState.previousClassification === 'DEGRADED' || priorState.previousClassification === 'MATERIAL';

      if (wasDegraded && consecutiveNormal < policy.recoveryWindowsRequired) {
        // Recovery hysteresis in effect: retain previous classification until recovery window threshold is met
        classification = priorState.previousClassification ?? 'DEGRADED';
        nextPersistenceState = {
          consecutiveDegradedWindows: priorState.consecutiveDegradedWindows,
          consecutiveNormalWindows: consecutiveNormal,
          previousClassification: classification,
          isTriggered: priorState.isTriggered,
        };
      } else {
        // Recovered to NORMAL
        classification = 'NORMAL';
        nextPersistenceState = {
          consecutiveDegradedWindows: 0,
          consecutiveNormalWindows: consecutiveNormal,
          previousClassification: 'NORMAL',
          isTriggered: false,
        };
      }
    }

    const assessmentId = `drift-${evaluation.evaluationId}`;
    const inputDigest = stableJson({
      evaluationId: evaluation.evaluationId,
      classification,
      driftDimensions: Array.from(driftDimensions).sort(),
      persistenceState: nextPersistenceState,
      policyRevision: policy.policyRevision,
    });

    return {
      assessmentId,
      strategyId: evaluation.strategyId,
      strategyRevisionId: evaluation.strategyRevisionId,
      performanceEvaluationId: evaluation.evaluationId,
      driftPolicyId: policy.policyId,
      driftPolicyRevision: policy.policyRevision,
      classification,
      metricAssessments,
      driftDimensions: Array.from(driftDimensions).sort(),
      sampleSize: evaluation.sampleSize,
      persistenceState: nextPersistenceState,
      quality: evaluation.quality,
      createdAt: asOf,
      asOf,
      inputDigest,
    };
  }
}
