import type { PromotionEligibility } from "../research/types.js";
export type { StrategyLifecycleState } from "./types.js";
import type { StrategyLifecycleState } from "./types.js";

export type StrategyLifecycleReasonCode =
  | "INVALID_TRANSITION"
  | "STRATEGY_REVISION_MISMATCH"
  | "EXPECTED_HEAD_MISMATCH"
  | "PROMOTION_ELIGIBILITY_REQUIRED"
  | "PROMOTION_ELIGIBILITY_NOT_ELIGIBLE"
  | "PROMOTION_ELIGIBILITY_STALE"
  | "PROMOTION_TARGET_MISMATCH"
  | "POLICY_UNAVAILABLE"
  | "POLICY_REVISION_MISMATCH"
  | "AUTHORIZATION_REQUIRED"
  | "AUTHORIZATION_INVALID"
  | "STRATEGY_RETIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "AGENT_UNAUTHORIZED_MUTATION";

export type StrategyLifecycleDecision = "ACCEPTED" | "REJECTED" | "CONFLICT";

export type StrategyLifecycleActorType = "system" | "operator" | "governance" | "agent";

export interface AuthorizationRef {
  readonly authorizationType: "operational_readiness" | "governance_approval" | "security_signoff" | "human_override" | string;
  readonly authorityRef: string;
  readonly grantedAt: string;
  readonly expiresAt?: string;
  readonly digest?: string;
}

export interface StrategyLifecycleTransitionRule {
  readonly fromState: StrategyLifecycleState;
  readonly toState: StrategyLifecycleState;
  readonly promotionEligibilityRequired: boolean;
  readonly requiredAuthorizationTypes?: readonly string[];
  readonly maxEligibilityAgeMs?: number;
  readonly allowAutomatedTransition?: boolean;
  readonly description?: string;
}

export interface StrategyLifecyclePolicy {
  readonly policyRevision: string;
  readonly name: string;
  readonly description?: string;
  readonly allowedTransitions: readonly StrategyLifecycleTransitionRule[];
  readonly defaultMaxEligibilityAgeMs?: number;
  readonly createdAt: string;
}

export interface StrategyLifecycleTransitionCommand {
  readonly commandId: string;
  readonly strategyId: string;
  readonly strategyRevisionId: string;
  readonly expectedLifecycleVersion: number;
  readonly fromState: StrategyLifecycleState;
  readonly toState: StrategyLifecycleState;
  readonly policyRevision: string;
  readonly promotionEligibility?: PromotionEligibility;
  readonly promotionEligibilityRef?: string;
  readonly authorizationRefs?: readonly AuthorizationRef[];
  readonly rationale?: string;
  readonly requestedAt: string;
  readonly evaluationTime: string;
  readonly idempotencyKey: string;
  readonly actorType: StrategyLifecycleActorType;
  readonly actorId: string;
}

export interface StrategyLifecycleTransitionResult {
  readonly transitionId: string;
  readonly strategyId: string;
  readonly strategyRevisionId: string;
  readonly previousState: StrategyLifecycleState;
  readonly newState: StrategyLifecycleState;
  readonly previousVersion: number;
  readonly newVersion: number;
  readonly policyRevision: string;
  readonly eligibilityRef?: string;
  readonly authorizationRefs: readonly string[];
  readonly decision: StrategyLifecycleDecision;
  readonly reasonCodes: readonly StrategyLifecycleReasonCode[];
  readonly requestedAt: string;
  readonly decidedAt: string;
  readonly eventRef?: string;
  readonly rationale?: string;
}

export interface StrategyLifecycleHead {
  readonly strategyId: string;
  readonly strategyRevisionId: string;
  readonly lifecycleState: StrategyLifecycleState;
  readonly lifecycleVersion: number;
  readonly updatedAt: string;
  readonly lastTransitionId?: string;
}

export interface StrategyLifecycleTransitionRecord {
  readonly transitionId: string;
  readonly strategyId: string;
  readonly strategyRevisionId: string;
  readonly fromState: StrategyLifecycleState;
  readonly toState: StrategyLifecycleState;
  readonly previousVersion: number;
  readonly newVersion: number;
  readonly policyRevision: string;
  readonly eligibilityRef?: string;
  readonly authorizationRefs: readonly AuthorizationRef[];
  readonly decision: StrategyLifecycleDecision;
  readonly reasonCodes: readonly StrategyLifecycleReasonCode[];
  readonly idempotencyKey: string;
  readonly commandHash: string;
  readonly rationale?: string;
  readonly requestedAt: string;
  readonly decidedAt: string;
  readonly createdAt: string;
}

export const DEFAULT_LIFECYCLE_POLICY_REVISION = "lifecycle-policy-v1.0";

