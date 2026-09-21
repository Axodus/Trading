# Repository Guidelines

## Project Structure & Module Organization

The primary implementation lives under `trading-core/`. Shared TypeScript contracts are in `trading-core/packages/trading-contracts/src`, while the main service is in `trading-core/services/trading-core/src`; its Node tests are in `test/`. The Python FastAPI service is under `backend-api/`, organized into `routers/`, `services/`, and `utils/`. Root-level `condor/`, `hummingbot-api/`, `mcp/`, `quants-lab/`, and `tradingbot/` are Git submodules. Operational decisions, runbooks, risks, and validation evidence belong in `.instructions/`. Generated `dist/` and `dist-test/` content should not be edited directly.

## Build, Test, and Development Commands

Run TypeScript commands from `trading-core/services/trading-core`:

- `npm run build` compiles the service and shared contracts.
- `npm run typecheck` performs strict type checking without emitting files.
- `npm test` runs the classified SAFE graph through `npm run test:safe`; it must not reach external exchange mutation. Mutation-capable Testnet acceptance uses an explicit command and runtime opt-in.
- `npm run trading:local:e2e -- --json --cleanup` runs the documented simulation-only PostgreSQL workflow.

For `backend-api/`, use `make install` to create the Conda environment, `make run` to start Uvicorn with reload, and `docker compose up --build` for the containerized stack. Initialize linked repositories with `git submodule update --init --recursive`.

## Coding Style & Naming Conventions

TypeScript uses ES modules, strict compiler settings, two-space indentation, `PascalCase` for classes/types, and `camelCase` for methods and variables. Keep domain code in its matching folder and include `.js` in relative TypeScript imports. Python uses four-space indentation and `snake_case`; format with Black and isort at a 130-character line length, then run flake8 or `pre-commit run --all-files`.

## Testing Guidelines

Name Node tests `*.test.mjs`. Add focused tests beside the service test suite for behavior changes, and run typecheck plus tests before submitting. PostgreSQL-dependent coverage must use the local E2E runbook; do not imply production readiness from simulation results. The Python backend currently has no dedicated automated test suite, so document manual API checks when changing it.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit subjects such as `feat(trading): ...` and requirement prefixes such as `TRADING-REQ-04: ...`. Keep commits scoped and imperative. Pull requests should explain behavior, risk and treasury impact, list validation commands/results, link the requirement or issue, and update relevant `.instructions/` architecture, roadmap, decision, or validation records. Include screenshots only for visible UI changes.

## Security & Configuration

Copy settings from `.env.example`; never commit credentials, wallet keys, exchange secrets, or generated bot data. Preserve governance, risk, telemetry, and accounting gates. Treat local and paper execution as the default unless production activity is explicitly authorized. Before executing a previously unclassified test command, inspect its package script, runner, and test-discovery path for external mutation capability. Never infer execution authorization from available credentials. Mutation-capable acceptance tests require explicit task authorization plus repository runtime gates.

## AXODUS_WORKSPACE_COORDINATION

This workspace is part of the federated Axodus portfolio. Read the root
[`AGENTS.md`](../AGENTS.md) and the
[Agent Coordination Protocol](../.instructions/AGENT_COORDINATION_PROTOCOL.md) before starting work.

Keep this file's local rules authoritative for this repository. For every
completed or materially blocked task, provide the required **Global Coordination
Handoff**: workspace, scope, local status, validation, local records changed,
dependencies, blockers or risks, priority impact, requested portfolio action,
and preserved boundaries.

Update this repository's existing local status, roadmap, task, validation,
blocker, or report records when the authorized task requires it. Do not edit
root portfolio records directly; the root Axodus orchestrator consolidates
validated handoffs into global status, priorities, blockers, dependencies, and
reports.
