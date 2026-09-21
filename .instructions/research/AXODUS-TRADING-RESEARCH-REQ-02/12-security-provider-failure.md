# 12 — Security & Provider Failure Analysis

## Trust boundary

Jev is an external untrusted decision provider. Input fields and typed output are validated; neither is authority.

## Threats and controls

| Risk | Control |
| --- | --- |
| Prompt/state injection through news, metadata or agent text | allowlist structured fields; mark untrusted text; atomic questions; never place provider output in authority instructions |
| Malformed/extra response fields | strict schema and option allowlist; reject unknown enums, NaN/infinite values and malformed distributions |
| Stale/substituted response | bind request ID, snapshot digest, model, question revision and deadline; discard late/mismatched results |
| Replay/duplicate | durable idempotency and unique input identity; duplicate response produces one shadow effect |
| Correlation error | bind strategy/revision, MarketState, proposal, environment, correlation and causation IDs |
| Secret leakage | separate Jev secret; never serialize auth headers; no exchange keys, customer credentials or private keys in state/logs |
| Sensitive market/state retention | data minimization; legal/DPA review; explicit retention policy; enterprise ZDR assessment before broader use |
| Model alias drift | pin version and record resolved model; new model creates new cohort |
| Provider compromise/outage | circuit breaker isolated to shadow worker; baseline pipeline has no runtime dependency |
| Excessive retries/cost | explicit per-call deadline, attempt cap and budget counters; no hidden SDK defaults in characterization |

## Failure model

| Failure | Shadow result | Baseline effect |
| --- | --- | --- |
| timeout/extreme latency | `TIMEOUT` or `STALE` | none |
| 429/rate limit | `RATE_LIMITED`; optional separately measured retry policy | none |
| HTTP/connection/provider outage | `PROVIDER_ERROR` | none |
| invalid schema/missing probability/unexpected enum | `INVALID_SCHEMA` | none |
| version mismatch | invalid or quarantined cohort | none |
| duplicate response | deduplicated and audited | none |
| response after snapshot expiry | `STALE` | none |

No fallback provider is allowed inside the Jev experimental cohort. Provider errors remain visible and count against operational readiness.

## Credential boundary

- Jev credential is injected only into the adapter runtime.
- Jev runtime has no exchange provider client or signing library requirement.
- No production credential is authorized.
- Logs and artifacts contain only redacted configuration names and safe provider metadata.

## Open contractual security questions

Ordinary-plan retention duration, subprocessors/regions, incident terms, SLA and enterprise ZDR terms require review of binding legal documents before an implementation handles material proprietary state.
