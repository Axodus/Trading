# Global Coordination Handoff

- Workspace: `Trading/quants-lab`
- Handoff ID / time: `AXODUS-TRADING-REQ-QUANT-ORDERFLOW-01 / 2026-09-24`
- Request / branch / HEAD: `historical L2/tape foundation and strategy equivalence / main / WORKTREE`
- Scope: Added Decimal order-flow contracts, source-equivalent signal adapters, historical manifest validation, equivalence fixtures, freeze metadata, and final local report.
- Local status: `PARTIAL / BLOCKED`
- Validation: `PYTHONPATH=quants-lab/research_notebooks python3 -m pytest ...` — `19 passed`; `git -C quants-lab diff --check` — pass.
- Changed local records: `quants-lab/research_notebooks/orderflow_backtest/`; `.instructions/reports/AXODUS-TRADING-REQ-QUANT-ORDERFLOW-01-HANDOFF.md`
- Dependencies: `historical-data owner -> Quants-Lab`; a real provenance-controlled BTCUSDT/ETHUSDC L2+tape dataset is required before historical validation.
- Blockers / risks: historical dataset unavailable; historical execution model remains incomplete; existing parent worktree has unrelated R3E changes.
- Priority impact: `current priority unchanged`
- Portfolio action: `root coordinator should record the dataset blocker and preserve the partial adapter-equivalence evidence`
- Boundaries preserved: no commits, no push, no Testnet/Mainnet, no capital, no credentials, no strategy deployment.

