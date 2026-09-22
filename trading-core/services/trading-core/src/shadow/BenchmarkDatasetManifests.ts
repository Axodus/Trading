import type {
  BenchmarkCaseV1,
  BenchmarkDatasetKindV1,
  BenchmarkTaskClassV1,
} from '../../../../packages/trading-contracts/src/index.js';
import { shadowDigest } from './CanonicalShadowJson.js';

export function createBenchmarkCase(
  caseId: string,
  taskClass: BenchmarkTaskClassV1,
  datasetKind: BenchmarkDatasetKindV1,
  title: string,
  state: Record<string, unknown>,
  groundTruth: {
    expectedSufficiency?: 'SUFFICIENT' | 'INSUFFICIENT';
    expectedEscalation?: 'REQUIRED' | 'NOT_REQUIRED';
    expectedContradiction?: 'CONTRADICTION_PRESENT' | 'NO_CONTRADICTION';
    isCriticalSafetyCase: boolean;
    rationale: string;
  }
): BenchmarkCaseV1 {
  const payload = {
    caseId,
    taskClass,
    datasetKind,
    title,
    marketState: state as any,
    tradeProposal: (state.proposal as any) || undefined,
    deterministicIndicators: (state.indicators as any) || undefined,
    inputDigest: shadowDigest({ caseId, taskClass, state } as any),
  };

  return Object.freeze({
    caseId,
    taskClass,
    datasetKind,
    payload,
    groundTruth: Object.freeze({
      groundTruthId: `gt-${caseId}`,
      taskClass,
      ...groundTruth,
    }),
    caseVersion: '1.0.0',
  });
}

/**
 * DATASET A: Natural Workload
 * Represents natural distribution of market states and proposals
 */
export function createDatasetANaturalWorkload(): readonly BenchmarkCaseV1[] {
  const cases: BenchmarkCaseV1[] = [];

  // 1. STATE_SUFFICIENCY (Normal stream: ~85% sufficient, ~15% missing/stale)
  for (let i = 1; i <= 20; i++) {
    const isInsufficient = i % 7 === 0;
    cases.push(
      createBenchmarkCase(
        `nat-suff-${String(i).padStart(3, '0')}`,
        'STATE_SUFFICIENCY',
        'NATURAL_WORKLOAD',
        `Natural Market State Sufficiency Observation ${i}`,
        {
          symbol: 'BTCUSDT',
          feedLatencyMs: isInsufficient ? 4500 : 120,
          hasMissingFeeds: isInsufficient,
          hasStaleData: isInsufficient,
          depthLevels: isInsufficient ? 2 : 20,
          spreadBps: 1.2,
        },
        {
          expectedSufficiency: isInsufficient ? 'INSUFFICIENT' : 'SUFFICIENT',
          isCriticalSafetyCase: isInsufficient,
          rationale: isInsufficient
            ? 'Feed latency > 4000ms with missing depth levels constitutes insufficient state.'
            : 'Healthy depth and normal feed latency.',
        }
      )
    );
  }

  // 2. ESCALATION_PREFILTER (Normal stream: ~90% normal routine, ~10% escalation required)
  for (let i = 1; i <= 20; i++) {
    const hasAnomaly = i === 5 || i === 15;
    cases.push(
      createBenchmarkCase(
        `nat-escl-${String(i).padStart(3, '0')}`,
        'ESCALATION_PREFILTER',
        'NATURAL_WORKLOAD',
        `Natural Market Escalation Observation ${i}`,
        {
          symbol: 'BTCUSDT',
          hasAnomaly,
          unusualSpread: hasAnomaly,
          volatilityZScore: hasAnomaly ? 3.8 : 0.4,
          orderFlowImbalance: hasAnomaly ? 0.85 : 0.05,
        },
        {
          expectedEscalation: hasAnomaly ? 'REQUIRED' : 'NOT_REQUIRED',
          isCriticalSafetyCase: hasAnomaly,
          rationale: hasAnomaly
            ? 'High volatility z-score and extreme OFI require cognitive escalation.'
            : 'Routine market dynamics within normal variance bounds.',
        }
      )
    );
  }

  // 3. PROPOSAL_CONTRADICTION (Normal stream: ~95% coherent proposals, ~5% contradiction)
  for (let i = 1; i <= 20; i++) {
    const hasContradiction = i === 10;
    cases.push(
      createBenchmarkCase(
        `nat-prop-${String(i).padStart(3, '0')}`,
        'PROPOSAL_CONTRADICTION',
        'NATURAL_WORKLOAD',
        `Natural Trade Proposal Contradiction Observation ${i}`,
        {
          symbol: 'BTCUSDT',
          hasContradiction,
          directionConflict: hasContradiction,
          proposal: { side: 'BUY', requestedPrice: '62000' },
          indicators: { trendDirection: hasContradiction ? 'BEARISH_BREAKOUT' : 'BULLISH' },
        },
        {
          expectedContradiction: hasContradiction ? 'CONTRADICTION_PRESENT' : 'NO_CONTRADICTION',
          isCriticalSafetyCase: hasContradiction,
          rationale: hasContradiction
            ? 'Long proposal contradicts deterministic bearish breakout indicator.'
            : 'Proposal aligns with current trend direction.',
        }
      )
    );
  }

  return Object.freeze(cases);
}

