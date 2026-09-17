# AXODUS-TRADING-RESEARCH-REQ-01A2

## Market Microstructure Dataset Feasibility

**Status:** `RESEARCH COMPLETE — DOCUMENTATION ONLY`  
**Classification:** `RESEARCH / NON-NORMATIVE`  
**Program:** Axodus Trading / System One Trading Feasibility  
**Provider calls:** `NONE`  
**Dataset downloads:** `NONE`  
**Purchases:** `NONE`  
**Trading:** `NOT AUTHORIZED`

## Executive finding

The current Axodus Trading workspace does not contain a real market-data
benchmark suitable for the original microstructure hypothesis. It contains
candle-oriented infrastructure and backtesting support, but no established
historical L2/L3 or synchronized trade/order-book archive.

Therefore:

- **Path M — microstructure:** feasible in principle, but not available from
  the current workspace and not responsibly executable without an external
  dataset decision.
- **Path T — tactical short-horizon prediction:** feasible with the existing
  candle-oriented architecture, subject to obtaining and governing historical
  candle data; it is a different hypothesis from microstructure interpretation.
- **Current program state:** no System One calls, model training, strategy
  implementation, paper trading, or live trading are authorized.

**Final classification:** `DATASET REQUIRES COMMERCIAL DECISION`

This means that the preferred Path M is technically plausible but cannot be
selected from the local evidence alone. A free/public source may support a
limited tactical or trade-level study, but it has not been established here as
a reproducible, synchronized historical L2 benchmark.

## Source and evidence discipline

The following labels are used throughout:

- **Repository fact:** directly observed in `/opt/Axodus/Trading`.
- **Documented fact:** stated by an official source or official API reference.
- **Vendor claim:** a provider's description of its own coverage or service.
- **Engineering inference:** reasoned implication that still needs validation.
- **Unknown:** not established without a sample, contract, or source-specific
  verification.

This report does not treat a vendor product page, a public download index, or a
symbol listing as proof that a particular historical interval can be replayed
with synchronized trades, book updates, timestamps, and reproducible licensing.

## Repositories reviewed

### `/opt/Axodus/Trading`

Repository facts relevant to this gate:

- Trading Core contains candle-oriented indicators and regime/latency-related
  services.
- `backend-api/routers/manage_market_data.py` uses Hummingbot candle data and
  exposes historical/realtime candle-oriented paths.
- `backend-api/routers/manage_backtesting.py` uses Hummingbot's backtesting
  engine and a candle-compatible execution-cost parameter.
- Existing test SQLite files are operational fixtures, not a validated market
  benchmark. Their observed market-data rows are empty or only a few rows, and
  they do not establish historical L2/L3 coverage.
- No local research pipeline was found that reconstructs an order book from
  historical incremental updates.
- No local statistical/ML benchmark was found for the proposed System One
  comparison.

### Scope boundary

No other repository was treated as an owner of Axodus Trading market data.
ACS was not modified and remains outside this program.

## Current capability baseline

| Capability | Status | Evidence / implication |
|---|---|---|
| Candle history interface | `AVAILABLE` | Hummingbot candle-oriented market-data path exists. |
| Candle backtesting | `AVAILABLE` | Hummingbot backtesting integration exists. |
| Real local benchmark dataset | `UNAVAILABLE` | User/CTO confirmed no real benchmark data in this workspace. |
| Historical trades/ticks | `UNKNOWN` | No validated local archive or schema was found. |
| Historical L1 | `UNKNOWN` | Not established by the current repository. |
| Historical L2 updates | `UNAVAILABLE` locally | No local update archive/replay path was found. |
| Historical L3/order identity | `UNAVAILABLE` locally | No evidence of order-level feed or reconstruction. |
| Trade/book synchronization | `UNAVAILABLE` locally | Cannot be assessed without raw synchronized data. |
| Aggressor-side flow | `UNKNOWN` | Could only be derived after trade data and matching rules exist. |
| Cancellation/replenishment | `UNAVAILABLE` locally | Requires suitable order-book events; candles cannot establish it. |
| Queue dynamics | `UNAVAILABLE` locally | Requires event-level depth/order information and a model. |
| Deterministic market replay | `PARTIAL` | Candle backtest exists; event-level replay is not established. |
| Transaction-cost inputs | `PARTIAL` | Backtest exposes a cost parameter, but venue-specific historical cost/fill data is not established. |
| Measured inference latency for Trading | `UNAVAILABLE` | ACS measurements are not Trading evidence and must not be reused. |

