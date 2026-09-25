# Global Coordination Handoff — AXODUS-TRADING-REQ-QUANT-HIST-DATA-01 Amendment A

- Workspace: `Trading/quants-lab`
- Handoff ID / time: `AXODUS-TRADING-REQ-QUANT-HIST-DATA-01-AMENDMENT-A / 2026-09-24T13:46:00Z`
- Request / branch / HEAD: `14-day historical dataset materialization / quants-lab main / 84484314b4837a4b655a53dd250d58dfcfd12ecd`
- Scope: Reduced primary window from 90 days to 14 days; downloader and manifests now target `2026-06-23` through `2026-07-06`, preserving prior artifacts.
- Local status: `IN_PROGRESS`
- Validation: Python compile and `git diff --check` pass. Acquisition supervisor active with `84/1344` primary partitions qualified, `0` failed, `0` retries at checkpoint.
- Changed local records: `research_notebooks/orderflow_backtest/bulk_historical_downloader.py`, `run_bulk_acquisition.py`, `dataset_manifest.json`, `historical_l2_source_freeze.json`, `historical_acquisition_manifest.json`.
- Dependencies: `CryptoHFTData` qualified source -> Quant-Lab acquisition; storage at `/run/media/mzfshark/Storage/Axodus/Trading/market-data`.
- Blockers / risks: Acquisition remains incomplete; sequence/reconstruction/full-dataset quality reports are pending. No strategy backtest is authorized.
- Priority impact: current priority unchanged.
- Portfolio action: root coordinator should update only after final 14-day qualification handoff.
- Boundaries preserved: no Jev calls, no Testnet/Mainnet mutation, no real capital, strategies frozen, no commit, no push.
