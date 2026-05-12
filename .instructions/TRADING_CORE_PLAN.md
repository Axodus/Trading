# Trading Core Phase 0 Plan

# Purpose

Phase 0 establishes the sovereign architecture, product economy boundaries, shared contracts, and service scaffolding for Axodus Trading.

Phase 0 does not implement deep provider runtime logic.

---

# Architecture Commitments

- Trading is infrastructure, product, economy, and monetization.
- Hummingbot remains an execution runtime, not the sovereign core.
- Treasury Trading and User Trading share one core but use distinct execution-domain policies.
- Frontends, agents, and marketplaces do not call execution providers directly.
- Product entitlement never replaces governance, compliance, or risk validation.

---

# Phase 0 Outputs

- architecture documentation
- shared TypeScript contracts
- event taxonomy
- credential vault boundaries
- disclosure and risk acceptance boundaries
- `trading-core` and `trading-product` service scaffolds
- clear non-goals for Phase 1+

---

# Non-Goals

- no live Hummingbot orchestration
- no market connectivity implementation
- no billing provider selection
- no secrets storage implementation
- no runtime provisioning backend beyond service boundaries
