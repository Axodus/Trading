# AXODUS Trading — WLD Absorption Execution Qualification IMP Specification

**Request:** `AXODUS-TRADING-IMP-WLD-ABSORPTION-EXECUTION-QUALIFICATION-01`
**Parent design:** `AXODUS-TRADING-REQ-WLD-ABSORPTION-EXECUTION-QUALIFICATION-DESIGN-01`
**Program:** `GAP-QUANT-09 / OFFLINE_QUALIFICATION_DESIGN`
**Owner:** Trading
**Status:** `SPECIFICATION_READY / CTO_IMP_SPEC_REVIEW_PENDING`
**Implementation:** `NOT AUTHORIZED`

## 1. Purpose and decision boundary

Specify the smallest offline experiment that can determine whether the frozen
WLDUSDT Absorption Fade execution hypothesis survives explicit queue, delay,
partial-fill, exit, fee and data-quality assumptions. The experiment evaluates
execution-model plausibility and, only when qualified historical data exists,
economic sensitivity. It does not attempt to reproduce or validate the old
`+$1.273421680555...` replay result.

The selected strategy is unchanged:

```yaml
strategy_id: orderflow.absorption.fade
strategy_revision: freeze-2026-09-24-adapter-v1
symbol: WLDUSDT
market: Binance USD-M Futures (subject to source and instrument evidence)
strategy_parameters: frozen; no optimization or edits
```

The approval in the attached CTO disposition selects this research candidate;
it does not make it a DEV real-execution candidate. Current posture remains:
`WLD_INDEPENDENT_OOS=NOT_ESTABLISHED`, `WLD_EXECUTION_MODEL=NOT_QUALIFIED`,
`DEV_REAL_EXECUTION_CANDIDATE=NONE`.

## 2. Scope and exclusions

In scope for a later, separately authorized implementation:

- adapt the existing Condor paper-execution concepts behind a replay-only
  interface; preserve the frozen Absorption signal adapter;
- deterministic causal event ordering and conservative handling of ambiguous
  events;
- scenario-based queue/fill simulation with explicit uncertainty labels;
- order, fill, position and cost ledgers with reconciliation;
- offline isolation, deterministic identifiers, provenance and reproducible
  artifacts;
- functional validation with synthetic fixtures, clearly labeled as such.

Out of scope: strategy or parameter changes; use of Microprice/Q1; Quant Lab
product work; live/public-feed paper operation; exchange connectivity; network
capture or dataset purchase; Testnet; Mainnet; credentials; orders; capital;
portfolio sizing; strategy promotion; and any claim of qualification from
synthetic fixtures. Historical data acquisition, external services, and a new
independent OOS run each require their own explicit authorization and gates.

## 3. Baseline evidence and preserved historical record

At specification preparation, the inspected repositories were clean:

| Repository | Branch | HEAD |
|---|---|---|
| Trading | `dev` | `87a4be198dbaec1ab474701d9fecff10ab6fb0f0` |
| Quants-Lab | `main` | `148c27da84c1ab1ee861be14a7a41d067000ee49` |
| Condor | `main` | `3e3c5fd57d98a4ab5561967613d188831e7837c1` |

Relevant existing contracts and limitations:

- Quants-Lab `OrderFlowFrameV1` carries minute/frame time, aggregate buy/sell,
  BBO, depth, imbalance and derived fields. It is not a raw event-level queue
  tape. `AbsorptionReplay` currently enters at the next frame's `price`, marks
  the order `ASSUMED_MAKER`, treats the whole entry as filled, and evaluates
  stop/target/time exits from frame prices. Its historical output cannot prove
  queue position or observed fills.
- `condor/condor/paper_execution.py` already has resting-maker queue-volume and
  depth-walking taker concepts. Its current runtime uses a public live market
  feed, wall-clock time and UUIDs; it must not be invoked as-is by this offline
  experiment. Reuse is at the model/logic boundary after extraction behind
  injected replay inputs, deterministic time/IDs and a no-network interface.
