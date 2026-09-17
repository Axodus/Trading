# Global Coordination Handoff — AXODUS-TRADING-REQ-09

- Workspace: `Trading`
- Handoff ID / time: `REQ-09-core-provenance / 2026-09-17T21:44:00Z`
- Request / branch / HEAD: `AXODUS-TRADING-REQ-09 / dev / 6e2e0d6 + pending REQ-09 documentation`
- Scope: Recover historical Hummingbot Core provenance for API revision `2494e847...` and determine whether an immutable Core baseline can be proposed without assumption.
- Local status: `COMPLETE / PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED`; implementation remains on hold.
- Validation: Inspected API history, dependency manifests, Docker/CI/bootstrap metadata, tags, unreachable objects, and local Core/package availability; `git diff --check` passes.
- Changed local records: REQ-09 report, `STATUS.md`, `ROADMAP.md`, `TASKS.md`, `VALIDATION.md`, and this handoff.
- Dependencies: `hummingbot-api @ 2494e847...` has no immutable Core revision, artifact digest, or lockfile correspondence; a prospective Axodus Core qualification requires explicit CTO baseline selection.
- Blockers / risks: Historical package pins are recoverable but do not identify a Core SHA/artifact. `AXODUS-TRADING-BLOCKER-02` and `IMP-02` remain open/blocked; `BLOCKER-01` remains independent.
- Priority impact: No change to program priority; connector identity tracing remains deferred until Core provenance is frozen.
- Portfolio action: Record partial provenance recovery and request CTO selection of either defensible historical evidence or a new prospective immutable Core qualification baseline. CEO decision: none.
- Boundaries preserved: No Core/API/client/connector modification, dependency update, adapter or identity implementation, credentials, exchange connectivity, orders, paper/live trading, or capital authority.
