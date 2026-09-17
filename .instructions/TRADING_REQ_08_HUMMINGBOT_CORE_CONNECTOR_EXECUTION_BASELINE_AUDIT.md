# AXODUS-TRADING-REQ-08 — Hummingbot Core & Connector Execution Baseline Audit

## Status

`CORE BASELINE UNRESOLVED`

REQ-08 is complete as an evidence audit with the Core-dependent phases blocked. The
materialized `hummingbot-api` source does not identify a reproducible Hummingbot Core
revision, package version, image digest or source checkout. Connector-level order-ID
claims therefore remain unverified. No upstream source or runtime was modified.

## Repositories verified

| Repository | Trading gitlink | Checked out | Remote origin | State | Metadata |
| --- | --- | --- | --- | --- | --- |
| `condor` | `d89e74f2e3e273bea102c64e4977118e6a88084f` | same SHA | `https://github.com/Axodus/condor` | clean, `heads/main` | package `condor` `0.1.0`, MIT |
| `hummingbot-api-client` | `dae015a3c513879ed06a55cf2b2c10e5772c0962` | same SHA | `https://github.com/Axodus/hummingbot-api-client` | clean, `v1.5.9` | package `1.5.9`, Apache-2.0 |
| `hummingbot-api` | `2494e847538bb7b819495cbc30eb4ef828feaacd` | same SHA | `https://github.com/Axodus/hummingbot-api` | clean, `v2.1.0-961-g2494e84` | application `VERSION = 1.0.1`, MIT |

The `.gitmodules` URLs match the configured remotes for all three repositories. The
Trading gitlinks match each checked-out SHA. No branch/tag mismatch or dirty state was
observed. The Hummingbot Core repository is not a Trading submodule and no Core source,
wheel, lockfile or installed package is present in the workspace.

## Current provenance findings

The current API acquisition path is:

```text
hummingbot-api/environment.yml
        │
        └── pip: hummingbot       # unversioned
                │
                ▼
        conda/Docker build
```

Evidence in the materialized API:

- `environment.yml` deliberately installs `hummingbot` without a version. Its comments
  state that required Core changes were not yet in a PyPI release and that installation
  order was load-bearing.
- `Dockerfile` copies the environment created from `environment.yml`; it does not clone
  Core or pin a package artifact.
- the Docker workflow publishes API images as `latest` and the application version; it
  does not record a Core revision or image digest.
- `setup.sh` pulls `hummingbot/hummingbot:latest` for the operational bot image.
- `main.py` calls `require_core_surface()`, but the current required surface list is
  empty. This is an API-shape guard, not provenance or compatibility verification.
- the API repository history contains an older commit `88400de` named `freeze hummingbot
  version`, which used `hummingbot==20241125`. That historical pin is not present in the
  current baseline and cannot be promoted to the current Core revision.

Result: no exact Core package/repository/revision is determinable from the current
workspace. Cloning upstream HEAD or selecting the historical package would violate the
REQ-08 provenance rule.

## REQ-03 → REQ-08 revision delta

| Component | REQ-03 / prior evidence | Current workspace | Classification |
| --- | --- | --- | --- |
| Condor | historical audited source | `d89e74f2…`, clean | `UNCHANGED` relative to REQ-04 materialized baseline |
| API client | `1.5.9`, prior baseline | `1.5.9`, `dae015a3…`, clean | `UNCHANGED` |
| Hummingbot API | `2494e847…` current server baseline | same SHA, clean | `UNCHANGED` |
| Hummingbot Core | absent / not pinned | absent / unpinned | `UNRESOLVED`, not an upgrade or regression claim |

REQ-07 remains valid. REQ-08 supersedes only the previous phase status: Core source is
still unavailable for connector-level verification, now with concrete provenance
evidence showing why it cannot be recovered from the current API repository.

## Core and connector audit status

The API source exposes the following external Core boundary:

- `ConnectorBase`, `ExchangePyBase`, `PerpetualDerivativePyBase` and connector discovery
  through `AllConnectorSettings`;
- `Gateway` and separate Gateway network connector handling;
- connector `buy`/`sell` calls from the API trading service;
- provider-generated `client_order_id` values in Hummingbot in-flight order tracking;
- API-side order persistence and lookup keyed by provider-generated IDs.

The following required REQ-08 claims are **not verifiable** without the exact Core source:

- `ClientOrderTracker` and `InFlightOrder` implementation at the server's expected
  revision;
- `buy`/`sell` signatures and caller-controlled ID support;
- ID generation and exchange request construction in Binance spot;
- ID generation and exchange request construction in Binance perpetual;
- Gateway/DEX order identity behavior;
- exchange-specific charset, length and uniqueness constraints;
- preservation and lookup of caller IDs in provider evidence and fills.

| Connector sample | Caller ID accepted | Preserved | Lookup by ID | Reconciliation |
| --- | --- | --- | --- | --- |
| Binance spot | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `NONE / UNVERIFIED` |
| Binance perpetual | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `NONE / UNVERIFIED` |
| Gateway/DEX sample | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `NONE / UNVERIFIED` |

