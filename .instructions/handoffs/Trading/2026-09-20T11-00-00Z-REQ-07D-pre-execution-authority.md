# AXODUS-TRADING-EPIC-01 / REQ-07D — Canonical TradingIntent & Pre-Execution Authorization Boundary Handoff

**TYPE:** IMPLEMENTATION / CANONICAL PRE-EXECUTION AUTHORITY
**STATUS:** COMPLETE / CTO REVIEW REQUIRED
**OWNER:** Agent Coder / Engineering Agent
**PARENT:** AXODUS-TRADING-CROSS-EPIC / REQ-07A
**FREEZE BASELINE:** c6286e2a58776d14d767ece800ac2d03118a8fd6
**SHARED CONTRACT FREEZE:** AXODUS-TRADING-CROSS-EPIC-SCF-01

---

## 1. Executive Summary

Implemented the canonical, deterministic, durable pre-execution authorization authority in Trading Core (PreExecutionAuthorizationService, PreExecutionAuthorizationValidator, PostgresPreExecutionAuthorizationRepository). The authority converts an already evaluated trading action (TradeProposal + PortfolioDecision + RiskDecision + StrategyOperationalSnapshot) into an immutable, provider-neutral TradingIntent after strict final authorization consistency validation.

The implementation strictly enforces all architectural invariants frozen in REQ-07A:
- **NO CURRENT VALID RISK AUTHORIZATION = NO TRADINGINTENT**: An explicit RiskDecision with outcome ALLOW or MODIFY is mandatory; REJECT and HALT are strictly blocked.
- **VALID HISTORICAL RISK AUTHORIZATION != CURRENT VALID RISK AUTHORIZATION**: Closes TOCTOU vulnerabilities by validating that the current StrategyOperationalSnapshot exactly matches the Risk-evaluated lifecycle version, health version, and snapshot identity, and is unexpired.
- **TradingIntent != ExecutionIntent**: TradingIntent is strictly provider-neutral and contains zero exchange endpoints, order candidates, or live connector commands.
- **Risk Monotonicity**: TradingIntent.approvedCapital <= RiskDecision.effectiveCapital <= PortfolioDecision.approvedCapital and TradingIntent.approvedLeverage <= RiskDecision.effectiveLeverage using exact FixedDecimal 12-decimal arithmetic.
- **Single-Use Risk Decision Consumption**: Single-use authorization tracking prevents duplicate intent creation from the same RiskDecision (AUTHORIZATION_ALREADY_CONSUMED).
- **Transactional Atomicity & Outbox**: Atomically persists authorization record, trading intent, and enqueues TradingIntentCreated event to trading_execution_outbox.
- **Durable Idempotency & Conflict Prevention**: Exact command replay returns the existing intent; conflicting payload fails closed with IDEMPOTENCY_CONFLICT.
- **DEBT-AUD-A-03 Tracking**: Acknowledged as OPEN / PARTIALLY REMEDIATED.

---

## 2. Delivered Artifacts & Implementation Details

### A. Canonical Domain Contracts (trading-core/packages/trading-contracts/src/governance/preExecution.ts)
- Defined PreExecutionAuthorizationDecision (AUTHORIZED, REJECTED, STALE, CONFLICT).
- Defined PreExecutionReasonCode with 26 prioritized typed reason codes.
- Defined PreExecutionOperationalSnapshotRef representing the atomic join of lifecycle and health heads.
- Defined PreExecutionAuthorizationCommand, PreExecutionAuthorizationResult, and PreExecutionAuthorizationRecord.

### B. PostgreSQL Durability & Outbox Integration (migrations/0006_pre_execution_authorization.sql)
- Created trading_intents table with unique constraint on risk_decision_id and performance indices.
- Created pre_execution_authorizations table with unique index on (strategy_id, idempotency_key) and index on risk_decision_id.
- Extended InMemoryPostgresClient for full transactional and query support across all tables.

### C. Pure Deterministic Validation (src/pre-execution/PreExecutionAuthorizationValidator.ts)
- Evaluates authorization commands against current operational snapshot, proposal, portfolio decision, and risk decision.
- Prioritized reason code evaluation:
  RISK_HALT_ACTIVE > AGENT_UNAUTHORIZED_INTENT_CREATION > PORTFOLIO_BYPASS > RISK_DECISION_REQUIRED > RISK_DECISION_REJECTED > STRATEGY_REVISION_MISMATCH > LIFECYCLE_VERSION_MISMATCH > HEALTH_VERSION_MISMATCH > OPERATIONAL_SNAPSHOT_MISMATCH > OPERATIONAL_SNAPSHOT_EXPIRED > OPERATIONAL_SNAPSHOT_INCOMPATIBLE > STRATEGY_HEALTH_SUSPENDED > STRATEGY_HEALTH_RETIRED > STRATEGY_HEALTH_REVALIDATION_REQUIRED > STRATEGY_HEALTH_UNKNOWN > STRATEGY_RETIRED > PORTFOLIO_DECISION_MISMATCH > PORTFOLIO_DECISION_EXPIRED > RISK_DECISION_EXPIRED > RISK_DECISION_STALE > MARKET_STATE_EXPIRED > CAPITAL_MONOTONICITY_VIOLATION > LEVERAGE_MONOTONICITY_VIOLATION > IDEMPOTENCY_CONFLICT > AUTHORIZATION_ALREADY_CONSUMED.