## Dataset option comparison

The options below are research candidates. None is installed, downloaded, or
authorized for acquisition by this report.

| Option | Market-data shape | Historical microstructure suitability | Access / cost | Main limitation |
|---|---|---|---|---|
| Exchange public archives, exemplified by Binance Public Data | Public klines and trade/aggregate-trade files; depth products must be verified per market and period | `PARTIAL / UNKNOWN` for Path M; generally stronger for Path T and trade-level work | Public access may be free; terms and redistribution must be reviewed | Public availability does not by itself prove full-depth, synchronized, lossless replay or stable retention |
| Exchange public WebSocket feeds, exemplified by Coinbase and Kraken | Live public trades/book channels | `PARTIAL` for future collection only; not a historical benchmark already available | Usually public feed access; collection, rate limits, terms, and operational uptime apply | Requires building and operating an archive; no historical coverage is established by the live API documentation alone |
| Tardis historical crypto data | Commercial historical trade/order-book candidate with replay-oriented use cases | `STRONG CANDIDATE` for Path M, subject to exact venue/product verification | Commercial plan/contract; pricing and permitted use require confirmation | Cost, license, retention, exact depth, timestamp semantics, and export rights need a pre-purchase check |
| Kaiko historical market data | Commercial institutional trade/order-book candidate | `STRONG CANDIDATE` for Path M, subject to exact product verification | Commercial quote/contract | Product granularity, raw-event access, replay rights, cost, and retention require vendor confirmation |
| Databento or similar normalized historical feed | Candidate normalized historical market-data service | `UNKNOWN` for the exact crypto L2 requirement in this program | Commercial terms vary | Must verify that the selected dataset is crypto, venue-specific, event-level, and sufficient for book reconstruction |
| Candle aggregators / public OHLC archives | OHLCV bars | `UNAVAILABLE` for original Path M; `AVAILABLE` for a separate Path T design | Often public or low cost | Cannot establish order-flow, cancellations, queue state, or book depletion |

### Official source register

These are the primary-source entry points to verify before any acquisition or
collection decision. They are references for evaluation, not authorization to
use the services.

| Source | What it can establish | Remaining verification |
|---|---|---|
| Binance Public Data repository: `https://github.com/binance/binance-public-data` | Public file conventions and published market-data categories | Exact symbol/date coverage, depth semantics, completeness, synchronization, and license/redistribution conditions |
| Coinbase Exchange WebSocket documentation: `https://docs.cdp.coinbase.com/exchange/websocket-feed/overview` | Public live-feed channels and message contracts | Historical availability, archive rights, retention, and loss/reconnect behavior for a collected dataset |
| Kraken WebSocket documentation: `https://docs.kraken.com/api/docs/websocket-v2/` | Public live-feed/book/trade API contracts | Historical archive availability and whether a collected archive can be reproduced adequately |
| Tardis documentation: `https://docs.tardis.dev/` | Vendor-described historical crypto-data products and access mechanisms | Exact venue/instrument, depth, event semantics, retention, pricing, export, and research license |
| Kaiko documentation: `https://docs.kaiko.com/` | Vendor-described institutional market-data products | Exact raw-data access, order-book granularity, contract, pricing, and redistribution rights |
| Databento documentation: `https://databento.com/docs` | Vendor-described normalized historical-data model | Exact crypto availability and suitability for synchronized L2 replay |

## Required data properties for Path M

The minimum useful Path M dataset is not merely “order book data.” It should
provide, for one explicitly identified venue and instrument:

1. Exchange timestamps and ingestion/arrival timestamps, with documented units
   and clock semantics.
