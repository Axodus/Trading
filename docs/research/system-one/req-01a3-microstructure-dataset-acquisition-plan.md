# AXODUS-TRADING-RESEARCH-REQ-01A3

## Microstructure Dataset Acquisition Plan

**Research date:** 2026-09-17
**Status:** `COMPLETE — DOCUMENTATION ONLY`
**Classification:** `RESEARCH / NON-NORMATIVE`
**Program:** Axodus Trading
**Acquisition:** `NOT AUTHORIZED`
**System One calls:** `NOT AUTHORIZED`
**Trading:** `NOT AUTHORIZED`

## Executive summary

The Trading workspace has no real benchmark dataset for the original
microstructure hypothesis. Existing candle/backtest capability is useful for a
separate tactical hypothesis, but cannot establish order-flow or order-book
claims.

The smallest scientifically credible route for Path M is a bounded historical
seed containing trades plus sufficiently granular L2 snapshots/incremental
updates for one venue and instrument, with deterministic replay and an
untouched temporal OOS period. The best long-term shape is a **HYBRID**:

```text
small licensed historical seed
        +
continuous raw collection from a legitimate public feed
        ↓
validated replayable research archive
```

However, the seed and the required rights/pricing are not currently available
in the workspace. Therefore the decision package ends with:

**`DATASET REQUIRES COMMERCIAL DECISION`**

This is not a purchase recommendation or authorization. It means Path M may be
worth pursuing, but the next decision requires exact product, sample, license,
and quote information.

## Evidence discipline

- `VERIFIED PUBLIC INFORMATION`: present in an official public repository or
  official API/product documentation.
- `VENDOR CLAIM`: provider-described coverage or capability that still needs
  sample and contract validation.
- `QUOTE REQUIRED`: price or contractual term not published for the exact
  requested scope.
- `ENGINEERING ESTIMATE`: planning estimate requiring measurement.
- `UNKNOWN`: not established by the repository or public source.

No commercial source was contacted. No data was downloaded.

## MVRD — Minimum Viable Research Dataset

### Target

One venue, one contract, raw trades plus L2 snapshot/incremental updates, with
exchange timestamps, sequence/gap semantics, and a replay validator. L3 is
desirable but is not required for the first investigation.

### Proposed minimum

- 14 consecutive calendar days for source/replay feasibility;
- preferably 30 consecutive days for the first research corpus;
- development, validation, freeze, and untouched temporal OOS periods;
- at least two materially different liquidity/volatility conditions;
- raw archive plus normalized derived layer;
- checksums, source/version metadata, and gap diagnostics.

The period is a proposed gate, not an arbitrary claim of sufficiency and not an
authorization to acquire data. The final number must be confirmed after event
counts, label overlap, horizon selection, and replay quality are measured.

### MVRD acceptance tests

The dataset fails the MVRD gate if it cannot demonstrate:

1. deterministic snapshot/update reconstruction;
2. detection of missing, duplicated, or out-of-order events;
3. reproducible alignment of trades with contemporaneous book state;
4. preservation of exchange timestamp semantics;
5. sufficient events for the selected horizons without sparse-label distortion;
6. rights to retain and internally analyze raw and derived data.

## LTDI — Long-Term Data Infrastructure

LTDI is a candidate research asset, not an implementation authorized by A3:

```text
historical seed + continuous collection
        -> immutable raw store
        -> normalization/gap validation
        -> book reconstruction/replay
        -> research/backtest consumers
```

It should be considered only if Trading expects repeated market-data research
independent of System One. A collection-first route does not replace a seed
archive: it delays development/OOS separation and creates an opportunity cost
while history accumulates.

Required LTDI properties are raw retention, exchange/local timestamps,
sequence-gap handling, snapshot recovery, reconnect logs, checksums, versioned
normalization, deterministic replay, access control, and a retention policy.

## Shortlist

The shortlist is intentionally limited to three executable directions.

### 1. Tardis — historical crypto derivatives / perpetuals data

**Exact candidate:** Tardis historical `Perpetuals`/`Derivatives` access,
requesting trades plus `incremental_book_L2` and required snapshots for Binance
USDⓈ-M `BTCUSDT`.

**Public-source status:** `VENDOR CLAIM`. Official Tardis material describes
historical tick-level crypto data, order-book products, replay/download access,
and exchange-specific coverage. Exact plan entitlements, depth, dates, and
raw-versus-normalized semantics require confirmation.

