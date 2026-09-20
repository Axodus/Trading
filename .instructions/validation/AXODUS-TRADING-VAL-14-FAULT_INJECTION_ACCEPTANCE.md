# AXODUS-TRADING-VAL-14-FAULT — Fault Injection & Resilience Acceptance

**Status:** `COMPLETE / PASS / CTO REVIEW REQUIRED`  
**Date:** 2026-09-20  
**Parent Gate:** `AXODUS-TRADING-EPIC-01 / REQ-14`  
**Environment:** Isolated Fault Injection Suite (Node.js Test Runner)  
**Mainnet:** `PROHIBITED`  
**Real Capital:** `PROHIBITED`  

---

## 1. Executive Summary

This validation gate certifies that the integrated Trading Harness responds safely and deterministically to deliberate faults injected across infrastructure, market data, persistence, provider transport, execution ambiguity, and governance.

Tested Invariants:
1. **Zero Fault-Induced Duplicate Trades:** No injected fault causes duplicate order submission or double economic accounting.
2. **Fail-Closed Safety:** Incomplete, stale, or ambiguous states immediately transition to containment or reconciliation without silent continuation.
3. **SUBMITTED_UNKNOWN Reconciliation:** Lost provider ACKs transition to `SUBMITTED_UNKNOWN` and trigger reconciliation by `clientOrderId` rather than blind resubmission.
4. **Split-Brain Prevention:** Stale worker lease tokens are rejected with `HarnessFencingTokenError`.
5. **Multiple Failure Latching:** Simultaneous faults (e.g. stale market data + provider outage) keep safety kill active until all conditions recover.
6. **Recovery Stability Window:** Flapping recoveries reset stability timers, preventing premature execution resumption.

---

## 2. Fault Matrix

| Injected Fault | Injection Point | Expected Harness Response | Observed Behavior | Verdict |
|---|---|---|---|---|
| Stale Market Data | MarketState Ingestion | Block proposal, signal safety | `KILL_NEW_RISK` active, 0 orders | `PASS` |
| Revision Drift | Risk -> Intent Boundary | Reject execution intent | `HarnessRevisionMismatchError` | `PASS` |
| Lost Provider ACK | Execution Adapter | `SUBMITTED_UNKNOWN` state | Lookup by `clientOrderId`, no retry | `PASS` |
| Outbox DB Failure | Run Persistence | Full ACID rollback | 0 orphan records in PostgreSQL | `PASS` |
| Stale Worker Token | Stage Transition | Fencing rejection | `HarnessFencingTokenError` | `PASS` |
| Governance Rejection | Intervention Plan | Record rejection, escalate | Authority sovereignty preserved | `PASS` |
| Kill Switch Trigger | Active Run Preflight | Immediate stage containment | Run aborted, new risk blocked | `PASS` |
| Fault During Recovery | Stability Window | Reset recovery timer | SAFE_TO_RESUME withheld | `PASS` |