2. A full initial snapshot or a documented sufficient depth snapshot.
3. Incremental book updates with sequence/order information, or an equivalent
   loss-detection and resynchronization mechanism.
4. Trades with identifiers or ordering sufficient to align them with book state.
5. Bid/ask prices and quantities at the chosen depth.
6. Stable symbol, contract, venue, and timezone metadata.
7. A replay procedure that detects gaps rather than silently filling them.
8. Terms that permit the intended internal research use and retention.

L3 is desirable but not mandatory for the first investigation. L2 can be
sufficient if depth, updates, sequence behavior, and trade synchronization are
adequate. If the source only provides periodic book snapshots, the report must
classify cancellation/replenishment and queue conclusions as unsupported or
partial rather than infer them.

## Capability matrix by data type

| Property | Public exchange archive | Live public feed collected later | Commercial historical provider |
|---|---|---|---|
| Trades/ticks | `AVAILABLE / PARTIAL`, source-specific | `AVAILABLE` while connected | `STRONG CANDIDATE` |
| L1 top-of-book | `PARTIAL / UNKNOWN` | `AVAILABLE` for supported channel | `STRONG CANDIDATE` |
| L2 incremental depth | `UNKNOWN` until exact files are verified | `AVAILABLE` for supported channel, subject to loss handling | `STRONG CANDIDATE` |
| L3 individual orders | Usually `UNKNOWN` or unavailable | Usually venue/product-specific | `UNKNOWN` until contract verified |
| Book reconstruction | `PARTIAL / UNKNOWN` | `DERIVABLE` if snapshot, updates, sequence and recovery exist | `DERIVABLE` if raw event semantics are supplied |
| Aggressor flow | `DERIVABLE` from synchronized trades and book/rules | `DERIVABLE` | `DERIVABLE`, subject to vendor semantics |
| Cancellation/replenishment | `UNKNOWN` without event-level updates | `PARTIAL / DERIVABLE` depending feed | `DERIVABLE` if update semantics are complete |
| Deterministic replay | `UNKNOWN` until gap/completeness checks pass | `PARTIAL` during collection | `STRONG CANDIDATE`, still requires validation |

## Venue and instrument assessment

### Recommended initial research target

**BTC-USDT on Binance USDⓈ-M perpetual**, using the source's canonical symbol
and preserving a mapping to the repository's connector notation (`BTC-USDT`
and `binance_perpetual`). This is a research recommendation only.

Rationale:

- high expected liquidity is useful for reducing extreme sparse-book cases;
- one instrument and one venue keep reconstruction and cost analysis bounded;
- the target aligns with the prior audit's connector defaults without making
  Binance a universal assumption;
- a perpetual market exposes funding/contract metadata that must be recorded,
  even if funding is outside the first label.

The recommendation is conditional on confirming that the selected source
actually supplies the required trade/depth history for the same contract and
period. If not, the next candidate should be selected by data quality and
replayability, not brand familiarity.

## Historical coverage and temporal resolution

No local historical coverage exists for the required Path M benchmark.

For an external candidate, the following must be recorded before selection:

- earliest and latest date available;
- missing intervals and venue outages;
- exchange timestamp precision and actual event ordering;
- snapshot frequency and update granularity;
- sequence continuity and recovery behavior;
- trade/book synchronization method;
- daylight/timezone and contract-roll conventions;
- whether the provider normalizes or rewrites original events.

The first microstructure design should not assume sub-millisecond or 10 ms
labels. Candidate horizons should be constrained by the observed event quality
and later by measured System One inference latency:

- **Primary candidate band:** `1s–30s`, if event resolution and latency permit.
- **Secondary band:** `100ms–1s`, only if timestamp/order integrity is strong
  and the provider call path can be measured at that scale.
- **Outside initial scope:** microsecond/low-millisecond HFT claims.
- **Separate Path T:** `1m–15m` candle/tactical horizons; not a substitute for
  the microstructure hypothesis.

## Aggressor flow, cancellations, and replenishment

These are not available from the current workspace.

They are derivable only under explicit conditions:

- aggressor side requires trade records plus a documented classification rule
  or sufficiently precise matching to contemporaneous quotes;
