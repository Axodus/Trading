# AXODUS-TRADING-REQ-06 — Execution State, Reconciliation & Idempotency Freeze

Status: `AUDIT COMPLETE / DOCUMENTATION FREEZE PROPOSED / IMP-02 BLOCKED`

Date: 2026-09-17

## Result

The execution lifecycle is Axodus-owned, but the current REQ-04 Hummingbot baseline does not provide the provider-side identity and lookup guarantees required to make unknown submission outcomes safely reconcilable. The domain contract can be frozen; operational `IMP-02` cannot start without a decision on the provider identity/reconciliation gap.

Final classification: `IMP-02 BLOCKED`.

This record supersedes the earlier open questions in the REQ-06 initiation record while preserving REQ-03 and REQ-04 provenance. It does not implement lifecycle, persistence, adapters, credentials, exchange connectivity or orders.

## Preserved baseline and boundaries

```text
Condor              d89e74f2e3e273bea102c64e4977118e6a88084f
Hummingbot client   v1.5.9 / dae015a3c513879ed06a55cf2b2c10e5772c0962
Hummingbot API      2494e847538bb7b819495cbc30eb4ef828feaacd
```

IMP-01 remains complete and published for restricted HTTP execution and HTTP market-data reads. `AXODUS-TRADING-BLOCKER-01` remains open; WebSocket is not admitted. Condor remains outside the first execution path.

No credentials, exchange connectivity, orders, paper/shadow/live trading, production, capital authority, Condor integration, WebSocket work or upstream modification is authorized by this record.

## Canonical Axodus lifecycle

Provider states are evidence; they do not replace Axodus lifecycle truth.

```text
INTENT_ACCEPTED
      │ authorization and risk gate pass
      ▼
SUBMISSION_PENDING
      │ one explicit submission attempt created
      ├── known rejection ───────────────► REJECTED
      ├── known provider result ─────────► SUBMITTED
      └── timeout/transport ambiguity ──► PROVIDER_EXECUTION_UNKNOWN
                                             │
                                             ▼
                                      RECONCILIATION_PENDING
                                             │
                           ┌─────────────────┴─────────────────┐
                           ▼                                   ▼
                    defensible match                    insufficient evidence
                           │                                   │
                           ▼                                   ▼
                    continue lifecycle                 RECOVERY_REQUIRED
```

`SUBMITTED` may become `PARTIALLY_FILLED`, `FILLED`, `CANCEL_REQUESTED`, `CANCELLED`, `REJECTED` or `EXPIRED` only through explicit Axodus transitions backed by evidence. `RECONCILED` is an audit result, not permission to erase the prior unknown state. `RECOVERY_REQUIRED` requires governed recovery or operator review.

Canonical states:

`INTENT_ACCEPTED`, `SUBMISSION_PENDING`, `SUBMITTED`, `PARTIALLY_FILLED`, `FILLED`, `CANCEL_REQUESTED`, `CANCELLED`, `REJECTED`, `EXPIRED`, `PROVIDER_EXECUTION_UNKNOWN`, `RECONCILIATION_PENDING`, `RECONCILED`, `RECOVERY_REQUIRED`, `TERMINAL_FAILURE`.

## Identity and attempt model

| Concept | Owner | Required meaning |
|---|---|---|
| `OrderIntentId` | Axodus | Stable identity of the approved logical order intent. |
| `clientOrderId` / idempotency key | Axodus | Canonical deduplication identity; never silently replaced by a provider ID. |
| Submission attempt | Axodus | One deliberate request with attempt number, timestamps, correlation, authorization and payload digest. |
| Transport retry | Axodus policy | Read/query retry is distinct from submission; no automatic submission retry after unknown outcome. |
| `providerOrderId` | Provider reference | External identifier mapped to the intent only as evidence. |
| Lifecycle state | Axodus | Sovereign state derived from approved transitions and evidence. |
| Reconciliation query | Axodus workflow | Provider read; never a new submission attempt. |
| Cancellation intent | Axodus | Separately authorized request to seek cancellation. |

The same logical intent must never create a new submission attempt implicitly. A new attempt requires an explicit Axodus decision after reconciliation and duplicate-prevention checks.

## Minimum durable record

Before operational `IMP-02`, durable state must include:

