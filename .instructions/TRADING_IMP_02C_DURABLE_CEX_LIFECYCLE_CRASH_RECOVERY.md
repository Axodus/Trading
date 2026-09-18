# AXODUS-TRADING-IMP-02C — Durable CEX Lifecycle & Crash Recovery

Date: 2026-09-18

Status: `IMPLEMENTED / VALIDATION EVIDENCE READY / CTO REVIEW PENDING`

## Scope

IMP-02C integrates the accepted Axodus-owned CEX lifecycle with the PostgreSQL persistence primitives from IMP-02C0. The durable execution path uses `SubmissionAttempt` as the authoritative runtime aggregate, preserves attempt-specific `executionClientOrderId`, and applies canonical transitions with optimistic CAS.

Provider calls occur outside PostgreSQL transactions. An ambiguous provider result remains `UNKNOWN` and is recovered through exact reconciliation; the implementation never performs blind submission retry. Cancellation ambiguity is persisted separately from `CANCELLED` and is resolved only through provider evidence.

## Implemented behavior

- durable creation and mutation of submission attempts;
- state, evidence, event and outbox writes through the accepted single-connection transaction context;
- CAS-protected lifecycle transitions;
- recovery-candidate discovery from a new repository/service instance;
- exact identity reconciliation for ambiguous submissions;
- concurrent recovery workers with stale-writer conflict handling;
- cancellation request/result separation and cancellation ambiguity recovery;
- preservation of `NOT_FOUND` and `INDETERMINATE` without resubmission;
- terminal-state protection against duplicate or late evidence;
- no WebSocket, Condor, Gateway/DEX, credentials or external exchange operations.

## Validation evidence

The PostgreSQL-backed targeted suite passed 7/7 tests:

- ambiguous submission recovered after service/repository restart;
- concurrent recovery workers produced one canonical reconciliation transition;
- cancellation ambiguity was persisted and resolved after restart without a second cancel;
- `NOT_FOUND` and `INDETERMINATE` remained unresolved without resubmission;
- IMP-02C0 persistence, rollback, CAS, outbox and restart-visibility tests passed.

The local simulation E2E also passed with migration `0003_durable_execution_primitives.sql`, database health, schema validation, repository readiness, replay smoke and cleanup. The environment was mock/simulation-only with live trading disabled.

## Boundary and limitation

This increment validates orchestration against deterministic provider fakes and a real local PostgreSQL database. It does not claim OS-level crash injection, production provider behavior, exactly-once external effects, live/paper trading readiness, or closure of the full failure-window acceptance gate.

`VAL-02C` remains the next gate and must exercise failure windows A–J, including process destruction/recreation, commit boundaries, recovery coordination and durable cancellation. `AXODUS-TRADING-BLOCKER-02` remains `OPEN / CRASH RECOVERY VALIDATION / CTO CLOSURE PENDING`.

## Related records

- `.instructions/TRADING_REQ_12_DURABLE_EXECUTION_STATE_RECOVERY_ARCHITECTURE_FREEZE.md`
- `.instructions/TRADING_IMP_02C0_DURABLE_EXECUTION_PERSISTENCE_PRIMITIVES.md`
- `.instructions/TRADING_VAL_02C_DURABLE_CRASH_RECOVERY_ACCEPTANCE.md`