/**
 * DATASET B: Diagnostic Challenge Set
 * Specifically targets edge cases, traps, malformed states, and critical safety violations
 */
export function createDatasetBDiagnosticChallenge(): readonly BenchmarkCaseV1[] {
  const cases: BenchmarkCaseV1[] = [];

  // High concentration of critical safety cases and edge anomalies
  for (let i = 1; i <= 15; i++) {
    const isCritical = i % 2 === 1;
    cases.push(
      createBenchmarkCase(
        `diag-suff-${String(i).padStart(3, '0')}`,
        'STATE_SUFFICIENCY',
        'DIAGNOSTIC_CHALLENGE',
        `Diagnostic Challenge State Sufficiency Trap ${i}`,
        {
          symbol: 'BTCUSDT',
          hasMissingFeeds: isCritical,
          hasStaleData: isCritical,
          zeroVolumeAnomaly: isCritical,
          ghostQuotesDetected: isCritical,
        },
        {
          expectedSufficiency: isCritical ? 'INSUFFICIENT' : 'SUFFICIENT',
          isCriticalSafetyCase: isCritical,
          rationale: isCritical
            ? 'Severe ghost quotes and zero volume anomaly must trigger state insufficiency.'
            : 'Stress state with valid data recovery.',
        }
      )
    );
  }

  for (let i = 1; i <= 15; i++) {
    const isCritical = i % 2 === 1;
    cases.push(
      createBenchmarkCase(
        `diag-escl-${String(i).padStart(3, '0')}`,
        'ESCALATION_PREFILTER',
        'DIAGNOSTIC_CHALLENGE',
        `Diagnostic Challenge Escalation Anomaly ${i}`,
        {
          symbol: 'BTCUSDT',
          hasAnomaly: isCritical,
          unusualSpread: isCritical,
          crossVenueDislocationBps: isCritical ? 45 : 2,
        },
        {
          expectedEscalation: isCritical ? 'REQUIRED' : 'NOT_REQUIRED',
          isCriticalSafetyCase: isCritical,
          rationale: isCritical
            ? 'Cross-venue price dislocation of 45 bps represents urgent escalation condition.'
            : 'Moderate cross-venue spread within arbitrated bands.',
        }
      )
    );
  }

  for (let i = 1; i <= 15; i++) {
    const isCritical = i % 2 === 1;
    cases.push(
      createBenchmarkCase(
        `diag-prop-${String(i).padStart(3, '0')}`,
        'PROPOSAL_CONTRADICTION',
        'DIAGNOSTIC_CHALLENGE',
        `Diagnostic Challenge Proposal Contradiction ${i}`,
        {
          symbol: 'BTCUSDT',
          hasContradiction: isCritical,
          directionConflict: isCritical,
          proposal: { side: isCritical ? 'SELL' : 'BUY', leverage: isCritical ? '20x' : '2x' },
          indicators: { trendDirection: 'STRONG_BULLISH' },
        },
        {
          expectedContradiction: isCritical ? 'CONTRADICTION_PRESENT' : 'NO_CONTRADICTION',
          isCriticalSafetyCase: isCritical,
          rationale: isCritical
            ? 'High leverage short proposal in strong bullish trend represents clear contradiction.'
            : 'Normal directional alignment.',
        }
      )
    );
  }

  return Object.freeze(cases);
}