- cancellation pressure requires incremental quantity/price updates and a
  rule separating cancellations from executions and feed artifacts;
- replenishment requires observing depth changes over time and distinguishing
  new displayed liquidity from updates, executions, and snapshot artifacts;
- queue dynamics require more than a best bid/ask snapshot and are usually
  sensitive to venue-specific matching and hidden-liquidity behavior.

If those conditions are not proven by a candidate source, the corresponding
judgment is `UNSUPPORTED`, not “approximately available.”

## Cost, license, and storage

### Cost classification

| Option | Cost status |
|---|---|
| Existing local data | No acquisition cost, but insufficient for Path M |
| Public archives/feeds | Potentially free to access; operational collection/storage cost remains; terms must be reviewed |
| Commercial historical provider | `UNKNOWN` until quote/product/contract review; requires a separate commercial decision |

No price was assumed or paid in this audit. A free endpoint is not equivalent to
free reproducible research: storage, validation, recovery, and permitted use
remain costs.

### Provisional storage envelope

Exact storage is `UNKNOWN` without a representative sample. For planning only,
an event-level BTC perpetual dataset should be budgeted by measured bytes per
event rather than by a vendor headline:

```text
storage = event_count × normalized_record_size
          + raw_archive
          + indexes
          + replay/checkpoint overhead
```

Before any purchase or download, require a source-specific sample or documented
volume estimate for a 14–30 day window. The estimate must include raw and
normalized copies, indexes, compression, and at least one replay workspace.
This report intentionally does not invent a GB/month number without a sample.

## Ingestion and replay complexity

### Public live-feed collection

`HIGH` complexity for a research-grade archive. It requires persistent capture,
clock recording, reconnect and resubscription handling, sequence-gap detection,
snapshot recovery, immutable raw storage, checksums, and a replay validator.

### Public historical files

`MEDIUM` to `HIGH`, depending on whether files contain complete event streams or
only aggregates. File download alone does not prove replayability; validation
must detect gaps, duplicates, ordering anomalies, symbol changes, and timestamp
ambiguity.

### Commercial historical provider

`MEDIUM` expected adapter complexity if raw event semantics and replay tooling
are documented. This remains an engineering inference, not a guarantee. The
provider-specific adapter must remain outside canonical Trading contracts.

## Data quality and reproducibility risks

The principal risks are:

- dropped or duplicated book updates;
- snapshot/update sequence mismatch;
- exchange timestamps replaced by provider arrival timestamps;
- trades and book updates from different clocks or feeds;
- hidden normalization of prices, quantities, or symbols;
- incomplete depth presented as full L2;
- aggregate trades mistaken for individual executions;
- historical gaps concentrated in volatile periods;
- contract, venue, or symbol changes across the sample;
- terms that prohibit retention, redistribution, or repeatable re-analysis;
- provider version changes that alter normalized semantics.

Any candidate failing loss detection, timestamp documentation, or replay
validation should not be used to claim microstructure evidence.

## Path M feasibility

**Classification:** `FEASIBLE IN PRINCIPLE / NOT AVAILABLE LOCALLY`

Path M is scientifically meaningful and can answer the original question, but
only after a dataset is selected that supports deterministic reconstruction of
the relevant state. The current workspace cannot execute this path honestly.

The most credible route is a bounded commercial historical sample, subject to a
separate cost/license/security decision. A public live feed could eventually
produce a dataset, but that would be a data-collection project and would not
provide the immediate historical/OOS separation required by the next gate.

## Path T feasibility

**Classification:** `FEASIBLE AS A DIFFERENT HYPOTHESIS`

The existing candle/backtest capability can support a future tactical study of
short-horizon prediction. It cannot answer whether System One extracts
incremental information from order flow or book dynamics.

Path T must therefore use separate wording, labels, baselines, and success
criteria. It must not be reported as validation of the microstructure mandate.

## Recommended dataset and minimum sample

### Recommendation

Do not acquire or download yet. First request a source-comparison package from
one or more candidate providers containing:

