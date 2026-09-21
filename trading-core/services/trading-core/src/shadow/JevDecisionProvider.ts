import type {
  ShadowDecisionAnswer,
  ShadowDecisionObservation,
  ShadowDecisionRequest,
  ShadowProviderStatus,
} from '../../../../packages/trading-contracts/src/index.js';
import { shadowDigest } from './CanonicalShadowJson.js';
import type { DecisionProvider, ShadowClock } from './DecisionProvider.js';
import { systemShadowClock } from './DecisionProvider.js';
import { validateShadowAnswers } from './ShadowDecisionValidation.js';

export interface JevProviderConfig {
  apiKey?: string;
  endpoint?: string;
  timeoutMs?: number;
  clock?: ShadowClock;
  fetch?: JevFetch;
}

export interface JevFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type JevFetch = (url: string, init: {
  method: string;
  headers: Readonly<Record<string, string>>;
  body: string;
  signal: AbortSignal;
}) => Promise<JevFetchResponse>;

export class JevDecisionProvider implements DecisionProvider {
  readonly providerId = 'typesafe-jev';
  readonly configured: boolean;
  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly clock: ShadowClock;
  private readonly fetcher: JevFetch;

  constructor(config: JevProviderConfig = {}) {
    this.apiKey = config.apiKey;
    this.configured = Boolean(config.apiKey);
    this.endpoint = config.endpoint ?? 'https://api.typesafe.ai/v1/systemone';
    this.timeoutMs = config.timeoutMs ?? 5_000;
    this.clock = config.clock ?? systemShadowClock;
    this.fetcher = config.fetch ?? (globalThis.fetch as unknown as JevFetch);
  }

  static fromEnvironment(environment: Readonly<Record<string, string | undefined>>): JevDecisionProvider {
    return new JevDecisionProvider({
      apiKey: environment.TRADING_TYPESAFE_API_KEY ?? environment.TYPESAFE_API_KEY ?? environment.TYPESAFE_AI_API_KEY,
      endpoint: environment.TRADING_TYPESAFE_API_ENDPOINT ?? environment.TYPESAFE_API_ENDPOINT,
      timeoutMs: parsePositiveInteger(environment.TRADING_TYPESAFE_API_TIMEOUT_MS ?? environment.TYPESAFE_API_TIMEOUT_MS),
    });
  }

