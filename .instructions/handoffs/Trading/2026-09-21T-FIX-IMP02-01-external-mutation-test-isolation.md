# AXODUS-TRADING-FIX-IMP02-01 / FINAL HANDOFF

## STATUS

ACCEPT recommended. Implementation and non-mutating validation completed. No commit or push performed.

## BASELINE

- Request baseline context: EPIC-01 closure commit `21fc5560caa1efca4274bd139ce78e4f80efb708`.
- Current worktree HEAD: `21fd9bb308bf283e39136fd61e4b44ff5d58a8c7` (`feat(trading): add Jev shadow decision provider stage 0`).
- Branch: `dev`, ahead of `origin/dev` by 2 commits before this uncommitted remediation.

## ROOT CAUSE

The prior `npm test` script expanded to `node --test test/*.test.mjs`, which discovered and executed `val-09-testnet-certification.test.mjs`. That suite can create and cancel real Binance Futures Testnet orders. Valid Testnet credentials in the environment were therefore enough for the default regression graph to reach external mutation.

The corrected invariant is encoded as repository behavior: credential availability is not execution authorization.

## INCIDENT RECORD

Preserved unchanged as source evidence:

`.instructions/handoffs/Trading/2026-09-21T-paper-shadow-blocked-testnet-scope-violation.md`

Additional remediation record created:

`.instructions/validation/AXODUS-TRADING-FIX-IMP02-01_EXTERNAL_MUTATION_TEST_ISOLATION.md`

## ALL EXTERNAL-MUTATION TESTS FOUND

| test/suite | command | side effect | environment | classification | default reachable before? | default reachable after? | guard |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `test/val-09-testnet-certification.test.mjs` | `npm run test:testnet:acceptance` | Real order submit/cancel plus residual open-order and position checks | Binance Futures Testnet | `TESTNET_MUTATING` | Yes | No | classified runner + `AXODUS_TRADING_ALLOW_TESTNET_MUTATION=true` + suite-level guard before env loading |
| `val:04b2:r4:execute` runner | `npm run val:04b2:r4:execute` | Real controlled order lifecycle | Binance Futures Testnet | `TESTNET_MUTATING` script | No | No | explicit runner mode + historical R4 confirmation + `AXODUS_TRADING_ALLOW_TESTNET_MUTATION=true` |
| `Val05ContinuousRunner.submitControlledIntent` | no package script in default graph | Can submit through provider when assembled with live provider and explicit operational confirmation | Binance Futures Testnet capable | external-capable code path, not default test | No | No | explicit controlled confirmation and no default command exposure; not executed |

No Mainnet-mutating test command was discovered. Mainnet endpoint strings present in tests are negative assertions that must reject production Binance endpoints.

## NETWORK TEST CLASSIFICATION

- `SAFE`: all `*.test.mjs` files except `val-09-testnet-certification.test.mjs`. They use mocks, fixtures, local PostgreSQL, deterministic adapters, or negative URL checks. Some names contain “testnet” but do not perform real external mutation.
- `NETWORK_READONLY` scripts: `val:04b2:r4:public`, `val:05:fix01:reconcile`. These are explicit commands outside default regression.
- `TESTNET_MUTATING`: `test:testnet:acceptance`, `val:04b2:r4:execute`.
- `MAINNET_MUTATING`: none authorized and none exposed as a normal validation command.

## DEFAULT TEST PATH — BEFORE

```text
npm test
  -> tsc -p tsconfig.test.json
  -> node --test test/*.test.mjs
  -> val-09-testnet-certification.test.mjs included
  -> real Testnet order submit/cancel possible when credentials present
```

## DEFAULT TEST PATH — AFTER

```text
npm test
  -> npm run test:safe
  -> tsc -p tsconfig.test.json
  -> node scripts/run-classified-tests.mjs SAFE
  -> manifest-selected SAFE tests only
  -> TESTNET_MUTATING files excluded
```

## TEST DISCOVERY CHANGES

Added `test/test-classification.manifest.json` and `scripts/run-classified-tests.mjs`.

The runner fails closed if:

- any discovered `*.test.mjs` file is missing from the manifest;
- any manifest entry is stale;
- an unknown classification is requested;
- `TESTNET_MUTATING` is requested without explicit mutation capability.

Manifest audit result:

```text
files 55 entries 55
missing []
stale []
mutating [val-09-testnet-certification.test.mjs]
```

