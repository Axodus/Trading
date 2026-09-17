# AXODUS-TRADING-RESEARCH-REQ-01A4

## Microstructure Data Commercial Validation

**Research date:** 2026-09-17
**Status:** `COMPLETE — COMMERCIAL/TECHNICAL DUE DILIGENCE`
**Classification:** `RESEARCH / NON-NORMATIVE`
**Architecture candidate:** `HYBRID — CONDITIONAL`
**Purchase:** `NOT AUTHORIZED`
**System One calls:** `NOT AUTHORIZED`
**REQ-01B/C/D:** `HOLD`

## Executive summary

The Trading repository contains no real benchmark dataset for Path M. The
current local capability is candle/backtest oriented and cannot validate
historical L2 reconstruction, synchronized trades, cancellations, or queue
dynamics.

The due-diligence result is:

```text
Path M scientific route       FEASIBLE IN PRINCIPLE
MVRD available locally         NO
Commercial exact price         NOT PUBLICLY CONFIRMED
Material data rights           NOT CONFIRMED
Free technical sample          NOT obtained
BUILD/COLLECT                  TECHNICALLY POSSIBLE, slow to seed
HYBRID                         BEST CANDIDATE, conditional
```

**Final recommendation:** `HYBRID — CONDITIONAL ON QUOTE / RIGHTS / SAMPLE`

This is a recommendation for a future CEO acquisition gate, not an approval
to contact vendors further, purchase, subscribe, download, or implement.

## Scope and evidence status

The review covered the three alternatives mandated by the CTO:

1. Tardis historical crypto market data;
2. Kaiko Level 1/Level 2 historical market data;
3. Binance public historical data plus public-feed collection.

The review used official public repositories, API/product documentation, and
public pricing/terms pages where available. No sales contact, quote request,
trial, contract, or sample exchange was completed from this workspace.

Evidence labels:

- `VERIFIED PUBLIC INFORMATION`: visible in an official public source.
- `VENDOR CLAIM`: provider-described capability requiring sample/contract
  validation.
- `QUOTE REQUIRED`: exact price or commercial term is not public for the
  requested scope.
- `LEGAL/COMMERCIAL CONFIRMATION REQUIRED`: access does not establish the
  requested right.
- `ENGINEERING ESTIMATE`: planning estimate requiring measurement.
- `UNKNOWN`: not established.

## Official source register

| Source | Review purpose | Status |
|---|---|---|
| Binance Public Data: https://github.com/binance/binance-public-data | Public files, futures trades/aggregate trades/klines, checksums and conventions | `VERIFIED PUBLIC INFORMATION`; exact historical L2 scope remains `UNKNOWN` |
| Binance developer documentation: https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams | Public USDⓈ-M market-data feed contracts | `VERIFIED PUBLIC INFORMATION`; collection quality and long-term rights require validation |
| Tardis documentation: https://docs.tardis.dev/ | Historical tick/order-book products, replay/download/API concepts | `VENDOR CLAIM`; exact entitlement and rights require quote/contract/sample |
| Tardis pricing: https://tardis.dev/pricing | Public plan/pricing availability | Exact requested historical scope is `QUOTE REQUIRED` |
| Kaiko documentation: https://docs.kaiko.com/ | L1/L2, trades, delivery and data-product concepts | `VENDOR CLAIM`; exact product semantics require quote/sample |
| Kaiko product pages: https://www.kaiko.com/products/market-data | Product and delivery comparison | Exact requested scope is `QUOTE REQUIRED` |

Public documentation is not treated as proof of historical completeness,
reconstructability, retention, redistribution, model-training rights, or
post-termination access.

## DATA gate

### MVRD acceptance requirement

The minimum viable research dataset must contain, for one exact venue and
instrument:

- trades with ordering/identifiers and exchange timestamps;
- a documented initial snapshot;
- incremental L2 updates or equivalent reconstructable depth;
- sequence/gap detection and recovery semantics;
- stable contract/symbol metadata;
- enough history for development, validation, freeze, and temporal OOS;
- raw preservation and deterministic replay validation.

