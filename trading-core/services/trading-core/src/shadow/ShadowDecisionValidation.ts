import type { ShadowDecisionAnswer, ShadowQuestion } from '../../../../packages/trading-contracts/src/index.js';
import { ShadowProviderResponseError } from './ShadowDecisionErrors.js';

export function validateShadowAnswers(questions: readonly ShadowQuestion[], answers: readonly ShadowDecisionAnswer[]): void {
  if (answers.length !== questions.length) throw new ShadowProviderResponseError('Provider answer count does not match question count');
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
  for (const question of questions) {
    const answer = byId.get(question.questionId);
    if (!answer || answer.type !== question.type) throw new ShadowProviderResponseError(`Invalid answer for ${question.questionId}`);
    if (question.type === 'NOUL') validateProbability(Number(answer.value), question.questionId);
    if (question.type === 'CHOICE') {
      if (!(answer.value in question.options)) throw new ShadowProviderResponseError(`Unexpected choice for ${question.questionId}`);
      validateDistribution(answer.probabilities, Object.keys(question.options), question.questionId);
    }
    if (question.type === 'SCORE') {
      const score = Number(answer.value);
      if (!Number.isFinite(score) || score < 0 || score > question.levels.length - 1) throw new ShadowProviderResponseError(`Invalid score for ${question.questionId}`);
      validateDistribution(answer.probabilities, question.levels.map((_, index) => String(index)), question.questionId);
    }
    if (answer.confidence !== undefined) validateProbability(answer.confidence, `${question.questionId}.confidence`);
  }
}

function validateDistribution(distribution: Readonly<Record<string, number>> | undefined, keys: readonly string[], id: string): void {
  if (!distribution) throw new ShadowProviderResponseError(`Missing probabilities for ${id}`);
  let total = 0;
  for (const key of keys) {
    const value = distribution[key];
    if (value === undefined) throw new ShadowProviderResponseError(`Missing probability ${key} for ${id}`);
    validateProbability(value, `${id}.${key}`);
    total += value;
  }
  if (Math.abs(total - 1) > 0.001) throw new ShadowProviderResponseError(`Probabilities do not sum to one for ${id}`);
}

function validateProbability(value: number, id: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new ShadowProviderResponseError(`Invalid probability for ${id}`);
}