- The 2026-09-24 L2 source handoff recorded
  `NO_ACCEPTABLE_HISTORICAL_L2_SOURCE_FOUND`: Tardis CSV sample lacked observed
  sequence fields and had unresolved licensing; Binance Vision depth aggregates
  were insufficient for causal level reconstruction; the bounded Binance
  stream pilot covered BTCUSDT/ETHUSDC, not WLDUSDT. The report does not prove
  WLD historical source availability. Re-audit exact current files and source
  rights before any economic replay.
- The OOS report records 16 WLD trades, $100 per trade, gross +$1.91342168,
  fees $0.64, net +$1.27342168, zero modeled slippage/funding, and maker assumed
  on both entry and exit. Its runner metadata also labels a BTCUSDT fee model
  and `$1000` fixed sizing although the observed WLD ledger uses `$100`; retain
  original artifacts and record this provenance mismatch as a limitation.

The consumed research ranges are protected. At minimum this includes WLD
`2026-06-23T18:20:00Z` through `2026-07-02T23:59:59.999Z` IS inputs and
`2026-06-26T18:20:00Z` through `2026-07-06T23:59:59.999Z` reported OOS, plus
all source events/frames used to create them. The prior report's OOS overlaps
the separate historical IS replay through July 2; consequently it is not
independent OOS. No renaming, recutting, rehashing, or new adapter may release
those source intervals from protection. Historical artifacts are immutable.

## 4. Required offline architecture

```text
frozen Absorption adapter
          │ signal only
          ▼
immutable qualified replay input ──► deterministic event normalizer
                                             │
                                             ▼
                                   offline execution model
                                  ┌──────────┴──────────┐
                                  │                     │
                              queue model           exit model
                                  └──────────┬──────────┘
                                             ▼
                         append-only order/fill/position/cost ledgers
                                             ▼
                         reconciliation + evidence manifest + digests
```

The execution model receives immutable events through an injected in-memory or
read-only file interface. It has no provider/feed constructor, HTTP/WebSocket
client, credentials, exchange SDK, Docker socket, operational command router,
or network fallback. It cannot construct or submit a real or paper exchange
order. “PAPER” is not an allowed result label for this offline simulator; use
`OFFLINE_EXECUTION_SIMULATION` and explicit scenario provenance.

Reuse the existing frozen Absorption adapter and provenance/hash primitives.
Adapt Condor's queue and depth-walking concepts; do not couple to its live
`BinanceMainnetPublicMarketFeed`. Keep the existing OOS package read-only.

## 5. Causal event contract

Each normalized event must retain source, symbol, event type, exchange time,
receive time when available, source sequence/trade identity, original payload
digest, and normalization revision. Event types include at least book snapshot,
book delta, trade print, signal/decision, simulated submit, simulated
acknowledgement, cancel request, cancel acknowledgement, fill, trigger/exit,
and terminal reconciliation.

Ordering rules:

1. Validate each source's native sequence continuity before replay. A sequence
   reset, gap, conflicting duplicate, invalid/crossed/empty book, or unreconciled
   snapshot quarantines the affected interval; the model must not bridge it.
2. Exchange event time is the cross-stream primary clock. Source sequence orders
   events only within a source stream; it must not be treated as a universal
   sequence across book and trade streams.
3. Exact duplicate event identities with identical content are idempotently
   discarded and counted. The same identity with different content is a hard
   integrity failure. Missing event identity is retained as an explicit
   limitation and cannot be silently deduplicated by price/size alone.
4. Simulated decision, submit and acknowledgement times derive from frozen
   deterministic latency assumptions. Liquidity events with event time less
   than or equal to simulated acknowledgement time cannot consume queue or fill
   the order. This strict boundary prevents same-timestamp pre-ack liquidity
   from being used.
5. Where book and trade events share a timestamp and no source contract proves
   their relative order, mark the group `CAUSAL_ORDER_AMBIGUOUS`. Do not infer a
   beneficial ordering. The conservative scenario receives no fill credit from
   ambiguous events; the uncertainty is preserved in the ledger and can make
   that attempt inconclusive.
6. A missing timestamp, non-monotonic stream, unknown unit, or unbounded data
   gap fails the affected replay closed. Receive time may diagnose latency but
   must not replace exchange time to fabricate causal order.

