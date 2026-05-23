# Trading Phase 9C - WhiteRabbit Product Surface API

Status: IMPLEMENTED

Date: 2026-05-21

## Objective

Expose WhiteRabbit as the first consumable Strategy Product surface for Marketplace, DeFi, DEX, Academy, Governance local pages, and ACS.

WhiteRabbit is a platform product endpoint, not a generic trading dashboard.

## Delivered Services

- `WhiteRabbitSurfaceApi`
- `WhiteRabbitQueryService`
- `WhiteRabbitActionRequestService`
- `WhiteRabbitTelemetrySummaryService`
- `WhiteRabbitQuotaViewService`

## Delivered Models

Added WhiteRabbit product surface API models:
- `WhiteRabbitSurfaceResponse`
- `WhiteRabbitProvisioningRequest`
- `WhiteRabbitTelemetrySummary`
- `WhiteRabbitQuotaView`
- `WhiteRabbitRuntimeSurfaceView`
- `WhiteRabbitActionRequest`

## Supported Read Models

WhiteRabbit surface exposes:
- access state
- runtime state
- entitlement state
- quota usage
- telemetry summary
- runtime lifecycle
- disclosure status
- credential binding state
- provider compatibility
- simulation/paper readiness

## Supported Actions

Request-only:
- request access
- request provisioning
- request runtime pause
- request runtime stop
- request simulation
- request telemetry export

Actions route into the headless Trading API/ACS request boundary.

## Boundary Rules

WhiteRabbit surface must not:
- expose provider DTOs
- expose credentials
- expose raw runtime commands
- mutate strategies directly
- bypass ACS
- bypass Trading Core gates
- call Hummingbot directly

## Non-goals

- no public marketplace implementation
- no copy trading
- no live trading enablement
- no frontend implementation
- no direct Hummingbot interaction

## Test Coverage

Implemented tests for:
- normalized state only
- invalid entitlement blocks action request
- runtime status remains tenant-scoped
- telemetry excludes sensitive information
- user actions generate action requests only