- exact BTC-USDT perpetual venue/product;
- a small representative raw sample;
- schema and timestamp documentation;
- snapshot/update and sequence semantics;
- trade/book synchronization description;
- gap and replay guarantees;
- retention, export, and internal-research rights;
- itemized cost for a bounded historical window.

The preferred shape is raw trades plus L2 snapshot/incremental updates for one
venue and instrument. A commercial provider is the leading candidate because
it is more likely to provide historical event data without first building a
collection operation, but this remains a decision gate, not an adoption finding.

### Proposed minimum research sample

For a later design gate, the minimum should be defined as:

- at least `14 consecutive calendar days` for a feasibility/replay check;
- preferably `30 consecutive calendar days` for initial research;
- at least two materially different liquidity/volatility conditions;
- a development period and an untouched temporal test period;
- enough events to support all proposed horizons without sparse-label bias;
- a separately preserved raw archive and a reproducible normalized replay.

These are proposed research minima, not observed coverage and not an
authorization to obtain data.

## Recommended next gate

`REQ-01B` should remain on hold until a dataset decision resolves:

1. whether Path M is worth a commercial data commitment;
2. which venue/instrument and exact source are selected;
3. whether the source's terms permit the intended internal research;
4. whether a sample passes reconstruction, synchronization, and gap tests;
5. whether storage and replay costs are proportionate to the research value.

If no dataset passes those checks at acceptable cost, close the microstructure
path and decide separately whether a bounded Path T study is justified.

## REQ-01A3 acquisition decision package

The following options are the reduced shortlist for a future acquisition gate.
They are not purchase orders and no vendor contact was initiated.

### MVRD — Minimum Viable Research Dataset

The MVRD should be the smallest bounded historical corpus that supports:

```text
development
    -> validation
    -> freeze
    -> untouched temporal OOS
```

The proposed first shape is one venue, one instrument, raw trades plus L2
snapshot/incremental updates, and a 14-day feasibility sample followed by a
30-day research target if reconstruction passes. The sample must include at
least two materially different liquidity/volatility conditions. These periods
are planning gates, not arbitrary evidence of sufficiency and not an
authorization to obtain data.

The MVRD must preserve raw records, source metadata, checksums/version IDs,
replay diagnostics, and a normalized derived layer. Derived features remain
replaceable; raw source data remains the audit reference subject to license.

### LTDI — Long-Term Data Infrastructure

LTDI is a separate candidate architecture:

```text
historical seed archive + continuous raw collection
             -> immutable/raw store
             -> normalization and gap validation
             -> reconstructed book/replay layer
             -> research and backtest consumers
```

LTDI is only justified if the Trading program expects repeated market-data
research independent of System One. It should not be built solely to provide a
single provider experiment. A self-collected archive also does not replace a
historical seed: waiting months for a temporal OOS period creates opportunity
cost and delays falsification of the original hypothesis.

### Four acquisition strategies

| Strategy | MVRD | LTDI | Decision status | Assessment |
|---|---|---|---|---|
| `BUY` | Buy a bounded historical product with trades + L2 updates/snapshots | Usually not sufficient by itself for long-term sovereignty | `CONDITIONAL` | Fastest route to a research-ready historical/OOS sample; price and rights are quote-dependent |
| `BUILD/COLLECT` | Not immediately suitable for historical/OOS unless an existing archive is found | Collect exchange-public feeds prospectively with raw retention and replay validation | `TECHNICALLY FEASIBLE` | Avoids vendor data dependency but creates substantial engineering, operations, and time-to-history cost |
| `HYBRID` | Buy the smallest seed archive, then collect the same venue/instrument prospectively | Best candidate for long-term continuity if rights and schema are controlled | `PREFERRED CANDIDATE` | Combines immediate historical validation with future collection; requires source normalization and dual quality checks |
| `HOLD / NO-GO` | Keep Path M blocked | Do not build collection until research value is re-justified | `VALID OPTION` | Correct outcome if license, price, storage, or expected information gain is disproportionate |

## BUY options

### BUY-1 — Tardis historical derivatives data