**MVRD:** `STRONG CANDIDATE`, conditional on sample reconstruction and rights.
**LTDI:** historical seed candidate; not automatically a sovereign archive.
**Price:** `QUOTE REQUIRED`.
**Rights:** `QUOTE REQUIRED` for internal retention, derived data, backups,
publication, and use after cancellation.

### 2. Kaiko — Level 1 & Level 2 Data

**Exact candidate:** Kaiko `Level 1 & Level 2 Data`, requesting historical
tick-level trades and the exact venue/instrument order-book product needed for
reconstruction of Binance USDⓈ-M `BTCUSDT`.

**Public-source status:** `VENDOR CLAIM`. Official Kaiko material describes
historical trades, order books, snapshot/full-book products, delivery methods,
and versioning. The exact requested product must distinguish raw/incremental
L2 from aggregated or snapshot-only data.

**MVRD:** `STRONG CANDIDATE`, conditional on raw/sufficient L2 and sample tests.
**LTDI:** historical seed candidate; contract dependency remains.
**Price:** `QUOTE REQUIRED`.
**Rights:** `QUOTE REQUIRED` for retention, derived features, backups, and
re-analysis.

### 3. Binance Public Data and public-feed collection

**Exact candidate:** Binance Public Data futures `trades`, `aggTrades`, and
klines, plus the separately verified futures order-book route; for LTDI,
Binance USDⓈ-M public WebSocket trade/depth feeds for `BTCUSDT`.

**Public-source status:** `VERIFIED PUBLIC INFORMATION` for the existence of
the official public-data repository and documented public market-data APIs.
The exact historical L2 archive, date coverage, completeness, and terms for the
selected contract remain `UNKNOWN / QUOTE REQUIRED` until confirmed.

**MVRD:** `PARTIAL` until historical L2 is proven.
**LTDI:** `TECHNICALLY FEASIBLE CANDIDATE`, subject to collection engineering,
feed limits, gap recovery, storage, and terms.
**Price:** public files/feeds may have no purchase price; engineering/storage
cost is `ENGINEERING ESTIMATE`.
**Rights:** public access does not automatically establish redistribution,
publication, or long-term retention rights.

## Data content comparison

| Requirement | Tardis | Kaiko | Binance public route |
|---|---|---|---|
| Trades/ticks | Vendor claim: candidate | Vendor claim: candidate | Public files/API documented; exact completeness to verify |
| L2 updates | Vendor claim: candidate | Product-specific; verify raw/incremental semantics | Historical route unknown; live feed documented |
| Snapshots | Product-specific; verify | Product-specific; verify | Required for collection/recovery; exact archive unknown |
| L3 | Not required; exact availability unknown | Exact product unknown | Not assumed |
| Book reconstruction | Candidate; sample required | Candidate; sample required | Derivable prospectively if snapshots, updates, and sequences are retained |
| Aggressor flow | Derivable if trades/book align | Derivable if trades/book align | Derivable only after synchronization rules pass |
| Cancellation/replenishment | Requires event-level semantics | Requires event-level semantics | Not supported by candles; future L2 collection may support it |
| Replay | Vendor-described candidate; validate | Vendor-described candidate; validate | Must be built and validated for collection |

## BUY / BUILD / HYBRID / HOLD

| Strategy | MVRD | LTDI | Time-to-research | Main trade-off |
|---|---|---|---|---|
| `BUY` | Small licensed historical seed | Limited long-term ownership | Fastest if sample passes | Cost and vendor/license dependency |
| `BUILD/COLLECT` | Not immediate; no historical OOS seed | Feasible candidate | Slow; history accumulates prospectively | Lower vendor dependency, higher engineering/operations burden |
| `HYBRID` | Buy the smallest seed | Collect same venue/instrument continuously | Fast initial research plus continuity | Two semantics/pipelines must be reconciled |
| `HOLD / NO-GO` | Keep Path M blocked | No LTDI build | Immediate zero acquisition cost | No microstructure evidence |

## Cost and commercial status

| Item | Status |
|---|---|
| Tardis exact plan/window/API or files | `QUOTE REQUIRED` |
| Kaiko exact product/window/delivery | `QUOTE REQUIRED` |
| Binance public trades/klines | Public access may be free; verify current terms |
| Binance historical L2 route | `UNKNOWN / QUOTE REQUIRED` |
| Storage for a selected window | `ENGINEERING ESTIMATE / MUST MEASURE` |
| Collector/replay operations | `ENGINEERING ESTIMATE / MUST MEASURE` |
| Rights after subscription termination | `QUOTE REQUIRED` |