## EXPLICIT TESTNET COMMAND

`npm --prefix trading-core/services/trading-core run test:testnet:acceptance`

This command was invoked without opt-in during validation and failed closed before loading the mutating suite.

## EXPLICIT MUTATION OPT-IN

`AXODUS_TRADING_ALLOW_TESTNET_MUTATION=true`

This is required in addition to the explicit command. It is not a replacement for CTO authorization.

## CREDENTIAL / AUTHORIZATION SEPARATION

- `VAL-09-TESTNET` now calls `assertTestnetMutationAuthorized(process.env)` before `loadWorkspaceEnv()`, so missing opt-in blocks before local credentials are read from `.env.local`.
- The classified runner blocks `TESTNET_MUTATING` before test loading.
- Automated test proves synthetic credential variables present with no opt-in still fail closed.
- `.env.local` remains ignored and untracked.

## FAIL-CLOSED IMPLEMENTATION

Implemented `ExternalMutationTestGuard.ts` with:

- `TESTNET_MUTATION_OPT_IN_ENV = AXODUS_TRADING_ALLOW_TESTNET_MUTATION`
- `ExternalMutationAuthorizationError`
- `assertTestnetMutationAuthorized()`

Applied to:

- `val-09-testnet-certification.test.mjs`
- `val-04b2-live-runner.ts`

## DEFENSE-IN-DEPTH LAYERS

1. Default test script routes to `test:safe`.
2. Classified runner excludes `TESTNET_MUTATING` from SAFE.
3. Classification drift fails closed.
4. `test:testnet:acceptance` requires explicit opt-in.
5. `VAL-09-TESTNET` suite checks opt-in before credential loading.
6. `val:04b2:r4:execute` requires the same opt-in plus its existing confirmation token.
7. Developer and agent documentation now require inspection of unclassified commands and forbid inferring authorization from credentials.

## MAINNET ISOLATION

No Mainnet mutation command discovered. Relevant tests still reject production Binance endpoints such as `https://fapi.binance.com`, `https://api.binance.com`, and `https://dapi.binance.com`.

## AUTOMATED SAFETY TESTS

Focused tests added/updated:

- default `npm test` routes only SAFE graph;
- explicit Testnet suite fails before test loading without opt-in;
- credential-present + opt-in-absent fails closed;
- classification manifest drift is detected;
- R4 execute confirmation alone is insufficient without Testnet mutation capability;
- R4 execute path reaches harness exactly once only when both confirmation and opt-in are present in a mocked/local test.

Focused result:

```text
15 passed / 0 failed / 0 skipped
```

## SAFE REGRESSION RESULT

`npm test`:

```text
799 passed / 0 failed / 1 skipped
```

The command routed through `npm run test:safe` and `run-classified-tests.mjs SAFE`. `VAL-09-TESTNET` was not loaded.

## TYPECHECK / BUILD

- `npm run typecheck`: PASS.
- `npm run build`: PASS.

## QUANT REGRESSION

Not run. This remediation changes TypeScript test routing/guards and documentation only. The safe Trading regression includes the existing ACS/Quant EvidenceRecordV2 Node conformance tests. No `quants-lab` source was changed.

## EXTERNAL MUTATION COUNTERS

```yaml
jevApiCalls: 0

exchangeTestnetOrderPost: 0
exchangeTestnetOrderCancel: 0
exchangeTestnetOtherMutation: 0

exchangeMainnetOrderPost: 0
exchangeMainnetOrderCancel: 0
exchangeMainnetOtherMutation: 0

realCapitalMutation: 0

productionCredentialsUsed: 0
customerCredentialsUsed: 0
privateKeysUsed: 0

secretsExposed: false
```

## JEV / PAPER ACTIVITY

- Jev PAPER calls: 0.
- Paper experiment observations: 0.
- H1/H2 not resumed.
- STABILITY_PROBE not run.
- PAPER SHADOW remains paused.

## SECRET-SAFETY RESULT

- `.env.local`: ignored and untracked.
- Changed-file secret scan found no committed credential value.
- Scan false positives were manually inspected: `risk-envelope` filename text and `process.env.TRADING_BINANCE_API_KEY/SECRET` variable-name references, not values.
- No credential values were printed, copied, committed, or recorded.

## WORKTREE / RECOVERY INTEGRITY

Preexisting Stage 0 / IMP-02 changes remain present and were not overwritten:

