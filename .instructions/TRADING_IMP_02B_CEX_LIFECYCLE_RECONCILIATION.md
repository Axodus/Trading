# AXODUS-TRADING-IMP-02B — Canonical CEX Execution Lifecycle & Reconciliation

**Status:** `IMPLEMENTED / CTO REVIEW PENDING`  
**Classification:** `CEX LIFECYCLE FOUNDATION / REST EXACT RECONCILIATION`  
**Scope:** Binance Spot and Binance Perpetual capability model  
**Baseline:** `HUMMINGBOT_BASELINE_V1` / restricted HTTP substrate

## Result

IMP-02B establishes an Axodus-owned lifecycle foundation for CEX submission attempts. Each attempt receives a distinct `executionClientOrderId` derived from the attempt identity. The provider order ID remains provider evidence and is never used as the Axodus canonical identity.

The implementation supports explicit attempt, submission, acknowledgement, rejection, failure, unknown-outcome, reconciliation and cancellation states. `PROVIDER_EXECUTION_UNKNOWN` can only proceed through an admitted exact reconciliation provider. `not-found` does not authorize resubmission and `indeterminate` remains unresolved. No retry operation exists in this implementation.

Cancellation is modeled separately: `cancel-requested` and `cancelled` are distinct states.

## Capability admission

The reconciliation provider must declare all three capabilities:

- `supportsCallerOrderIdentity`
- `supportsExactOrderLookup`
- `supportsDeterministicReconciliation`

If any capability is absent, reconciliation is rejected before provider lookup. This excludes Gateway/DEX from the CEX reconciliation path while preserving its future transaction-identity model.

## Evidence and recovery

The provider returns Axodus-normalized evidence containing the execution client order ID, optional provider order ID, provider status, quantities, observation time, source, cancellation state and fill references. Provider DTOs and exceptions are not part of the lifecycle contract.

`CexExecutionAttemptRepository` is the persistence boundary. The current implementation supplies an in-memory repository for deterministic validation and exposes recoverable states for a later durable implementation: `submission-in-progress`, `execution-unknown`, `reconciling` and `cancel-requested`.

The accepted correctness path is REST exact lookup by caller identity. WebSocket remains outside the path and `AXODUS-TRADING-BLOCKER-01` remains open.

## Validation

The focused suite covers attempt identity, exact reconciliation outcomes, capability rejection, cancellation separation and the no-resubmission rule. The full Trading Core suite passed with 7 test files and 0 failures.

`VAL-02B` remains the next validation milestone. `BLOCKER-02` remains open until that validation proves deterministic recovery, including restart semantics.

## Boundaries preserved

No upstream submodule was modified. No credentials, exchange connectivity, orders, paper/live trading, WebSocket, Condor integration, DEX reconciliation or capital authority was introduced.
