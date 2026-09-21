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
