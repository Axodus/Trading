# AXODUS-TRADING-VAL-03 — Hummingbot Runtime & CEX Provider Integration Acceptance

Date: 2026-09-18

Status: `IN PROGRESS / FULL CONTROLLED RUNTIME EVIDENCE / CTO REVIEW PENDING`

Classification: `PARTIAL / ORDER HISTORY LIMITATION PENDING`

## Scope

This gate validates the materialized Hummingbot API/client surface and the Axodus integration in a controlled local environment before any paper, shadow or live provider activity. It does not change the dependency baseline, upstream repositories, connector semantics or security boundary.

## Controlled environment

- Python 3.12.14 isolated environment;
- FastAPI, Pydantic, HTTPX, aiohttp, SQLAlchemy and API runtime dependencies installed only in the isolated environment;
- `hummingbot==20260901` installed only as a temporary runtime-validation package;
- the PyPI Hummingbot package is not an Axodus baseline selection;
- no credentials, exchange connectivity, orders, WebSocket, Condor, DEX or capital used.

## Evidence accepted so far

| Surface | Result | Evidence |
| --- | --- | --- |
| Hummingbot Core import/compatibility | PASS | `test_core_compatibility.py`: 5/5 |
| Hummingbot API client static contract | PASS | `test_calls_match_api_spec.py`: 337/337 |
| API order synchronization with materialized Core | PASS | `test_order_sync_batches_queries.py`: 6/6 |
| API reconciliation batching with materialized Core | PASS | `test_reconcile_batches_queries.py`: 7/7 |
| Axodus TypeScript regression | PASS | typecheck, build, 10/10 test files |
| API history pagination service test | NOT ACCEPTED | exceeded a 30-second controlled timeout |
| Full application lifespan + PostgreSQL + Core + controlled connector | PASS | `.instructions/validation/val03_full_runtime.py`; real lifespan, local PostgreSQL and controlled connector |
| Runtime submission, lookup and cancellation | PASS | exercised through the real lifespan and service wiring |
| Restart persistence | PASS | second service instance recovered the order from PostgreSQL |
| Deterministic shutdown/cleanup | PASS | temporary PostgreSQL instance and application lifespan cleaned up |
| Full API service runtime | PASS WITH LIMITATION | order-history endpoint remains separately unaccepted after finite timeout |

The isolated runtime proves useful Core imports and deterministic API service behavior for the tested surfaces. The full controlled harness now also proves the real application lifespan, PostgreSQL wiring, Core initialization in-process and the controlled connector path without external exchange access.

## Controlled harness result — 2026-09-18

The bounded harness at `.instructions/validation/val03_controlled_runtime.py` exercised the real FastAPI application, routing, Pydantic request/response models and HTTP boundary through ASGI transport. Authentication, provider services and persistence were dependency-overridden with asynchronous controlled fakes so the test did not enter the application lifespan or external infrastructure.

Results: health, submission identity preservation, exact lookup, cancellation, malformed identity rejection before provider invocation, provider rejection, transport failure normalization, no automatic duplicate submission after transport ambiguity, and service reconstruction over the same controlled local store all passed. WebSocket was not used.

The service validation handler required a minimal runtime fix because Pydantic 2 can place a `ValueError` in `ctx`, which the previous JSON response path could not serialize. The fix only normalizes exception values in validation responses and does not change trading semantics or security boundaries.

## Full controlled runtime harness — 2026-09-18

`.instructions/validation/val03_full_runtime.py` started a temporary local PostgreSQL instance and exercised two successive `main.app.router.lifespan_context(...)` instances through the real FastAPI application. The harness used controlled security, gateway, orchestration and connector implementations only where the service would otherwise require Docker, MQTT, Gateway or exchange access; the real application lifespan, database manager, service construction, Hummingbot Core import/initialization, routing and repository path remained active.

Results:

| Surface | Result |
| --- | --- |
| Application startup/shutdown | PASS |
| PostgreSQL connection, schema and repository path | PASS |
| Hummingbot Core import/initialization inside the service process | PASS |
| Submission → exact lookup → cancellation | PASS |
| `executionClientOrderId` preservation | PASS |
| Restart visibility through a new service instance | PASS |
| 503/504/failure normalization | PASS in the controlled HTTP path; prior harness evidence retained |
| WebSocket dependency | PASS — not used or reachable |
| Deterministic cleanup | PASS |

No credentials, exchange connectivity, external orders, capital or paper/shadow execution were used. The isolated `hummingbot==20260901` package remains validation-only and does not change `HUMMINGBOT_BASELINE_V1`.

## Remaining evidence

1. The order history cursor test remains `NOT ACCEPTED` after exceeding the finite 30-second timeout; the timeout was not hidden by increasing the limit.
2. The controlled harness does not qualify real venue behavior, credentials, WebSocket behavior or the frozen dependency baseline.

Source inspection shows that order history is a historical search/reporting capability and is not used by the exercised submission, exact reconciliation, cancellation or crash-recovery paths. It is therefore proposed as a documented non-critical limitation, subject to CTO review rather than being silently promoted to PASS.

## Preserved boundaries

This gate does not authorize credentials, exchange connectivity, real or paper orders, WebSocket correctness, Condor, DEX reconciliation, production activity, System One or capital authority. The temporary `hummingbot==20260901` package must not be promoted to the Axodus dependency baseline without a separate qualification decision.

## Current decision

`VAL-03` remains `IN PROGRESS / PARTIAL / FULL CONTROLLED RUNTIME PASS WITH DOCUMENTED NON-CRITICAL ORDER HISTORY LIMITATION CANDIDATE`. The controlled service/runtime path is validated; final acceptance remains with CTO review of the isolated order-history limitation. Prior milestones remain accepted. External provider execution remains on hold.