- Computes proportionally scaled approved quantity and effective capital using exact 12-decimal FixedDecimal arithmetic.

### D. Durable Repository & Authority (src/pre-execution/PostgresPreExecutionAuthorizationRepository.ts & src/pre-execution/PreExecutionAuthorizationService.ts)
- PostgresPreExecutionAuthorizationRepository: persists trading intents, authorization records, idempotency lookups, and enqueues outbox events.
- PreExecutionAuthorizationService: handles idempotent replays, validates commands, checks single-use risk decision consumption, executes single-transaction persistence (intent + authorization record + outbox event), and enqueues TradingIntentCreated domain event.

---

## 3. Comprehensive Test Coverage (test/epic01-req07d-pre-execution-authorization.test.mjs)

1. **Fixture A (Canonical Path)**: Valid proposal, portfolio decision, snapshot, and Risk ALLOW -> produces immutable TradingIntent.
2. **Fixture B (Risk MODIFY)**: Risk MODIFY reduces effective capital and proportionally scales quantity without precision loss.
3. **Fixture C (Health TOCTOU Closure)**: Stale Health (HEALTHY -> SUSPENDED) invalidates authorization (STRATEGY_HEALTH_SUSPENDED / STALE).
4. **Fixture D (Lifecycle TOCTOU Closure)**: Stale Lifecycle (PRODUCTION -> RETIRED) invalidates authorization (STRATEGY_RETIRED / STALE).
5. **Fixture E (Revision Mismatch)**: Proposal r7 vs snapshot r8 fails closed (STRATEGY_REVISION_MISMATCH / REJECTED).
6. **Fixture F (Risk REJECT)**: Risk REJECT cannot produce intent (RISK_DECISION_REJECTED / REJECTED).
7. **Fixture G (Risk HALT / Kill Switch)**: Risk HALT or active Kill Switch has top precedence (RISK_HALT_ACTIVE / REJECTED).
8. **Fixture H (Agent Bypass Prevention)**: Direct Agent intent creation without canonical upstream authorization is blocked.
9. **Fixture I (Portfolio Bypass Prevention)**: Missing or unapproved portfolio decision fails closed (PORTFOLIO_BYPASS / REJECTED).
10. **Fixture J (Single-Use RiskDecision)**: Single-use consumption prevents duplicate intent creation (AUTHORIZATION_ALREADY_CONSUMED / CONFLICT).
11. **Idempotent Replay**: Exact command replay returns the existing TradingIntent without re-persisting.
12. **Idempotency Conflict**: Conflicting payload for the same key throws PreExecutionIdempotencyConflictError.
13. **Capital Monotonicity**: Risk increasing capital above Portfolio approved is rejected (CAPITAL_MONOTONICITY_VIOLATION).
14. **Leverage Monotonicity**: Risk increasing leverage above requested is rejected (LEVERAGE_MONOTONICITY_VIOLATION).
15. **Exact Arithmetic**: Extreme boundary values (0.1, 0.01, 1e-12, 999999999.999999999999) handled with zero floating-point drift.
16. **Snapshot Expiration**: Expired operational snapshot fails with OPERATIONAL_SNAPSHOT_EXPIRED / STALE.
17. **RiskDecision Expiration**: Expired RiskDecision fails with RISK_DECISION_EXPIRED / STALE.
18. **PortfolioDecision Expiration**: Expired PortfolioDecision fails with PORTFOLIO_DECISION_EXPIRED / STALE.
19. **MarketState Expiration**: Stale MarketState fails with MARKET_STATE_EXPIRED / STALE.
20. **Compatibility Check (RISK_REDUCING_ONLY)**: Rejects buy actions; permits reduce/close actions.
21. **Persistence & Restart Safety**: State preserved across repository reinitialization.

---

## 4. Verification & Validation Summary

- **TypeScript Typecheck:** PASS (0 errors)
- **TypeScript Build:** PASS (0 errors)
- **TypeScript Test Suites:** 32/32 PASS (100% green across all 32 test files)
- **Python Quant Lab Unit Tests:** 45/45 PASS (100% green)
- **Git Diff Hygiene:** git diff --check and git -C quants-lab diff --check PASS (0 errors)
- **External Mutation Counters:**
  - Exchange order POST = 0
  - Exchange order DELETE = 0
  - DEX transaction signing = 0
  - Hummingbot live execution = 0
  - Condor live execution = 0
  - WebSocket live execution = 0
  - ExecutionIntent emitted to provider = 0
  - Mainnet mutation = 0
  - Real capital = 0
  - Production credentials used = 0
  - Customer credentials used = 0
  - Secrets exposed = false

---

## 5. Next Program Gate

- CTO review and acceptance of REQ-07D.
- Proceed with Execution Boundary and ExecutionIntent translation integration gates.
