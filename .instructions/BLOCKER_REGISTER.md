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

Status: UNKNOWN

Description: Historical local E2E evidence exists, but current validation was not rerun in PORTFOLIO-REQ-01.

Impact: Maturity remains L3 candidate.

Resolution path: PORTFOLIO-REQ-02 ran nested Trading Core typecheck and tests successfully, but the real local Postgres E2E test remains skipped. Run `npm run trading:local:e2e` in a dedicated Trading request.

## PORTFOLIO-REQ-02 Blocker Review

| Blocker | Status |
|---|---|
| Live trading blocked | ACTIVE |
| Production credentials blocked | ACTIVE |
| Current validation refresh required | UNKNOWN |
| Root `package.json` absent | ACTIVE |
| Real local Postgres E2E not executed | ACTIVE |