The above rules are the contract for deterministic replay; implementation must
use integer epoch units and stable tie grouping rather than platform-dependent
floating-point time.

## 6. Queue and fill scenarios

Level-2 market-by-price data does not reveal exact order priority, individual
cancellations, hidden liquidity, or the queue's full composition. Every fill is
therefore a **simulated scenario outcome**, never an observed historical fill.

The engine must emit at least these separately identified scenarios, with all
parameters frozen in an immutable run configuration:

- `QUEUE_CONSERVATIVE`: initialize queue ahead from displayed same-price depth
  at simulated acknowledgement; only eligible opposite-aggressor trade volume
  at the order price can consume displayed queue then the simulated order.
  Same-timestamp ambiguity, missing aggressor side, and unexplained book-size
  reductions receive no favorable fill credit. Book cancellations do not
  automatically reduce queue ahead.
- `QUEUE_BASELINE`: may recognize a bounded, explicitly parameterized share of
  observed same-price depth reductions as queue ahead cancellation only when
  the event stream and reconstruction support it. It must distinguish that
  assumption from known individual cancellations.
- `QUEUE_OPTIMISTIC_DIAGNOSTIC`: may be emitted only as a labeled sensitivity
  bound; it is never used alone for pass/qualification.

Eligible trade prints require side/aggressor direction consistent with the
resting order, price at the order, timestamp strictly after acknowledgement,
and validated trade identity. Trade-through events may not fill the remaining
quantity instantly. Any modeled trade-through effect must be bounded by
eligible executable volume and an explicit scenario rule. Partial fills update
remaining quantity and queue state; fills cannot exceed order remainder or
eligible post-ack volume.

Scenario parameters include queue initialization, cancellation attribution,
latency distribution or fixed latency, maximum resting duration, participation
cap, hidden-liquidity treatment, and invalid-event policy. Parameters are
versioned and frozen before any untouched validation window is selected or
opened. Sensitivity outputs are reported separately, not averaged into an
unlabeled point estimate.

## 7. Orders, exits, residual positions and reconciliation

Model a finite state machine with immutable event history. Minimum order states:
`CREATED`, `SUBMITTED`, `ACKNOWLEDGED`, `PARTIALLY_FILLED`, `FILLED`,
`CANCEL_PENDING`, `CANCELLED`, `REJECTED`, `EXPIRED`, `FAILED`; terminal-state
rules must prevent later fills after confirmed cancellation while allowing a
fill whose causal event precedes cancellation acknowledgement. Duplicate
commands/events are idempotent by stable IDs.

Entry uses the frozen post-only maker hypothesis; post-only rejection and no
fill are valid outcomes. Exit policies are distinct:

- Take-profit may rest as a passive limit with its own queue and expiry rules.
- Stop and timeout exits are urgent and use the frozen taker model: walk
  contemporaneous valid contra-side depth, charge taker fees, and model
  explicit latency/impact. If depth is insufficient, preserve a residual
  position; do not fill at midpoint, entry price, or a fabricated fallback.
- If stop and take-profit become possible within an interval whose event order
  is unresolved, apply the pre-registered adverse ordering or mark the attempt
  ambiguous/inconclusive. Do not select the favorable path.
- Concurrent cancellation/fill outcomes are resolved only by causal event
  order; unresolved races remain explicit and cannot be counted as a clean
  terminal fill.

Every attempt closes as one of `RECONCILED_FLAT`, `RECONCILED_OPEN_RESIDUAL`,
`INVALID_DATA`, `AMBIGUOUS_LIFECYCLE`, or `INCOMPLETE_EVIDENCE`. A residual
position or unmatched order/fill invalidates that attempt's economic conclusion
and must be reported; it cannot be dropped from aggregates.

Required append-only ledgers: source events, signals, orders, order events,
fills, cancellations, positions, cost events, and terminal reconciliation.
Stable IDs derive from run digest plus deterministic event ordinal/content;
wall-clock time and random UUIDs are prohibited in replay artifacts.

## 8. Economic conventions

