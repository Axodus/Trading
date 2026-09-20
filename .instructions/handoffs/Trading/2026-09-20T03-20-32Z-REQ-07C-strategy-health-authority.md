# AXODUS-TRADING-EPIC-01 / REQ-07C — FINAL HANDOFF

**STATUS:** COMPLETE / CTO REVIEW REQUIRED  
**BASELINE:** `c6286e2a58776d14d767ece800ac2d03118a8fd6`  
**BRANCH:** `dev`  
**FINAL WORKTREE:** DIRTY — REQ-07B parallel changes remain uncommitted alongside this validated REQ-07C worktree.  
**SCF-01 SEMANTIC CHANGE REQUIRED:** NO  

## Architecture

`StrategyHealthAuthority` is the single Trading-domain writer for canonical operational health. It consumes structured, attributable evidence through transition commands and persists:

```text
health transition + health head projection + outbox event
```

in one PostgreSQL transaction. It never invokes Quant runtime, Agents, Portfolio allocation, Risk state mutation, TradingIntent, execution adapters, or venue APIs.

`StrategyOperationalSnapshot` is the read-side atomic join of the canonical lifecycle and health heads for an exact StrategyRevision. It contains lifecycle and health versions, compatibility, deterministic identity, effective time, and expiry. Risk consumes this snapshot rather than inferring health from lifecycle.

## Dependency Classification

- **REUSE:** StrategyHealth state vocabulary, StrategyRevision identity, REQ-06 RiskDecision and RiskEvaluationContext, PostgreSQL client/transaction/outbox primitives, Fixed runtime test architecture.
- **ADAPT:** In-memory PostgreSQL client extended with lifecycle/health storage, atomic transaction staging, and deterministic failure injection.
- **EXTEND:** RiskEvaluationContext and RiskDecision hard-limit evidence bind to StrategyOperationalSnapshot without changing the frozen RiskDecision contract.
- **NEW:** StrategyHealthPolicy, StrategyHealthAuthority, PostgresStrategyHealthRepository, StrategyHealthValidator, StrategyOperationalSnapshotService, migration `0005_strategy_health_authority.sql`.
- **REJECT:** Quant runtime imports, Agent state writes, lifecycle state writes, capital mutation, TradingIntent, execution/venue coupling.

## Health Authority

- **States:** UNKNOWN, HEALTHY, DEGRADED, REVALIDATION_REQUIRED, SUSPENDED, RETIRED.
- **Transition graph:** explicit allowlist; RETIRED is terminal; recovery from UNKNOWN, DEGRADED, REVALIDATION_REQUIRED, and SUSPENDED requires evidence plus authorization.
- **Policy:** immutable revision (`strategy-health-policy-v1.0`) is bound to every transition.
- **Exact revision binding:** health heads are keyed by strategyId + strategyRevisionId; r7 never supplies health to r8.
- **Inputs implemented:** canonical evidence references, reason codes, authorization references, manual/operator/governance/system transition commands.
- **Inputs deferred:** live performance divergence, drawdown, execution quality, slippage, latency, provider incidents, and risk-event metrics lack sufficiently frozen canonical telemetry schemas. They remain structured evidence slots rather than fabricated calculations.
- **Quant boundary:** Quant artifacts can be supplied as evidence references. No `quants-lab` runtime dependency exists.
- **Adverse evidence / revalidation / suspension:** deterministic command-to-transition flow; event/outbox creates `StrategyDegraded`, `StrategyRevalidationRequired`, `StrategySuspended`, `StrategyHealthRecovered`, `StrategyRetired`, or generic health event as applicable.

## Durability

- **PostgreSQL migration:** `trading-core/services/trading-core/migrations/0005_strategy_health_authority.sql`.
- **Health history:** append-only `strategy_health_transitions`.
- **Health head:** CAS-protected `strategy_health_heads`.
- **Idempotency:** unique strategy/revision/key constraint plus command hash; replay returns the original effect and key/payload conflicts fail explicitly.
- **Restart safety:** validated by recreating the authority over the same durable in-memory PostgreSQL storage.
- **Atomicity:** validated through injected outbox-write failure; no head, history, or outbox record commits partially.

## Lifecycle ↔ Health Matrix and Snapshot

- The exhaustive 6 × 12 REQ-07A matrix returns only `FULL`, `RISK_REDUCING_ONLY`, `CONDITIONAL`, or `REJECTED`.
- These compatibility values are not RiskDecision outcomes.
- PAPER, TESTNET, LIMITED_LIVE, and PRODUCTION + HEALTHY are `FULL`.
- MONITOR + HEALTHY is `RISK_REDUCING_ONLY`.
- Active lifecycle states + DEGRADED are `CONDITIONAL`.
- All other combinations are `REJECTED`.
- Snapshot identity changes whenever StrategyRevision, lifecycleVersion, or healthVersion changes.
- Snapshot expiry uses injected evaluation time; expiry is fail-closed at the exact boundary.