**Exact candidate product:** Tardis `Perpetuals` or `Derivatives` plan with
downloadable CSV datasets and, if required, the Pro/Business raw replay API;
requested data types should be `trades`, `incremental_book_L2`, and book
snapshots for Binance USD-M Futures `btcusdt` (exact entitlement and symbol
must be confirmed).

**Verified public information:** Tardis documentation describes normalized
tick-level trades, incremental L2 updates, top-5/top-25 snapshots, raw
exchange-native replay for higher subscription tiers, and per-exchange
historical coverage pages. It documents exchange timestamps, local capture
timestamps, capture order, and sequence/gap caveats. The documentation also
states that plans and historical access vary by subscription and billing
period.

**Vendor claim / to validate:** exact Binance USD-M BTCUSDT coverage for the
requested dates, completeness for the required channels, and suitability of
the selected plan for the intended internal research.

**Price:** `QUOTE REQUIRED` for the exact plan, historical window, API/CSV
access, and any export rights. No price is estimated here.

**MVRD assessment:** `STRONG CANDIDATE`. The documented data shape is aligned
with the minimum Path M requirement, but reconstruction must be tested against
a representative sample before commitment.

**LTDI assessment:** `POSSIBLE SEED / NOT A SOVEREIGN ARCHIVE`. The product can
seed research and may reduce early collection work, but recurring access,
subscription validity, and contract rights must be evaluated.

### BUY-2 — Kaiko Level 1 & Level 2 Data

**Exact candidate product:** Kaiko `Level 1 & Level 2 Data`, requesting
historical tick-level trades and the exact raw/full-order-book or granular
snapshot product for the selected venue/instrument. Delivery may be via API,
CSV/cloud delivery, or another product path offered in the quote.

**Verified public information:** Kaiko publicly describes tick-level trades,
order books, full-order-book and snapshot products, multiple delivery methods,
dataset versioning, and venue coverage. Its public material also indicates that
some products are aggregated or snapshot-based, so the requested product must
not be confused with raw event-level L2.

**Vendor claim / to validate:** exact Binance USD-M BTCUSDT perpetual product,
event granularity, update/sequence semantics, raw versus normalized delivery,
and whether the selected product supports deterministic reconstruction rather
than only derived liquidity metrics.

**Price:** `QUOTE REQUIRED`. Public material directs prospective customers to a
custom quote; no estimate is appropriate.

**MVRD assessment:** `STRONG CANDIDATE`, conditional on receiving raw or
sufficiently granular L2 plus trades for the same venue/instrument and a
license permitting internal research retention.

**LTDI assessment:** `POSSIBLE SEED / DEPENDENCY RISK`. Dataset versioning is a
positive reproducibility feature, but delivery, contract, and ongoing access
must be checked against the desired long-term ownership boundary.

### BUY-3 — Binance Public Data / Futures Orderbook route

**Exact candidate product:** Binance Public Data historical `trades`,
`aggTrades`, and klines for USD-M Futures, plus the separate futures order-book
data route if Binance confirms access for the requested symbol/date range.

**Verified public information:** the official public-data repository documents
daily/monthly public files for futures trades, aggregate trades, and klines,
with checksums. Official Binance material also documents public market-data
REST/WebSocket access. Historical futures order-book availability is a
separate route and must be confirmed; older official order-book documentation
explicitly described gaps and application-based access.

**MVRD assessment:** `PARTIAL`. Trades and candles are a credible public
starting point, but the required historical L2 product, coverage, and
completeness are not established by the public archive alone.

**LTDI assessment:** `VIABLE BUILD INPUT`. The live public feed can be a source
for future collection, subject to rate limits, reconnect handling, sequence
gaps, snapshots, storage, and terms. It is not a substitute for a historical
seed if immediate OOS research is required.

**Price:** public access may be free for the documented files/feeds; actual
engineering and storage cost remains. Historical L2 application/product
terms are `QUOTE REQUIRED / UNKNOWN` until Binance confirms them.

## BUILD/COLLECT option

**Candidate source:** exchange-public WebSocket market-data feeds for one
venue/instrument, initially Binance USD-M BTCUSDT only if that source passes
the selection checks. Coinbase/Kraken public feeds remain alternatives but
would change the venue/instrument hypothesis and must not be mixed silently.

