# AXODUS-TRADING-REQ-12 — Durable Execution State & Recovery Architecture Freeze

Date: 2026-09-17  
Status: `COMPLETE / ARCHITECTURE PARTIAL / DEPENDENCY DECISION REQUIRED`  
Implementation: `HOLD`  
Scope: Trading workspace only

## Outcome

REQ-12 audited the existing Trading persistence, event, migration, lifecycle and recovery surfaces before any durable execution implementation. The repository has reusable PostgreSQL and event foundations, but it does not yet expose a proven durable execution aggregate with atomic evidence/state transitions and cross-process recovery guarantees.

Final classification: **`DURABLE ARCHITECTURE PARTIAL / DEPENDENCY DECISION REQUIRED`**.

`IMP-02C — Durable Execution Lifecycle & Recovery` remains `HOLD`. `BLOCKER-02` remains open as `DURABILITY BLOCKING`.

## Sources reviewed

- `trading-core/services/trading-core/src/execution/CexExecutionLifecycleService.ts`
- `trading-core/services/trading-core/src/repositories/interfaces.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresClient.ts`
- `trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresConnectionPool.ts`
- `trading-core/services/trading-core/src/repositories/postgres/MigrationRunner.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresOrderRepository.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresProviderStateRepository.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresTradingEventRepository.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresRuntimeRepository.ts`
- `trading-core/services/trading-core/src/state/TradingStateService.ts`
- `trading-core/services/trading-core/src/state/ExecutionStateService.ts`
- `trading-core/services/trading-core/src/telemetry/TradingEventBus.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationWorker.ts`
- `trading-core/services/trading-core/src/reconciliation/StaleExecutionStateDetector.ts`
- `trading-core/services/trading-core/src/reconciliation/RuntimeRecoveryRequestRouter.ts`
- `trading-core/services/trading-core/test/postgres.e2e.test.mjs`
- `trading-core/services/trading-core/test/execution-orchestrator.test.mjs`
- `trading-core/services/trading-core/docs/LOCAL_POSTGRES_E2E.md`
- local `.instructions/STATUS.md`, `TASKS.md`, `ROADMAP.md`, `VALIDATION.md`, and `BLOCKER_REGISTER.md`

The review was local and offline. No credentials, exchange connectivity, orders, upstream changes or runtime activation were used.

## Reuse-first findings

| Capability | Current evidence | Classification | Decision needed |
| --- | --- | --- | --- |
| PostgreSQL connectivity | `NodePostgresClient`, pool configuration, health/bootstrap services | `REUSE` | none for the substrate |
| Schema migrations | `MigrationRunner` and migration history table | `REUSE / EXTEND` | durable execution migrations must be added later |
| Generic repositories | order, fill, position, portfolio, provider state and runtime repositories | `REUSE / ADAPT` | execution-attempt repository is still missing |
| Trading events | `PostgresTradingEventRepository` and replay queries | `REUSE / ADAPT` | append must participate in the same transaction as lifecycle mutation |
| Event bus | synchronous append plus subscriber dispatch | `PROTECT / ADAPT` | dispatch cannot be treated as durable publication |
| Idempotency | in-memory execution client identity checks and lifecycle guards | `PARTIAL` | durable uniqueness and attempt identity constraints required |
| CAS/versioning | no durable execution version contract or SQL compare-and-set found | `MISSING` | select and freeze mechanism before implementation |
| Fencing/leases | no execution-worker lease/fencing contract found | `MISSING` | decide whether worker ownership requires it |
| Outbox | no Trading-owned transactional outbox for execution events found | `MISSING / DECISION REQUIRED` | choose minimal PostgreSQL outbox or explicitly defer external publication |
| ACS integration | reconciliation proposal/request surfaces exist, but no reason to make ACS owner of Trading execution state | `ISOLATE` | keep Trading aggregate and authority local |

The existing `NodePostgresClient.transaction()` is not sufficient evidence of a safe production transaction boundary. Its public pool abstraction exposes only `query`, and the implementation begins and commits through pool-level queries without an explicit checked-out connection contract. A future implementation must prove that all statements in a transaction use one database connection and that commit/rollback outcomes are observable and classified.

## Canonical durable aggregate

Trading should own one durable aggregate per logical execution attempt, linked to its logical intent:

```text
OrderIntent
  └── SubmissionAttempt
        ├── attemptId
        ├── intentId
        ├── executionClientOrderId
        ├── providerId / connector / market
        ├── lifecycleState
        ├── submissionOutcome
        ├── providerOrderId
        ├── reconciliationState
        ├── cancellationState
        ├── evidence references and normalized evidence
        ├── createdAt / updatedAt / lastObservedAt
        ├── version
        └── recovery ownership metadata when required
```

The canonical identity remains Axodus-owned. `providerOrderId` is evidence associated with the attempt; it never replaces `attemptId` or `executionClientOrderId`.

The durable schema must enforce, at minimum:

- unique `attemptId`;
- unique `executionClientOrderId` within the Trading authority scope;
- explicit lifecycle and reconciliation states;
- nullable provider identity and evidence fields;
- monotonically increasing version suitable for compare-and-set;
- timestamps for local creation, provider observation and reconciliation;
- an append-only audit/event association;
- no credentials or secret material in the aggregate or evidence payload.

## Ownership and transaction boundaries

Axodus owns the aggregate, lifecycle policy, reconciliation decision, idempotency policy, audit meaning and capital/risk authority. Hummingbot and the exchange provide operational evidence only.

The external provider call must never run inside a long PostgreSQL transaction:

```text
transaction: persist attempt + submission-in-progress
commit
external provider call
process may crash
transaction: persist outcome/evidence + lifecycle transition + audit/outbox
commit
```

The following local operations must be atomic in one database transaction:

