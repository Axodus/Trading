# Trading Next Wave Boundaries

Status: ACTIVE PLANNING BOUNDARY

Date: 2026-05-23

## Purpose

Define what the next implementation wave may and may not do after the Phase 17A checkpoint.

## Strategic Direction

The next wave must follow:

```text
checkpoint/review
-> real local Postgres validation
-> WhiteRabbit paper operational scenario
-> reconciliation remediation request-only flow
-> Credential Vault threat model
-> deeper paper runtime only after gates are stable
```

The next wave must not jump to live trading.

---

## Allowed Next Work

### Local Postgres Operational Validation

Allowed:

- run `npm run trading:local:e2e`
- document expected output
- document local troubleshooting
- validate migration, seed, health, schema and replay
- improve diagnostics if validation reveals gaps

Forbidden:

- no production database
- no cloud database
- no Kubernetes job
- no production CI/CD claim

### WhiteRabbit Paper Operational Scenario

Allowed:

- create deterministic paper scenario
- exercise signal -> paper session -> normalized fills -> telemetry -> reconciliation dry-run -> controlled resume decision
- preserve tenant isolation
- use Trinity recommendations as advisory inputs

Forbidden:

- no live config
- no real exchange orders
- no production credentials
- no performance/yield claims
- no automatic controlled resume approval

### Reconciliation Remediation Workflow

Allowed:

- define request-only remediation lifecycle
- route approved ACS review into remediation request
- model runtime recovery request
- model provider resync review request
- model manual operator review request
- emit audit events

Forbidden:

- no auto-healing
- no provider mutation
- no order cancellation
- no position closure
- no direct exchange/Hummingbot action

### Credential Vault Threat Model

Allowed:

- compare KMS/HSM/Vault options
- document tenant/runtime/provider grant threat model
- define rotation and emergency revocation policy
- define audit retention expectations
- define production credential onboarding blockers

Forbidden:

- no real user credential onboarding
- no wallet signing
- no withdrawal permission support
- no provider-specific KMS implementation without explicit approval

### Hummingbot Paper Runtime Readiness

Allowed:

- define readiness checklist
- confirm paper-only connector compatibility
- confirm no DTO leakage
- confirm paper/session lifecycle boundaries

Forbidden:

- no live Hummingbot session
- no direct ACS to Hummingbot controls
- no strategy mutation through Hummingbot directly

---

## Required Gates Before Any Live Planning

Before live trading can even be planned, the following must be complete:

- checkpoint docs committed
- full unit/type/build validation passing
- local Postgres E2E passing
- WhiteRabbit paper operational scenario passing
- paper observability risk loop reviewed
- reconciliation remediation remains governed and request-only
- Credential Vault real backend threat model approved
- compliance and disclosure gates enforced
- no unresolved critical architecture findings

## Hard Non-goals

- live trading
- production exchange orders
- production credential onboarding
- autonomous execution
- public generic `/trading` dashboard
- direct ACS provider control
- direct Trinity provider control
- direct Hummingbot user controls
- auto-healing reconciliation
- profit, yield or performance claims

