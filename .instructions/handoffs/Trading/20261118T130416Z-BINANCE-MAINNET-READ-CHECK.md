# Global Coordination Handoff — Binance Futures Mainnet authenticated read

- Workspace: `Trading`; handoff ID/time: `20261118T130416Z-BINANCE-MAINNET-READ-CHECK` / `2026-11-18T13:04:16.429Z`.
- Request / baseline: user identified `.env.dev` for the personal Mainnet API test following the [operational spot check](20261118T125001Z-TRADING-OPERATIONAL-READINESS-SPOTCHECK.md); `dev` at `5754a3832975a01d0ed49572ce701d7c9d5705a6`, with preexisting worktree changes preserved.
- Scope / local status: `BLOCKED / REAL_EXECUTION_HOLD`; verify connectivity and authentication for one read-only Binance USD-M Futures request from this host.
- Validation: `.env.dev` is ignored by Git and contains nonempty `TRADING_BINANCE_API_KEY` and `TRADING_BINANCE_API_SECRET`; `.env.local` still has separately named Testnet entries. Public Binance clock returned a valid response. One signed `GET /fapi/v1/accountConfig` to Binance Mainnet returned HTTP `401`, Binance code `-2015`; authenticated access was not established. Neither private response data nor secrets were recorded. Loaded directly for this isolated check; runtime configuration was not changed.
- Dependencies / blockers: Binance administration and credential owner must verify the Mainnet key, IP allowlist and permissions for USD-M Futures reads. This response does not isolate one cause. `.env.dev` mode observed as `0775`; recommend owner-only permissions. No account or filesystem permissions changed.
- Changed local records: this receipt only. Portfolio priority/maturity unchanged; no coordinator action requested.
- Boundaries preserved: no orders, Binance account mutations, transfers, credential changes, runtime activation, commit or push. No update to Hummingbot or DEV execution readiness.
