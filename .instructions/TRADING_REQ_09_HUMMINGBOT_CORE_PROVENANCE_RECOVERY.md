# AXODUS-TRADING-REQ-09 — Hummingbot Core Provenance Recovery & Immutable Baseline Freeze

Status: `COMPLETE / PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED`

Classification: `PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED`

Implementation: `HOLD`

## Objective

Recover, from the materialized `hummingbot-api` history, the strongest defensible evidence for the Hummingbot Core expected by API revision `2494e847538bb7b819495cbc30eb4ef828feaacd`, without selecting an arbitrary upstream revision.

## Repositories and source scope

- Trading repository: `/opt/Axodus/Trading`, branch `dev`.
- API repository: `hummingbot-api` at `2494e847538bb7b819495cbc30eb4ef828feaacd`.
- Relevant API history: dependency changes, `environment.yml`, Dockerfile, Compose, setup script, CI workflow, compatibility guard, tags and reachable refs.
- Hummingbot Core repository: not materialized in the workspace and not selected from an upstream HEAD.

## Evidence ladder

| Evidence | Finding | Strength |
| --- | --- | --- |
| Current API dependency declaration | `environment.yml` installs `hummingbot` without version or revision | Direct, but non-reproducible |
| Current API compatibility statement | Commit `ee2ab6f95f0cef92526e2d7c64ef32d948abbbcf` explicitly says the package is deliberately unpinned because required fields were not yet in a PyPI release | Strong explanation of current ambiguity |
| Historical explicit pin | Commit `88400de324a97c01cdb3a6c847c7aec0d60f79f3` pinned `hummingbot==20241125` | Strong historical provenance, superseded |
| Later explicit pin | Commit `68367ab758ab2d45f3f0e986a8c9578d376caedf` pinned `hummingbot==20250715` | Strong historical provenance, superseded |
| Pin removal | Commit `334ba8d3c299d2a4587d498ee98a3747f5f70768` removed the `20241125` pin; commit `81e3d8bb09184b9e80cd722121fdef376ede0ed5` removed the later pin | Direct history, no Core SHA |
| Container provenance | API Dockerfile builds the environment from `environment.yml`; Compose uses `hummingbot/hummingbot-api:latest`; setup pulls `hummingbot/hummingbot:latest` | No immutable Core evidence |
| CI provenance | Docker workflow publishes `latest` and API version tags without Core package metadata or image digest | No immutable Core evidence |
| Local artifact evidence | No Core source, wheel, lockfile or installed `hummingbot` package exists locally; import probe fails | Confirms audit limitation |
| Git object evidence | No unreachable API objects recovered by `git fsck`; current API HEAD has no containing tag | No hidden recovery path found |
| Temporal correlation | Historical pins provide dates/versions only; same-date Core HEAD would not establish correspondence | Insufficient alone |

## Historical timeline

1. `88400de` (`2024-12-31`): API explicitly pins `hummingbot==20241125`.
2. `334ba8d` (`2025-03-03`): that pin is removed and the dependency becomes floating.
3. `68367ab` (`2025-09-16`): API explicitly pins `hummingbot==20250715`.
4. `81e3d8b` (`2025-10-09`): the `20250715` pin is removed again.
5. `832e7b1` (`2025-10-17`): the floating dependency remains.
6. `ee2ab6f` (`2026-08-21`): the unpinned state is documented as deliberate because the API reads Core fields absent from a PyPI release.
7. `2494e847` (`2026-09-16`): current API revision still installs `hummingbot` without an immutable Core reference.

The timeline proves that the API has used identifiable package versions in the past. It does not prove which Core commit produced the package, nor which package artifact was installed by the current API baseline.

## Provenance result

Historical provenance is **partially recovered**:

- identifiable historical package pins exist;
- the current API dependency is intentionally floating;
- no historical pin is demonstrably the Core implementation expected by current API revision `2494e847...`;
- no package-to-Core commit mapping, lockfile, container digest or immutable artifact is present;
- no exact historical Core revision can be selected without introducing an Axodus assumption.

Final result: `PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED`.

This is not `PROVENANCE RECOVERED / IMMUTABLE CORE BASELINE PROPOSED`.

## Consequences for REQ-08 and BLOCKER-02

- REQ-08 remains valid and is now superseded only by this deeper provenance result; its final classification remains `CORE BASELINE UNRESOLVED`.
- REQ-07 identity findings remain preserved.
- `AXODUS-TRADING-BLOCKER-02 — End-to-End Provider Order Identity Continuity` remains `OPEN / IMP-02 BLOCKING`.
- Binance spot, Binance perpetual and Gateway/DEX identity tracing remains on hold because the Core revision is not frozen.
- No connector behavior, ID generator, order tracker or exchange preservation rule may be promoted from an arbitrary Core revision into the Axodus baseline.

## Baseline options requiring CTO selection

### Historical reconstruction

Not currently defensible. The historical package pins are evidence of package versions only and do not identify an immutable Core source revision or artifact digest.

### Prospective Axodus qualification

Permitted as the next decision path, but not selected by this REQ. It would require:

1. selecting a specific Core commit, release artifact or image digest;
2. materializing it for audit;
3. validating compatibility with API `2494e847...` and client `v1.5.9`;
4. recording the exact trio as a new prospective Axodus baseline;
5. only then resuming the targeted connector identity trace.

The prospective baseline must eliminate the floating `hummingbot` dependency and record a version, revision or digest in a reproducible dependency contract.

## Non-goals and boundaries

- no Core materialization from arbitrary upstream HEAD;
- no version or dependency change;
- no Core, API, client or connector modification;
- no compatibility shim or identity propagation implementation;
- no credentials, exchange connectivity, orders, paper/live trading or capital activity;
- `BLOCKER-01` remains independent and open;
- Condor remains outside the execution path.

## Validation

- inspected API history with commit dates and dependency diffs;
- inspected current and historical `environment.yml`, Dockerfile, Compose, setup and CI metadata;
- inspected tags, reachable refs and unreachable Git objects;
- confirmed no local Core artifact or installed `hummingbot` package is available;
- no runtime or upstream tests executed because no immutable Core dependency exists to test;
- no external repositories were modified.

## Decisions required

### CTO

Select whether to qualify a new prospective Axodus Core baseline, or provide an immutable artifact/revision that establishes historical correspondence. Until then, keep connector identity tracing and `IMP-02` blocked.

### CEO

`NONE`.
