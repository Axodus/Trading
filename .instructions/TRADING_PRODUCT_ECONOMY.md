# Trading Product Economy

# Product Thesis

Axodus Trading sells access to infrastructure, automation, intelligence, and governed runtime tooling.

It does not sell detached trading signals as the system primitive.

Trading Core itself is not the public product surface. It is the headless infrastructure behind strategy products, marketplace listings, ACS workflows, DAO tenant operations, and domain-specific Axodus surfaces.

---

# Product Domains

- strategy products
- marketplace publication
- access tiers
- user runtime instances
- entitlements
- telemetry upgrades
- token utility

---

# Strategy Products

Each commercial strategy product must describe:
- visibility
- monetization mode
- supported providers
- runtime limits
- access policy
- lifecycle status

WhiteRabbit becomes both a strategy engine candidate and a future strategy product.

WhiteRabbit is the first UI-accessible Strategy Product. User-facing WhiteRabbit interactions should appear through the WhiteRabbit product surface, Marketplace, ACS tenant console, or contextual DeFi/DEX/Governance flows, not through a generic public Trading dashboard.

---

# Product Surface Rule

Allowed user-facing surfaces:
- WhiteRabbit strategy product pages
- Marketplace listings
- DeFi contextual execution products
- DEX contextual execution products
- Academy onboarding flows
- Governance local tenant pages
- ACS tenant consoles

Non-goal:
- generic public `/trading` section in AxodusAPP
- direct Hummingbot controls
- direct provider control panels
- frontend authority over execution, risk, treasury, or governance

---

# Initial Product Surface

WhiteRabbit is the first and only initial user-facing Trading product surface.

WhiteRabbit may be embedded later in:
- Marketplace
- DeFi
- DEX
- Academy
- Tenant DAO pages
- ACS tenant consoles

Trading Core remains headless. Product surfaces consume normalized read models and submit governed requests; they do not become execution authorities.

WhiteRabbit product views must expose:
- access state
- entitlement state
- token gate state
- subscription compatibility
- required disclosures
- credential binding status
- runtime status
- quota usage
- risk status
- telemetry summary

WhiteRabbit product views must not expose:
- secrets
- provider DTOs
- direct Hummingbot controls
- direct provider calls
- strategy internals mutation

---

# Economic Clarification

Free or no-commission strategies may still create revenue or token utility through:
- token gating
- staking requirements
- subscription access
- premium telemetry tiers
- marketplace upgrades
- runtime quotas
- access tier progression
- bundled premium infrastructure
# WhiteRabbit Product Surface API

WhiteRabbit is exposed as a Strategy Product surface, not as a generic Trading dashboard.

The surface may be embedded by:
- Marketplace
- DeFi
- DEX
- Academy
- Governance local pages
- ACS

It exposes normalized product state, access state, quota, telemetry, disclosure, credential binding, provider compatibility, and simulation/paper readiness.

Actions are request-only and must route through ACS and Trading Core gates.

The surface must not expose provider DTOs, secrets, raw runtime commands, direct strategy mutation, or direct Hummingbot controls.

---
