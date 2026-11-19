# AXODUS Quant Lab — Q0-CONTRACT-CORRECTIONS-01

Program: `GAP-QUANT-09` · Parent: `AXODUS-QUANT-LAB-Q0` · Date: 2026-11-18  
CTO disposition: `Q0_ACCEPTED_WITH_CORRECTIONS / CONTRACT_FREEZE_PENDING`  
Delivery: `CORRECTIONS_PROPOSED / CTO_FREEZE_REVIEW_PENDING`

This addendum changes only the provisions below. The five Q0 V1 contracts, the staged plan, Microprice as the Q1 target and the offline research boundary remain in force. Examples are synthetic, not historical qualification.

## Q0-FIX-01 — Result artifacts

An available result ledger or series references an immutable JSON artifact by `ArtifactRef`, including its exact `schemaId` and digest. All artifacts below have the closed envelope `{schemaId, instrument, dataOrigin, rows}`. `instrument` and `dataOrigin` match the result. An empty verified artifact is `AVAILABLE` with `rowCount: 0`; missing evidence is `UNAVAILABLE` with a reason and no artifact. The result's row count must match the payload.

```ts
type BaseQuantity = { asset: Id; value: Decimal }  // positive; registered base asset
type QuotePrice = { unit: MoneyUnit; value: Decimal } // positive; quote per base
type Observation = {
  ordinal: number; time: Utc
  source: "ENGINE_RECORDED" | "DERIVED_FROM_LEDGER"
  sourceRowIds: readonly Id[]
}
type OrderRowV1 = Observation & {
  orderId: Id; decisionId?: Id; side?: "BUY" | "SELL"; quantity?: BaseQuantity
  status: "FILLED" | "PARTIALLY_FILLED" | "UNFILLED" | "CANCELLED" | "REJECTED"
}
type FillRowV1 = Observation & {
  fillId: Id; orderId: Id; side: "BUY" | "SELL"; quantity: BaseQuantity
  price: QuotePrice; fees: readonly FeeComponentV1[]
  feeCoverage: "COMPLETE" | "UNAVAILABLE"
  spreadCost: Amount; slippageCost: Amount
}
type ClosedTradeRowV1 = Observation & {
  tradeId: Id; side: "LONG" | "SHORT"; openedAt: Utc; quantity: BaseQuantity
  entryPrice?: QuotePrice; exitPrice?: QuotePrice; fillIds?: readonly Id[]
  grossBasis: PnlBasis; gross: Amount; fees: Amount; spreadCost: Amount
  slippageCost: Amount; netFundingCost: Amount; net: Amount
}
type SeriesPointV1 = Observation & {
  value: Decimal; unit: MoneyUnit
  semantic: "GROSS_REALIZED" | "NET_REALIZED" | "CUMULATIVE_FEES" | "EQUITY_MTM"
  recognition: "CLOSED_TRADE_FINALIZATION" | "NATIVE_REALIZATION" | "FILL" | "MARK"
}
```

| `schemaId` | Rows and meaning of `time` |
| --- | --- |
| `quant-lab.orders.v1` | `OrderRowV1`: time of the recorded status. This is not an inferred submission time. |
| `quant-lab.fills.v1` | `FillRowV1`: simulated fill time. |
| `quant-lab.closed-trades.v1` | `ClosedTradeRowV1`: final close time; `openedAt <= time`. No row for an unfinalized position. |
| `quant-lab.series.gross-realized.v1` / `quant-lab.series.net-realized.v1` | `SeriesPointV1`: cumulative amount at finalized close or at a verified native realization event. |
| `quant-lab.series.cumulative-fees.v1` | `SeriesPointV1`: cumulative fees from all fills at their recorded times; includes positions still open. |
| `quant-lab.series.equity-mtm.v1` | `SeriesPointV1`: native equity at mark time. Its value includes initial capital; it is not a realized PnL point. |

Rows sort by normalized UTC time then by preserved native event order; `ordinal` is the zero-based index after sorting. Identity is unique per order, fill or finalized trade in its ledger. Source IDs are stable records in the native evidence or in the normalized ledgers; they cannot contain job IDs, storage locators or wall-clock execution metadata. Each series uses one reporting unit and one recognition basis. Realized gross and net use the same coverage and basis when both are published. A chart may draw a labeled starting reference but may not add a synthetic source row. If the engine only returns order status without a verifiable time, as can happen in `SimulationEngine`, the adapter marks that ledger unavailable and retains the native record. It does not guess a time from the order ID. If the order ledger is available, fill `orderId` must resolve there.

## Q0-FIX-02 — Units, fee attribution and conversion

