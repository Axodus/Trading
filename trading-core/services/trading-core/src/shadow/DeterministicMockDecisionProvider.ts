import type { ShadowDecisionObservation, ShadowDecisionRequest, ShadowProviderStatus } from '../../../../packages/trading-contracts/src/index.js';
import type { DecisionProvider, ShadowClock } from './DecisionProvider.js';
import { shadowDigest } from './CanonicalShadowJson.js';
import { validateShadowAnswers } from './ShadowDecisionValidation.js';

export type MockProviderMode = 'FIXED' | 'DELAYED' | 'TIMEOUT' | 'ERROR' | 'INVALID' | 'STALE' | 'DUPLICATE';

export class DeterministicMockDecisionProvider implements DecisionProvider {
  readonly providerId = 'axodus-deterministic-mock';
  readonly configured = true;
  private seen = new Set<string>();

  constructor(
    private readonly mode: MockProviderMode = 'FIXED',
    private readonly delayMs = 0,
    private readonly clock: ShadowClock = () => new Date('2026-09-21T12:00:00.000Z'),
  ) {}

  async evaluate(request: ShadowDecisionRequest): Promise<ShadowDecisionObservation> {
    const startedAt = this.clock().toISOString();
    if (this.delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
    if (this.mode === 'ERROR') throw new Error('MOCK_PROVIDER_UNAVAILABLE');
    const duplicate = this.seen.has(request.requestId);
    this.seen.add(request.requestId);
    const answers = request.questions.map((question) => {
      if (question.type === 'NOUL') return { questionId: question.questionId, type: question.type, value: '0.7' } as const;
      if (question.type === 'CHOICE') {
        const keys = Object.keys(question.options);
        const chosen = keys[0] ?? 'invalid';
        return { questionId: question.questionId, type: question.type, value: this.mode === 'INVALID' ? 'unexpected' : chosen, confidence: 1, probabilities: Object.fromEntries(keys.map((key) => [key, key === chosen ? 1 : 0])) } as const;
      }
      return { questionId: question.questionId, type: question.type, value: '0', confidence: 1, probabilities: Object.fromEntries(question.levels.map((_, index) => [String(index), index === 0 ? 1 : 0])) } as const;
    });
    if (this.mode === 'INVALID') validateShadowAnswers(request.questions, answers);
    const status: ShadowProviderStatus = this.mode === 'TIMEOUT' ? 'TIMED_OUT' : this.mode === 'STALE' ? 'STALE_RESPONSE' : (this.mode === 'DUPLICATE' && duplicate) ? 'DUPLICATE_RESPONSE' : 'SUCCEEDED';
    const completedAt = this.clock().toISOString();
    const inputDigest = shadowDigest({ requestId: request.requestId, status, answers } as any);
    return Object.freeze({
      observationId: `shadow-observation:${inputDigest.slice(8)}`,
      requestId: request.requestId,
      snapshotId: request.snapshot.snapshotId,
      correlationId: request.snapshot.correlationId,
      provider: this.providerId,
      requestedModel: request.snapshot.requestedModel,
      resolvedModel: 'mock-v1',
      status,
      answers,
      attemptCount: 1,
      attempts: [{ attempt: 1, startedAt, completedAt, latencyMs: this.delayMs, outcome: status }],
      totalProviderWallTimeMs: this.delayMs,
      observedAt: completedAt,
      inputDigest,
    });
  }
}
