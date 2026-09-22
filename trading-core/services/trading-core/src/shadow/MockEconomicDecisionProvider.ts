import type {
  ShadowDecisionAnswer,
  ShadowDecisionObservation,
  ShadowDecisionRequest,
  ShadowProviderStatus,
} from '../../../../packages/trading-contracts/src/index.js';
import type { DecisionProvider, ShadowClock } from './DecisionProvider.js';
import { shadowDigest } from './CanonicalShadowJson.js';
import { validateShadowAnswers } from './ShadowDecisionValidation.js';

export type EconomicMockProfile =
  | 'PARITY_CANDIDATE'          // cheap candidate that accurately matches ground truth with high quality
  | 'INFERIOR_CANDIDATE'        // cheap candidate that fails critical safety cases (fails quality floor)
  | 'REFERENCE_STANDARD'        // high-cost reference LLM with near-perfect quality
  | 'DETERMINISTIC_BASELINE'    // zero-cost exact rule comparator
  | 'TIMEOUT_SIMULATOR'         // simulates latency timeouts
  | 'SCHEMA_ERROR_SIMULATOR'    // simulates invalid/malformed response payloads
  | 'ABSTAINING_CANDIDATE';     // frequently abstains safely

export interface MockEconomicProviderConfig {
  readonly providerId: string;
  readonly modelId: string;
  readonly profile: EconomicMockProfile;
  readonly inputPricePerMillionTokensUsd: string;
  readonly outputPricePerMillionTokensUsd: string;
  readonly fixedSurchargeUsd?: string;
  readonly latencyMs?: number;
  readonly inputTokensPerCase?: number;
  readonly outputTokensPerCase?: number;
}

export class MockEconomicDecisionProvider implements DecisionProvider {
  readonly providerId: string;
  readonly configured = true;

  constructor(
    private readonly config: MockEconomicProviderConfig,
    private readonly clock: ShadowClock = () => new Date('2026-09-22T12:00:00.000Z'),
  ) {
    this.providerId = config.providerId;
  }

  get modelId(): string {
    return this.config.modelId;
  }

  get profile(): EconomicMockProfile {
    return this.config.profile;
  }

  get pricing(): MockEconomicProviderConfig {
    return this.config;
  }

