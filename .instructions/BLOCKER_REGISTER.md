# Trading Blocker Register

Last updated: 2026-06-08

## TRADING-BLOCKER-001 - Live Trading Blocked

Severity: CRITICAL

Status: OPEN

Description: Live trading, real CEX execution and withdrawals are not approved.

Impact: Trading remains local/paper-planning only.

Resolution path: Require governance, risk, compliance, audit and operator approval before any execution track.

## TRADING-BLOCKER-002 - Production Credentials Blocked

Severity: CRITICAL

Status: OPEN

Description: Production exchange keys, secrets, Credential Vault/KMS/HSM runtime and withdrawal authority are not approved.

Impact: No production exchange integration can be enabled.

Resolution path: Complete Credential Vault decisioning and secret-management approval.

## TRADING-BLOCKER-003 - Current Validation Refresh Required

Severity: MEDIUM

Status: RESOLVED

Description: Historical local E2E evidence exists, but current validation was not rerun in PORTFOLIO-REQ-01.

Impact: Resolved for local durable persistence/readiness evidence.

Resolution path: TRADING-REQ-04 ran `npm run trading:local:e2e -- --json --cleanup` successfully against local Postgres.

## TRADING-BLOCKER-004 - Root Package Boundary

Severity: LOW

Status: ACTIVE

Description: The Trading root workspace does not expose a root `package.json`. Validation commands are nested under `trading-core/services/trading-core`.

Impact: Operators must run validation from the documented nested service path.

Resolution path: Keep documented nested validation path, or create a root orchestration script only through a separate approved non-product request.

## PORTFOLIO-REQ-02 Blocker Review

| Blocker | Status |
|---|---|
| Live trading blocked | ACTIVE |
| Production credentials blocked | ACTIVE |
| Current validation refresh required | RESOLVED |
| Root `package.json` absent | ACTIVE |
| Real local Postgres E2E not executed | RESOLVED |

## TRADING-REQ-04 Blocker Review

| Blocker | Status |
|---|---|
| Live trading blocked | ACTIVE |
| Production credentials blocked | ACTIVE |
| Current validation refresh required | RESOLVED |
| Root `package.json` absent | ACTIVE |
| Real local Postgres E2E not executed | RESOLVED |
| Production database execution blocked | ACTIVE |
| Treasury movement blocked | ACTIVE |
