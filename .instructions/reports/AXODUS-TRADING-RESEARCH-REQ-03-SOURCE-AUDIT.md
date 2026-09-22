# REQ-03 Source Audit

Date: 2026-09-22
Status: research-only / CTO review required

## Verified official-source observations

- Anthropic's official model-deprecation documentation lists `claude-3-5-haiku-20241022` as retired on February 19, 2026. It cannot be selected as a future live benchmark reference without an explicit historical-only designation.
- Anthropic's official pricing documentation is model-specific and includes current, cache, batch, and lifecycle-sensitive pricing.
- Google's official Gemini pricing documentation is model-specific and includes time-bounded introductory and future standard rates.

## Not verified for authorization

- TypeSafe/Jev current public price and retention terms.
- Current OpenAI reference model and price for the eventual benchmark.
- Current Anthropic replacement model and price.
- Provider latency distributions.
- Enterprise ZDR contractual scope.

## Required before IMP-03A live-provider selection

1. Snapshot official provider/model pages with access date.
2. Pin active model IDs and reject deprecated aliases.
3. Record input/output/cache/batch price dimensions.
4. Record privacy and retention evidence separately from marketing claims.
5. Keep all economic projections labeled as assumptions until observed token usage exists.
