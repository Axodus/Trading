# Trading Compliance Model

# Non-Custodial Disclosure Boundary

User Trading must support explicit disclosure and acceptance checks before runtime provisioning or execution enablement.

---

# Disclosure Coverage

- non-custodial model
- automation risk
- market risk
- leverage risk
- strategy-specific risk

---

# Required Properties

- versioned disclosures
- auditable acceptance events
- requirement targeting by product or runtime flow
- explicit missing-acceptance detection

Phase 0 defines contracts and event language only. It does not implement legal text delivery or jurisdiction-specific policy engines.

---

# Phase 5B Operational Gate

Compliance is now an operational runtime gate for User Trading.

Implemented services:
- `ComplianceGate`
- `DisclosureAcceptanceService`
- `DisclosureRequirementEvaluator`
- `DisclosureVersionService`
- `RuntimeComplianceValidator`

Runtime provisioning, runtime resume, execution enablement, and provider activation require valid disclosure acceptance.

Disclosure validation enforces:
- required disclosure targeting
- exact version match
- expiration checks
- missing acceptance detection
- audit events for required, accepted, expired, missing, and rejected compliance decisions

Treasury execution bypasses this user disclosure flow.
