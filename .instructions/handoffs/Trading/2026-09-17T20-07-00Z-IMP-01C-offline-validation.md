# Global Coordination Handoff — Trading — IMP-01C

## Workspace

- `/opt/Axodus/Trading`

## Scope

- `AXODUS-TRADING-IMP-01C` offline contract and adversarial integration validation for the restricted HTTP execution boundary

## Local status

- `COMPLETE / CTO REVIEW PENDING`
- local commit created; push remains held for CTO review

## Delivered

- serialized Axodus request and representative Hummingbot response validation
- deterministic success normalization and malformed-response rejection
- HTTP 4xx/5xx mapping to typed Axodus failures
- timeout and transport failure mapping to `PROVIDER_EXECUTION_UNKNOWN` with no blind retry
- correlation propagation and authorization-header injection boundary validation
- dependency drift and forbidden-capability rejection before HTTP
- confirmation that upstream fields, DTOs and exceptions do not cross into Trading Core callers
- confirmation that WebSocket is unreachable from the execution path

## Validation

- `npm run typecheck`: PASS
- `npm test`: PASS, 4 test files / 4 suites / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS
- Hummingbot API Client `test/test_calls_match_api_spec.py`: PASS, 337 tests
- no credentials, exchange connectivity, orders, collector or external operations used

## Records changed

- `trading-core/packages/trading-contracts/src/execution/axodus.ts`
- `trading-core/services/trading-core/src/execution/providers/hummingbot/HummingbotHttpExecutionProvider.ts`
- `trading-core/services/trading-core/test/imp-01b-http-adapter.test.mjs`
- `.instructions/TRADING_IMP_01_RESTRICTED_BASELINE_AUTHORIZATION.md`
- `.instructions/TASKS.md`
- `.instructions/ROADMAP.md`
- `.instructions/STATUS.md`
- `.instructions/README.md`
- `.instructions/VALIDATION.md`

## Dependencies

- REQ-04 current materialized baseline
- IMP-01A Axodus contracts and HTTP admission
- IMP-01B minimal Hummingbot HTTP adapter

## Blockers and risks

- `AXODUS-TRADING-BLOCKER-01` remains open: WebSocket is blocked and unused
- a transport failure after submission leaves execution state unknown; callers must not blindly retry
- Condor remains outside the first execution path
- no live or paper execution is authorized

## Priority impact

- releases `IMP-01D` consideration only after an explicitly admitted market-data transport
- establishes offline evidence for the first restricted execution path

## Requested portfolio action

- review and accept the IMP-01C commit; preserve `IMP-01D` as conditional and keep BLOCKER-01 open

## Preserved boundaries

- Axodus retains strategy, signal, judgment, risk, order intent, credentials, positions, portfolio, accounting and capital authority
- no upstream source, dependency revision, WebSocket path, Condor integration or operational trading path was changed