No price estimate is supplied. The quote must itemize one-time fees, recurring
fees, API/download limits, overage, cancellation, archive retention, and
whether raw data remains usable after termination.

## Storage and time-to-research

Exact storage is `UNKNOWN` without a representative sample. Require the source
to provide raw bytes/event counts for 14 and 30 days, then measure:

```text
raw archive + normalized archive + indexes + replay/checkpoints + backups
```

The initial engineering envelope is therefore `ENGINEERING ESTIMATE`, not a
GB/month assertion.

Expected time-to-research:

- **BUY:** shortest, after sample, legal, and replay acceptance;
- **HYBRID:** short initial path, with LTDI continuity added later;
- **BUILD/COLLECT:** no immediate historical OOS; operationally long;
- **HOLD:** no research readiness.

## Scientific adequacy and Trading-core reuse

The preferred dataset remains useful if System One is discarded. It would
support deterministic microstructure features, quantitative baselines,
alternative judgment providers, and provider-free replay/backtesting.

The reusable ownership boundary should be:

```text
raw market data -> Trading-owned validation/replay layer
provider adapter -> removable research component
judgment output -> advisory experiment result
decision/execution -> outside this gate and never provider-owned
```

System One is not a reason to purchase data that lacks independent Trading
research value.

## Commercial questions required before CEO choice

For each shortlisted provider, request exact answers for:

- venue, contract, symbol, date range, and timezone;
- raw trades versus aggregates;
- L2 snapshot and incremental update format;
- sequence, gap, recovery, and completeness guarantees;
- exchange versus provider timestamps and precision;
- normalized versus native fields and versioning;
- internal research, derived features, backups, and re-analysis rights;
- redistribution, publication, team/seat, and subcontractor restrictions;
- retention after cancellation;
- sample size, storage volume, delivery format, and replay tooling;
- one-time, recurring, overage, support, and cancellation pricing;
- correction policy and historical restatement behavior.

## CTO recommendation

The concrete recommendation is **HYBRID, conditional and staged**:

1. Keep REQ-01B/C/D and all provider calls on hold.
2. If the research remains strategically justified, authorize a separate
   commercial-evaluation gate for a bounded Tardis and Kaiko quote/sample,
   while checking Binance's public historical/order-book route as the
   low-cost fallback.
3. Select the smallest seed that passes MVRD reconstruction, temporal split,
   rights, and replay acceptance tests.
4. Consider LTDI only after the seed demonstrates that repeated Trading
   research justifies collection and maintenance.
5. If no candidate satisfies rights, replayability, cost, and scientific
   adequacy, choose `HOLD / NO-GO` and do not force Path M into Path T.

## CEO acquisition options

The CEO can choose at the next authorized gate:

- **BUY:** bounded licensed historical MVRD;
- **BUILD/COLLECT:** prospective raw-feed archive, accepting delayed OOS;
- **HYBRID:** minimum historical seed plus continuous collection;
- **HOLD / NO-GO:** no acquisition and no Path M progression.

The current report recommends opening that decision gate, not selecting or
funding an option.

## Risks and unresolved items

- Commercial product names may cover multiple incompatible data shapes.
- Public archives may contain trades without reconstructable depth.
- Snapshot-only data cannot support strong cancellation/queue claims.
- Provider normalization may obscure exchange-native ordering.
- Terms may prohibit retention or publication of derived artifacts.
- A free public feed can create a large hidden engineering and storage cost.
- A purchased seed and self-collected feed may use incompatible semantics.
- No candidate has yet passed a real sample reconstruction test.

## Implementation and authority record

- Documentation only: completed.
- Vendor contact: not performed.
- Purchase/subscription: not performed.
- Dataset download: not performed.
- Collection infrastructure: not implemented.
- Exchange integration: not implemented.
- System One calls: not performed.
- Models, strategies, paper trading, and live trading: not performed.
- ACS changes: none.

**Commit:** authorized for local documentation.
**Push:** `HOLD pending CTO review`.
**CEO decision required during A3:** `NONE`; a later acquisition gate will be
required for any material commercial commitment.