L3 is not required for the first Path M investigation. Snapshot-only data is
insufficient for strong cancellation, replenishment, or queue claims unless the
provider documents an equivalent event-level representation.

### Tardis

**Data status:** `STRONG CANDIDATE / SAMPLE REQUIRED`.

Official vendor documentation describes historical tick-level crypto data and
order-book/replay-oriented products. The candidate request is:

```text
Binance USDⓈ-M BTCUSDT perpetual
trades
incremental L2
initial/recovery snapshots
exchange timestamps + capture timestamps
14-day feasibility sample / 30-day research quote
```

The exact plan, date coverage, depth, raw versus normalized fields, sequence
behavior, and completeness are not confirmed for this specific request.

### Kaiko

**Data status:** `STRONG CANDIDATE / PRODUCT AND SAMPLE REQUIRED`.

Official vendor material describes historical trades and L1/L2/order-book
products with multiple delivery methods and data versioning. The candidate
request is the same venue/instrument and period as Tardis, explicitly asking
whether the product contains raw/incremental L2 rather than only snapshots,
aggregates, or derived liquidity metrics.

Exact event semantics, depth, sequence fields, coverage, and completeness are
not confirmed for this request.

### Binance public/build

**Data status:** `PARTIAL`.

The official public-data repository and developer documentation establish public
historical trade/aggregate-trade/klines files and public USDⓈ-M market-data
feeds. That is useful for Path T and for a future LTDI collector.

The historical L2 seed required by MVRD is not established by the public file
catalog alone. A live feed collected prospectively can support future
reconstruction only if snapshots, updates, sequence recovery, timestamps, and
raw retention are implemented and validated.

## RIGHTS gate

No candidate has passed the rights gate.

| Right | Tardis | Kaiko | Binance/public-build |
|---|---|---|---|
| Raw-data retention | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `UNKNOWN; review current terms` |
| Internal processing | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `UNKNOWN; access is not a blanket license` |
| Derived features/labels | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `UNKNOWN; review terms` |
| Model training/evaluation | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `UNKNOWN; review terms` |
| Retention of results | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `UNKNOWN` |
| Publication/redistribution | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `UNKNOWN / likely constrained by terms` |
| Backup copies | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `LEGAL/COMMERCIAL CONFIRMATION REQUIRED` | `UNKNOWN` |
| Use after termination | `QUOTE/LEGAL CONFIRMATION REQUIRED` | `QUOTE/LEGAL CONFIRMATION REQUIRED` | `UNKNOWN` |

“Commercial use” or “public access” must not be interpreted as permission to
retain raw data, publish derived datasets, train models, or continue using an
archive after termination.

## ECONOMICS gate

### Current price status

| Alternative | Upfront | Recurring | Minimum commitment | Status |
|---|---:|---:|---:|---|
| Tardis exact MVRD request | `QUOTE REQUIRED` | `QUOTE REQUIRED` | `QUOTE REQUIRED` | No purchase or contact completed |
| Kaiko exact MVRD request | `QUOTE REQUIRED` | `QUOTE REQUIRED` | `QUOTE REQUIRED` | No purchase or contact completed |
| Binance public files/feeds | No purchase price established for public route | Infrastructure cost only | None established | Terms and operational limits require review |
| Binance historical L2 seed | `UNKNOWN / QUOTE REQUIRED` | `UNKNOWN / QUOTE REQUIRED` | `UNKNOWN` | Not established by public archive review |

No commercial price is invented in this report.

### Total-cost categories

Any CEO acquisition decision must include:

- license/subscription and overage charges;
- storage of raw and normalized data;
- integrity validation and replay tooling;
- engineering adapter and schema maintenance;
- monitoring, recovery, and reprocessing;
- backup and retention;
- legal review of data rights;
- time-to-research and delayed OOS cost;
- migration/removal effort if the provider is replaced.

For BUILD/COLLECT, replace subscription cost with collector operations,
storage, incident recovery, exchange-feed changes, and the opportunity cost of
waiting for history.

### Storage and engineering estimates

Exact volume is `UNKNOWN` without a sample. The quote/sample request must
include raw event count and bytes for 14 and 30 days. Planning must use:

