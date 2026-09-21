# 08 — Shadow Decision + Evidence Contract Proposal

## `ShadowDecisionSnapshot`

Immutable input artifact:

```text
shadowSnapshotId, environment, harnessRunId?, correlationId, causationId,
strategyId, strategyRevisionId, strategyEvidenceRefs[], promotionEligibilityRef,
marketStateRef, opportunityRef, tradeProposalRef, baselineAction,
stateSchemaId, stateSchemaRevision, statePayloadDigest,
questionSetId, questionSetRevision, createdAt, asOf, expiresAt, inputDigest
```

`baselineAction` records what canonical Strategy/Quant proposed. It is not Jev output.

## `ShadowDecisionObservation`

Append-only provider result:

```text
shadowDecisionId, shadowSnapshotId, providerId, adapterRevision,
requestedModel, resolvedModel, providerRequestRef?, attempt,
status, answers[], usage?, cost?,
queuedAt, requestStartedAt, responseReceivedAt, validatedAt, persistedAt,
providerLatencyMs?, totalShadowLatencyMs, rawResponseDigest?,
errorClass?, createdAt, inputDigest
```

Status vocabulary:

`COMPLETED | TIMEOUT | RATE_LIMITED | PROVIDER_ERROR | INVALID_SCHEMA | STALE | CANCELLED | DUPLICATE`

Each normalized answer preserves:

```text
questionId, questionType, selectedValue?, score?, noul?,
probabilities?, providerConfidence?, validationStatus
```

Provider confidence is labeled as provider output. It is not Axodus calibration evidence.

## `ShadowDecisionEvaluation`

Created only after the horizon or canonical execution outcome is available:

```text
evaluationId, shadowDecisionId, labelPolicyId, labelPolicyRevision,
horizonStart, horizonEnd, outcomeKind,
marketOutcomeRefs[], executionResultRef?, diagnosticsRef?, pnlAttributionRef?,
feedbackSnapshotRef?, groundTruth, quality, evaluatedAt, inputDigest
```

Quality: `COMPLETE | PARTIAL | INSUFFICIENT_DATA | INVALID | PENDING`.

## Provenance and privacy

- Reuse existing IDs, correlation and Harness Evidence Package references.
- Persist an allowlisted normalized state and digest; avoid unnecessary raw market/provider payloads.
- Never persist API keys, auth headers, exchange credentials or private keys.
- Keep provider raw response optional, encrypted/restricted if retained, and non-authoritative.
- An observation cannot be mutated when an outcome arrives; evaluation is a new artifact.

## Identity

The observation identity should bind snapshot, provider, adapter revision, pinned model, question-set revision and attempt policy. Same identity with a different payload is a typed conflict. Duplicate delivery converges to one canonical shadow effect.
