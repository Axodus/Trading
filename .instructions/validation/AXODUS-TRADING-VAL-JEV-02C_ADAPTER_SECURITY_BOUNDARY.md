# AXODUS-TRADING-VAL-JEV-02C — Jev Adapter and Security Boundary

**Status:** PASS (live credential unavailable)

`JevDecisionProvider` is the only TypeSafe-aware boundary. It maps Axodus `NOUL`, `CHOICE` and `SCORE` questions to the HTTP API and validates answer types, domains, probability distributions, model identity and usage before producing a canonical shadow observation.

The adapter uses `POST https://api.typesafe.ai/v1/systemone`, Bearer authentication and the pinned `jev-1.13.0` cohort model. TypeSafe documents object state, typed question maps and a response containing resolved model, answers and usage in its [API reference](https://docs.typesafe.ai/api). The current [models page](https://docs.typesafe.ai/models) lists `jev-1.13.0`, `$0.042/M input tokens`, 64k request context and warns that aliases move.

Retries are disabled: every invocation has exactly one attempt. `429`, timeout, HTTP failure, malformed schema and absent credential become explicit shadow-only outcomes. No alternate AI provider is substituted.

Credential lookup accepts `TYPESAFE_API_KEY` as canonical and `TYPESAFE_AI_API_KEY` as a compatibility alias. Values are never logged, persisted or returned. `.env.local` remains ignored. Changed-file secret checks found no committed credential material.

Privacy boundary: only the documented allowlist leaves Axodus. TypeSafe states that customer requests/responses are not used for training; its [legal page](https://docs.typesafe.ai/legal) says retention is governed by linked agreements and that ZDR is available for enterprise customers. Actual retention for the current Axodus account, processing location, deletion guarantees and SLA remain UNKNOWN and must be resolved before campaign expansion.