export const DEFAULT_LIFECYCLE_POLICY_V1: StrategyLifecyclePolicy = {
  policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
  name: "Canonical Axodus Strategy Lifecycle Policy v1.0",
  description: "Frozen strategy lifecycle transition rules governed by REQ-07A / SCF-01",
  defaultMaxEligibilityAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  createdAt: "2026-09-19T00:00:00.000Z",
  allowedTransitions: [
    // Forward Progression
    { fromState: "IDEA", toState: "RESEARCH", promotionEligibilityRequired: false, description: "Begin formal quantitative research" },
    { fromState: "RESEARCH", toState: "BACKTEST", promotionEligibilityRequired: false, description: "Advance to historical backtest" },
    { fromState: "BACKTEST", toState: "ROBUSTNESS", promotionEligibilityRequired: true, description: "Advance to walk-forward robustness qualification" },
    { fromState: "ROBUSTNESS", toState: "PAPER", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["operational_readiness"], description: "Promote to paper trading simulation" },
    { fromState: "PAPER", toState: "TESTNET", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["operational_readiness"], description: "Promote to testnet execution" },
    { fromState: "TESTNET", toState: "LIMITED_LIVE", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["operational_readiness", "governance_approval"], description: "Promote to guarded limited live execution" },
    { fromState: "LIMITED_LIVE", toState: "PRODUCTION", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["governance_approval"], description: "Promote to full production execution" },
    { fromState: "PRODUCTION", toState: "MONITOR", promotionEligibilityRequired: false, description: "Shift to monitoring/deleveraged mode" },
    { fromState: "MONITOR", toState: "PRODUCTION", promotionEligibilityRequired: false, description: "Resume active production from monitor mode" },

    // Operational Demotions
    { fromState: "PRODUCTION", toState: "LIMITED_LIVE", promotionEligibilityRequired: false, description: "Demote from production to limited live" },
    { fromState: "LIMITED_LIVE", toState: "TESTNET", promotionEligibilityRequired: false, description: "Demote from limited live to testnet" },
    { fromState: "TESTNET", toState: "PAPER", promotionEligibilityRequired: false, description: "Demote from testnet to paper" },
    { fromState: "PAPER", toState: "DEMOTED", promotionEligibilityRequired: false, description: "Demote from paper trading" },
    { fromState: "TESTNET", toState: "DEMOTED", promotionEligibilityRequired: false, description: "Demote from testnet" },
    { fromState: "LIMITED_LIVE", toState: "DEMOTED", promotionEligibilityRequired: false, description: "Demote from limited live" },
    { fromState: "PRODUCTION", toState: "DEMOTED", promotionEligibilityRequired: false, description: "Demote from production" },
    { fromState: "MONITOR", toState: "DEMOTED", promotionEligibilityRequired: false, description: "Demote from monitor" },
    { fromState: "DEMOTED", toState: "PAPER", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["operational_readiness"], description: "Re-promote from demoted to paper" },
    { fromState: "DEMOTED", toState: "TESTNET", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["operational_readiness"], description: "Re-promote from demoted to testnet" },

    // Revalidation Edges
    { fromState: "PAPER", toState: "REVALIDATION", promotionEligibilityRequired: false, description: "Enter revalidation from paper" },
    { fromState: "TESTNET", toState: "REVALIDATION", promotionEligibilityRequired: false, description: "Enter revalidation from testnet" },
    { fromState: "LIMITED_LIVE", toState: "REVALIDATION", promotionEligibilityRequired: false, description: "Enter revalidation from limited live" },
    { fromState: "PRODUCTION", toState: "REVALIDATION", promotionEligibilityRequired: false, description: "Enter revalidation from production" },
    { fromState: "MONITOR", toState: "REVALIDATION", promotionEligibilityRequired: false, description: "Enter revalidation from monitor" },
    { fromState: "DEMOTED", toState: "REVALIDATION", promotionEligibilityRequired: false, description: "Enter revalidation from demoted" },
    { fromState: "REVALIDATION", toState: "ROBUSTNESS", promotionEligibilityRequired: false, description: "Re-execute robustness testing" },
    { fromState: "REVALIDATION", toState: "BACKTEST", promotionEligibilityRequired: false, description: "Re-execute backtest testing" },
    { fromState: "REVALIDATION", toState: "PAPER", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["operational_readiness"], description: "Return to paper trading post-revalidation" },
    { fromState: "REVALIDATION", toState: "TESTNET", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["operational_readiness"], description: "Return to testnet post-revalidation" },
    { fromState: "REVALIDATION", toState: "LIMITED_LIVE", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["operational_readiness", "governance_approval"], description: "Return to limited live post-revalidation" },
    { fromState: "REVALIDATION", toState: "PRODUCTION", promotionEligibilityRequired: true, requiredAuthorizationTypes: ["governance_approval"], description: "Return to production post-revalidation" },
    { fromState: "REVALIDATION", toState: "DEMOTED", promotionEligibilityRequired: false, description: "Demote post-revalidation" },
    { fromState: "REVALIDATION", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire post-revalidation failure" },

    // Retirement Edges (from any non-terminal state to RETIRED)
    { fromState: "IDEA", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from idea" },
    { fromState: "RESEARCH", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from research" },
    { fromState: "BACKTEST", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from backtest" },
    { fromState: "ROBUSTNESS", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from robustness" },
    { fromState: "PAPER", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from paper" },
    { fromState: "TESTNET", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from testnet" },
    { fromState: "LIMITED_LIVE", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from limited live" },
    { fromState: "PRODUCTION", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from production" },
    { fromState: "MONITOR", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from monitor" },
    { fromState: "DEMOTED", toState: "RETIRED", promotionEligibilityRequired: false, description: "Retire from demoted" },
  ],
};
