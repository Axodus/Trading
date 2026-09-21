# 13 — Latency Measurement Model

## Timeline

```text
t_market_event
  -> t_market_received
  -> t_state_constructed
  -> t_proposal_created
  -> t_shadow_queued
  -> t_provider_start
  -> t_request_sent
  -> t_response_received
  -> t_response_validated
  -> t_shadow_persisted

baseline independently:
t_proposal_created -> Portfolio -> Risk -> Intent -> submission -> ACK -> fill
```

## Measures

- market transport = `received - event`;
- state construction = `state constructed - latest required observation received`;
- shadow queue = `provider start - shadow queued`;
- provider round trip = `response received - request sent`;
- local decision processing = validation and normalization time;
- shadow persistence = persisted minus validated;
- total shadow = persisted minus snapshot created;
- baseline Portfolio/Risk/intent/order/ACK/fill latencies from canonical timestamps where present.

Network and provider inference cannot be separated without trustworthy provider server timing. Report them as combined round trip otherwise.

## Reporting rules

- Record monotonic duration and wall-clock timestamps separately.
- Carry clock domain and skew status.
- Report sample count, timeout censoring and retry inclusion.
- p50/p95/p99 are reported only when the cohort is large enough to make the quantile meaningful.
- A retried request records attempt latencies and end-to-end latency; do not call the total “inference latency.”
- Compare provider response completion with proposal expiry, but never make baseline execution wait in SHADOW.

## Public claims

TypeSafe and public demos describe roughly sub-second or approximately 100 ms decisions. These are `VENDOR CLAIM` or `PUBLIC THIRD-PARTY CLAIM`, not Axodus end-to-end latency. Axodus must measure its own state construction, network, provider, authorities, exchange and fill path.
