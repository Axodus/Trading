import type {
  StrategyLifecycleHead,
  StrategyLifecyclePolicy,
  StrategyLifecycleReasonCode,
  StrategyLifecycleTransitionCommand,
  StrategyLifecycleTransitionRule,
  StrategyLifecycleDecision,
  AuthorizationRef,
} from "../../../../packages/trading-contracts/src/strategy/lifecycle.js";

export interface StrategyLifecycleValidationOutcome {
  decision: StrategyLifecycleDecision;
  reasonCodes: StrategyLifecycleReasonCode[];
  rule?: StrategyLifecycleTransitionRule;
}

const REASON_CODE_ORDER: Record<StrategyLifecycleReasonCode, number> = {
  STRATEGY_RETIRED: 1,
  AGENT_UNAUTHORIZED_MUTATION: 2,
  EXPECTED_HEAD_MISMATCH: 3,
  STRATEGY_REVISION_MISMATCH: 4,
  POLICY_UNAVAILABLE: 5,
  POLICY_REVISION_MISMATCH: 6,
  INVALID_TRANSITION: 7,
  PROMOTION_ELIGIBILITY_REQUIRED: 8,
  PROMOTION_TARGET_MISMATCH: 9,
  PROMOTION_ELIGIBILITY_NOT_ELIGIBLE: 10,
  PROMOTION_ELIGIBILITY_STALE: 11,
  AUTHORIZATION_REQUIRED: 12,
  AUTHORIZATION_INVALID: 13,
  IDEMPOTENCY_CONFLICT: 14,
};

export class StrategyLifecycleValidator {
  static validate(
    command: StrategyLifecycleTransitionCommand,
    head: StrategyLifecycleHead | undefined,
    policy: StrategyLifecyclePolicy | undefined,
  ): StrategyLifecycleValidationOutcome {
    const reasons = new Set<StrategyLifecycleReasonCode>();

    if (!head) {
      return {
        decision: "REJECTED",
        reasonCodes: ["STRATEGY_REVISION_MISMATCH"],
      };
    }

    // 1. Retirement is strictly terminal
    if (head.lifecycleState === "RETIRED") {
      reasons.add("STRATEGY_RETIRED");
    }

    // 2. Agents cannot directly mutate lifecycle state
    if (command.actorType === "agent") {
      reasons.add("AGENT_UNAUTHORIZED_MUTATION");
    }

    // 3. Expected head version mismatch (CAS)
    if (command.expectedLifecycleVersion !== head.lifecycleVersion) {
      reasons.add("EXPECTED_HEAD_MISMATCH");
    }

    // 4. Exact strategy revision binding
    if (command.strategyRevisionId !== head.strategyRevisionId) {
      reasons.add("STRATEGY_REVISION_MISMATCH");
    }

    // 5. Policy availability and revision check
    if (!policy) {
      reasons.add("POLICY_UNAVAILABLE");
    } else if (command.policyRevision !== policy.policyRevision) {
      reasons.add("POLICY_REVISION_MISMATCH");
    }

    // 6. Starting state and edge validity
    if (command.fromState !== head.lifecycleState || command.fromState === command.toState) {
      reasons.add("INVALID_TRANSITION");
    }

    let matchingRule: StrategyLifecycleTransitionRule | undefined;
    if (policy) {
      matchingRule = policy.allowedTransitions.find(
        (rule: StrategyLifecycleTransitionRule) => rule.fromState === command.fromState && rule.toState === command.toState,
      );
      if (!matchingRule) {
        reasons.add("INVALID_TRANSITION");
      }
    }

    // 7. PromotionEligibility validations
    if (matchingRule) {
      if (matchingRule.promotionEligibilityRequired) {
        if (!command.promotionEligibility && !command.promotionEligibilityRef) {
          reasons.add("PROMOTION_ELIGIBILITY_REQUIRED");
        }
      }

      if (command.promotionEligibility) {
        const eligibility = command.promotionEligibility;

        if (eligibility.strategyRevisionId !== command.strategyRevisionId) {
          reasons.add("STRATEGY_REVISION_MISMATCH");
        }

        if (eligibility.targetState !== command.toState) {
          reasons.add("PROMOTION_TARGET_MISMATCH");
        }

        if (eligibility.decision !== "ELIGIBLE") {
          reasons.add("PROMOTION_ELIGIBILITY_NOT_ELIGIBLE");
        }

        const evalTimeMs = Date.parse(command.evaluationTime);
        if (eligibility.expiresAt && Date.parse(eligibility.expiresAt) <= evalTimeMs) {
          reasons.add("PROMOTION_ELIGIBILITY_STALE");
        }

        const maxAgeMs = matchingRule.maxEligibilityAgeMs ?? policy?.defaultMaxEligibilityAgeMs;
        if (maxAgeMs !== undefined && eligibility.decidedAt) {
          const decidedAtMs = Date.parse(eligibility.decidedAt);
          if (evalTimeMs - decidedAtMs > maxAgeMs) {
            reasons.add("PROMOTION_ELIGIBILITY_STALE");
          }
        }
      }

      // 8. Operational Authorizations validations
      if (matchingRule.requiredAuthorizationTypes && matchingRule.requiredAuthorizationTypes.length > 0) {
        const providedAuths = command.authorizationRefs ?? [];
        for (const reqType of matchingRule.requiredAuthorizationTypes) {
          const matchingAuth = providedAuths.find((auth: AuthorizationRef) => auth.authorizationType === reqType);
          if (!matchingAuth) {
            reasons.add("AUTHORIZATION_REQUIRED");
          } else if (matchingAuth.expiresAt && Date.parse(matchingAuth.expiresAt) <= Date.parse(command.evaluationTime)) {
            reasons.add("AUTHORIZATION_INVALID");
          }
        }
      }
    }

    const sortedReasons = Array.from(reasons).sort(
      (left, right) => (REASON_CODE_ORDER[left] ?? 99) - (REASON_CODE_ORDER[right] ?? 99),
    );

    if (sortedReasons.length > 0) {
      const isConflict = sortedReasons.includes("EXPECTED_HEAD_MISMATCH");
      return {
        decision: isConflict ? "CONFLICT" : "REJECTED",
        reasonCodes: sortedReasons,
        rule: matchingRule,
      };
    }

    return {
      decision: "ACCEPTED",
      reasonCodes: [],
      rule: matchingRule,
    };
  }
}
