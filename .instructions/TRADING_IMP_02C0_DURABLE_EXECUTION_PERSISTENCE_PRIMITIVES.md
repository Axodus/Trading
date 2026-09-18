# AXODUS-TRADING-IMP-02C0 — Durable Execution Persistence Primitives

Status: `IMPLEMENTED / VALIDATION READY / CTO REVIEW PENDING`

Date: 2026-09-17

## Scope

This increment implements only the persistence primitives authorized by REQ-12 for the Axodus-owned execution lifecycle. PostgreSQL remains the single durable store. The in-memory lifecycle and provider-facing execution path remain unchanged.

## Delivered

- migration `0003_durable_execution_primitives.sql` for durable submission attempts and transactional outbox entries;
- PostgreSQL repository for create, read, recovery-candidate listing and versioned compare-and-set updates;
- typed concurrency conflict and transaction failure boundaries;
- dedicated checked-out PostgreSQL connection for transaction callbacks;
- atomic attempt mutation plus outbox event persistence through one transaction context;
- restart visibility through a new repository instance.

## Invariants

- CAS requires `expectedVersion`; zero affected rows produce a typed concurrency conflict;
- repositories participating in a canonical transition receive the same transaction client;
- external provider calls are outside database transactions;
- `UNKNOWN` remains unresolved and no recovery worker or resubmission is introduced;
- WebSocket, Condor, DEX, credentials, exchange connectivity and operational trading remain outside scope.

## Validation evidence

- typecheck: PASS;
- full service tests: PASS, 9 test files, 0 failures;
- real PostgreSQL rollback atomicity: PASS;
- real PostgreSQL CAS conflict: PASS;
- real PostgreSQL attempt/evidence/outbox atomic commit: PASS;
- real PostgreSQL restart visibility: PASS;
- build: PASS;
- `git diff --check`: PASS.

## Decision state

`VAL-02C0` is the next acceptance gate. `AXODUS-TRADING-BLOCKER-02` remains `OPEN / DURABILITY BLOCKING`. This record does not claim durable lifecycle completion, crash recovery, worker fencing or operational readiness.
