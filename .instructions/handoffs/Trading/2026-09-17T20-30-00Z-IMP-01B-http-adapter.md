# Global Coordination Handoff — Trading — IMP-01B

## Workspace

- `/opt/Axodus/Trading`

## Scope

- `AXODUS-TRADING-IMP-01B` minimal HTTP `ExecutionProvider` adapter against the frozen REQ-04 baseline

## Local status

- `COMPLETE / CTO REVIEW PENDING`
- local commit created; push remains held for CTO review

## Delivered

- Axodus-owned request mapping to Hummingbot `POST /trading/orders`
- response normalization into `ExecutionResult`
- typed upstream HTTP, timeout, transport and protocol failure mapping
- correlation and authorization-header propagation through injected boundary dependencies
- exact dependency-baseline enforcement
- unsupported order capabilities rejected before HTTP
- upstream client types remain confined to the adapter

## Validation

- `npm run typecheck`: PASS
- `npm test`: PASS, 4 test files / 4 suites / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS
- no credentials, exchange connectivity, orders or external operations used

## Records changed

- `trading-core/services/trading-core/src/execution/providers/hummingbot/HummingbotHttpExecutionProvider.ts`
- `trading-core/services/trading-core/src/index.ts`
- `trading-core/services/trading-core/test/imp-01b-http-adapter.test.mjs`
- `.instructions/TRADING_IMP_01_RESTRICTED_BASELINE_AUTHORIZATION.md`
- `.instructions/TASKS.md`
- `.instructions/ROADMAP.md`
- `.instructions/STATUS.md`
- `.instructions/VALIDATION.md`

## Dependencies

- REQ-04 current materialized baseline
- IMP-01A Axodus contracts and HTTP admission

## Blockers and risks

- `AXODUS-TRADING-BLOCKER-01` remains open: WebSocket is blocked and unused
- Condor remains outside the first execution path
- no live or paper execution is authorized

## Priority impact

- releases `IMP-01C` offline validation

## Requested portfolio action

- review and accept the IMP-01B commit; then continue to IMP-01C if accepted

## Preserved boundaries

- Axodus retains strategy, signal, judgment, risk, order intent, credentials, positions, portfolio, accounting and capital authority
- no upstream source, dependency revision or WebSocket path was changed
