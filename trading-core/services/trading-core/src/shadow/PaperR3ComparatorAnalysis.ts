import { classifyDirectionalOutcome, type DeterministicDirectionalPressure } from './DeterministicMarketComparator.js';

export interface PaperR3ComparableRecord {
  deterministicComparator?: { directionalPressure: DeterministicDirectionalPressure };
  observation: { answers: readonly { questionId: string; value: string }[] };
  outcome?: { horizons: readonly { horizonMinutes: number; forwardReturn: string }[] };
}

export interface PaperR3DirectionComparison {
  horizonMinutes: number;
  directionalOutcomes: number;
  deterministicPredictions: number;
  deterministicCorrect: number;
  deterministicAbstentions: number;
  jevPredictions: number;
  jevCorrect: number;
  jevAbstentions: number;
  jointPredictions: number;
  bothCorrect: number;
  deterministicOnlyCorrect: number;
  jevOnlyCorrect: number;
  neitherCorrect: number;
}

/**
 * Descriptive, non-fitted comparison for R3. It does not declare a winner or
 * calculate statistical significance; that requires a sufficiently diverse,
 * frozen cohort and separate analysis gate.
 */
export function comparePaperR3Direction(
  records: readonly PaperR3ComparableRecord[],
  horizonMinutes: number,
): PaperR3DirectionComparison {
  let directionalOutcomes = 0;
  let deterministicPredictions = 0;
  let deterministicCorrect = 0;
  let jevPredictions = 0;
  let jevCorrect = 0;
  let jointPredictions = 0;
  let bothCorrect = 0;
  let deterministicOnlyCorrect = 0;
  let jevOnlyCorrect = 0;
  let neitherCorrect = 0;
  let deterministicAbstentions = 0;
  let jevAbstentions = 0;
  for (const record of records) {
    const outcome = record.outcome?.horizons.find((item) => item.horizonMinutes === horizonMinutes);
    if (!outcome) continue;
    const actual = classifyDirectionalOutcome(outcome.forwardReturn);
    const deterministic = record.deterministicComparator?.directionalPressure;
    const jev = record.observation.answers.find((answer) => answer.questionId === 'directional_pressure')?.value;
    const deterministicEligible = deterministic === 'upward' || deterministic === 'downward';
    const jevEligible = jev === 'upward' || jev === 'downward';
    if (actual === 'neutral') continue;
    directionalOutcomes += 1;
    if (!deterministicEligible) deterministicAbstentions += 1;
    if (!jevEligible) jevAbstentions += 1;
    const deterministicHit = deterministic === actual;
    const jevHit = jev === actual;
    if (deterministicEligible) {
      deterministicPredictions += 1;
      if (deterministicHit) deterministicCorrect += 1;
    }
    if (jevEligible) {
      jevPredictions += 1;
      if (jevHit) jevCorrect += 1;
    }
    if (!deterministicEligible || !jevEligible) continue;
    jointPredictions += 1;
    if (deterministicHit && jevHit) bothCorrect += 1;
    else if (deterministicHit) deterministicOnlyCorrect += 1;
    else if (jevHit) jevOnlyCorrect += 1;
    else neitherCorrect += 1;
  }
  return Object.freeze({
    horizonMinutes,
    directionalOutcomes,
    deterministicPredictions,
    deterministicCorrect,
    deterministicAbstentions,
    jevPredictions,
    jevCorrect,
    jevAbstentions,
    jointPredictions,
    bothCorrect,
    deterministicOnlyCorrect,
    jevOnlyCorrect,
    neitherCorrect,
  });
}
