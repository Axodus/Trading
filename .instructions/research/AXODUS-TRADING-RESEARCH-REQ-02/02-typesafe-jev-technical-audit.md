# 02 — TypeSafe Jev Technical Audit

Audit date: 2026-09-21.

| Topic | Finding | Evidence class |
| --- | --- | --- |
| API | `POST https://api.typesafe.ai/v1/systemone`; Bearer API key; state + model + named questions | `DOCUMENTED FACT` ([quickstart](https://docs.typesafe.ai/introduction/quickstart), [API](https://docs.typesafe.ai/api)) |
| SDKs | Official Python and JavaScript/TypeScript clients; JS requires Node 20+ and includes ESM, CJS and declarations | `DOCUMENTED FACT` ([JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)) |
| State | Text, JSON object, or array of text values; text-only model input | `DOCUMENTED FACT` ([models](https://docs.typesafe.ai/models)) |
| Questions | Choice, Score and Noul; several questions share the same state and are evaluated independently | `DOCUMENTED FACT` ([primitives](https://docs.typesafe.ai/primitives)) |
| Answers | Choice: selected option, distribution, confidence. Score: score, legend, distribution, confidence. Noul: probability only | `DOCUMENTED FACT` ([primitives](https://docs.typesafe.ai/primitives)) |
| Confidence | Derived from the returned distribution; thresholds must be evaluated for the specific domain | `DOCUMENTED FACT` ([confidence](https://docs.typesafe.ai/confidence)) |
| Model | Current documented version `jev-1.13.0`; `jev-latest` is a moving alias and response reports the resolved model | `DOCUMENTED FACT` ([models](https://docs.typesafe.ai/models)) |
| Context | 64k combined request; 32k for state plus longest question | `DOCUMENTED FACT` ([models](https://docs.typesafe.ai/models)) |
| Rate limits | Currently documented as 250k tokens/s and 1,200 requests/min; vendor warns values may change without notice | `DOCUMENTED FACT` ([models](https://docs.typesafe.ai/models)) |
| Price | $42/Btok or $0.042/Mtok input; output tokens free at audit date | `DOCUMENTED FACT` ([models](https://docs.typesafe.ai/models)) |
| Errors | Typed SDK errors include auth, permission, validation, rate-limit, timeout, connection and server errors | `DOCUMENTED FACT` ([JS client](https://docs.typesafe.ai/sdk/javascript/api/classes/TypeSafeClient)) |
| Retries | SDK default is two retries for connection/timeout, 408, 429 and 5xx with backoff and Retry-After support | `DOCUMENTED FACT` ([retry policy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy)) |
| Latency | TypeSafe materials describe fast decisions; no Axodus measurement exists | `VENDOR CLAIM`; Axodus status `UNKNOWN` |
| Data use | Vendor states customer requests/responses are not used for training | `DOCUMENTED VENDOR POLICY` ([models](https://docs.typesafe.ai/models), [legal index](https://docs.typesafe.ai/legal)) |
| Retention | Enterprise ZDR is offered; ordinary-plan retention and exact processing terms require contract review | Partial `DOCUMENTED FACT`; otherwise `UNKNOWN` ([legal index](https://docs.typesafe.ai/legal)) |
| Reproducibility | Typed outputs and model IDs aid replay analysis, but identical-output determinism is not documented | `UNKNOWN` |
| Availability/SLA | No reviewed public SLA establishes availability for Axodus | `UNKNOWN` |

## Model limitations relevant to Trading

TypeSafe documents jagged performance for numeric precision, date/time comparison, indirection, large irrelevant state, adversarial content and structural invariants ([Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)). Axodus must therefore keep in deterministic code:

- FixedDecimal arithmetic and all capital/quantity/leverage checks;
- time ordering, expiration and freshness;
- identity, revision, environment and correlation checks;
- Portfolio, Risk, execution, accounting and safety policy;
- schema validation and probability-distribution validation.

## Adapter requirements

- Pin `jev-1.13.0` for an experiment; log requested alias and resolved version if an alias is ever tested.
- Set an explicit total shadow deadline. Prefer `maxRetries=0` for latency characterization; if retry behavior is studied, record each attempt and never treat retried latency as single-inference latency.
- Validate exact option sets, finite probabilities in `[0,1]`, distribution sums within a declared serialization tolerance, model identity and response freshness.
- Persist request/response digests and safe normalized fields, not secrets or unrestricted payloads.

## Unperformed characterization

No credential was provided or needed. Therefore authentication success, observed response schema, real latency, error bodies, cost accounting, repeatability and actual account rate limits are not `OBSERVED/REPRODUCED BY AXODUS`.
