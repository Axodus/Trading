# Trading Phase 4B - WhiteRabbit Product Surface Contract

Status: IMPLEMENTED

---

# Objective

Define WhiteRabbit as the only initial user-facing Trading product surface while keeping Trading Core headless.

WhiteRabbit is prepared for later embedding inside Marketplace, DeFi, DEX, Academy, Tenant DAO pages, or ACS tenant consoles.

No frontend implementation is included.

---

# Read Models

Phase 4B adds normalized WhiteRabbit read models:

- `WhiteRabbitProductView`
- `WhiteRabbitAccessView`
- `WhiteRabbitRuntimeView`
- `WhiteRabbitRiskView`
- `WhiteRabbitTelemetryView`
- `WhiteRabbitDisclosureView`
- `WhiteRabbitCredentialBindingView`

These models expose product status, access status, entitlement state, token gate status, tier compatibility, required disclosures, credential binding status, runtime status, quota usage, risk status, pause/stop availability, and telemetry summary.

---

# Allowed User Actions

WhiteRabbit product surfaces may model:

- request access
- accept disclosure
- bind credential reference
- provision runtime
- pause runtime
- stop runtime
- view telemetry
- view quota usage

All actions remain requests into Trading Core or product workflows.

---

# Forbidden User Actions

WhiteRabbit product surfaces must not allow users to:

- call provider
- call Hummingbot
- bypass risk
- bypass compliance
- bypass product entitlement
- override treasury policies
- mutate strategy internals directly

---

# Safe Surface Rule

WhiteRabbit read models expose only safe normalized state.

They must not expose:

- CEX API secrets
- wallet secret material
- raw Hummingbot DTOs
- raw provider order DTOs
- runtime isolation internals
- direct provider controls

---

# Risk and Compliance Language

The product contract keeps non-custodial and automation risk language visible.

Runtime enablement is blocked when:

- required disclosures are missing
- credential binding is missing or inactive
- entitlement is invalid
- token/subscription access is incompatible
- quotas are exhausted

---

# Non-goals

Phase 4B does not include:

- frontend UI
- real credential vault
- real exchange connection
- billing provider integration
- Hummingbot strategy migration
- profit or yield claims
