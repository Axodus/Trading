# BUB_AGENTS.md

Operational guidance for using bub-agents inside the Trading workspace.

## Purpose

Bub-agents are advisory execution-support agents for planning, architecture review, security review, QA, documentation, and implementation analysis. They do not override the latest user instruction, this workspace `.instructions`, repository reality, security constraints, or Axodus architecture principles.

The Coding Execution Agent remains responsible for final decisions, edits, validation, commit, and report.

## Workspace Context

Workspace: `Trading`

Repository root: `/mnt/d/Rede/Github/Axodus/Trading`

Primary responsibility: trading product behavior, strategy metadata, execution intent references, treasury/risk context, telemetry correlation, and auditability.

## When To Use Bub-Agents

Use bub-agents for multi-file changes, trading architecture, strategy/risk logic, exchange/API integration, treasury-sensitive metadata, wallet/Web3 boundaries, test planning, documentation updates, or sprint-level execution.

Do not use bub-agents for typo fixes, simple text changes, trivial imports, isolated formatting, or obvious one-line fixes.

## Roles

- Planner: task decomposition, affected files, execution order, risks, acceptance criteria.
- Architect: strategy/execution/risk/reporting boundaries.
- Backend: services, API clients, adapters, validation, errors.
- Frontend: trading dashboard, strategy UI, risk states.
- Web3: wallet/contract boundaries if present.
- Security: exchange keys, treasury risk, secrets, unsafe execution.
- QA: strategy states, risk cases, regression and edge cases.
- Documentation: `.instructions`, README, decisions, workflow, readiness notes.

## Delegation Template

```md
# Bub-Agent Task
Role:
Workspace: Trading
Repository: /mnt/d/Rede/Github/Axodus/Trading
Task:
Relevant context:
Expected output:
- findings
- risks
- affected files
- recommended steps
- acceptance criteria
Constraints:
- Follow workspace `.instructions`.
- Separate signal, intent, approval, execution, settlement, and reporting.
- Mark uncertainty clearly.
```

## Workspace-Specific Rules

- Core does not execute trades, manage exchange APIs, or promise performance.
- Trading signal, strategy intent, approval, execution, settlement, and reporting must remain separate.
- Never invent exchange credentials, production strategy performance, APY, PnL, fills, balances, or contract addresses.
- Treasury-sensitive trading flows require explicit authority, policy, receipt, and risk metadata.
- Mock trading data must be clearly marked as mock.
- Any real exchange, wallet, treasury, or chain execution path is security-sensitive and requires explicit instruction plus review.
- Risk metadata and audit receipts should be preserved for execution-sensitive flows.

## Conflict Resolution

Resolve conflicts in this order: latest user instruction, workspace `.instructions`, repository architecture, security requirements, smallest safe change, maintainability, bub-agent recommendation.

If unresolved, stop and report the blocker.

## Final Report

State whether bub-agents were used, roles used, key findings, accepted recommendations, rejected recommendations, tests run, and remaining risks.

## Commit Behavior

When a sprint is completed, run practical validation, check `git status`, commit the completed sprint, and report the commit hash.

Recommended commit format: `trading: <short description>`