**Required collection capability:** immutable raw capture, exchange and local
timestamps, subscription metadata, sequence/gap detection, snapshot recovery,
reconnect logs, checksums, retention policy, normalized schema, deterministic
replay, and a validation report for every collection interval.

**Time-to-research:** no immediate historical OOS. A collection-first route
requires the development/validation/OOS windows to accumulate prospectively.
That delay is an explicit cost and makes BUILD/COLLECT inferior to BUY for the
first falsification gate unless a suitable historical archive is discovered.

**Price:** `NO VENDOR PRICE`; engineering, storage, operations, and feed access
costs are `ENGINEERING ESTIMATE / MUST MEASURE`.

**Decision:** do not authorize implementation under A3. Keep it as an LTDI
option for a later gate.

## HYBRID option

**Candidate:** the smallest licensed Tardis or Kaiko historical seed that passes
the MVRD checks, followed by collection from the same venue/instrument using
the exchange-public feed.

**Advantages:** immediate temporal development/OOS capability, independent
future collection, cross-checking between purchased and self-collected data,
and a clearer removal test if the provider is used only as a seed.

**Risks:** source semantics may differ between seed and collection; exchange
feed changes may require versioned adapters; license terms may restrict storing
or replacing vendor data; two pipelines increase validation and maintenance.

**Decision:** `PREFERRED CANDIDATE` only after commercial rights and a sample
quality test. It is not an implementation authorization.

## Provider shortlist and decision table

| Candidate | MVRD fit | LTDI fit | Time-to-research | Rights status | Price status | Vendor dependency | Recommendation |
|---|---|---|---|---|---|---|---|
| Tardis Perpetuals/Derivatives + CSV/replay | Strong candidate | Seed | Fastest candidate, subject to sample | `QUOTE REQUIRED` | `QUOTE REQUIRED` | Medium/high while subscribed | First product to request a concrete quote/sample for |
| Kaiko Level 1 & Level 2 Data | Strong candidate | Seed | Fast candidate, subject to exact delivery | `QUOTE REQUIRED` | `QUOTE REQUIRED` | Medium/high under contract | Parallel commercial alternative |
| Binance Public Data + confirmed futures orderbook route | Partial until L2 confirmed | Stronger as collection input | Trades/candles fast; L2 unknown | Public terms/product terms require review | Public files may be free; L2 `QUOTE REQUIRED / UNKNOWN` | Lower provider dependency, higher engineering burden | Public fallback and collection source, not yet an MVRD decision |

## Commercial request checklist

If a future CTO/CEO gate authorizes vendor contact, request the following for
the exact product rather than a generic sales demonstration:

- `BTCUSDT` USD-M perpetual, exact venue and contract identity;
- 14-day sample and 30-day quote, including raw file size;
- trades plus incremental L2 and initial/recovery snapshots;
- exchange timestamp precision, local capture timestamp, and tie-break rules;
- sequence/gap semantics and documented completeness incidents;
- whether data is raw, normalized, aggregated, or reconstructed;
- historical start/end dates for the exact instrument;
- download/API/replay limits, rate limits, and retention period;
- internal research, derived-feature, backup, and re-analysis rights;
- redistribution, publication, and team/seat restrictions;
- data versioning and correction policy;
- one-time setup fee, monthly/annual recurring fee, overage, and cancellation
  behavior;
- support/SLA terms, if any;
- whether an archive remains usable after subscription termination.

All unavailable answers remain `QUOTE REQUIRED` or `UNKNOWN`; they must not be
filled with market guesses.

## Acquisition comparison: MVRD and LTDI

