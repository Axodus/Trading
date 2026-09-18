# AXODUS-TRADING-VAL-02C — Durable Crash Recovery Acceptance

Date: 2026-09-18

Status: `NEXT / CTO REVIEW REQUIRED AFTER IMP-02C`

Classification: `DURABLE RECOVERY VALIDATION PENDING / BLOCKER-02 OPEN`

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

## Current evidence boundary

IMP-02C currently provides PostgreSQL-backed orchestration, deterministic restart using new service/repository instances, CAS-safe concurrent recovery and durable cancellation ambiguity handling. That evidence is sufficient to open VAL-02C, but it does not itself prove OS-level crash atomicity or production provider behavior.

## Closure rule

VAL-02C may propose `DURABLE CEX LIFECYCLE & CRASH RECOVERY VALIDATED / BLOCKER-02 CLOSURE CANDIDATE`. It must not close `BLOCKER-02`; closure remains a separate CTO decision.
