# Trading Phase 9B - Headless Trading API Boundary

Status: IMPLEMENTED

Date: 2026-05-21

## Objective

Expose the first governed service/controller API boundary for the headless Trading Core.

The API boundary is designed for ACS and product surfaces. It is not a public REST, GraphQL, websocket, or frontend route layer.

## Delivered Services

- `TradingApiGateway`
- `TradingReadApi`
- `TradingActionRequestApi`
- `TradingTelemetryApi`
- `TradingRuntimeInspectionApi`

## Delivered Contracts

Added under `trading-contracts/src/api/types.ts`:
- `TradingApiRequest`
- `TradingApiResponse`
- `TradingActionRequest`
- `TradingReadModel`
- `TradingRuntimeSnapshot`
- `TradingTelemetrySnapshot`

## Supported API Categories

Read APIs:
- runtime status
- provider status
- telemetry summaries
- entitlement placeholder state
- quota placeholder state
- strategy state
- runtime lifecycle
- recommendation summaries

Action request APIs:
- request runtime provisioning
- request runtime pause
- request runtime stop
- request simulation
- request backtest
- request strategy activation
- request disclosure acceptance

Runtime inspection:
- normalized runtime state
- normalized runtime telemetry
- event metadata only

Telemetry:
- normalized event counts
- recommendation count
- runtime event count
- latest event timestamp

## Boundary Rules

API layer must not:
- call providers directly
- expose raw execution authority
- expose secrets
- expose provider DTOs
- bypass runtime gates
- become source of truth

Action requests are translated into ACS commands. ACS then enters Trading Core pipelines and gates.

## Non-goals

- no public REST server
- no GraphQL server
- no websocket server
- no external auth provider
- no frontend routes
- no direct provider execution

## Test Coverage

Implemented tests for:
- API cannot bypass Trading Core or ACS
- API cannot call providers directly
- runtime snapshots exclude secrets and provider DTO payloads
- action requests preserve tenant context
- telemetry responses are normalized
- treasury/user telemetry reads remain separated