| Dimension | BUY | BUILD/COLLECT | HYBRID | HOLD / NO-GO |
|---|---|---|---|---|
| Cost | Quote-dependent recurring/one-time | Engineering/storage/operations estimate | Both, but seed can be minimized | Lowest immediate spend |
| Time-to-research | Fastest if sample passes | Slow; no historical seed | Fast enough plus future continuity | No research progress |
| Data richness | Potentially high | Depends on feed and collection quality | High if semantics align | None beyond current candles |
| Scientific validity | High only after replay audit | High only after months of clean collection | Highest practical option if cross-validated | No Path M evidence |
| Rights | Must be contracted | Must follow exchange/feed terms | Must cover both sources | No new rights needed |
| Storage | Vendor or local, contract-dependent | Fully local responsibility | Local raw plus seed retention | Current workspace only |
| Engineering effort | Medium adapter/validator | High collector/replay/operations | High but staged | None |
| Maintenance | Vendor plus adapter | Continuous operational ownership | Both responsibilities | None |
| Replay suitability | Candidate-dependent; verify | Must be built and validated | Can use seed as reference | Not applicable |
| Trading-core reuse | Raw/normalized research layer can be reusable | Strong long-term reuse if well governed | Strongest, with schema discipline | No new capability |
| Vendor dependency | Highest | Lowest | Medium | None |

## CTO recommendation

1. Keep `REQ-01B/C/D` on hold.
2. Do not implement LTDI or contact vendors under this gate.
3. If the program remains strategically justified, open a separate
   acquisition gate for a **bounded MVRD quote/sample request** from Tardis and
   Kaiko, with Binance's public/order-book route evaluated as the no/low-cost
   fallback.
4. Prefer **HYBRID** only if the purchased seed passes reconstruction and the
   license allows the intended internal research; otherwise choose BUY for a
   narrowly bounded study or HOLD/NO-GO.
5. Do not select a product based on price alone. Rights, event semantics,
   replayability, and temporal OOS validity are acceptance criteria.

This is a recommendation to request a later decision gate, not a procurement
authorization.

## Security and financial boundaries

This audit crossed no exchange, wallet, order, capital, or production boundary.
No credentials were requested or used. No System One payload was sent. No
market data was downloaded. No production configuration, ACS contract, Trading
runtime, strategy, or execution path was changed.

Any future dataset acquisition must separately review license, retention,
tenant isolation, secret handling, access logging, and whether raw market data
may leave the controlled research environment.

## Unresolved questions

- Which candidate source provides complete historical L2 for the selected venue
  and perpetual contract, rather than only snapshots or aggregates?
- Are exchange timestamps preserved, and what precision/order guarantees apply?
- Can trades be synchronized deterministically with book state?
- Are update sequences complete and independently gap-auditable?
- What exact rights cover internal storage, derived features, backups, and
  re-analysis after the contract ends?
- What is the measured storage volume for 14 and 30 days?
- What is the actual replay throughput on the Trading research environment?
- Which horizons survive both data resolution and later measured inference
  latency?
- Is commercial acquisition proportionate to the expected information gain?

## Final classification

**`DATASET REQUIRES COMMERCIAL DECISION`**

The preferred microstructure path is not rejected scientifically. It is not
available locally, and the public/free alternatives reviewed here do not yet
provide sufficient evidence for a reproducible historical L2 benchmark.
Trading can proceed to a future dataset-selection gate only after a separate
decision on source, terms, cost, and sample validation.

## Implementation performed

- Added this documentation-only REQ-01A2 feasibility report.
- No dataset downloaded.
- No commercial service purchased.
- No exchange integration added.
- No System One calls made.
- No model, strategy, paper-trading, live-trading, ACS, or production changes.

## Decisions required from CTO

- Accept or reject the classification `DATASET REQUIRES COMMERCIAL DECISION`.
- If continuing, authorize a separate source/sample evaluation gate with an
  explicit budget and license review.
- Decide whether Path M remains preferred after the commercial decision, or
  whether a separately framed Path T study is more proportionate.

## Decisions required from CEO

`NONE` at this documentation-only gate. CEO authorization becomes relevant if
the next gate requests a material commercial data purchase or other external
financial commitment.

## Commit / publication state

**Commit:** authorized by mandate, pending local creation.  
**Push:** `HOLD` pending CTO review.  
**Program state:** `AXODUS-TRADING-RESEARCH-REQ-01A2 — COMPLETE / PENDING CTO REVIEW`.