1. reconciliation evidence write, canonical lifecycle transition, version increment and audit event;
2. cancellation evidence write, cancellation lifecycle transition, version increment and audit event;
3. durable creation of an attempt and its execution identity, including uniqueness enforcement;
4. outbox insertion together with the state transition when an external consumer must receive the event.

In-memory event-bus dispatch is post-commit side effect only. Subscriber failure must not roll back a committed canonical transition, and subscriber success must not be mistaken for durable publication.

## Concurrency decision required

The proportional default for the current Trading runtime is **optimistic compare-and-set on the attempt version**, backed by a database uniqueness constraint for execution identity. Every state mutation must include the expected version and reject stale writers without changing state.

A short row lock may be used inside the transaction that applies a single transition. A long lease must not surround provider network I/O. Worker leases/fencing are required only if multiple recovery workers can claim the same attempt; if introduced, the fence token must be checked on every durable write.

This is a design recommendation, not an implementation decision. The exact combination of CAS, row lock and worker claim must be frozen before IMP-02C.

## Recovery protocol

On startup, a recovery worker must query non-terminal attempts and classify them by state and age. It may perform exact REST reconciliation for attempts whose provider outcome is unknown or whose recovery policy requires fresh evidence. It must never create a new submission solely because an attempt is incomplete or a lookup returns no match.

```text
startup
  ↓
claim eligible non-terminal attempt with CAS/lease
  ↓
read canonical attempt and version
  ↓
exact provider reconciliation when required
  ↓
transaction: evidence + canonical transition + audit/outbox
  ↓
commit
  ↓
release claim / allow next recovery pass
```

Recovery results remain `FOUND`, `NOT_FOUND` or `INDETERMINATE`. `NOT_FOUND` is a policy input and never means `SAFE_TO_RESUBMIT`. `INDETERMINATE` keeps the attempt unresolved. A cancellation timeout likewise remains ambiguous until evidence resolves it.

## Required failure-window behavior

| Window | Durable state before crash | External reality | Recovery action | Allowed transition |
| --- | --- | --- | --- | --- |
| A. before provider submission | attempt durable, not submitted or submission intent recorded | no provider call proven | inspect durable state and policy | no automatic second submission from absence alone |
| B. during submission | `SUBMISSION_IN_PROGRESS` | unknown | exact REST reconciliation | `FOUND`, `NOT_FOUND` or `INDETERMINATE` only |
| C. provider accepted, local ack not committed | in-progress or unknown | order exists | lookup by exact client identity | associate provider evidence and resume lifecycle |
| D. provider rejected, local result not committed | in-progress or unknown | rejection may be external evidence | reconcile and preserve rejection evidence when proven | rejected/failure only with evidence |
| E. unknown persisted, before reconciliation | `EXECUTION_UNKNOWN` | unknown | recovery worker claims attempt and reconciles | enter reconciling, then typed result |
| F. found, before lifecycle commit | reconciling plus evidence may be staged | order exists | retry atomic transition under version check | transition once; stale worker loses |
| G. cancellation submitted, result absent | `CANCEL_REQUESTED` | cancellation unknown | exact status/cancellation lookup | cancelled only with evidence |
| H. two recovery workers | same attempt/version | one or both may call provider | claim/CAS/fence and idempotent evidence | one canonical transition; duplicate work is harmless |
| I. stale worker write | old version | newer state already committed | compare-and-set rejects write | no regression |
| J. DB commit succeeded, process died before observing | new state committed | external state unchanged | reread by identity/version | treat committed state as source of truth; no duplicate mutation |

## Outbox decision

No broker is required for this milestone. If execution lifecycle events must leave the process, the preferred design is a minimal PostgreSQL outbox row written in the same transaction as the aggregate transition. A dispatcher may publish committed rows later and must be retry-safe. If no external publication is required by IMP-02C, the implementation may defer dispatcher work while still preserving the audit event transactionally.

The existing event repository is not by itself an outbox: it appends a record, maintains an in-process cache, and does not provide atomic coupling with a lifecycle repository.

## Security and authority boundaries

- credentials, keys, wallets and Gateway authority remain outside this aggregate;
- provider evidence must be redacted and bounded before durable storage;
- no secret material belongs in events, outbox rows, logs or recovery payloads;
- recovery workers may reconcile and persist evidence, but may not create new submissions;
- Axodus Risk and Capital Authority remain the only owners of admission and financial policy;
- ACS may consume approved events or request controlled workflows, but does not own Trading execution state.

## Required implementation decisions before IMP-02C

1. Select and document a transaction-capable PostgreSQL connection abstraction that pins all statements to one connection.
2. Select the durable schema and repository boundary for `SubmissionAttempt`.
3. Freeze version/CAS and, if needed, worker claim/fencing semantics.
4. Decide whether a transactional outbox is required for the first durable increment.
5. Define commit-outcome handling and recovery tests for database/process failure windows.
6. Define the migration and local Postgres validation plan, including fault injection without exchange access.

These are dependency and architecture decisions within the approved REQ-12 scope. No choice was silently made where the repository does not yet provide evidence.

## Preservation of prior findings

`IMP-02B` and `VAL-02B` remain valid for in-process lifecycle semantics, exact CEX reconciliation, repeated-operation safety and terminal-state protection. Their durable recovery claim remains explicitly limited.

`BLOCKER-01` remains independent and open: WebSocket is not admitted and is not a correctness dependency for this design.

Gateway/DEX reconciliation remains outside the CEX aggregate and requires a separate transaction-identity model.

## Exit criterion

REQ-12 is complete as an architecture audit, but not implementation-ready. The next gate is a CTO decision on the transaction abstraction, durable aggregate placement, concurrency mechanism and outbox requirement. Only after those decisions are recorded should `IMP-02C` open.