```text
raw bytes
+ normalized bytes
+ indexes/checkpoints
+ validation artifacts
+ backups
```

Storage and maintenance remain `ENGINEERING ESTIMATE / MUST MEASURE` for all
three alternatives. A public feed being free does not make BUILD/COLLECT free.

## REUSE gate

All three alternatives can have value independent of System One only if the
resulting archive is owned as a Trading research asset and exposes neutral
market-data semantics.

| Reuse question | Tardis | Kaiko | Binance/public-build |
|---|---|---|---|
| Useful for deterministic features | Yes, if raw/sufficient L2 is delivered | Yes, if raw/sufficient L2 is delivered | Yes, for trades and future collected depth |
| Useful for non-System-One providers | Yes, through neutral adapter | Yes, through neutral adapter | Yes, through Trading-owned replay layer |
| Long-term sovereignty | Limited by license | Limited by license | Stronger, but operational burden is higher |
| Removal risk | Adapter and license dependency | Adapter and license dependency | Exchange/schema/feed maintenance dependency |
| Trading Core reuse | Candidate research/replay asset | Candidate research/replay asset | Candidate long-term archive |

The data asset should remain useful for quantitative baselines, alternative
judgment providers, and deterministic replay even if System One is abandoned.

## Technical sample validation protocol

If a free sample or evaluation sample becomes available without payment or a
binding commitment, the following validation is authorized by A4:

```text
raw semantics
  -> trades/L2 synchronization
  -> snapshot + incremental reconstruction
  -> timestamp/sequence checks
  -> integrity/gap report
  -> deterministic replay comparison
```

The sample must be synthetic-free market data only for validation and must not
be used for alpha, model training, strategy development, or System One calls
under this gate. If the sample requires payment, subscription, or commitment,
stop with `SAMPLE REQUIRES EXECUTIVE AUTHORIZATION`.

No such sample was received or inspected during A4.

## BUILD/COLLECT evaluation

**Source candidate:** Binance public USDⓈ-M WebSocket market-data feeds for one
venue/instrument, if the feed contract and current terms pass review.

Required LTDI components are an immutable raw capture, exchange/local clocks,
sequence-gap recovery, snapshot resynchronization, reconnect logs, checksums,
versioned normalization, deterministic replay, and monitored retention.

**Conclusion:** BUILD/COLLECT is technically credible for LTDI but does not
provide an immediate historical seed. It should not be chosen as the first Path
M route unless delayed development/OOS is explicitly accepted.

## HYBRID evaluation

**Candidate:** buy the smallest rights-cleared Tardis or Kaiko historical seed
that passes MVRD tests, then collect the same venue/instrument prospectively
from a legitimate public feed.

**Why it is preferred:** it shortens time-to-research, preserves an independent
historical OOS opportunity, and can evolve into a Trading-owned archive. It
also remains useful if System One is rejected.

**Conditions:** exact quote, rights confirmation, sample validation, semantic
compatibility between seed and collection, and a bounded maintenance plan.

## CEO decision matrix

| Dimension | Tardis | Kaiko | Binance/public-build |
|---|---|---|---|
| DATA | Strong candidate, sample required | Strong candidate, sample required | Partial seed; stronger future collection candidate |
| RIGHTS | Confirmation required | Confirmation required | Terms require review |
| MVRD | Candidate | Candidate | Not established for L2 |
| LTDI | Seed only | Seed only | Stronger collection input |
| Historical seed | Vendor claim; exact coverage unknown | Vendor claim; exact coverage unknown | Trades/candles public; L2 unknown |
| Sample validated | No | No | No |
| Upfront cost | `QUOTE REQUIRED` | `QUOTE REQUIRED` | Public route may be free; infra cost remains |
| Recurring cost | `QUOTE REQUIRED` | `QUOTE REQUIRED` | Operations/storage estimate |
| Minimum commitment | `QUOTE REQUIRED` | `QUOTE REQUIRED` | None established |
| Engineering cost | Medium estimate | Medium estimate | High estimate for collector/replay |
| Storage | Sample required | Sample required | Sample required |
| Time-to-research | Fastest candidate | Fast candidate | Slow for historical OOS |
| Replay suitability | Candidate; validate | Candidate; validate | Must be built/validated |
| Vendor dependency | Medium/high | Medium/high | Lower vendor dependence, higher ops burden |
| Trading-Core reuse | Good if rights/data pass | Good if rights/data pass | Good if archive is governed |
| Unresolved items | Product, quote, rights, sample | Product, quote, rights, sample | Historical L2, completeness, terms |

