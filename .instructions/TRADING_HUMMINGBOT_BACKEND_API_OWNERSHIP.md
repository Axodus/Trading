# Hummingbot Backend API Ownership

Date: 2026-09-07  
Status: LEGACY / PROTECTED / NON-EXECUTIVE

## Scope

`Trading/backend-api` is the Axodus fork of the upstream
`hummingbot/backend-api` project. It is a separate nested Git repository and
must retain its own history, remotes, branches, and local working state.

## Ownership

| Role | Responsible scope |
| --- | --- |
| Primary nucleus owner | Trading |
| Supporting nucleus | ACS, for bounded orchestration and policy integration only |
| Upstream project | Hummingbot Foundation / `hummingbot/backend-api` |
| Local repository | `Axodus/backend-api` |

## Function

The repository exposes a Python/FastAPI control surface for Hummingbot
instances. Its historical code covers container lifecycle control, bot
configuration, account and connector configuration, broker messaging,
backtesting, market-data access, performance data, archival, and local
database handling.

## Boundary

This relocation is organizational only. It does not activate the service,
authorize Hummingbot runtime calls, permit exchange credentials, enable paper
or live trading, authorize withdrawals, or change any execution authority.

The checkout contains historical local state and potentially sensitive
configuration paths. Do not inspect, publish, move outside this protected
checkout, commit, push, run, or connect it without a dedicated Trading request
and the approvals required by the global and Trading safety boundaries.

## Repository Handling

- `Trading/backend-api` is intentionally ignored by the parent Trading Git
  repository.
- Run Git commands for this project from `Trading/backend-api`.
- Keep changes, validation, and any future upstream synchronization isolated
  to the nested repository.
- Treat the path as a legacy protected dependency until a current Trading owner
  accepts a scoped modernization, retirement, or integration request.
