# AXODUS-TRADING-IMP-02 — PAPER SHADOW Principal + Stability Probe

**Status:** `COMPLETE / INSUFFICIENT EVIDENCE / CTO REVIEW REQUIRED`
**Date:** 2026-09-21
**Baseline:** `8418a2cf588cb8727c0a6c369719d40587841205`
**Execution HEAD observed:** `bc201fdc5f726b0347b0b90ded83735f5aa9f4c6`
**Scope:** PAPER SHADOW H1/H2 plumbing pilot plus STABILITY_PROBE.

## Scope

This run followed the committed external-mutation isolation boundary. It used deterministic PAPER snapshot fixtures and Jev SHADOW calls only.

The campaign executed:

- H1 / Trade Validator plumbing over six principal PAPER snapshots;
- H2 / Market-State Reader plumbing over the same principal snapshots;
- one STABILITY_PROBE cohort with five repeated evaluations of the exact same immutable snapshot.

The fixtures validate provider request/response plumbing, provider model recording, question-set response parsing, latency and usage collection, explicit abstention/failure accounting, and stability-probe reporting. They do not establish market quality, calibration, economic performance, counterfactual performance or Jev incremental value.

## Results

```yaml
principalSnapshots: 6
stabilityProbeCalls: 5
jevPaperApiCalls: 11
successfulObservations: 11
providerFailures: 0
abstentions: 1
requestedModel: jev-1.13.0
resolvedModels: ['jev-1.13.0']
attemptsPerRequest: 1
blindRetries: 0
```

Observed provider round-trip latency:

```yaml
n: 11
minMs: 303
p50Ms: 408
p95Ms: 1404
p99Ms: 1404
maxMs: 1494
```

Observed usage:

```yaml
inputTokens: 16372
outputTokens: 2747
```

Baseline/Jev matrix for principal fixtures:

```yaml
{
  "A/A": 3,
  "A/R": 0,
  "R/A": 2,
  "R/R": 0,
  "ABSTAIN": 1,
  "FAILURE": 0
}
```

These matrix counts are plumbing observations over deterministic fixtures only. They must not be interpreted as predictive or economic evidence.

## STABILITY_PROBE

```yaml
probeCount: 5
immutableSnapshot: shadow-snapshot:bed4e366e479e8e5
maxRegimeProbabilityDelta: 0
```

The probe repeated the same immutable snapshot five times. Under the current provider outputs, `market_regime` probabilities were stable for that specific fixture, while this does not establish broad provider determinism or trading value.

## Ground Truth and Disposition

Every principal record is marked:

```text
outcomeProvenance = NO_DEFENSIBLE_OUTCOME
```

No canonical PAPER execution outcome, market-derived counterfactual or simulation engine outcome was attached. Therefore:

```text
H1 Trade Validator value = INSUFFICIENT EVIDENCE
H2 Market-State Reader value = INSUFFICIENT EVIDENCE
Calibration = NOT SCORABLE
Incremental economic value = NOT SCORABLE
```

## Safety and Authority

```yaml
exchangeTestnetOrderPost: 0
exchangeTestnetOrderDelete: 0
exchangeMainnetOrderPost: 0
exchangeMainnetOrderDelete: 0
realCapital: 0
productionCredentialsUsed: 0
customerCredentialsUsed: 0
privateKeysUsed: 0
secretsExposed: false
```

Jev remained SHADOW-only. It did not participate in Portfolio, Risk, TradingIntent, ExecutionIntent, Harness or exchange authority. `AXODUS_TRADING_ALLOW_TESTNET_MUTATION` was not enabled.

## Artifacts

- Machine-readable result: `.instructions/reports/AXODUS-TRADING-IMP-02-PAPER-SHADOW-RESULTS.json`
- External-mutation boundary: `.instructions/validation/AXODUS-TRADING-FIX-IMP02-01_EXTERNAL_MUTATION_TEST_ISOLATION.md`
- Incident record: `.instructions/handoffs/Trading/2026-09-21T-paper-shadow-blocked-testnet-scope-violation.md`

## Next Decision

Do not begin Testnet SHADOW or claim Jev decision value from this pilot.

A CTO decision is required before any expanded PAPER cohort, TESTNET SHADOW, Advisory, or Gated mode. A valid expanded cohort needs canonical or independently reproducible market/outcome provenance, frozen label policy, durable observation/evaluation joins and a predeclared evaluation design.
