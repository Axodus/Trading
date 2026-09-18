# AXODUS-TRADING-VAL-02C0

## PostgreSQL Atomicity and CAS Acceptance

**Status:** `READY / CTO REVIEW PENDING`
**Scope:** `IMP-02C0 — Durable Execution Persistence Primitives`
**Recorded:** 2026-09-17

This validation record covers the persistence primitives authorized by REQ-12. It does not claim that the complete durable execution lifecycle or crash-recovery worker is implemented.

## Acceptance evidence

| Boundary | Result | Evidence |
| --- | --- | --- |
| SubmissionAttempt persistence | PASS | Real PostgreSQL C0 test creates and reloads the aggregate. |
| Single-connection transaction context | PASS | `NodePostgresClient.transaction()` checks out one connection, issues `BEGIN`/`COMMIT` or `ROLLBACK`, and releases it. |
| Rollback atomicity | PASS | Injected failure after aggregate/outbox work leaves neither canonical row visible. |
| CAS conflict | PASS | Two writers using the same version produce one update and one typed `CONCURRENCY_CONFLICT`. |
| Attempt/evidence/outbox atomic commit | PASS | One transaction persists the CAS mutation and outbox entry with the resulting aggregate version. |
| Recovery candidate query | PASS | Non-terminal attempts are returned in deterministic order for later recovery processing. |
| Restart visibility | PASS | A new repository/client instance reads the committed aggregate and outbox state. |
| In-memory lifecycle untouched | PASS | C0 adds persistence primitives without replacing the accepted 02B in-memory state machine. |

## Validation commands

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm test` — PASS, 9 test files / 0 failures
- `TRADING_POSTGRES_E2E=1 node --test test/imp-02c0-durable-persistence.test.mjs` — PASS, 2 tests / 0 failures against real PostgreSQL
- `npm run trading:local:e2e -- --json --cleanup` — PASS; simulation-only, live trading disabled, production readiness false
- `git diff --check` — PASS

## Remaining boundary

`VAL-02C0` does not validate process crash injection, durable recovery worker ownership, fencing/leases, or provider-call recovery. Those remain part of `IMP-02C` and `BLOCKER-02` remains `OPEN / DURABILITY BLOCKING`.

**Decision state:** `VALIDATION READY / CTO REVIEW PENDING`