All amounts carry explicit asset/currency units. Quantity is WLD base quantity;
notional, realized PnL and fees are USDT unless the qualified instrument contract
states otherwise. Use exact decimal arithmetic; record conversion source,
timestamp and rate if any non-USDT amount must be converted.

For a fully reconciled position:

```text
gross_realized = signed sum of entry/exit fill-price cashflows
net_realized   = gross_realized - exchange_fees - explicit_slippage_cost
                 - funding_net_cost - other explicitly modeled costs
```

Execution prices produced by walking the historical book already embody the
price impact relative to the chosen reference. Such impact may be reported as
an attribution, but must not be subtracted again. For each fill, record the
reference price, execution price, fee rate, fee unit, liquidity role, and
slippage attribution convention. Maker fees apply only to fills that the
scenario classifies as maker; urgent exits and marketable orders use taker fees.
Funding is cost-positive and credit-negative. If a potentially applicable
funding event or rate is unavailable, mark it `NOT_MODELED`; do not substitute
zero. Economic qualification is blocked if the missing item could materially
change the frozen pass criterion.

Reconciliation must assert, within exact decimal arithmetic and declared
rounding rules, that fill quantities equal order filled quantities, fees equal
the sum of fill fee events, position quantity equals signed fills, closed-trade
gross equals matched fill cashflows, and net equals gross less each cost exactly
once. Open/residual positions remain marked separately; realized PnL is not
presented as complete equity.

The historical +$1.2734 result across 16 x $100 notional is approximately
7.96 bps per $100 in aggregate. This is only a sensitivity reference showing
that a small unmodeled per-trade cost could erase the reported surplus. It is
not an acceptance threshold, forecast, or loss bound.

## 9. Data qualification and OOS protection

Before an economic replay, the implementation request must identify the exact
WLDUSDT venue/instrument, source/provider, acquisition method, data rights,
source time range, raw and normalized schemas, sequence model, trade aggressor
fields, snapshot/bootstrap rules, event coverage, gap/duplicate/crossed-book
counts, checksum lineage, and immutable storage location. It must establish
that the data actually contains the event details required by the chosen queue
scenarios. Minute `OrderFlowFrameV1` alone is insufficient for queue replay.

If no source passes, the only permitted outcome is functional/offline model
validation on synthetic fixtures; report `ECONOMIC_QUALIFICATION=INCONCLUSIVE_DATA_UNAVAILABLE`.
No claim of economic viability or independent OOS follows.

Before access to any new validation window, freeze and hash: strategy revision
and parameters; execution model and all scenario assumptions; source/data
manifest; evaluation window; metrics and units; minimum usable observations;
data-integrity thresholds; economic pass/fail/inconclusive rules; sensitivity
aggregation and missing-data policy. The following numerical package is
proposed for CTO review; it is not approved and is not an implementation
default:

| Measure | Proposed threshold for CTO decision |
|---|---|
| Independent holdout duration | At least 60 consecutive UTC calendar days, strictly outside all consumed source and feature windows |
| Minimum evidence | At least 100 completed round trips over at least 30 distinct active UTC days; all attempted entries, non-fills and residuals stay in the ledgers |
| Conservative economics | Aggregate net PnL greater than zero and one-sided 95% block-bootstrap lower confidence bound for mean daily net PnL greater than zero, using UTC day as the resampling block |
| Scenario robustness | Conservative queue scenario is decision-bearing; baseline must also have positive aggregate net PnL; optimistic scenario is diagnostic only |
| Source coverage | At least 99.5% coverage of expected source events over included intervals, reported separately for book and trades |
| Sequence and book integrity | Zero sequence discontinuities, invalid/crossed/empty books, missing required event times, or conflicting duplicate identities in included intervals; quarantine affected intervals before measuring coverage |
| Causal book age | At decision, simulated acknowledgement and each fill, last valid book no older than 250 ms for a 100 ms depth stream; otherwise no fill credit or quarantine |
| Lifecycle reconciliation | Zero unmatched orders/fills and zero unexplained residual positions for `PASS`; known residuals or ambiguous outcomes make the affected economic assessment inconclusive |
| Latency robustness | Evaluate measured p50, p95 and p99 source-to-simulated-ack latency plus one 100 ms stream interval; the conservative net-economics condition still applies |