## Risk Consumption and Staleness

REQ-06 now requires a valid operational snapshot for live risk evaluation and records its snapshot ID/version plus lifecycle/health versions within the existing `hardLimitEvaluation` evidence map. This preserves the frozen RiskDecision wire contract while making staleness detectable.

An ALLOW/MODIFY RiskDecision is not current if its StrategyRevision, snapshot ID/version, lifecycleVersion, healthVersion, or expiry differs from the current snapshot. Risk HALT is only an input/event boundary; it does not mutate health directly.

## Boundaries

- **Agent mutation:** rejected.
- **Quant mutation:** rejected.
- **Lifecycle mutation:** absent.
- **Capital mutation:** absent.
- **TradingIntent implemented:** NO.
- **Execution implemented:** NO.
- **DEBT-AUD-A-03:** OPEN / PARTIALLY REMEDIATED; unchanged.

## Tests

- `npm --prefix trading-core/services/trading-core run typecheck` — PASS, 0 errors.
- `npm --prefix trading-core/services/trading-core run build` — PASS, 0 errors.
- `npm --prefix trading-core/services/trading-core test` — PASS, 31/31 suites; REQ-07C focused suite: 8/8 tests.
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — PASS, 45/45 tests.
- `git diff --check` — PASS.
- `git -C quants-lab diff --check` — PASS.

## External Mutation Counters

```text
Exchange order POST = 0
Exchange order DELETE = 0
DEX transaction signing = 0
Hummingbot live execution = 0
Condor live execution = 0
WebSocket live execution = 0
Mainnet mutation = 0
Real capital = 0
Production credentials used = 0
Customer credentials used = 0
Secrets exposed = false
```

## Files Changed

- `trading-core/services/trading-core/src/health/StrategyHealthTypes.ts`
- `trading-core/services/trading-core/src/health/StrategyHealthPolicy.ts`
- `trading-core/services/trading-core/src/health/StrategyHealthValidator.ts`
- `trading-core/services/trading-core/src/health/StrategyHealthErrors.ts`
- `trading-core/services/trading-core/src/health/PostgresStrategyHealthRepository.ts`
- `trading-core/services/trading-core/src/health/StrategyHealthAuthority.ts`
- `trading-core/services/trading-core/src/health/StrategyOperationalSnapshotService.ts`
- `trading-core/services/trading-core/migrations/0005_strategy_health_authority.sql`
- `trading-core/services/trading-core/src/repositories/postgres/InMemoryPostgresClient.ts`
- `trading-core/services/trading-core/src/risk/RiskTypes.ts`
- `trading-core/services/trading-core/src/risk/RiskDecisionValidator.ts`
- `trading-core/services/trading-core/src/risk/RiskAuthorityService.ts`
- `trading-core/services/trading-core/src/index.ts`
- `trading-core/services/trading-core/test/epic01-req06-risk-authority.test.mjs`
- `trading-core/services/trading-core/test/epic01-req07c-strategy-health-authority.test.mjs`
- `.instructions/STATUS.md`
- `.instructions/ROADMAP.md`
- `.instructions/TASKS.md`

## Residual Risks and Next Gate

The PostgreSQL migration is implemented and repository behavior is covered by transactional in-memory conformance. The opt-in real PostgreSQL E2E harness was not enabled in this local validation. Continuous telemetry-derived divergence, drawdown, slippage, latency, and execution-quality health evaluators remain deferred until their canonical inputs are frozen.

`REQ-07D` remains blocked until CTO accepts both REQ-07B and REQ-07C. No implementation authorization for TradingIntent follows automatically.

### Global Coordination Handoff

- Workspace: `Trading`
- Handoff ID / time: `2026-09-20T03:20:32Z-REQ-07C / 2026-09-20T03:20:32Z`
- Request / branch / HEAD: `REQ-07C / dev / c6286e2a58776d14d767ece800ac2d03118a8fd6 (WORKTREE)`
- Scope: `Durable StrategyHealthAuthority and StrategyOperationalSnapshot implementation`
- Local status: `LOCAL_VALIDATED / CTO REVIEW REQUIRED`
- Validation: `Typecheck, build, 31 TypeScript suites, 45 Quant tests, diff checks passed`
- Changed local records: `.instructions/STATUS.md, .instructions/ROADMAP.md, .instructions/TASKS.md, this handoff`
- Dependencies: `REQ-07B Lifecycle Authority -> REQ-07C Snapshot consumer -> REQ-07D future TradingIntent gate`
- Blockers / risks: `REQ-07D awaits CTO acceptance of REQ-07B and REQ-07C; real PostgreSQL E2E remains opt-in and unrun`
- Priority impact: `Current priority unchanged`
- Portfolio action: `Root coordinator should record this validated handoff and maintain the REQ-07D block`
- Boundaries preserved: `No TradingIntent, execution, mainnet, real capital, credentials, or external mutation`
