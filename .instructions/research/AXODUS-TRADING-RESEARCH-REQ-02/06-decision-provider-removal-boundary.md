# 06 — DecisionProvider / Removal Boundary

## Axodus-owned abstraction

```ts
interface DecisionProvider {
  readonly providerId: string;
  evaluate(command: ShadowDecisionCommand): Promise<DecisionProviderResult>;
}
```

The canonical command contains only provider-neutral fields: immutable state projection, question-set identity, model selection policy, request identity, deadline and correlation. The canonical result contains typed normalized answers, provider/model identity, attempt timing, status and digests.

## Jev adapter ownership

`JevDecisionProvider` alone owns:

- TypeSafe SDK/HTTP types and authentication;
- Choice/Score/Noul request mapping;
- TypeSafe error mapping and retry configuration;
- requested alias/resolved model capture;
- raw response parsing and normalization;
- provider-specific usage/cost fields.

No TypeSafe SDK type crosses into Portfolio, Risk, intent, execution, feedback, governance or safety contracts.

## Dependency direction

```text
shadow worker -> DecisionProvider <- JevDecisionProvider -> TypeSafe API
      |
      +-> ShadowDecisionRepository / Evidence refs

canonical Trading authorities ---- no dependency ----> Jev
```

## Removal test

Removing the Jev package, credentials, adapter and worker must leave:

- canonical compilation and Trading tests unaffected;
- baseline proposal/Portfolio/Risk/Intent/Execution digests unchanged;
- no migration required for domain-owned tables;
- historical shadow records readable through provider-neutral normalized fields;
- provider-specific raw material optional and non-authoritative.

## Feature controls

- Default `SHADOW_DISABLED` until a separate implementation is authorized.
- Per-environment allowlist limited to PAPER/TESTNET.
- A provider circuit breaker affects only the shadow worker.
- Baseline events are never held waiting for provider completion.
- No adapter receives execution provider credentials or APIs.

## Rejected designs

- Importing TypeSafe SDK into `RiskAuthorityService` or `TradingHarnessCoordinator`.
- Adding Jev fields to `RiskDecision`, `TradingIntent` or `ExecutionIntent`.
- Calling Jev synchronously inside pre-execution authorization.
- Sharing Jev credentials with execution adapters.
- Treating provider probabilities as calibrated Axodus facts before evaluation.
