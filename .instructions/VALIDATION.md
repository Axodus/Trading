# Trading Validation

Last updated: 2026-06-08

## Known Commands

Root `package.json`: NOT_PRESENT

Known validation evidence is documented in Trading-specific runbooks, including:

- `.instructions/TRADING_REQUEST_03_LOCAL_E2E_ENVIRONMENT.md`
- `.instructions/TRADING_PHASE_17B_LOCAL_POSTGRES_E2E_RUNBOOK.md`

## PORTFOLIO-REQ-01 Validation Scope

Safe documentation checks:

- `.instructions/STATUS.md` exists.
- `.instructions/TRADING_MATURITY_ASSESSMENT.md` exists.
- no live trading, exchange execution, withdrawal, credential, treasury or production claim is introduced.

## Current Validation Status

Status: PASS

Current product validation includes the documented local E2E path.

PORTFOLIO-REQ-01 result:

- Root `package.json`: not present.
- Product validation commands were not run from root.
- No dependency installation was performed.

PORTFOLIO-REQ-02 commands:

```bash
cd trading-core/services/trading-core
npm run typecheck
npm test
```

PORTFOLIO-REQ-02 results:

- Typecheck: PASS
- Tests: PASS, 240 passed / 1 skipped
- Skipped: real local Postgres E2E test

Remaining validation:

- Production or staging validation remains forbidden until explicitly approved.

## TRADING-REQ-04 Local Postgres E2E

Command:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e -- --json --cleanup
```

Result: PASS

Summary:

- `ok: true`
- `status: passed`
- `environment: local`
- `cleanup: true`
- `mock: true`
- `simulationOnly: true`
- `liveTradingEnabled: false`
- `productionReady: false`

Passed steps:

- local safety validation
- docker compose up
- wait for postgres
- run migrations
- seed local data
- database health
- schema validation
- repository readiness and replay smoke
- docker compose down

Validation evidence:

- `.instructions/TRADING_E2E_REVALIDATION_EVIDENCE.md`
- `.instructions/reports/TRADING_REQ_04_SAFE_LOCAL_POSTGRES_E2E_REVALIDATION.md`

## AXODUS-TRADING-REQ-02 Documentation Audit

Result: COMPLETE / DOCUMENTATION VALIDATED / IMPLEMENTATION HOLD

Validation performed:

- Trading instructions, architecture, decisions, roadmap, tasks, security, risk, agent, runtime, implementation inventory and Hummingbot backend ownership records reviewed
- Trading Core Hummingbot adapter and selected nested backend API market-data/backtesting surfaces reviewed
- declared submodule state checked; Condor and Hummingbot API submodule source checkouts are absent in this working tree
- Core and Institutional authority terms checked for conflicting ownership statements
- System One REQ-01A–A4 records read for impact only; no research re-executed
- documentation diff checked with `git diff --check`

Findings:

- Hummingbot is canonical as an execution substrate behind Axodus `ExecutionProvider`
- Condor is now explicitly documented as a bounded external agent runtime/orchestration adapter
- Axodus retains strategy, signal, market judgment, risk, order intent, canonical state, portfolio, credentials, audit, accounting and capital authority
- candle/backtest and normalized event replay are present in evidence; historical L2/L3 microstructure replay is not
- REQ-01A–A4 conclusions remain unchanged except for boundary clarifications

Evidence:

- `.instructions/TRADING_REQ_02_CANONICAL_ARCHITECTURE_AUDIT.md`