  async evaluate(request: ShadowDecisionRequest): Promise<ShadowDecisionObservation> {
    if (!this.apiKey) return this.failure(request, 'UNAVAILABLE', 'JEV_CREDENTIAL_NOT_CONFIGURED', 0, this.clock().toISOString());
    const started = this.clock();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(request.timeoutMs, this.timeoutMs));
    try {
      const response = await this.fetcher(this.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: request.snapshot.providerState,
          model: request.snapshot.requestedModel,
          questions: Object.fromEntries(request.questions.map((question) => [question.questionId, toJevQuestion(question)])),
        }),
        signal: controller.signal,
      });
      const latencyMs = Math.max(0, this.clock().getTime() - started.getTime());
      if (!response.ok) {
        const status: ShadowProviderStatus = response.status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE';
        return this.failure(request, status, `JEV_HTTP_${response.status}`, latencyMs, started.toISOString());
      }
      const payload = await response.json();
      const parsed = parseJevResponse(payload, request);
      validateShadowAnswers(request.questions, parsed.answers);
      return this.success(request, parsed, latencyMs, started.toISOString());
    } catch (error) {
      const latencyMs = Math.max(0, this.clock().getTime() - started.getTime());
      const aborted = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
      return this.failure(request, aborted ? 'TIMED_OUT' : 'INVALID_RESPONSE', aborted ? 'JEV_TIMEOUT' : 'JEV_RESPONSE_INVALID', latencyMs, started.toISOString());
    } finally {
      clearTimeout(timeout);
    }
  }

  private success(
    request: ShadowDecisionRequest,
    response: ParsedJevResponse,
    latencyMs: number,
    startedAt: string,
  ): ShadowDecisionObservation {
    const completedAt = this.clock().toISOString();
    const digest = shadowDigest({ requestId: request.requestId, model: response.model, answers: response.answers } as any);
    return Object.freeze({
      observationId: `shadow-observation:${digest.slice(8)}`,
      requestId: request.requestId,
      snapshotId: request.snapshot.snapshotId,
      correlationId: request.snapshot.correlationId,
      provider: this.providerId,
      requestedModel: request.snapshot.requestedModel,
      resolvedModel: response.model,
      status: 'SUCCEEDED',
      answers: response.answers,
      attemptCount: 1,
      attempts: [{ attempt: 1, startedAt, completedAt, latencyMs, outcome: 'SUCCEEDED' as const }],
      totalProviderWallTimeMs: latencyMs,
      usage: response.usage,
      observedAt: completedAt,
      inputDigest: digest,
    });
  }

  private failure(request: ShadowDecisionRequest, status: ShadowProviderStatus, failureCode: string, latencyMs: number, startedAt: string): ShadowDecisionObservation {
    const completedAt = this.clock().toISOString();
    const digest = shadowDigest({ requestId: request.requestId, status, failureCode } as any);
    return Object.freeze({
      observationId: `shadow-observation:${digest.slice(8)}`,
      requestId: request.requestId,
      snapshotId: request.snapshot.snapshotId,
      correlationId: request.snapshot.correlationId,
      provider: this.providerId,
      requestedModel: request.snapshot.requestedModel,
      status,
      answers: [],
      attemptCount: status === 'DISABLED' ? 0 : 1,
      attempts: status === 'DISABLED' ? [] : [{ attempt: 1, startedAt, completedAt, latencyMs, outcome: status }],
      totalProviderWallTimeMs: latencyMs,
      observedAt: completedAt,
      failureCode,
      inputDigest: digest,
    });
  }
}

interface ParsedJevResponse {
  model: string;
  answers: ShadowDecisionAnswer[];
  usage?: { inputTokens?: number; outputTokens?: number };
}

function parseJevResponse(value: unknown, request: ShadowDecisionRequest): ParsedJevResponse {
  if (!isRecord(value) || typeof value.model !== 'string' || !isRecord(value.answers)) throw new Error('JEV_RESPONSE_SHAPE_INVALID');
  const rawAnswers = value.answers as Record<string, unknown>;
  const answers = request.questions.map((question): ShadowDecisionAnswer => {
    const raw = rawAnswers[question.questionId];
    if (!isRecord(raw)) throw new Error(`JEV_ANSWER_MISSING:${question.questionId}`);
    if (raw.type !== question.type.toLowerCase()) throw new Error(`JEV_ANSWER_TYPE_INVALID:${question.questionId}`);
    if (question.type === 'NOUL') return { questionId: question.questionId, type: 'NOUL', value: String(raw.noul) };
    if (question.type === 'CHOICE') return { questionId: question.questionId, type: 'CHOICE', value: String(raw.choice), confidence: numberOrUndefined(raw.confidence), probabilities: probabilities(raw.probabilities) };
    return { questionId: question.questionId, type: 'SCORE', value: String(raw.score), confidence: numberOrUndefined(raw.confidence), probabilities: probabilities(raw.probabilities) };
  });
  const usage = isRecord(value.usage) ? { inputTokens: numberOrUndefined(value.usage.input_tokens), outputTokens: numberOrUndefined(value.usage.output_tokens) } : undefined;
  return { model: value.model, answers, usage };
}

function toJevQuestion(question: ShadowDecisionRequest['questions'][number]): Record<string, unknown> {
  if (question.type === 'NOUL') return { type: 'noul', instructions: question.instructions };
  if (question.type === 'CHOICE') return { type: 'choice', instructions: question.instructions, criteria: question.options };
  return { type: 'score', instructions: question.instructions, criteria: question.levels };
}

function probabilities(value: unknown): Readonly<Record<string, number>> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, Number(entry)]));
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