- `src/shadow/ShadowQuestionSets.ts`
- `src/shadow/index.ts`
- `src/shadow/PaperShadowAnalysis.ts`
- `scripts/jev-paper-shadow-campaign.mjs`

Incident record preserved:

- `.instructions/handoffs/Trading/2026-09-21T-paper-shadow-blocked-testnet-scope-violation.md`

FIX-IMP02-01 changes are additive/minimal and separate from PAPER campaign continuation.

## FILES CREATED

- `.instructions/validation/AXODUS-TRADING-FIX-IMP02-01_EXTERNAL_MUTATION_TEST_ISOLATION.md`
- `trading-core/services/trading-core/scripts/run-classified-tests.mjs`
- `trading-core/services/trading-core/src/external/ExternalMutationTestGuard.ts`
- `trading-core/services/trading-core/test/fix-imp02-external-mutation-isolation.test.mjs`
- `trading-core/services/trading-core/test/test-classification.manifest.json`
- this handoff file

Preexisting untracked incident/PAPER files remain preserved and are not claimed as new FIX-only implementation.

## FILES MODIFIED

- `AGENTS.md`
- `.instructions/STATUS.md`
- `.instructions/TASKS.md`
- `.instructions/ROADMAP.md`
- `trading-core/services/trading-core/package.json`
- `trading-core/services/trading-core/src/external/val-04b2-live-runner.ts`
- `trading-core/services/trading-core/src/index.ts`
- `trading-core/services/trading-core/test/val-04b2-r4-runner.test.mjs`
- `trading-core/services/trading-core/test/val-09-testnet-certification.test.mjs`

Preexisting IMP-02/PAPER modifications still present:

- `trading-core/services/trading-core/src/shadow/ShadowQuestionSets.ts`
- `trading-core/services/trading-core/src/shadow/index.ts`

## BLOCKERS

None for FIX-IMP02-01 acceptance recommendation.

## UNKNOWNS

- Exact HTTP mutation counts from the original incident remain inferred as `>= 2` posts and `>= 2` cancellations because the prior suite did not emit exact HTTP counters.
- Runners outside the service package or future new tests still require the documented classification discipline.

## RESIDUAL RISKS

- Future contributors could add a new mutating command outside the manifest. The added AGENTS/documentation rule and manifest drift detection protect the service test graph, but package scripts outside this graph still require command-surface review.
- Existing `val:04b2:r4:execute` remains intentionally mutating when explicitly authorized with both required gates.

## RECOMMENDED DISPOSITION

ACCEPT.

Commit remains not authorized by this handoff. PAPER SHADOW remains paused until CTO separately authorizes resume.

## GIT STATUS

```text
dev @ 21fd9bb308bf283e39136fd61e4b44ff5d58a8c7
branch ahead of origin/dev by 2
worktree has uncommitted FIX-IMP02-01, preserved IMP-02/PAPER and incident-record changes
```

## Global Coordination Handoff

- Workspace: `Trading`
- Handoff ID / time: `2026-09-21T-FIX-IMP02-01-EXTERNAL-MUTATION-TEST-ISOLATION / 2026-09-21 America/Sao_Paulo`
- Request / branch / HEAD: `AXODUS-TRADING-FIX-IMP02-01 / dev / 21fd9bb308bf283e39136fd61e4b44ff5d58a8c7`
- Scope: `External-mutation test isolation and non-mutating validation`
- Local status: `LOCAL_VALIDATED / CTO REVIEW REQUIRED / UNCOMMITTED`
- Validation: `focused 15/15 PASS; explicit mutating command without opt-in FAIL-CLOSED; typecheck PASS; build PASS; npm test SAFE 799 pass / 0 fail / 1 skip; diff check PASS; secret scan no credential values`
- Changed local records: `.instructions/STATUS.md; .instructions/TASKS.md; .instructions/ROADMAP.md; .instructions/validation/AXODUS-TRADING-FIX-IMP02-01_EXTERNAL_MUTATION_TEST_ISOLATION.md; this handoff`
- Dependencies: `CTO review required before FIX commit or PAPER SHADOW resume`
- Blockers / risks: `No active FIX blocker; original PAPER campaign remains paused`
- Priority impact: `PAPER SHADOW remains paused until acceptance`
- Portfolio action: `root coordinator should record local validation only after CTO acceptance`
- Boundaries preserved: `No Jev PAPER calls, no Testnet mutation, no Mainnet, no real capital, no production/customer credentials, no push`

