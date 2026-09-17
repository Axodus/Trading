# Global Coordination Handoff — AXODUS-TRADING-REQ-08

- Workspace: `/opt/Axodus/Trading`
- Handoff ID / time: `REQ-08-core-baseline / 2026-09-17T21:32:39Z`
- Request / branch / HEAD: `AXODUS-TRADING-REQ-08 / dev / cdfd77e`
- Scope: verify materialized Condor, Hummingbot API client and Hummingbot API provenance; determine whether the API's Hummingbot Core baseline is reproducible; audit Core-dependent identity path readiness
- Local status: `BLOCKED / CORE BASELINE UNRESOLVED`
- Validation: gitlink/remote/checkout comparison; manifest, Docker, workflow, bootstrap and history inspection; Core package/wheel/lockfile search; local import probe confirmed `hummingbot` is unavailable; no runtime or external exchange activity
- Changed local records: `.instructions/TRADING_REQ_08_HUMMINGBOT_CORE_CONNECTOR_EXECUTION_BASELINE_AUDIT.md`, `.instructions/STATUS.md`, `.instructions/ROADMAP.md`, `.instructions/TASKS.md`, `.instructions/VALIDATION.md`, `.instructions/BLOCKER_REGISTER.md`, this handoff
- Dependencies: Hummingbot API owner -> Trading; an immutable Hummingbot Core artifact/revision is required before Binance/Gateway connector identity claims can be verified
- Blockers / risks: `AXODUS-TRADING-BLOCKER-02` remains open; `IMP-02` remains blocked; current API installs Core unpinned and `latest` operational images are not reproducible
- Priority impact: current priority unchanged; Core provenance resolution is the next dependency before identity-extension design
- Portfolio action: root coordinator should record REQ-08 as `CORE BASELINE UNRESOLVED` and preserve BLOCKER-02; no global priority or capital decision requested
- Boundaries preserved: no Core/API/client/connector modification, no dependency update, no credentials, no exchange connectivity, no orders, no Condor execution integration, no WebSocket work, no paper/live trading, no production or capital authority
