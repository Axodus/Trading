# AXODUS-TRADING-VAL-JEV-02A — Provider-Neutral Contracts

**Status:** PASS  
**Baseline:** `0d8c71f0ec8c43174546bb2e44e6676346b01f3e`  
**Mode:** SHADOW only

The additive `shadow/decisionProvider` contract defines immutable snapshot, request, observation, evaluation, experiment, question-set and label-policy identities. It contains no TypeSafe SDK or HTTP transport type. The provider result is evidence and has no Portfolio, Risk, Intent, Harness or Exchange mutation surface.

The exported provider state is an explicit allowlist:

| Group | Exported fields | Purpose |
|---|---|---|
| Market | instrument, venue, timeframe, market/observation time, freshness, completeness, quality, sequence status, versioned features | Reconstruct the market state assessed |
| Opportunity | qualification, expected characteristics, expiry | Bound the contextual opportunity |
| Proposal | action, requested quantity/capital/leverage, expected return/risk, liquidity, duration, costs, creation/expiry | Evaluate the already-created proposal |

Credentials, source payloads, private keys, customer data, infrastructure metadata and authority decisions are excluded. Canonical sorted serialization and a deterministic experimental identity digest make equivalent state reproducible. The digest is an identity aid, not a security signature.

Validation: focused Stage 0 suite PASS; deterministic serialization, immutable identity, revision/state binding, allowlist and forbidden authority surface covered.