  async evaluate(request: ShadowDecisionRequest): Promise<ShadowDecisionObservation> {
    const startedAt = this.clock().toISOString();
    const latency = this.config.latencyMs ?? (this.config.profile === 'REFERENCE_STANDARD' ? 850 : 320);

    if (this.config.profile === 'TIMEOUT_SIMULATOR') {
      const completedAt = this.clock().toISOString();
      const status: ShadowProviderStatus = 'TIMED_OUT';
      const inputDigest = shadowDigest({ requestId: request.requestId, status } as any);
      return Object.freeze({
        observationId: `shadow-observation:${inputDigest.slice(8)}`,
        requestId: request.requestId,
        snapshotId: request.snapshot.snapshotId,
        correlationId: request.snapshot.correlationId,
        provider: this.providerId,
        requestedModel: request.snapshot.requestedModel,
        resolvedModel: this.config.modelId,
        status,
        answers: [],
        attemptCount: 1,
        attempts: [{ attempt: 1, startedAt, completedAt, latencyMs: latency, outcome: status }],
        totalProviderWallTimeMs: latency,
        observedAt: completedAt,
        failureCode: 'PROVIDER_TIMEOUT',
        inputDigest,
      });
    }

    const answers: ShadowDecisionAnswer[] = [];
    const providerState = request.snapshot.providerState || {};

    for (const question of request.questions) {
      if (this.config.profile === 'SCHEMA_ERROR_SIMULATOR') {
        answers.push({
          questionId: question.questionId,
          type: question.type,
          value: 'INVALID_ENUM_UNRECOGNIZED_BY_SCHEMA',
          confidence: 0.99,
        });
        continue;
      }

      if (this.config.profile === 'ABSTAINING_CANDIDATE') {
        answers.push({
          questionId: question.questionId,
          type: question.type,
          value: 'ABSTAIN',
          confidence: 0.2,
          probabilities: { ABSTAIN: 1.0 },
        });
        continue;
      }

      // Check task question semantics
      if (question.questionId === 'state_sufficiency') {
        let val = 'SUFFICIENT';
        const isInsufficient = providerState.hasMissingFeeds === true || providerState.hasStaleData === true;
        if (this.config.profile === 'PARITY_CANDIDATE' || this.config.profile === 'REFERENCE_STANDARD' || this.config.profile === 'DETERMINISTIC_BASELINE') {
          val = isInsufficient ? 'INSUFFICIENT' : 'SUFFICIENT';
        } else if (this.config.profile === 'INFERIOR_CANDIDATE') {
          // Inferior candidate falsely declares insufficient/malformed states as sufficient (Critical False-Safe)
          val = 'SUFFICIENT';
        }
        answers.push({
          questionId: question.questionId,
          type: 'CHOICE',
          value: val,
          confidence: val === 'SUFFICIENT' ? 0.95 : 0.88,
          probabilities: { [val]: 0.95, [val === 'SUFFICIENT' ? 'INSUFFICIENT' : 'SUFFICIENT']: 0.05 },
        });
      } else if (question.questionId === 'escalation_required') {
        let val = 'NOT_REQUIRED';
        const hasAnomaly = providerState.hasAnomaly === true || providerState.unusualSpread === true;
        if (this.config.profile === 'PARITY_CANDIDATE' || this.config.profile === 'REFERENCE_STANDARD' || this.config.profile === 'DETERMINISTIC_BASELINE') {
          val = hasAnomaly ? 'REQUIRED' : 'NOT_REQUIRED';
        } else if (this.config.profile === 'INFERIOR_CANDIDATE') {
          // Inferior candidate misses anomalies and falsely flags as not required (Critical False-Safe)
          val = 'NOT_REQUIRED';
        }
        answers.push({
          questionId: question.questionId,
          type: 'CHOICE',
          value: val,
          confidence: val === 'REQUIRED' ? 0.92 : 0.96,
          probabilities: { [val]: 0.92, [val === 'REQUIRED' ? 'NOT_REQUIRED' : 'REQUIRED']: 0.08 },
        });
      } else if (question.questionId === 'proposal_contradiction') {
        let val = 'NO_CONTRADICTION';
        const hasContradiction = providerState.hasContradiction === true || providerState.directionConflict === true;
        if (this.config.profile === 'PARITY_CANDIDATE' || this.config.profile === 'REFERENCE_STANDARD' || this.config.profile === 'DETERMINISTIC_BASELINE') {
          val = hasContradiction ? 'CONTRADICTION_PRESENT' : 'NO_CONTRADICTION';
        } else if (this.config.profile === 'INFERIOR_CANDIDATE') {
          val = 'NO_CONTRADICTION';
        }
        answers.push({
          questionId: question.questionId,
          type: 'CHOICE',
          value: val,
          confidence: val === 'CONTRADICTION_PRESENT' ? 0.94 : 0.95,
          probabilities: { [val]: 0.94, [val === 'CONTRADICTION_PRESENT' ? 'NO_CONTRADICTION' : 'CONTRADICTION_PRESENT']: 0.06 },
        });
      } else {
        answers.push({
          questionId: question.questionId,
          type: question.type,
          value: 'DEFAULT_MOCK_ANSWER',
          confidence: 0.9,
        });
      }
    }

    const isInvalid = this.config.profile === 'SCHEMA_ERROR_SIMULATOR';
    const status: ShadowProviderStatus = isInvalid ? 'INVALID_RESPONSE' : 'SUCCEEDED';
    const completedAt = this.clock().toISOString();
    const inputDigest = shadowDigest({ requestId: request.requestId, status, answers } as any);

    const inputTokens = this.config.inputTokensPerCase ?? 1200;
    const outputTokens = this.config.outputTokensPerCase ?? (this.config.profile === 'REFERENCE_STANDARD' ? 180 : 0);

    return Object.freeze({
      observationId: `shadow-observation:${inputDigest.slice(8)}`,
      requestId: request.requestId,
      snapshotId: request.snapshot.snapshotId,
      correlationId: request.snapshot.correlationId,
      provider: this.providerId,
      requestedModel: request.snapshot.requestedModel,
      resolvedModel: this.config.modelId,
      status,
      answers,
      attemptCount: 1,
      attempts: [{ attempt: 1, startedAt, completedAt, latencyMs: latency, outcome: status }],
      totalProviderWallTimeMs: latency,
      usage: {
        inputTokens,
        outputTokens,
      },
      observedAt: completedAt,
      inputDigest,
    });
  }
}