```ts
type MoneyUnit = { kind: "ASSET" | "FIAT"; code: Id }
type Amount = { unit: MoneyUnit } & (
  | { status: "KNOWN"; value: Decimal }
  | { status: "NOT_MODELED" | "UNAVAILABLE"; reason: Id }
)
type FeeComponentV1 = {
  original: { unit: MoneyUnit; value: Decimal }
  reporting: Amount
  conversion?: {
    rate: Decimal; asOf: Utc; evidenceDigest: Sha256; evidenceRecordId: Id
  }
}
```

- Add `reportingUnit: MoneyUnit` to result economics. All aggregate monetary amounts and graph points use this unit. Q1 uses the instrument quote asset. Asset units and fiat units never compare equal by label alone. Quantity and price remain explicitly denominated; the mark and fill prices are quote per unit of the base asset.
- Cost convention: a debit is positive; a rebate or funding receipt is negative. `realizedFees` belongs only to finalized trades or an explicitly supported native realization ledger. `totalFillFees` and `CUMULATIVE_FEES` cover all fills with sufficient evidence. Attribution is performed by the engine, or from an explicit trace of allocated fee portions; the adapter does not allocate pro rata on its own.
- For a foreign fee, the conversion is reporting units per original unit, with a strictly positive rate and an approved, immutable observation whose `asOf` is its availability time in the replay. `asOf` must be at or before fill time; the pair, direction, timestamp and rate must match the evidence. The reporting amount is the exact decimal product in V1. With no acceptable observation, preserve the original fee, emit `UNAVAILABLE` for the conversion and affected totals/series, and never assume parity. Omitting a known debit or mixing currencies is invalid. Same-unit fees require exact equality and no conversion object. `feeCoverage=COMPLETE` with no fees means a verified zero; `UNAVAILABLE` is not zero.
- Q1 preserves `realizedNet = realizedGross − realizedFees`: the gross based on simulated fills includes spread and slippage. They are attribution, not extra deductions. Q1 funding is `NOT_MODELED`. A net value that already exists natively may be shown on its declared basis when its provenance supports it; incomplete decomposition cannot be labeled reconciled.

## Q0-FIX-03 — Exact digest inputs and canonical bytes

Use Quants-Lab's [`canonical_json` and `sha256_digest`](../../../quants-lab/core/quant_foundations/canonical.py) **after** V1 schema validation and the following typed normalization. Do not change the native digest algorithm or recanonicalize archived evidence bytes.

1. Only declared `Decimal` fields and maps whose registered parameter kind is `DECIMAL` receive decimal normalization. Accept `^-?(0|[1-9][0-9]*)(\.[0-9]+)?$`; trim fractional trailing zeros and then a bare dot, and turn any signed zero into `"0"`. Reject exponent notation, non-finite numbers and JSON numbers in decimal fields. Integers are JSON safe integers; booleans are booleans; other strings retain exact Unicode scalar values with no Unicode normalization. Duplicate JSON keys and invalid Unicode are rejected before hashing.
2. Normalize typed timestamps to `YYYY-MM-DDTHH:mm:ss.sssZ` in UTC. Offset-bearing values may be normalized at intake; emitted records carry `Z`. Reject unqualified times, leap seconds, and sub-millisecond precision that would require rounding. Require valid calendar instants and years `0001`–`9999`. Equality and window checks use normalized instants.
3. Omit absent optional keys; explicit `null` is invalid in V1 Lab contracts. Encode compact UTF-8 JSON without BOM or trailing newline, using the Quants-Lab string escaping and lexicographically sorted Unicode code-point object keys. Preserve array order. Canonical lists that represent sets, including limitation IDs, are unique and sorted by code point; result artifact event arrays use the order specified above. Parameter and assumption types come from the pinned schemas, not from string heuristics. `REQUIRED` fields have no default, `DEFAULTED` fields take the pinned value when omitted, and a `FIXED` field can only resolve to its pinned value. `INTEGER` rejects booleans; `ENUM` requires membership. Validate bounds and any adapter constraints before queuing and again against the resolved config in the worker.

| Digest | Exact preimage before encoding |
| --- | --- |
| `datasetManifestDigest` | Entire normalized `ResearchDatasetManifestV1`. Dataset evidence IDs in the manifest are stable logical IDs, not storage locations. `dataset.contentDigest` separately hashes the sorted list of `{window, schemaId, digest, rowCount}` for its partitions, ordered by window start, end, schema ID and digest. Partition digest is SHA-256 of actual immutable bytes. |
| `specificationDigest` | Entire normalized specification excluding **only** `specificationDigest`. Add required `inputWindow: Window` and `validationRegistryDigest: Sha256` to the specification. `inputWindow` includes the evaluation window and any warm-up or other consumed data. Job ID, principal, origin, idempotency key, submission time and retry ancestry belong only to the job. |
| Normalized artifact digest | Entire normalized `{schemaId, instrument, dataOrigin, rows}` envelope. No storage ID or job metadata inside the envelope. An archive's native reference digest remains over the original bytes. |
| `resultDigest` | Entire normalized `CanonicalBacktestResultV1` excluding **only** `resultDigest`; includes `resultId`, full provenance, evidence references and `replayDigest` if present. |
| `replayDigest` | Exact object `{schemaVersion, specificationDigest, dataOrigin, positionAtEnd, economics, limitations, ledgers, series}`. For this projection, each available ledger/series becomes `{status, schemaId, digest, rowCount}`; each unavailable entry stays `{status, reason}`. Only LAB_JOB results may supply this digest. Result ID, job metadata, storage IDs and native evidence references are excluded. If content is not reproducible without operational IDs, the adapter cannot claim a replay digest. |