- intent, tenant/execution context and correlation identifiers;
- canonical client/idempotency identity, immutable request and payload digest;
- provider baseline and admitted transport;
- authorization/risk references, policy version and expiry;
- attempt number, timestamps, request/response evidence and transport outcome;
- lifecycle state and transition history;
- provider/exchange identifiers and their evidence source;
- reconciliation state, query attempts, timestamps and match rationale;
- fills, cancellation intent/result, terminal classification and recovery checkpoint.

In-memory adapter state, Hummingbot `in_flight_orders` and provider persistence are insufficient restart authority.

## Cancellation semantics

`CANCEL_REQUESTED` records Axodus intent and authorization. A provider response saying cancellation was initiated does not mean `CANCELLED`. For an unknown submission, cancellation requires a reconciled provider identity/state or a separately accepted safe capability; ambiguous cancellation returns to reconciliation/recovery and never authorizes blind resubmission.

## Hummingbot capability mapping

These findings come from the materialized REQ-04 source.

| Capability | Evidence | Classification | Consequence |
|---|---|---|---|
| Caller-supplied `clientOrderId` on submit | Client `place_order` and server `TradeRequest` have no field; connector generates the ID | `NOT AVAILABLE` | Axodus identity cannot be propagated as provider deduplication key. |
| Provider order identity | `TradeResponse.order_id` is connector-assigned client order ID; records also expose client/exchange IDs | `AVAILABLE / LIMITED` | Store as external evidence only. |
| Provider idempotency / duplicate suppression | No request key or guarantee in submit path | `NOT AVAILABLE / UNVERIFIED` | Axodus owns duplicate prevention and must reconcile before resubmission. |
| Active-order discovery | `/trading/orders/active`, filtered by account/connector/pair | `AVAILABLE / PARTIAL` | In-flight evidence only; no exact unknown-intent lookup. |
| Historical order lookup by exact ID | Search filters lack order ID/client ID | `PARTIAL / UNSAFE` | Broad search cannot prove identity in all cases. |
| Trade/fill lookup by exact order ID | Trade filters lack direct order-ID filter | `PARTIAL / UNSAFE` | Fill reconciliation may remain inconclusive. |
| Cancellation | ID accepted only when in `in_flight_orders`; response says initiated | `PARTIAL / UNSAFE` | Cannot prove terminal cancellation or resolve unknown submission. |
| Restart recovery | Server reloads provider in-flight records, not Axodus lifecycle | `PARTIAL / INSUFFICIENT` | Axodus durable state remains required. |

The current `HummingbotHttpExecutionProvider` also drops `request.clientOrderId` from the body, confirming that the admitted HTTP path cannot provide provider-side idempotency.

## Reconciliation algorithm

For `PROVIDER_EXECUTION_UNKNOWN`:

1. Persist the immutable intent and submission attempt before further provider mutation.
2. Mark `RECONCILIATION_PENDING`; do not submit again.
3. Query bounded evidence: known provider ID if available, active orders, historical orders in the account/market/time window, trades/fills and related status.
4. Match only on sufficiently specific account, connector, instrument, side, quantity, price/type, timing and provider identifiers. A broad row match is not proof.
5. If one order is defensibly matched, attach the provider ID and continue from observed evidence.
6. If no order is proven through incomplete surfaces, retain the unknown event and move to `RECOVERY_REQUIRED`; absence is not proof of non-creation.
7. Conflicting or stale evidence remains ambiguous and requires governed recovery/operator review.
8. Only a later explicit Axodus decision may create a new attempt, with a new attempt identity and recorded reason.

Read/query retries may be bounded and audited. Submission retries are not implied by query retry policy.

## Ownership matrix

| Capability | Axodus | Hummingbot | Condor | Classification |
|---|---|---|---|---|
| Intent and client/idempotency identity | canonical | cannot accept caller key currently | no authority | `NEW / PRESERVE` |
| Submission attempt and lifecycle | canonical | operational response only | direct path rejected | `AXODUS-OWNED` |
| Provider/exchange identifiers | records evidence | connector/server source | read-only later | `ADAPT` |
| Duplicate prevention | canonical decision | no verified guarantee | cannot decide | `NEW` |
| Reconciliation policy/final state | canonical | partial observations | no authority | `NEW / BLOCKED` |
| Durable recovery | canonical | provider persistence is evidence | no authority | `NEW` |
| Cancellation authorization/terminal meaning | canonical | initiates connector cancellation | direct path rejected | `ADAPT / PROTECT` |
| Fills, positions, portfolio, audit, accounting | canonical | mechanisms/observations only | no authority | `PRESERVE` |
| Strategy, signal, judgment, risk and capital | canonical | does not own | does not own | `PRESERVE` |

