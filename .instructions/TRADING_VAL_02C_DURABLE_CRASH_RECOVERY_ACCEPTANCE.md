# AXODUS-TRADING-VAL-02C — Durable Crash Recovery Acceptance

Date: 2026-09-18

Status: `COMPLETE / CTO ACCEPTED`

Classification: `DURABLE CEX LIFECYCLE & CRASH RECOVERY VALIDATED / BLOCKER-02 CLOSURE ACCEPTED`

## Acceptance scope

VAL-02C must validate the durable lifecycle against a real local PostgreSQL database and deterministic provider fakes. It must cover failure windows A–J from REQ-12:

1. crash before provider submission;
2. crash during provider submission;
3. provider accepted before local acknowledgement;
4. provider rejected before local persistence;
5. persisted `UNKNOWN` before reconciliation;
6. `FOUND` evidence before lifecycle commit;
7. cancellation submission before result persistence;
8. two recovery workers on one attempt;
9. stale worker write after a newer CAS version;
10. successful database commit followed by process termination before the caller observes success.

Each case must record durable state before the window, external/provider evidence, recovery action, canonical transition and permitted next action.

## Required assertions

- `UNKNOWN` never becomes `FAILED` solely because a provider call timed out;
- `NOT_FOUND` never authorizes automatic resubmission;
- `INDETERMINATE` remains non-destructive;
- `CANCEL_REQUESTED` and `CANCELLED` remain distinct;
- repeated evidence is state-safe and does not duplicate canonical transitions;
- stale workers receive typed CAS conflicts and cannot overwrite newer state;
- recovery uses the same canonical `SubmissionAttempt` identity after restart;
- no correctness path depends on WebSocket;
- no credentials, exchanges, orders, capital, Condor, DEX or production services are used.

## Accepted evidence

IMP-02C and VAL-02C provide PostgreSQL-backed orchestration, deterministic restart using new service/repository instances, CAS-safe concurrent recovery, exact reconciliation and durable cancellation ambiguity handling. The accepted evidence covers the controlled Axodus/provider boundary and does not claim real-venue execution validation.

Accepted results: typecheck, build, full service suite (10/10 files), targeted IMP-02C/IMP-02C0 PostgreSQL suite (7/7), local simulation E2E with cleanup, and `git diff --check` all passed. No credentials, exchange connectivity, orders, WebSocket, Condor, DEX or capital were used.

The following distinction remains normative: durable crash recovery validated under deterministic providers is not real exchange execution validation.

## Closure decision

The CTO accepted VAL-02C on 2026-09-18 and closed `AXODUS-TRADING-BLOCKER-02`. The blocker register preserves its historical evolution. Independent boundaries remain open: `BLOCKER-01` WebSocket is still `KEEP BLOCKED / DO NOT USE`; Gateway/DEX reconciliation, Condor, live execution and capital remain outside authority.
