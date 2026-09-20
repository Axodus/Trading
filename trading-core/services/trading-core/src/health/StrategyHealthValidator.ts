import type { StrategyHealthHead, StrategyHealthPolicy, StrategyHealthTransitionCommand } from './StrategyHealthTypes.js';
import { transitionRule } from './StrategyHealthPolicy.js';

export type StrategyHealthReasonCode =
  | 'EXPECTED_HEAD_MISMATCH'
  | 'STRATEGY_REVISION_MISMATCH'
  | 'POLICY_UNAVAILABLE'
  | 'POLICY_REVISION_MISMATCH'
  | 'INVALID_TRANSITION'
  | 'RETIRED_TERMINAL'
  | 'EVIDENCE_REQUIRED'
  | 'AUTHORIZATION_REQUIRED'
  | 'AGENT_UNAUTHORIZED_MUTATION'
  | 'QUANT_UNAUTHORIZED_MUTATION';

export interface StrategyHealthValidation {
  readonly decision: 'ACCEPTED' | 'REJECTED' | 'CONFLICT';
  readonly reasonCodes: readonly StrategyHealthReasonCode[];
}

const ORDER: Record<StrategyHealthReasonCode, number> = {
  RETIRED_TERMINAL: 1,
  AGENT_UNAUTHORIZED_MUTATION: 2,
  QUANT_UNAUTHORIZED_MUTATION: 3,
  EXPECTED_HEAD_MISMATCH: 4,
  STRATEGY_REVISION_MISMATCH: 5,
  POLICY_UNAVAILABLE: 6,
  POLICY_REVISION_MISMATCH: 7,
  INVALID_TRANSITION: 8,
  EVIDENCE_REQUIRED: 9,
  AUTHORIZATION_REQUIRED: 10,
};

export class StrategyHealthValidator {
  static validate(
    command: StrategyHealthTransitionCommand,
    head: StrategyHealthHead | undefined,
    policy: StrategyHealthPolicy | undefined,
  ): StrategyHealthValidation {
    const reasons = new Set<StrategyHealthReasonCode>();

    if (!head) {
      reasons.add('STRATEGY_REVISION_MISMATCH');
    } else {
      if (head.healthState === 'RETIRED') reasons.add('RETIRED_TERMINAL');
      if (command.expectedHealthVersion !== head.healthVersion) reasons.add('EXPECTED_HEAD_MISMATCH');
      if (command.strategyId !== head.strategyId || command.strategyRevisionId !== head.strategyRevisionId) {
        reasons.add('STRATEGY_REVISION_MISMATCH');
      }
      if (command.fromHealth !== head.healthState || command.fromHealth === command.toHealth) {
        reasons.add('INVALID_TRANSITION');
      }
    }

    if (command.actorType === 'agent') reasons.add('AGENT_UNAUTHORIZED_MUTATION');
    if (command.actorType === 'quant') reasons.add('QUANT_UNAUTHORIZED_MUTATION');

    if (!policy) {
      reasons.add('POLICY_UNAVAILABLE');
    } else if (command.policyRevision !== policy.policyRevision) {
      reasons.add('POLICY_REVISION_MISMATCH');
    } else {
      const rule = transitionRule(policy, command.fromHealth, command.toHealth);
      if (!rule) {
        reasons.add('INVALID_TRANSITION');
      } else {
        if (rule.requiredEvidence && command.evidenceRefs.length === 0) reasons.add('EVIDENCE_REQUIRED');
        if (rule.requiredAuthorization && command.authorizationRefs.length === 0) reasons.add('AUTHORIZATION_REQUIRED');
      }
    }

    const reasonCodes = [...reasons].sort((left, right) => ORDER[left] - ORDER[right]);
    return {
      decision: reasonCodes.length === 0 ? 'ACCEPTED' : reasonCodes.includes('EXPECTED_HEAD_MISMATCH') ? 'CONFLICT' : 'REJECTED',
      reasonCodes,
    };
  }
}
