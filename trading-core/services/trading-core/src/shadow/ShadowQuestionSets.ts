import type { ShadowQuestion } from '../../../../packages/trading-contracts/src/index.js';

export const JEV_SHADOW_QUESTION_SET_V1: readonly ShadowQuestion[] = Object.freeze([
  Object.freeze({
    questionId: 'state_sufficiency',
    type: 'CHOICE' as const,
    instructions: 'Is the supplied market and proposal state sufficient for a bounded assessment?',
    options: Object.freeze({ sufficient: 'Enough current information is present', insufficient: 'Material information is missing or stale' }),
  }),
  Object.freeze({
    questionId: 'proposal_alignment',
    type: 'CHOICE' as const,
    instructions: 'Does the proposed direction appear aligned with the supplied market state?',
    options: Object.freeze({ aligned: 'Proposal direction is supported', not_aligned: 'Proposal direction is not supported', uncertain: 'Evidence is mixed' }),
  }),
  Object.freeze({
    questionId: 'market_regime',
    type: 'CHOICE' as const,
    instructions: 'Classify the current observable market regime.',
    options: Object.freeze({ trending: 'Directional and persistent', ranging: 'Mean reverting or range bound', volatile: 'High instability dominates', unknown: 'Insufficient evidence' }),
  }),
  Object.freeze({
    questionId: 'contextual_risk',
    type: 'SCORE' as const,
    instructions: 'Score contextual risk visible in the supplied state.',
    levels: Object.freeze(['low', 'moderate', 'high']),
  }),
]);

/** Frozen PAPER SHADOW question set. Changing semantics requires a new version. */
export const JEV_SHADOW_PAPER_QUESTION_SET_V1: readonly ShadowQuestion[] = Object.freeze([
  Object.freeze({
    questionId: 'state_sufficiency', type: 'CHOICE' as const,
    instructions: 'Classify whether the timestamped deterministic market features are sufficient for this bounded tactical assessment.',
    options: Object.freeze({ sufficient: 'Features are current and sufficient', partial: 'Useful but materially incomplete', insufficient: 'Too stale, incomplete, or ambiguous' }),
  }),
  Object.freeze({
    questionId: 'proposal_alignment', type: 'CHOICE' as const,
    instructions: 'Classify alignment between the existing proposal direction and supplied deterministic market state. This is non-authoritative.',
    options: Object.freeze({ aligned: 'State supports the proposal', not_aligned: 'State conflicts with the proposal', uncertain: 'Evidence is mixed' }),
  }),
  Object.freeze({
    questionId: 'market_regime', type: 'CHOICE' as const,
    instructions: 'Classify the tactical market regime from supplied features only.',
    options: Object.freeze({ trending: 'Persistent directional movement', mean_reverting: 'Reversion dominates', breakout: 'Range escape or acceleration', range: 'Bounded non-directional movement', high_volatility: 'Elevated volatility dominates', low_liquidity: 'Liquidity impairment dominates', unstable: 'Dislocated or rapidly changing state', noisy: 'Low signal-to-noise', uncertain: 'Insufficient evidence' }),
  }),
  Object.freeze({
    questionId: 'contextual_risk', type: 'SCORE' as const,
    instructions: 'Score non-authoritative contextual market risk.',
    levels: Object.freeze(['low', 'moderate', 'high']),
  }),
  Object.freeze({
    questionId: 'strategy_suitability', type: 'CHOICE' as const,
    instructions: 'Classify whether the named strategy family appears suitable for the supplied regime. Do not route or authorize strategy use.',
    options: Object.freeze({ suitable: 'Apparently suitable', unsuitable: 'Apparently unsuitable', uncertain: 'Insufficient evidence' }),
  }),
]);