## Provider-specific risks

### Tardis

- plan names may expose different depth, dates, or delivery modes;
- normalized fields may not preserve exchange-native semantics;
- exact archive retention and post-termination use are contractual;
- raw replay/API access may be tier-limited;
- no sample was validated in this gate.

### Kaiko

- L1/L2 product naming may include snapshot, aggregate, or raw variants;
- delivery method may affect replay and storage ownership;
- exact venue/contract coverage and event semantics require confirmation;
- commercial rights and retention are contractual;
- no sample was validated in this gate.

### Binance/public-build

- public trade files do not prove historical L2;
- live collection can lose updates without robust sequence recovery;
- exchange terms and feed behavior can change;
- self-operated archives create monitoring, storage, and maintenance burden;
- prospective collection delays OOS validation.

## Required commercial questions

Before any purchase recommendation, obtain written answers for:

1. Exact venue, contract, symbol, date range, and timezone.
2. Individual trades versus aggregates.
3. Snapshot and incremental L2 formats and depth.
4. Exchange timestamp precision and local capture timestamp.
5. Sequence, gap, recovery, and completeness semantics.
6. Raw/native versus normalized fields and versioning.
7. Sample bytes/event counts for 14 and 30 days.
8. Internal research, feature, label, and model-evaluation rights.
9. Retention, backup, derived-data, publication, and redistribution rights.
10. Post-termination use of raw, derived, and result artifacts.
11. One-time fees, recurring fees, overage, minimum commitment, and cancellation.
12. Delivery limits, rate limits, support, corrections, and SLA.

Until answered, retain `QUOTE REQUIRED` and
`LEGAL/COMMERCIAL CONFIRMATION REQUIRED`.

## CTO recommendation

**Primary recommendation: `HYBRID — CONDITIONAL ON QUOTE / RIGHTS / SAMPLE`.**

The next authorized decision should request bounded, non-binding commercial
information and a free/evaluation sample from Tardis and Kaiko, while retaining
Binance public/build as the lower-cash but higher-engineering alternative.

The CEO should not choose BUY or HYBRID until one candidate passes DATA and
RIGHTS, and ECONOMICS is itemized. If neither commercial candidate supplies
acceptable rights/price and Binance cannot provide a defensible historical L2
seed, choose `HOLD / NO-GO` for Path M rather than silently converting it to
Path T.

## CEO acquisition options

The current decision set is:

- `BUY` — only after exact product, quote, rights, and sample pass;
- `HYBRID` — preferred conditional path after the same checks;
- `BUILD-COLLECT` — valid LTDI route, accepting delayed historical OOS;
- `HOLD` — preserve the research question without acquisition;
- `NO-GO` — close Path M if cost/rights/effort are disproportionate.

**Recommended CEO gate choice:** authorize only a bounded quote/sample
evaluation; do not authorize purchase or collection infrastructure yet.

## Final classification

**`HYBRID — CONDITIONAL ON QUOTE / RIGHTS / SAMPLE`**

This is the concrete CTO recommendation. The acquisition decision itself
remains pending CEO selection and any required commercial authorization.

## Implementation performed

- Added this A4 documentation-only acquisition validation package.
- Conducted public-source/product comparison.
- No vendor sales contact or binding request was sent.
- No quote, paid trial, contract, purchase, or subscription was accepted.
- No sample was downloaded or inspected.
- No collection infrastructure, exchange integration, strategy, model,
  System One call, paper trading, live trading, or capital action occurred.
- No ACS or production changes occurred.

## Commit and publication state

**Commit:** authorized for documentation and evidence package.
**Push:** `HOLD pending CTO review`.
**Next gate:** CEO acquisition choice or explicit `HOLD / NO-GO`.
