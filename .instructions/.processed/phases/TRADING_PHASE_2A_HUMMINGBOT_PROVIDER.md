# Trading Phase 2A - Hummingbot Provider Adapter Foundation

# Purpose

Phase 2A introduces Hummingbot as the first real execution provider adapter while preserving Axodus sovereignty.

Hummingbot is:
- execution runtime
- provider adapter backend
- worker engine

Hummingbot is not:
- source of truth
- governance authority
- risk authority
- treasury authority
- product access authority

---

# Boundary Model

```text
TradingCore
-> ExecutionProviderRegistry
-> HummingbotProvider
-> HummingbotRuntime
-> Hummingbot Runtime/API
```

No Hummingbot DTO may cross the adapter boundary.

The public contract remains the Axodus `ExecutionProvider` interface and normalized Axodus execution types.

---

# Runtime Lifecycle

The adapter owns:
- provider registration
- runtime health checks
- connector discovery
- paper trading support
- emergency shutdown propagation

Health states normalize into:
- healthy
- degraded
- offline

Health and connector changes emit provider telemetry events.

---

# Normalization Strategy

Adapter files normalize Hummingbot-shaped data into Axodus contracts:
- order result
- fills
- balances
- positions
- runtime health
- connector state

Normalization occurs inside:
- `HummingbotTelemetryAdapter`
- `HummingbotConfigMapper`
- `HummingbotRuntime`

All strategy, governance, risk, product, and treasury decisions remain upstream of the provider.

---

# Non-Goals

- no deep Hummingbot strategy migration
- no WhiteRabbit migration
- no frontend runtime controls
- no direct agent access to Hummingbot
- no production Hummingbot API credentials
- no real exchange execution