The proposed 60-day, 100-round-trip, 30-active-day, 99.5% and 250 ms values
require CTO confirmation against WLD source capability and the frozen strategy
horizon. The 250 ms value applies only if the qualified source is a 100 ms
depth feed. If source cadence differs, the CTO must approve a replacement before
holdout access. Record rationale and digest for any change before selecting or
unsealing the holdout; do not tune thresholds after observing its economics.

The new window must be strictly later than the selection/training material or
otherwise proven independent by the canonical validation registry. It must
have zero overlap in raw source events, frames, partitions, and feature warmup
with any consumed selection or evaluation data. The holdout custodian must
record its digest and access state. Renaming a dataset, generating a new
revision, trimming rows, or changing adapter identity does not create an
independent sample. No current OOS result may be relabeled as independent.

## 10. Frozen evaluation outcomes

Every gate returns exactly one outcome:

- `PASS`: all frozen structural, integrity, reconciliation, sample-size and
  economic conditions for that gate are met.
- `FAIL`: evidence violates a frozen condition or the frozen conservative
  economic rule.
- `INCONCLUSIVE`: evidence is missing, insufficient, ambiguous, non-causal,
  unreconciled, or lacks qualified data.

Functional-model acceptance is separate from economic assessment. Synthetic
fixtures may establish deterministic transitions and negative-path behavior;
they cannot satisfy historical coverage, sample-size, OOS independence, or
economic criteria.

Before a holdout is opened, the numerical freeze must specify at least:

| Criterion | Required frozen definition |
|---|---|
| Net economics | reporting unit, cost coverage, aggregation and pass boundary |
| Conservative fill sensitivity | which queue scenario is decision-bearing and how adverse scenarios affect the decision |
| Observation sufficiency | minimum eligible signals, orders, fills, completed trades and active periods |
| Data integrity | maximum permitted gap, sequence, invalid-book, duplicate and ambiguity rates |
| Lifecycle | permissible residuals, cancel/fill races and incomplete attempts |
| Robustness | required scenario stability and uncertainty treatment |
| Stop conditions | conditions that halt evaluation and classify it as failed/inconclusive |

Unset values are a hard pre-holdout blocker, not implementation defaults.

## 11. Offline isolation obligations

The later implementation and validation must prove, by construction and
negative tests, that the replay:

- accepts only injected immutable events and has no live feed/provider
  dependency;
- has no API keys/secrets, exchange SDK submission route, WebSocket/REST
  fallback, operational execution ingress, or network capability;
- cannot emit an external order, cancel, wallet signature, Treasury action, or
  Governance mutation;
- rejects attempts to select live/testnet mode, unknown symbols/venues, mutable
  data references, or external URLs;
- remains deterministic under repeated identical event/config input;
- fails closed on sequence gaps, invalid clocks, conflicting duplicates,
  ambiguous causality, corrupt hashes, and reconciliation mismatch.

Validation must include dependency/import inspection and an OS/container-level
network-denial proof appropriate to the worker environment, not only a config
flag. Do not run against a live market feed. Mutation counters for all external
routes must remain zero.

## 12. Acceptance matrix for the future IMP

| Area | Required evidence |
|---|---|
| Causality | same-time ties, stream sequence gaps/resets, missing IDs, duplicate and conflicting duplicate, out-of-order delivery, strict no-pre-ack-liquidity behavior |
| Queue scenarios | displayed queue ahead; post-ack aggressor trade; non-aggressor trade; cancellation ambiguity; hidden-liquidity uncertainty; price touch/trade-through; partial quantity and no-fill cases |
| Lifecycle | post-only reject; submit/ack delay; fill then cancel; cancel then later print; concurrent fill/cancel; expiry; stop/TP ambiguity; insufficient taker depth; residual position |
| Economics | maker entry vs taker exit fees; price-walk impact counted once; funding known/unknown; quote-unit conversion; exact reconciliation; open position not mislabeled as equity |
| Data/provenance | WLD source audit, rights, coverage, event/sequence integrity, hashes, frozen strategy/config, protected-window rejection, independent-window evidence |
| Isolation | no network capability, no credentials, no exchange/operational imports or routing, rejected live mode, zero external mutations |
| Determinism | stable ledgers/digests for identical inputs; no wall-clock or random IDs |
| Decision gate | three outcomes, frozen numerical criteria, insufficient data/sample => inconclusive, negative conservative result => fail |