## Failure and ambiguity semantics

| Event | Axodus result |
|---|---|
| Explicit provider rejection | `REJECTED` with attempt evidence |
| Accepted/submitted response | `SUBMITTED`; no fill implied |
| Timeout/connection loss after request | `PROVIDER_EXECUTION_UNKNOWN` and `RECONCILIATION_PENDING` |
| One defensible reconciliation match | Attach provider identity; continue observed lifecycle |
| No match through incomplete search | `RECOVERY_REQUIRED`, never `REJECTED` or retry permission |
| Conflicting/stale evidence | `RECOVERY_REQUIRED` with audit finding |
| Cancellation initiated | `CANCEL_REQUESTED`; await evidence |
| Terminal cancellation observed | `CANCELLED` |

Invariant: `PROVIDER_EXECUTION_UNKNOWN != FAILED`; it never authorizes blind submission retry.

## Implementation gap map

| Capability | Current status | Action |
|---|---|---|
| Axodus lifecycle contract | Existing contracts are partial | `EXTEND` after CTO acceptance |
| Durable intent/attempt record | Persistence exists; lifecycle fields absent | `NEW` |
| Canonical client/idempotency identity | Core field exists; upstream cannot accept it | `ADAPT / DECISION REQUIRED` |
| Provider order mapping | Known submit response exists | `EXTEND` |
| Exact unknown-outcome reconciliation | No safe direct lookup | `NEW / BLOCKED` |
| Cancellation lifecycle | Upstream only initiates cancellation | `EXTEND / BLOCKED FOR UNKNOWN STATE` |
| Restart recovery | Generic proposal skeleton exists; lifecycle absent | `EXTEND` |
| Duplicate prevention | No provider guarantee | `NEW` |
| Condor execution integration | Direct paths exist outside Axodus boundary | `REJECT / LATER` |

## Proposed sequence after decision

```text
CTO decision on provider identity/reconciliation gap
        ↓
Axodus lifecycle and durable attempt contracts
        ↓
admitted provider identity/reconciliation capability
        ↓
unknown-outcome reconciliation and cancellation
        ↓
restart recovery and offline adversarial validation
        ↓
IMP-02 operational lifecycle
```

No implementation step is authorized by this document. `BLOCKER-01` WebSocket remains independent and open.

## REQ-03 findings reconciliation

### Preserved

- `PROVIDER_EXECUTION_UNKNOWN` remains distinct from failure and forbids blind retry.
- Axodus owns lifecycle, risk, intent, audit, accounting and capital authority.
- Hummingbot is operational substrate; Condor is outside the first execution path.
- Exactly-once cannot be inferred from HTTP success, generated IDs or provider persistence.

### Superseded

- The earlier “client-order-id/provider-id support remains to be checked” statement is replaced by the concrete capability findings above.
- The assumption that the current baseline was sufficient for operational unknown-outcome handling is replaced by `IMP-02 BLOCKED`.

### Invalidated

- None of the REQ-03 architecture boundaries are invalidated.

## Risks and unresolved questions

- Transport failure can leave an order created without an Axodus-propagated deduplication key.
- Broad searches can return no result or multiple plausible matches.
- Provider persistence and connector IDs cannot substitute for Axodus durable lifecycle authority.
- Cancellation can race with fills and cannot be treated as terminal from initiation alone.
- A future safe implementation requires a selected remedy: provider/API support for caller identity, reviewed adapter correlation, revised dependency, or governed operational restriction. This record selects none.

## Decision state

`AXODUS-TRADING-REQ-06`: `AUDIT COMPLETE / DOCUMENTATION FREEZE PROPOSED / CTO REVIEW PENDING`.

`IMP-02`: `BLOCKED` for operational execution lifecycle until the identity/reconciliation gap receives a CTO decision.

CEO decision required: `NONE`.

Related records:

- `.instructions/TRADING_REQ_03_IMPLEMENTATION_BASELINE_GAP_FREEZE.md`
- `.instructions/TRADING_REQ_04_MATERIALIZED_REPOSITORY_VERIFICATION.md`
- `.instructions/TRADING_IMP_01_RESTRICTED_BASELINE_AUTHORIZATION.md`
- `.instructions/TRADING_IMP_01D_HTTP_MARKET_DATA_BOUNDARY.md`
- `.instructions/TRADING_BLOCKER_01_REMEDIATION_DESIGN.md`
- `.instructions/BLOCKER_REGISTER.md`
