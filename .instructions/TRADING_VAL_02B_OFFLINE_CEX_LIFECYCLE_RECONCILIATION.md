# AXODUS-TRADING-VAL-02B — Offline Deterministic CEX Lifecycle & Reconciliation Acceptance

Date: 2026-09-17

Status: `COMPLETE / VALIDATION EVIDENCE READY / CTO REVIEW PENDING`

Classification: `CEX RECONCILIATION PARTIALLY VALIDATED / BLOCKER-02 REMAINS OPEN`

## Scope

This validation exercises the Axodus-owned CEX lifecycle implemented by IMP-02B using offline providers and repository snapshots. It covers Binance Spot/Perpetual strong-capability semantics only. Gateway/DEX, WebSocket, Condor, credentials, exchange connectivity, orders and capital remain outside scope.

## Evidence matrix

| Input | Provider evidence | Reconciliation result | Canonical state | Allowed next action |
|---|---|---|---|---|
| acknowledged submission | explicit submission evidence | acknowledged | `provider-acknowledged` | lifecycle may continue |
| explicit rejection | deterministic rejection | rejected | `rejected` | terminal rejection handling |
| timeout before acceptance | no known result | none yet | `execution-unknown` | exact reconciliation; no blind retry |
| timeout after acceptance | exact client-ID lookup finds order | `FOUND` | `reconciled-found` | continue lifecycle with provider evidence |
| timeout plus lookup absent | exact lookup returns no order | `NOT_FOUND` | `reconciled-not-found` | policy review; no resubmission implied |
| lookup unavailable | network/provider failure | indeterminate | `reconciled-indeterminate` | remain unresolved; retry only by explicit future policy |
| malformed lookup evidence | identity mismatch | indeterminate | `reconciled-indeterminate` | investigate evidence; no lifecycle advancement |
| partial fill | provider status and quantities | `FOUND` | `reconciled-found` | preserve fill evidence; state is not inferred terminal |
| full/terminal evidence | provider status and quantities | `FOUND` | `reconciled-found` | preserve evidence; terminality remains explicit |
| cancel request | request accepted locally | none yet | `cancel-requested` | await provider cancellation evidence |
| cancel timeout/failure | no proof of cancellation | failed/ambiguous | `cancellation-failed` | reconcile cancellation later; never infer `cancelled` |
| duplicate/late evidence | evidence after terminal state | ignored or rejected | terminal state preserved | no regression or replacement of Axodus identity |
| unsupported connector | capability flags absent | not admitted | prior state preserved | reject before provider access |

## Validated invariants

- `PROVIDER_EXECUTION_UNKNOWN` remains distinct from `FAILED`.
- `NOT_FOUND` does not create an attempt, authorize resubmission or become `FAILED` automatically.
- Exact provider evidence must carry the same `executionClientOrderId` as the Axodus attempt.
- `providerOrderId` is associated evidence and never replaces the Axodus execution identity.
- Repeated reconciliation after a final reconciliation result is state-safe and does not call the provider again.
- Concurrent reconciliation calls for one attempt share one provider lookup and cannot create conflicting canonical transitions.
- Repeated cancellation requests and duplicate terminal cancellation evidence are state-safe.
- Cancellation failure/ambiguity never becomes `cancelled` without evidence.
- Gateway/DEX capability rejection occurs before provider access in the CEX lifecycle.
- No correctness path uses WebSocket or a user stream.
- Provider lookup failures are normalized into unresolved Axodus state rather than leaking provider exceptions.

## Restart and recovery boundary

The validation reconstructs an equivalent attempt from a repository snapshot in a new service instance and proves that exact reconciliation continues from the same canonical `executionClientOrderId`. This validates the contract shape for recovery.

The lifecycle repository used by IMP-02B is currently in memory. Durable persistence, transactional compare-and-save, process crash recovery and cross-process concurrency are not part of this implementation and are not claimed as validated. The `BLOCKER-02` therefore remains open.

## Tests

Executed from `trading-core/services/trading-core`:

```bash
npm run typecheck
node test/val-02b-cex-lifecycle.test.mjs
npm test
```

Results:

- Typecheck: PASS.
- Dedicated VAL-02B suite: 12 tests passed, 0 failed.
- Full service regression: PASS after the validation fixes; existing IMP-01, IMP-01D, IMP-02A/VAL-02A and IMP-02B suites remain green.
- `git diff --check`: PASS.
- No credentials, exchange network, orders, WebSocket or upstream modifications used.

The dedicated suite covers acknowledged/rejected paths, ambiguous submission, exact found/not-found/indeterminate results, malformed evidence, lookup failure, partial fills, cancellation ambiguity, terminal protection, connector admission, Gateway/DEX exclusion, snapshot recovery, baseline-mismatch evidence and concurrent/repeated reconciliation.

## Result and next decision

Result: `CEX RECONCILIATION PARTIALLY VALIDATED / BLOCKER-02 REMAINS OPEN`.

The implementation is a closure candidate for the in-process deterministic contract, but `BLOCKER-02` must not be closed until durable persistence and restart/recovery semantics are implemented and validated under a separately authorized increment.

Record: `AXODUS-TRADING-BLOCKER-02` remains `OPEN / IMPLEMENTATION BLOCKER ONLY / CEX FEASIBILITY RESOLVED`.
