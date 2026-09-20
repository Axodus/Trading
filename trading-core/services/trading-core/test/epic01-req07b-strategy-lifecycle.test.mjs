import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  DEFAULT_LIFECYCLE_POLICY_V1,
  DEFAULT_LIFECYCLE_POLICY_REVISION,
} from "../../../../dist-test/trading-core/packages/trading-contracts/src/index.js";
import {
  StrategyLifecycleAuthority,
  StrategyLifecycleValidator,
  PostgresStrategyLifecycleRepository,
  InMemoryPostgresClient,
  createInMemoryPostgresStorage,
} from "../../../../dist-test/trading-core/services/trading-core/src/index.js";

describe("EPIC-01 / REQ-07B Strategy Lifecycle Authority", () => {
  let storage;
  let client;
  let authority;

  beforeEach(async () => {
    storage = createInMemoryPostgresStorage();
    client = new InMemoryPostgresClient(storage);
    authority = new StrategyLifecycleAuthority(client);
  });

  describe("1. Lifecycle State Machine & Transition Graph", () => {
    it("executes the full canonical forward progression from IDEA to PRODUCTION and MONITOR", async () => {
      const strategyId = "strat-alpha-1";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T10:00:00.000Z";

      // 1. Register head at IDEA (v0)
      const head = await authority.registerStrategy({
        strategyId,
        revisionId,
        initialState: "IDEA",
      });
      assert.equal(head.lifecycleState, "IDEA");
      assert.equal(head.lifecycleVersion, 0);

      // 2. IDEA -> RESEARCH (v0 -> v1)
      const r1 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "RESEARCH",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-1",
        actorType: "system",
        actorId: "orchestrator",
      });
      assert.equal(r1.decision, "ACCEPTED");
      assert.equal(r1.newState, "RESEARCH");
      assert.equal(r1.newVersion, 1);

      // 3. RESEARCH -> BACKTEST (v1 -> v2)
      const r2 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-2",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 1,
        fromState: "RESEARCH",
        toState: "BACKTEST",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-2",
        actorType: "system",
        actorId: "orchestrator",
      });
      assert.equal(r2.decision, "ACCEPTED");
      assert.equal(r2.newState, "BACKTEST");
      assert.equal(r2.newVersion, 2);

      // 4. BACKTEST -> ROBUSTNESS (requires PromotionEligibility) (v2 -> v3)
      const r3 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-3",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 2,
        fromState: "BACKTEST",
        toState: "ROBUSTNESS",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-1",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "ROBUSTNESS",
          evidenceRefs: ["ev-bt-1"],
          decidedAt: now,
          expiresAt: "2026-09-27T10:00:00.000Z",
        },
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-3",
        actorType: "system",
        actorId: "orchestrator",
      });
      assert.equal(r3.decision, "ACCEPTED");
      assert.equal(r3.newState, "ROBUSTNESS");
      assert.equal(r3.newVersion, 3);

      // 5. ROBUSTNESS -> PAPER (requires PromotionEligibility + operational_readiness) (v3 -> v4)
      const r4 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-4",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 3,
        fromState: "ROBUSTNESS",
        toState: "PAPER",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-2",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "PAPER",
          evidenceRefs: ["ev-wf-1"],
          decidedAt: now,
          expiresAt: "2026-09-27T10:00:00.000Z",
        },
        authorizationRefs: [
          {
            authorizationType: "operational_readiness",
            authorityRef: "auth-ops-1",
            grantedAt: now,
          },
        ],
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-4",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(r4.decision, "ACCEPTED");
      assert.equal(r4.newState, "PAPER");
      assert.equal(r4.newVersion, 4);

      // 6. PAPER -> TESTNET (requires PromotionEligibility + operational_readiness) (v4 -> v5)
      const r5 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-5",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 4,
        fromState: "PAPER",
        toState: "TESTNET",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-3",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "TESTNET",
          evidenceRefs: ["ev-paper-1"],
          decidedAt: now,
          expiresAt: "2026-09-27T10:00:00.000Z",
        },
        authorizationRefs: [
          {
            authorizationType: "operational_readiness",
            authorityRef: "auth-ops-2",
            grantedAt: now,
          },
        ],
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-5",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(r5.decision, "ACCEPTED");
      assert.equal(r5.newState, "TESTNET");
      assert.equal(r5.newVersion, 5);

      // 7. TESTNET -> LIMITED_LIVE (requires PromotionEligibility + operational_readiness + governance_approval) (v5 -> v6)
      const r6 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-6",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 5,
        fromState: "TESTNET",
        toState: "LIMITED_LIVE",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-4",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "LIMITED_LIVE",
          evidenceRefs: ["ev-testnet-1"],
          decidedAt: now,
          expiresAt: "2026-09-27T10:00:00.000Z",
        },
        authorizationRefs: [
          {
            authorizationType: "operational_readiness",
            authorityRef: "auth-ops-3",
            grantedAt: now,
          },
          {
            authorizationType: "governance_approval",
            authorityRef: "gov-vote-101",
            grantedAt: now,
          },
        ],
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-6",
        actorType: "governance",
        actorId: "gov-chair",
      });
      assert.equal(r6.decision, "ACCEPTED");
      assert.equal(r6.newState, "LIMITED_LIVE");
      assert.equal(r6.newVersion, 6);

      // 8. LIMITED_LIVE -> PRODUCTION (requires PromotionEligibility + governance_approval) (v6 -> v7)
      const r7 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-7",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 6,
        fromState: "LIMITED_LIVE",
        toState: "PRODUCTION",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-5",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "PRODUCTION",
          evidenceRefs: ["ev-lim-live-1"],
          decidedAt: now,
          expiresAt: "2026-09-27T10:00:00.000Z",
        },
        authorizationRefs: [
          {
            authorizationType: "governance_approval",
            authorityRef: "gov-vote-102",
            grantedAt: now,
          },
        ],
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-7",
        actorType: "governance",
        actorId: "gov-chair",
      });
      assert.equal(r7.decision, "ACCEPTED");
      assert.equal(r7.newState, "PRODUCTION");
      assert.equal(r7.newVersion, 7);

      // 9. PRODUCTION -> MONITOR (v7 -> v8)
      const r8 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-8",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 7,
        fromState: "PRODUCTION",
        toState: "MONITOR",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-8",
        actorType: "operator",
        actorId: "risk-officer",
      });
      assert.equal(r8.decision, "ACCEPTED");
      assert.equal(r8.newState, "MONITOR");
      assert.equal(r8.newVersion, 8);

      // 10. MONITOR -> PRODUCTION (v8 -> v9)
      const r9 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-9",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 8,
        fromState: "MONITOR",
        toState: "PRODUCTION",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-9",
        actorType: "operator",
        actorId: "risk-officer",
      });
      assert.equal(r9.decision, "ACCEPTED");
      assert.equal(r9.newState, "PRODUCTION");
      assert.equal(r9.newVersion, 9);

      // Verify final head
      const finalHead = await authority.getLifecycleHead(strategyId);
      assert.equal(finalHead.lifecycleState, "PRODUCTION");
      assert.equal(finalHead.lifecycleVersion, 9);
      assert.equal(finalHead.strategyRevisionId, revisionId);

      // Verify history count
      const history = await authority.getLifecycleHistory(strategyId);
      assert.equal(history.length, 9);
      assert.equal(history.every((rec) => rec.decision === "ACCEPTED"), true);
    });

    it("executes operational demotion, revalidation, and retirement paths", async () => {
      const strategyId = "strat-beta-1";
      const revisionId = "rev-2.0.0";
      const now = "2026-09-20T11:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "PRODUCTION" });

      // 1. PRODUCTION -> DEMOTED
      const r1 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-demote-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "PRODUCTION",
        toState: "DEMOTED",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-d1",
        actorType: "operator",
        actorId: "risk-manager",
      });
      assert.equal(r1.decision, "ACCEPTED");
      assert.equal(r1.newState, "DEMOTED");
      assert.equal(r1.newVersion, 1);

      // 2. DEMOTED -> REVALIDATION
      const r2 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-reval-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 1,
        fromState: "DEMOTED",
        toState: "REVALIDATION",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-d2",
        actorType: "operator",
        actorId: "risk-manager",
      });
      assert.equal(r2.decision, "ACCEPTED");
      assert.equal(r2.newState, "REVALIDATION");
      assert.equal(r2.newVersion, 2);

      // 3. REVALIDATION -> RETIRED (Terminal)
      const r3 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-retire-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 2,
        fromState: "REVALIDATION",
        toState: "RETIRED",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-d3",
        actorType: "governance",
        actorId: "gov-chair",
      });
      assert.equal(r3.decision, "ACCEPTED");
      assert.equal(r3.newState, "RETIRED");
      assert.equal(r3.newVersion, 3);

      // 4. RETIRED strategy cannot transition to ANY other state (Terminal invariant)
      const r4 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-resurrect-fail",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 3,
        fromState: "RETIRED",
        toState: "IDEA",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-d4",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(r4.decision, "REJECTED");
      assert.deepEqual(r4.reasonCodes, ["STRATEGY_RETIRED", "INVALID_TRANSITION"]);
      assert.equal(r4.newVersion, 3); // Version unchanged on rejection
    });

    it("rejects forbidden edges such as stage-skipping, self-transitions, and unauthorized demotions", async () => {
      const strategyId = "strat-gamma-1";
      const revisionId = "rev-3.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "IDEA" });

      // 1. Stage-skip: IDEA -> PRODUCTION
      const r1 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-skip-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "PRODUCTION",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-skip",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(r1.decision, "REJECTED");
      assert.deepEqual(r1.reasonCodes, ["INVALID_TRANSITION"]);

      // 2. Self-transition: IDEA -> IDEA
      const r2 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-self-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "IDEA",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-self",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(r2.decision, "REJECTED");
      assert.deepEqual(r2.reasonCodes, ["INVALID_TRANSITION"]);

      // 3. Disallowed demotion: IDEA -> DEMOTED
      const r3 = await authority.evaluateAndApplyTransition({
        commandId: "cmd-illegal-demote",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "DEMOTED",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-demote-illegal",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(r3.decision, "REJECTED");
      assert.deepEqual(r3.reasonCodes, ["INVALID_TRANSITION"]);
    });
  });

  describe("2. Exact StrategyRevision Binding", () => {
    it("rejects transitions where command StrategyRevisionId does not match canonical head", async () => {
      const strategyId = "strat-revision-test";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId: "rev-1.0.0", initialState: "IDEA" });

      const result = await authority.evaluateAndApplyTransition({
        commandId: "cmd-rev-mismatch",
        strategyId,
        strategyRevisionId: "rev-2.0.0", // Mismatch with head rev-1.0.0
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "RESEARCH",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-rev-1",
        actorType: "operator",
        actorId: "operator-1",
      });

      assert.equal(result.decision, "REJECTED");
      assert.equal(result.reasonCodes.includes("STRATEGY_REVISION_MISMATCH"), true);
    });

    it("rejects transitions where PromotionEligibility is bound to a different revision than the command", async () => {
      const strategyId = "strat-rev-elig-mismatch";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId: "rev-2.0.0", initialState: "BACKTEST" });

      const result = await authority.evaluateAndApplyTransition({
        commandId: "cmd-elig-rev-mismatch",
        strategyId,
        strategyRevisionId: "rev-2.0.0",
        expectedLifecycleVersion: 0,
        fromState: "BACKTEST",
        toState: "ROBUSTNESS",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-older-rev",
          strategyId,
          strategyRevisionId: "rev-1.0.0", // Older revision r7 eligibility cannot promote r8!
          decision: "ELIGIBLE",
          targetState: "ROBUSTNESS",
          evidenceRefs: ["ev-1"],
          decidedAt: now,
        },
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-elig-rev-1",
        actorType: "operator",
        actorId: "operator-1",
      });

      assert.equal(result.decision, "REJECTED");
      assert.equal(result.reasonCodes.includes("STRATEGY_REVISION_MISMATCH"), true);
    });
  });

  describe("3. PromotionEligibility Consumption & Freshness", () => {
    it("fails closed when PromotionEligibility is required by policy but omitted", async () => {
      const strategyId = "strat-elig-req";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "BACKTEST" });

      const result = await authority.evaluateAndApplyTransition({
        commandId: "cmd-no-elig",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "BACKTEST",
        toState: "ROBUSTNESS",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-no-elig",
        actorType: "operator",
        actorId: "operator-1",
      });

      assert.equal(result.decision, "REJECTED");
      assert.equal(result.reasonCodes.includes("PROMOTION_ELIGIBILITY_REQUIRED"), true);
    });

    it("rejects when PromotionEligibility decision is NOT_ELIGIBLE or REVALIDATION_REQUIRED", async () => {
      const strategyId = "strat-elig-decision-fail";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "BACKTEST" });

      const result = await authority.evaluateAndApplyTransition({
        commandId: "cmd-not-eligible",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "BACKTEST",
        toState: "ROBUSTNESS",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-not-eligible",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "NOT_ELIGIBLE",
          targetState: "ROBUSTNESS",
          evidenceRefs: ["ev-failed-bt"],
          decidedAt: now,
        },
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-not-elig",
        actorType: "operator",
        actorId: "operator-1",
      });

      assert.equal(result.decision, "REJECTED");
      assert.equal(result.reasonCodes.includes("PROMOTION_ELIGIBILITY_NOT_ELIGIBLE"), true);
    });

    it("rejects when PromotionEligibility targetState does not match command target", async () => {
      const strategyId = "strat-elig-target-mismatch";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "ROBUSTNESS" });

      const result = await authority.evaluateAndApplyTransition({
        commandId: "cmd-target-mismatch",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "ROBUSTNESS",
        toState: "PAPER",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-mismatch",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "TESTNET", // Eligibility for TESTNET cannot satisfy ROBUSTNESS -> PAPER
          evidenceRefs: ["ev-1"],
          decidedAt: now,
        },
        authorizationRefs: [
          { authorizationType: "operational_readiness", authorityRef: "auth-1", grantedAt: now },
        ],
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-target-mismatch",
        actorType: "operator",
        actorId: "operator-1",
      });

      assert.equal(result.decision, "REJECTED");
      assert.equal(result.reasonCodes.includes("PROMOTION_TARGET_MISMATCH"), true);
    });

    it("rejects stale or expired PromotionEligibility", async () => {
      const strategyId = "strat-stale-elig";
      const revisionId = "rev-1.0.0";
      const evalTime = "2026-09-20T12:00:00.000Z";
      const expiredAt = "2026-09-19T12:00:00.000Z"; // 1 day before evalTime

      await authority.registerStrategy({ strategyId, revisionId, initialState: "BACKTEST" });

      const result = await authority.evaluateAndApplyTransition({
        commandId: "cmd-stale",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "BACKTEST",
        toState: "ROBUSTNESS",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-expired",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "ROBUSTNESS",
          evidenceRefs: ["ev-1"],
          decidedAt: "2026-09-10T12:00:00.000Z",
          expiresAt: expiredAt,
        },
        requestedAt: evalTime,
        evaluationTime: evalTime,
        idempotencyKey: "idem-stale",
        actorType: "operator",
        actorId: "operator-1",
      });

      assert.equal(result.decision, "REJECTED");
      assert.equal(result.reasonCodes.includes("PROMOTION_ELIGIBILITY_STALE"), true);
    });
  });

  describe("4. Operational Authorizations Validation", () => {
    it("fails closed when required operational authorization is missing or expired", async () => {
      const strategyId = "strat-auth-test";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "LIMITED_LIVE" });

      // Missing governance_approval
      const rMissing = await authority.evaluateAndApplyTransition({
        commandId: "cmd-auth-missing",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "LIMITED_LIVE",
        toState: "PRODUCTION",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-prod",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "PRODUCTION",
          evidenceRefs: ["ev-1"],
          decidedAt: now,
        },
        authorizationRefs: [], // Missing required governance_approval
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-auth-missing",
        actorType: "operator",
        actorId: "operator-1",
      });

      assert.equal(rMissing.decision, "REJECTED");
      assert.equal(rMissing.reasonCodes.includes("AUTHORIZATION_REQUIRED"), true);

      // Expired governance_approval
      const rExpired = await authority.evaluateAndApplyTransition({
        commandId: "cmd-auth-expired",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "LIMITED_LIVE",
        toState: "PRODUCTION",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        promotionEligibility: {
          eligibilityId: "elig-prod-2",
          strategyId,
          strategyRevisionId: revisionId,
          decision: "ELIGIBLE",
          targetState: "PRODUCTION",
          evidenceRefs: ["ev-1"],
          decidedAt: now,
        },
        authorizationRefs: [
          {
            authorizationType: "governance_approval",
            authorityRef: "gov-vote-old",
            grantedAt: "2026-09-01T00:00:00.000Z",
            expiresAt: "2026-09-15T00:00:00.000Z", // Expired
          },
        ],
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-auth-expired",
        actorType: "operator",
        actorId: "operator-1",
      });

      assert.equal(rExpired.decision, "REJECTED");
      assert.equal(rExpired.reasonCodes.includes("AUTHORIZATION_INVALID"), true);
    });
  });

  describe("5. Optimistic Concurrency Control (CAS)", () => {
    it("enforces CAS expected head versioning and returns CONFLICT on concurrency collision", async () => {
      const strategyId = "strat-cas-test";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "IDEA" });

      // Request A expects v0 -> updates to v1
      const resA = await authority.evaluateAndApplyTransition({
        commandId: "cmd-cas-a",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "RESEARCH",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-cas-a",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(resA.decision, "ACCEPTED");
      assert.equal(resA.newVersion, 1);

      // Request B also expected v0 (concurrent stale request) -> CONFLICT
      const resB = await authority.evaluateAndApplyTransition({
        commandId: "cmd-cas-b",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0, // Stale expected version!
        fromState: "IDEA",
        toState: "RESEARCH",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-cas-b",
        actorType: "operator",
        actorId: "operator-2",
      });
      assert.equal(resB.decision, "CONFLICT");
      assert.deepEqual(resB.reasonCodes, ["EXPECTED_HEAD_MISMATCH", "INVALID_TRANSITION"]);

      // Request C correctly expects v1 -> succeeds to v2
      const resC = await authority.evaluateAndApplyTransition({
        commandId: "cmd-cas-c",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 1,
        fromState: "RESEARCH",
        toState: "BACKTEST",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-cas-c",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(resC.decision, "ACCEPTED");
      assert.equal(resC.newVersion, 2);
    });
  });

  describe("6. Durable Idempotency & Conflict Prevention", () => {
    it("returns identical result for exact idempotency replay and rejects conflicting payloads", async () => {
      const strategyId = "strat-idem-test";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "IDEA" });

      const command = {
        commandId: "cmd-idem-orig",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "RESEARCH",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "shared-key-100",
        actorType: "operator",
        actorId: "operator-1",
      };

      // 1. First execution -> ACCEPTED (v1)
      const res1 = await authority.evaluateAndApplyTransition(command);
      assert.equal(res1.decision, "ACCEPTED");
      assert.equal(res1.newVersion, 1);

      // 2. Exact replay with same idempotency key -> returns identical transition without incrementing version
      const res2 = await authority.evaluateAndApplyTransition(command);
      assert.equal(res2.decision, "ACCEPTED");
      assert.equal(res2.newVersion, 1);
      assert.equal(res2.transitionId, res1.transitionId);

      const head = await authority.getLifecycleHead(strategyId);
      assert.equal(head.lifecycleVersion, 1); // Still 1, not 2

      // 3. Conflicting replay with same idempotency key but different target state
      const conflictingCommand = {
        ...command,
        toState: "RETIRED", // Conflicting target state!
      };

      const resConflict = await authority.evaluateAndApplyTransition(conflictingCommand);
      assert.equal(resConflict.decision, "CONFLICT");
      assert.deepEqual(resConflict.reasonCodes, ["IDEMPOTENCY_CONFLICT"]);
    });
  });

  describe("7. Transactional Outbox & Event Emission", () => {
    it("atomically emits canonical events to trading_execution_outbox", async () => {
      const strategyId = "strat-outbox-test";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "IDEA" });

      // 1. Accepted transition
      await authority.evaluateAndApplyTransition({
        commandId: "cmd-outbox-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "RESEARCH",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-outbox-1",
        actorType: "operator",
        actorId: "operator-1",
      });

      // 2. Transition to RETIRED
      await authority.evaluateAndApplyTransition({
        commandId: "cmd-outbox-2",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 1,
        fromState: "RESEARCH",
        toState: "RETIRED",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-outbox-2",
        actorType: "operator",
        actorId: "operator-1",
      });

      const outboxEntries = storage.trading_execution_outbox.filter(
        (entry) => entry.aggregate_id === strategyId,
      );

      assert.equal(outboxEntries.length, 3);
      const eventTypes = outboxEntries.map((e) => e.event_type);
      assert.equal(eventTypes.includes("StrategyLifecycleTransitionAccepted"), true);
      assert.equal(eventTypes.includes("StrategyRetired"), true);
    });
  });

  describe("8. Restart Safety & Persistence Survival", () => {
    it("preserves state, versions, history, and idempotency across repository/service reinitialization", async () => {
      const strategyId = "strat-restart-test";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      // Session A performs transitions
      await authority.registerStrategy({ strategyId, revisionId, initialState: "IDEA" });
      await authority.evaluateAndApplyTransition({
        commandId: "cmd-res-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "RESEARCH",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-restart-1",
        actorType: "operator",
        actorId: "operator-1",
      });

      // Simulate process restart by creating a new client and authority pointing to the same storage
      const newClient = new InMemoryPostgresClient(storage);
      const newAuthority = new StrategyLifecycleAuthority(newClient);

      // Verify head and version are preserved
      const head = await newAuthority.getLifecycleHead(strategyId);
      assert.equal(head.lifecycleState, "RESEARCH");
      assert.equal(head.lifecycleVersion, 1);
      assert.equal(head.strategyRevisionId, revisionId);

      // Verify history is preserved
      const history = await newAuthority.getLifecycleHistory(strategyId);
      assert.equal(history.length, 1);
      assert.equal(history[0].toState, "RESEARCH");

      // Verify idempotency works across restarts
      const replay = await newAuthority.evaluateAndApplyTransition({
        commandId: "cmd-res-1",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "RESEARCH",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-restart-1",
        actorType: "operator",
        actorId: "operator-1",
      });
      assert.equal(replay.decision, "ACCEPTED");
      assert.equal(replay.newVersion, 1);
    });
  });

  describe("9. Security & Boundary Isolation (Bypass Guards)", () => {
    it("fails closed when an agent attempts direct lifecycle state mutation", async () => {
      const strategyId = "strat-agent-bypass";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "IDEA" });

      const result = await authority.evaluateAndApplyTransition({
        commandId: "cmd-agent-hack",
        strategyId,
        strategyRevisionId: revisionId,
        expectedLifecycleVersion: 0,
        fromState: "IDEA",
        toState: "PRODUCTION",
        policyRevision: DEFAULT_LIFECYCLE_POLICY_REVISION,
        requestedAt: now,
        evaluationTime: now,
        idempotencyKey: "idem-agent-hack",
        actorType: "agent", // Agents cannot mutate lifecycle state!
        actorId: "agent-trinity-007",
      });

      assert.equal(result.decision, "REJECTED");
      assert.equal(result.reasonCodes.includes("AGENT_UNAUTHORIZED_MUTATION"), true);
      assert.equal(result.reasonCodes.includes("INVALID_TRANSITION"), true);
    });

    it("verifies that PromotionEligibility alone cannot mutate state without LifecycleAuthority command", async () => {
      const strategyId = "strat-quant-bypass";
      const revisionId = "rev-1.0.0";
      const now = "2026-09-20T12:00:00.000Z";

      await authority.registerStrategy({ strategyId, revisionId, initialState: "ROBUSTNESS" });

      // Pure quant eligibility artifact created
      const quantEligibility = {
        eligibilityId: "elig-quant-alone",
        strategyId,
        strategyRevisionId: revisionId,
        decision: "ELIGIBLE",
        targetState: "PAPER",
        evidenceRefs: ["ev-quant-1"],
        decidedAt: now,
      };

      // State remains ROBUSTNESS until evaluated by StrategyLifecycleAuthority
      const head = await authority.getLifecycleHead(strategyId);
      assert.equal(head.lifecycleState, "ROBUSTNESS");
      assert.equal(head.lifecycleVersion, 0);
      assert.ok(quantEligibility.eligibilityId);
    });
  });
});