Store preimages with literal expected bytes and digests in [the test vectors](q0-contract-vectors.json). Production serializers for API and worker must pass them independently in Q1; these fixtures do not claim those products already exist.

## Q0-FIX-04 — Protected lineage and partial realization

- The server resolves the dataset from its approved registry and requires a verified lineage graph of exact dataset ID/revision/content hashes, partition hashes and transformation links. Only a governed source entry can start a new historical lineage. A rename, reslice, transcode, or merge inherits all relevant ancestor protections. A new label, file hash, or empty `protectedWindows` list cannot establish independence. Missing or cyclic lineage is rejected.
- A trusted, versioned validation registry binds protected half-open UTC windows to source lineage, instrument scope and authorized validation evidence. Inherited rules apply when the verified graph reaches a covered identity or partition. The server rejects overlap with `inputWindow`, including warm-up; a boundary that only touches is not overlap. Manifest `protectedWindows` may add restrictions, never remove authoritative ones. Record the verified registry snapshot digest in the specification and recheck it before running. An unavailable or changed snapshot fails closed; resubmission resolves the new snapshot. Synthetic fixtures require approved fixture lineage and cannot bypass historical access or become `QUALIFIED_VALIDATION`.
- Add `realizedCoverage: "COMPLETE" | "FINALIZED_TRADES_ONLY" | "UNAVAILABLE"` to result economics. `COMPLETE` requires evidence of all realization events or proof that no partial realization remains outside finalized trades. `FINALIZED_TRADES_ONLY` is a narrower, explicitly labeled view backed by complete finalized-trade records. If even that view is unsupported, set gross/net and their series to `UNAVAILABLE`. Unavailable all-position realized PnL is represented by the coverage classification; the UI must not headline the finalized-only subtotal as total realized PnL. Zero finalized trades does not prove zero economic realization. Native `EQUITY_MTM` and complete fill fees remain independently visible when known.
- `SimulationEngine` can accumulate realized amounts internally while emitting no closed-trade record until the position closes. Q1 projects finalized lifecycles at their close time; it does not reconstruct partial realization from price, equity deltas or fill assumptions. With a partially closed remainder still open and no supported native realization ledger, publish only a verified finalized-trade scope (or none), never a full realized curve. A closed-trade row keeps native fee attribution; no synthetic close at the end. When a later adapter supports native per-close realization, it declares `NATIVE_REALIZATION` and supplies the evidence for that distinct series. See [`_apply_fill`](../../../quants-lab/core/quant_simulation/engine.py#L169).

## Examples and consistency checks

- **Result rows:** the fixture enters at `100.02` and exits at `100.9799`, one base unit; its normalized rows cover simulated order status, fills, finalized trade, realized PnL, fees and native equity. The net is `0.9599 − 0.10049995 = 0.85940005` in USDT. `0.83930005` is rejected as double subtraction of the `0.0201` slippage attribution.
- **Foreign fee:** `0.001 BNB × 300 USDT/BNB = 0.3 USDT` with dated evidence. The same native amount without an admissible rate has `reporting.status=UNAVAILABLE`. No normalization to `0.001 USDT` and no zero substitution.
- **Partial close:** with no finalized trades, an open remainder and `0.3 USDT` in verified fill fees, the test permits native equity and the fill fee curve. A full native realized curve is rejected; a verified finalized-only zero is labeled as such.
- **Protected window:** a renamed descendant of a protected source is blocked even with an empty manifest protection list. A request starting exactly at the protected end is allowed only if its actual inputs, including warm-up, do not overlap.

Run `node .instructions/research/AXODUS-QUANT-LAB-Q0/verify-q0-vectors.mjs` from Trading (Node 22+ and Python 3). The verifier is a fixture check, not a Lab runtime. It tests the published hash vectors in Node and compares the expected bytes and hashes with Quants-Lab's Python canonical helper. The case table also covers denominated fees, result economics, series identity, authorization by lineage and partial close coverage. Fixture identity digests are illustrative; they do not certify an installed engine or an available dataset. Q1 must run the same cases through its real registry, adapters and graph projection after authorization.

**Next gate:** `Q0_CONTRACT_CORRECTIONS_REVIEW`. Contract freeze, Q1 implementation, commits, push and deployment remain unauthorized by this delivery.
