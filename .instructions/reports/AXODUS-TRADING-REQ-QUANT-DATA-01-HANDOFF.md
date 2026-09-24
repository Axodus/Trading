# AXODUS-TRADING-REQ-QUANT-DATA-01 — FINAL HANDOFF

```text
STATUS: COMPLETE / HISTORICAL_DATASET_NOT_AVAILABLE / CTO REVIEW REQUIRED

WORKSPACE: /opt/Axodus/Trading/quants-lab
BRANCH: main (quants-lab) / dev (parent)
HEAD: 41e9378a6f8c55e777bb96156c32c0aa4a4af10b
WORKTREE: UNCOMMITTED DATA TOOLING ADDED

SOURCE DISCOVERY:
  candidates: Binance official historical data archives, Hummingbot market feed connectors
  selected source: Binance official archives (candidate)
  selection rationale: provides sequenced L2 and trade tapes with aggressor flags

LICENSING:
  access constraints: internal research permitted; large binaries prohibited in Git
  redistribution: manifest-only repository storage
  repository policy: data kept external, code/manifests in repository

STORAGE:
  raw estimate: ~12-25 GB per 90-day pair
  normalized estimate: ~3-6 GB Parquet/partitioned JSONL
  derived estimate: ~500 MB OrderFlowFrameV1 series
  storage root: quants-lab/app/data/raw and quants-lab/app/data/processed
  partitioning: provider/symbol/date/type
  compression: zstd/parquet

BTCUSDT:
  source: pending live acquisition
  period: 90 contiguous UTC days required
  contiguous coverage: 0% available in repository
  L2: schema validated, pending raw seed
  tape: schema validated, pending raw seed
  aggressor side: explicit provider buyer_maker mapping defined
  sequence model: ordered snapshot + incremental deltas with gap detection
  gaps: unrecoverable gap quarantining enforced
  funding: historical funding rate contract defined
  instrument metadata: contract tick/step metadata contracts frozen
  quality status: HISTORICAL_DATASET_NOT_AVAILABLE

ETHUSDC:
  source: pending live acquisition
  period: 90 contiguous UTC days required
  contiguous coverage: 0% available in repository
  L2: schema validated, pending raw seed
  tape: schema validated, pending raw seed
  aggressor side: explicit provider buyer_maker mapping defined
  sequence model: ordered snapshot + incremental deltas with gap detection
  gaps: unrecoverable gap quarantining enforced
  funding: historical funding rate contract defined
  instrument metadata: contract tick/step metadata contracts frozen
  quality status: HISTORICAL_DATASET_NOT_AVAILABLE

DATASET MANIFEST:
  datasetId: orderflow-l2tape-pilot-candidate
  datasetRevision: v1-specification-only
  checksums: cryptographic hash verification enforced on load
  normalization version: v1
  parser version: v1

NORMALIZATION:
  contracts: OrderBookUpdateV1, TradePrintV1, FundingEventV1, InstrumentMetadataV1
  decimal integrity: strict Decimal arithmetic, zero float authority
  time model: UTC integer epoch milliseconds, causal sequencing
  book reconstruction: snapshot bootstrap + ordered delta application
  tape normalization: signed trade volume with explicit aggressor sides

L2/TAPE SYNCHRONIZATION: causal event_time_ms alignment, trade_time <= book_time

QUALITY REPORT:
  coverage: 0% real historical
  missing intervals: complete dataset pending
  sequence gaps: fail-closed rejection implemented and verified
  duplicates: duplicate sequence detection enforced
  out-of-order: causal sequence rejection enforced
  crossed books: invalid/crossed book rejection enforced
  timestamp anomalies: book_time > event_time rejection enforced

FUNDING DATA: FundingEventV1 contract implemented

FEE METADATA: 0.02%/0.05% BTCUSDT, 0.00%/0.04% ETHUSDC baseline documented

REAL SAMPLE REPLAY:
  raw -> normalized: proven in deterministic fixtures
  book reconstruction: proven in test_historical_data_v1.py
  tape alignment: proven in test_historical_data_v1.py
  OrderFlowFrame generation: proven compatible with source-equivalent adapters

ADAPTER INPUT COMPATIBILITY:
  Momentum: PASS
  Absorption: PASS
  Divergence: PASS

TEST RESULTS:
  manifest: PASS
  parser: PASS
  sequence: PASS
  reconstruction: PASS
  tape: PASS
  synchronization: PASS
  funding: PASS
  metadata: PASS
  causality: PASS

R3E_ISOLATION: PASS
R3H_ISOLATION: PASS
B1_ISOLATION: PASS

EXTERNAL TRADING MUTATIONS: 0
TESTNET MUTATIONS: 0
MAINNET MUTATIONS: 0
REAL CAPITAL: 0
SECRETS_EXPOSED: false

KNOWN LIMITATIONS:
  - Real 90-day L2/tape archive is not yet seeded locally.
  - Synthetic data is rejected for strategy promotion.

FINAL DISPOSITION: HISTORICAL_DATASET_NOT_AVAILABLE

RECOMMENDED NEXT GATE: CTO review and approval of external bulk acquisition source for BTCUSDT and ETHUSDC.

COMMIT: NOT PERFORMED
PUSH: NOT PERFORMED
CTO REVIEW REQUIRED: YES
```
