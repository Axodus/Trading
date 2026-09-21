# 14 — Experimental Stages & Promotion Gates

## Stage 0 — Technical/API characterization

Separately authorized, non-trading characterization against synthetic/non-sensitive states:

- verify auth, schema, model resolution, timeout/error mapping and usage fields;
- measure cold/warm latency, batching, rate-limit behavior and repeated-state stability;
- validate redaction and no-secret logging;
- compare SDK retries disabled versus explicit measured retry policy.

Exit: provider contract is reproducible and security/legal unknowns are acceptable for Paper/Testnet SHADOW.

## Stage 1 — Offline/replay

- Freeze state schema, questions, labels, horizons and split.
- Use historical canonical records where point-in-time integrity is provable.
- Produce calibration, disagreement and operational reports.

Exit: no leakage, enough sample for primary metrics, and no architecture violation.

## Stage 2 — Live SHADOW observation

- Subscribe to immutable proposal snapshots.
- Persist provider outcomes asynchronously.
- Prove baseline digests/outcomes are invariant with shadow enabled/disabled/provider failed.

Exit: durable provenance, acceptable failure rate/cost/latency, no baseline dependency.

## Stage 3 — SHADOW + TESTNET outcome correlation

- Link shadow observations to canonical testnet execution/economic facts.
- Evaluate by strategy, instrument and regime.
- Continue to treat Testnet as engineering evidence.

Exit: preregistered report with incremental-value and calibration results.

## Future Advisory candidate evidence

REQ-02 does not authorize Advisory. A future CTO+CEO gate should require at minimum:

1. statistically and economically meaningful incremental value on untouched prospective data;
2. calibration acceptable for the intended question and stable across major regimes;
3. explicit abstention behavior superior to a simple deterministic/data-quality baseline;
4. provider failure, latency and cost within predefined limits;
5. no P0/P1 security, provenance or removal-boundary defect;
6. replicated results across strategy revisions/instruments or a deliberately narrow scope;
7. a proposed Advisory contract that cannot alter Portfolio, Risk, Intent or execution;
8. independent review of legal/privacy and model-version migration.

Stages 4 `ADVISORY`, 5 `GATED` and 6 `REAL CAPITAL` remain out of scope and require new authorization. `DEBT-AUD-A-03` blocks any future real-capital readiness.