These are future tests, not tests run by this specification task.

## 13. Staged gate sequence and authorization

1. `CTO_WLD_IMP_SPEC_REVIEW`: approve this specification, source-audit scope,
   boundaries, and ownership.
2. `IMPLEMENTATION_AUTHORIZATION`: separate explicit authorization for offline
   model code and synthetic functional tests. No OOS selection/access or data
   acquisition is implied.
3. `OFFLINE_EXECUTION_MODEL_VALIDATED`: focused deterministic/negative tests,
   ledgers reconcile, isolation proven; synthetic results retain fixture label.
4. `DATA_SOURCE_QUALIFICATION`: separate evidence and authorization for source
   terms/acquisition as applicable; if unavailable, stop at functional status.
5. `ECONOMIC_CRITERIA_FREEZE`: CTO freezes numeric rules before any holdout is
   selected or revealed.
6. `INDEPENDENT_WINDOW_AUTHORIZATION`: authorize a new, access-controlled
   window after validating no overlap/lineage leakage.
7. `ECONOMIC_QUALIFICATION_ASSESSMENT`: run once under the frozen protocol;
   produce `PASS`, `FAIL`, or `INCONCLUSIVE` and preserve all artifacts.
8. Any proposal for external paper, Testnet, DEV real, capital, commit, push or
   deploy requires independent authorization; this IMP cannot grant it.

## 14. Explicit blockers and open decisions

- `WLD_DATA_SOURCE_UNQUALIFIED`: no verified WLD event-level historical source
  with the sequence, depth and aggressor data required for economic queue
  evaluation is established by the inspected source records.
- `WLD_OOS_NOT_INDEPENDENT`: prior OOS is consumed and overlaps prior IS
  material; keep all associated data protected.
- `ECONOMIC_THRESHOLDS_NOT_FROZEN`: numeric acceptance values, observation
  floor, scenario decision rule and data-quality thresholds require a CTO
  freeze before holdout access.
- `CONDOR_LIVE_RUNTIME_NOT_REPLAY_SAFE`: current runtime is feed-backed and
  uses wall clock/random IDs; adapt concepts behind offline injected replay
  rather than invoking that runtime directly.
- `EXIT_MODEL_NOT_QUALIFIED`: historical replay assumed maker costs/fills on
  exits; urgent exits must use explicit depth-walking taker assumptions.
- `HISTORICAL_PROVENANCE_MISMATCH`: original WLD OOS manifest contains BTC fee
  model and $1000 sizing labels that do not match the WLD ledger's reported
  $100/trade. Preserve and annotate; do not rewrite historical evidence.

Open decision at CTO spec review: freeze the precise event source/data-rights
qualification approach and numeric economic criteria. If no acceptable WLD
source is already available, any capture/purchase request must be submitted
separately; it is not an implied dependency authorization.

## 15. Authorization snapshot

```yaml
analysis: AUTHORIZED
design_specification: AUTHORIZED
source_implementation: NOT_AUTHORIZED
tests_or_replays: NOT_AUTHORIZED_BY_THIS_REQUEST
new_historical_run: NOT_AUTHORIZED
data_acquisition_or_external_capture: NOT_AUTHORIZED
paper_external: NOT_AUTHORIZED
testnet: NOT_AUTHORIZED
real_execution: NOT_AUTHORIZED
real_capital: NOT_AUTHORIZED
credentials: NOT_AUTHORIZED
commit: NOT_AUTHORIZED
push: NOT_AUTHORIZED
merge: NOT_AUTHORIZED
deployment: NOT_AUTHORIZED
```

**Requested next gate:** `CTO_WLD_IMP_SPEC_REVIEW`. Approval of the specification
is not implementation or execution authorization.
