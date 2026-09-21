# AXODUS-TRADING-VAL-JEV-02D — Stage 0 Characterization R2

**Status:** `PASS / CTO REVIEW REQUIRED`  
**Date:** 2026-09-21  
**Authorization:** Phase F live Jev calls granted; PAPER and extended TESTNET SHADOW not authorized.  
**Baseline:** `0d8c71f0ec8c43174546bb2e44e6676346b01f3e`

## Credential handling

The resumed run used the existing local credential in ignored root `.env.local` through the scoped variable name `TRADING_TYPESAFE_API_KEY`. No value was printed, captured, persisted, committed, returned, logged in evidence, or included in telemetry. `.env.local` remains ignored by `.gitignore`.

The local resolver accepts `TRADING_TYPESAFE_API_KEY` plus the existing legacy compatibility names `TYPESAFE_API_KEY` and `TYPESAFE_AI_API_KEY`. No generic `API_KEY` name is accepted.

## Live characterization result

The Stage 0 runner sent one connectivity/schema request first. Because that request succeeded and the provider returned the requested model, it sent the remaining four repeatability requests. A separate single-observation run was then used to record sanitized question-result/probability evidence.

```yaml
status: PASS
credentialConfigured: true
requestedModel: jev-1.13.0
resolvedModel: jev-1.13.0
modelConfirmed: true
connectivity: SUCCEEDED
primarySampleCalls: 5
singleObservationCalls: 1
providerAttemptsPerCall: 1
blindRetries: 0
```

The failed direct invocation from the repository root produced `credentialConfigured=false` and made `0` Jev API calls because the runner resolves the local env file from the service working directory. It is retained as an operator invocation note, not as provider failure evidence.

## Latency and repeatability

Primary five-call sample:

```yaml
latencyMs:
  min: 306
  p50: 336
  p95: 1167
  p99: 1167
  max: 1307
  n: 5
repeatability:
  successfulSamples: 5
  distinctAnswerFingerprints: 5
```

The provider response was not deterministic for the equivalent immutable fixture: every successful sample produced a distinct answer fingerprint.

Single-observation response summary:

```yaml
latencyMs: 1350
state_sufficiency:
  value: insufficient
  confidence: 0.41
  probabilityTotal: 1
proposal_alignment:
  value: aligned
  confidence: 0.47
  probabilityTotal: 1
market_regime:
  value: unknown
  confidence: 0.88
  probabilityTotal: 1
contextual_risk:
  value: "0.22"
  confidence: 0.67
  probabilityTotal: 1
```

Only question ids, answer values, confidence values and probability-key/total conformance were recorded. The raw provider payload and credential were not persisted.

## Retry and failure behavior

- Retry policy: one provider attempt per request.
- Observed attempts: `[1, 1, 1, 1, 1]` for the primary sample and `[1]` for the single observation.
- No timeout, HTTP failure, schema failure, 429, duplicate response or stale response occurred during the live sample.
- Mock/replay tests continue to cover timeout, provider error, malformed response, missing probability, duplicate, stale, provider absence, slow provider and disabled/removed provider.

## Usage and cost

Observed usage:

```yaml
primarySampleInputTokens: 6080
singleObservationInputTokens: 1216
totalObservedInputTokens: 7296
estimatedCostUsd: "0.00030643"
pricingBasis: vendor documented $0.042 per million input tokens, audit date 2026-09-21
```

Cost remains an estimate from observed usage and documented pricing; it is not a billing statement.

## Authority and isolation

- Jev remained SHADOW-only.
- Jev did not affect Portfolio, Risk, TradingIntent, ExecutionIntent, Harness, exchange adapter, Testnet or Mainnet.
- Baseline Trading did not wait for Jev in the accepted A–E tests.
- Removing/disabling Jev remains tested as baseline-equivalent for identical canonical inputs.

## External mutation counters

```yaml
jevApiCalls: 6
exchangeTestnetOrderPost: 0
exchangeTestnetOrderDelete: 0
exchangeMainnetOrderPost: 0
exchangeMainnetOrderDelete: 0
realCapital: 0
productionCredentialsUsed: 0
customerCredentialsUsed: 0
privateKeysUsed: 0
secretsExposed: false
blindRetries: 0
```

## Validation

```yaml
build: PASS
stage0LiveCharacterization: PASS
tradingRegressionObservedThisTurn: 800 passed / 0 failed / 1 skipped
focusedStage0Tests: included in trading regression invocation due package script behavior
secretCheckChangedFiles: PASS
.env.localIgnored: PASS
diffCheck: PASS
quantsLabDiffCheck: PASS
```

No commit and no push were performed.
