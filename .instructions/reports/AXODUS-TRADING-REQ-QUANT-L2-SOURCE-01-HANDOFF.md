# AXODUS-TRADING-REQ-QUANT-L2-SOURCE-01 — FINAL HANDOFF

```text
STATUS: COMPLETE / SOURCE_DECISION_FROZEN / CTO REVIEW REQUIRED
WORKSPACE: /opt/Axodus/Trading/quants-lab
BRANCH: main (quants-lab) / dev (Trading parent)
HEAD: 8e80a6918935cad7f04436a9a23c874f01712299 (quants-lab) / 3933f6b (parent)
WORKTREE: UNCOMMITTED TOOLING, SAMPLES, CONTRACTS, TESTS, AND ARCHITECTURE ADDED

TRACK A — HISTORICAL L2
CANDIDATES:
  Binance Vision bookDepth:
    qualification: REJECTED_SCHEMA
    reason: percentage depth aggregates without price-level causal reconstruction
  Tardis.dev Binance Futures CSV:
    BTCUSDT: real sample obtained; catalog coverage reported from 2019-11-17
    ETHUSDC: real sample obtained; catalog coverage reported from 2024-01-04
    schema: price-level incremental rows and top-25 snapshots
    timestamps: exchange and local timestamps in microseconds
    sequence: absent in observed downloadable CSV schema; no U/u/pu fields
    licensing: UNKNOWN pending contractual review
    cost: UNKNOWN pending account/pricing review
    qualification: PARTIALLY_QUALIFIED
  Binance USD-M Futures REST + WebSocket:
    BTCUSDT: prospective pilot passed
    ETHUSDC: prospective pilot passed
    schema: price levels, REST lastUpdateId, WebSocket U/u/pu
    sequence: causal continuity verified in bounded pilot
    qualification: QUALIFIED_PROSPECTIVE_ONLY
    limitation: no historical 90-day archive supplied by this pilot
  Axodus internal archive:
    qualification: NOT_AVAILABLE

SELECTED HISTORICAL SOURCE: none
RATIONALE: the observed Tardis downloadable CSV does not expose sequence identifiers, while Binance Vision lacks price levels. No paid raw historical source was authorized.

REAL SAMPLE:
  BTCUSDT: Tardis snapshot/incremental CSV plus Binance REST depth/trades
  ETHUSDC: Tardis snapshot/incremental CSV plus Binance REST depth/trades

REAL SAMPLE VALIDATION:
  parse: PASS
  decimal integrity: PASS
  sequence: Tardis CSV FAIL CLOSED; Binance native stream PASS
  gap detection: PASS
  reconstruction: PASS
  snapshot reconciliation: PASS
  spread_ticks: PASS
  OBI: PASS
  depth skew: PASS

L2/TAPE COMPOSITION:
  L2: canonical parser/reconstructor
  tape: Binance trade source
  synchronization: tape events <= book event time; future events excluded

ADAPTER COMPATIBILITY:
  Momentum: PASS
  Absorption: PASS
  Divergence: PASS

HISTORICAL COVERAGE:
  BTCUSDT: catalog/sample evidence only; no 90-day acquisition
  ETHUSDC: catalog/sample evidence only; no 90-day acquisition
  common 90d window: not locally acquired or qualified

LICENSING: Tardis UNKNOWN; Binance public market-data terms require review
BULK_ACQUISITION_READY: NO
SOURCE_DECISION: NO_ACCEPTABLE_HISTORICAL_L2_SOURCE_FOUND

TRACK B — PROSPECTIVE CAPTURE
LIVE SOURCE: Binance USD-M Futures public market data
STREAMS: <symbol>@depth@100ms and trade stream
SNAPSHOT: REST depth snapshot on bootstrap/reconnect
SEQUENCE: lastUpdateId overlap plus consecutive pu == previous u
RAW EVENT: RawMarketEventV1 with exchange time, receive time, stream, sequence, payload, SHA-256
PARTITIONS: immutable hourly raw JSONL with manifest and checksum
GAP MODEL: LIVE_GAP_DETECTED; quarantine derived continuity and re-bootstrap
RECOVERY: reconnect, buffer, fresh snapshot, resume new qualified partition
HEALTH: CaptureHealthV1

REAL NETWORK PILOT:
  connected: YES for BTCUSDT and ETHUSDC
  messages: 21 depth messages per symbol received
  reconstructed states: BTCUSDT 15; ETHUSDC 18
  gaps: 0
  raw partitions: written to /tmp/axodus-l2-pilot-20260924
  external trading mutation: 0

PROSPECTIVE_ARCHITECTURE: READY FOR SEPARATE IMPLEMENTATION GATE

TEST RESULTS:
  focused L2 qualification tests: 11 passed
  historical foundation and adapter tests: 7 passed
  full quants-lab suite: 79 passed, 0 failed

R3E_ISOLATION: PASS
R3H_ISOLATION: PASS
B1_ISOLATION: PASS
STRATEGY_FREEZE: PASS

EXTERNAL TRADING MUTATIONS: 0
TESTNET MUTATIONS: 0
MAINNET MUTATIONS: 0
REAL CAPITAL: 0
SECRETS_EXPOSED: false

KNOWN LIMITATIONS:
  - Tardis CSV sequence continuity is not independently verifiable from the observed downloadable schema.
  - Tardis licensing and pricing remain unknown pending contractual review.
  - No 90-day historical bulk acquisition was performed.
  - Prospective capture is a bounded pilot and not production deployment.

FINAL DISPOSITION: NO_ACCEPTABLE_HISTORICAL_L2_SOURCE_FOUND
RECOMMENDED NEXT GATE:
  - Evaluate a Tardis raw/API product that preserves native sequence fields, or qualify another commercial raw WebSocket archive.
  - If approved separately, implement AXODUS-TRADING-IMP-QUANT-CAPTURE-01 for prospective capture.

COMMIT: NOT PERFORMED
PUSH: NOT PERFORMED
CTO REVIEW REQUIRED: YES
```