This is an evidence boundary, not a claim that these venues cannot support caller IDs.

## Identity and architecture conformance

The current observable chain remains:

```text
Axodus SubmissionAttempt
        │
        ▼
Axodus HTTP adapter
        │
        ▼
hummingbot-api-client / TradeRequest
        │
        ▼
API trading service
        │
        ▼
Core connector buy/sell
```

The caller-controlled Axodus identity is not present in the client/server request
models or service call observed before the Core boundary. Hummingbot-generated IDs are
provider evidence and do not become Axodus lifecycle identity.

| Capability | Source / observed behavior | Axodus owner | Classification | Required boundary |
| --- | --- | --- | --- | --- |
| Order intent | Trading Core contracts | Axodus | `PROTECT` | Core-owned semantic input |
| Submission attempt and lifecycle | REQ-06 contracts | Axodus | `PROTECT` | no provider ownership transfer |
| Caller-controlled execution identity | absent from current API path | Axodus | `NEW` after separate approval | must cross every admitted layer |
| Provider order identity | Hummingbot Core/API persistence | Hummingbot evidence | `ADAPT` | evidence only until exact continuity is proven |
| Strategy, risk, capital authority | Axodus architecture | Axodus | `PROTECT` | never delegated to Core or Condor |
| Credentials, keys, wallets | API/Gateway surfaces | Axodus governance boundary | `ISOLATE` / `REJECT` | outside current integration |
| Gateway/DEX execution | API and Gateway surfaces | future reviewed provider | `ISOLATE` | no universal identity claim |
| Condor agent decisions | Condor source and API client usage | Axodus controlled interfaces | `ISOLATE` | outside first execution path |

## Security-sensitive surfaces

The API source contains direct trading, credential/key, Gateway wallet, executor,
portfolio and bot lifecycle surfaces. Their existence does not admit them into Axodus.
REQ-08 made no change to the following boundaries:

- Condor cannot own Trading authority or call execution outside Axodus-controlled
  interfaces.
- Hummingbot Core/API remains an operational substrate and evidence provider.
- Credentials, exchange keys, wallets, Gateway authority and direct trading remain
  isolated from the current implementation path.
- No credentials, exchange connection, order, paper/shadow/live activity or capital
  authority was used.

## Test and validation record

Executed:

- repository identity, gitlink and checkout comparison;
- remote, branch, tag and dirty-state inspection;
- manifest, Docker, workflow, bootstrap and history inspection;
- search for Core packages, wheels, lockfiles and installed source;
- local import probe: `hummingbot` is not installed (`ModuleNotFoundError`);
- source-level API/Core boundary inspection.

Not executed:

- Hummingbot Core tests or connector tests, because the exact Core dependency is absent;
- Binance or Gateway runtime tests, because they would require the unresolved Core and
  potentially credentials or external connectivity.

No source modification was made in any external repository.

## REQ-07 findings disposition

### Preserved

- `SubmissionAttempt → provider order identity` is not proven end to end.
- `PROVIDER_EXECUTION_UNKNOWN` remains distinct from `FAILED`.
- blind resubmission and heuristic reconciliation remain prohibited.
- `BLOCKER-02` remains open and blocks operational `IMP-02`.
- Axodus-controlled client order ID propagation remains the selected technical direction.

### Superseded

- The statement that the next step can proceed directly to concrete connector audit is
  superseded by the stronger provenance finding: the server's Core dependency is not
  reproducibly identified.

### Invalidated

- None. No prior REQ-07 identity finding was disproved by the current materialized state.

## Dependency baseline recommendation

`NO CURRENT CORE BASELINE RECOMMENDATION`.

The safe result is to keep the Core baseline unresolved until the owner supplies or
freezes one of the following with evidence:

1. an exact Hummingbot Core repository and immutable commit;
2. an immutable package artifact with provenance and compatibility evidence; or
3. an immutable container/image digest whose embedded Core can be inspected and mapped
   to the API server baseline.

The historical `hummingbot==20241125` pin and any current `latest` image are provenance
references only; neither is recommended as the current dependency baseline.

## IMP-02 readiness and decision state

`IMP-02: HOLD / BLOCKED`.

The identity extension cannot be designed at connector level from the current evidence.
The next authorized decision is a Core provenance freeze, followed by a fresh targeted
identity trace. No Core, API, client or connector modification is authorized by REQ-08.

## Final classification

`CORE BASELINE UNRESOLVED`

## Unresolved questions

- Which exact Hummingbot Core package/repository and revision does the deployed API image
  contain or require?
- Is the expected Core distributed through a private wheel, an unpublished branch, a
  container layer, or an installation artifact outside this workspace?
- Which Core revision corresponds to the API source's current `v2.1.0-961-g2494e84`
  server behavior?
- After provenance is frozen, which Binance and Gateway connectors preserve caller IDs
  and expose exact lookup evidence?

## Decisions required from CTO

- Freeze the exact Core provenance or authorize the owner to provide an immutable Core
  artifact for audit.
- After that freeze, decide whether identity propagation is Core extension, API/client
  extension, connector-conditional capability or remains blocked.

## Decisions required from CEO

`NONE`.

