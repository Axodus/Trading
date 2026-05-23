# Trading Phase 5B - Compliance Runtime Enforcement and Disclosure Gate

Status: IMPLEMENTED

---

# Objective

Transform compliance and disclosure from passive contracts into active runtime gates.

No User Trading runtime provisioning, runtime resume, execution enablement, or provider activation may proceed without required disclosure acceptance.

---

# Delivered Services

Implemented:

- `ComplianceGate`
- `DisclosureAcceptanceService`
- `DisclosureRequirementEvaluator`
- `DisclosureVersionService`
- `RuntimeComplianceValidator`

---

# Disclosure Categories

Supported disclosure categories:

- non-custodial
- automation risk
- market risk
- leverage risk
- strategy-specific
- runtime/provider

---

# Enforcement Flow

```text
User Action
-> Disclosure Requirement Check
-> Acceptance Validation
-> Runtime Enablement Decision
-> Provisioning / Execution
```

---

# Runtime Enforcement

Missing, expired, or outdated disclosure acceptance blocks:

- runtime provisioning
- runtime resume
- execution enablement
- provider activation

Treasury execution bypasses the User Trading disclosure flow.

---

# Versioning

Disclosure validation enforces:

- exact disclosure version match
- expired acceptance detection
- invalidation after version update
- strategy/product/runtime targeted requirements

---

# Events

Phase 5B supports:

- `RISK_DISCLOSURE_REQUIRED`
- `RISK_DISCLOSURE_ACCEPTED`
- `RISK_DISCLOSURE_EXPIRED`
- `RISK_DISCLOSURE_MISSING`
- `RUNTIME_COMPLIANCE_REJECTED`

These events are compatible with the existing event persistence and audit trail.

---

# Non-goals

Phase 5B does not include:

- jurisdiction engine
- legal text delivery engine
- PDF/document generation
- frontend UI
- blockchain storage

Only normalized disclosure references are used.
