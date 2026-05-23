# Trading Next Phase Boundaries

Status: REVIEW CHECKPOINT

Date: 2026-05-23

## Purpose

Define what the next implementation wave may and may not do after the Phase 15A checkpoint.

## Immediate Next Phase

### Phase 14C - WhiteRabbit Paper Validation Workflow

Allowed:

- connect WhiteRabbit runtime engine to `PaperTradingSessionService`
- create strategy-specific paper validation request/decision models
- summarize paper telemetry for WhiteRabbit
- use reconciliation dry-run results as evidence
- produce controlled resume eligibility decisions
- let Trinity recommendations feed review workflows without direct mutation

Forbidden:

- no live trading
- no real exchange orders
- no production API keys
- no direct Hummingbot control from product surface
- no autonomous runtime mutation
- no profit/yield claims

## Reconciliation Follow-up Boundary

Allowed:

- create ACS review commands for reconciliation proposals
- persist approval/rejection decisions
- route remediation requests through ACS/Governance/Risk

Forbidden:

- no auto-healing
- no automatic order cancellation
- no automatic position correction
- no direct provider mutation

## Paper Observability Risk Boundary

Allowed:

- convert paper telemetry into observability risk signals
- recommend simulation retry, backtest, pause, controlled resume or telemetry review
- preserve tenant/correlation context

Forbidden:

- no direct risk mutation from telemetry alone
- no automatic provider block
- no automatic strategy pause
- no live execution gating based only on paper telemetry

## Local Postgres CI Boundary

Allowed:

- create an explicit local E2E command
- start local docker compose Postgres
- run migrations
- seed mock data
- run repository readiness
- replay persisted events
- teardown/reset local-only DB

Forbidden:

- no production DB
- no cloud deployment
- no Kubernetes job
- no secrets manager
- no live trading

## Credential Vault Boundary

Allowed:

- run adapter selection spike
- define KMS/HSM threat model
- compare provider options
- define key rotation and emergency revocation policy

Forbidden:

- no production secret onboarding yet
- no real user exchange credentials
- no wallet signing
- no withdrawal permission support

## Commit Boundary Recommendation

Before implementing the next phase, create a review checkpoint.

Recommended order:

1. Commit documentation/checkpoint files.
2. Commit local Postgres E2E changes.
3. Commit observability risk changes.
4. Commit reconciliation worker changes.
5. Commit credential vault adapter changes.
6. Commit paper trading session changes.
7. Commit consolidated tests.

If a single commit is required operationally, use a clear checkpoint message:

```text
checkpoint(trading): freeze paper-ready core infrastructure
```
