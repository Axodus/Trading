import type { ShadowDecisionEvaluation, ShadowDecisionObservation, ShadowDecisionSnapshot } from '../../../../packages/trading-contracts/src/index.js';
import { ShadowDecisionConflictError } from './ShadowDecisionErrors.js';

export interface ShadowDecisionRepository {
  saveSnapshot(snapshot: ShadowDecisionSnapshot): Promise<void>;
  saveObservation(observation: ShadowDecisionObservation): Promise<void>;
  saveEvaluation(evaluation: ShadowDecisionEvaluation): Promise<void>;
}

export class InMemoryShadowDecisionRepository implements ShadowDecisionRepository {
  readonly snapshots = new Map<string, ShadowDecisionSnapshot>();
  readonly observations = new Map<string, ShadowDecisionObservation>();
  readonly evaluations = new Map<string, ShadowDecisionEvaluation>();

  async saveSnapshot(snapshot: ShadowDecisionSnapshot): Promise<void> { save(this.snapshots, snapshot.snapshotId, snapshot, snapshot.inputDigest); }
  async saveObservation(observation: ShadowDecisionObservation): Promise<void> { save(this.observations, observation.observationId, observation, observation.inputDigest); }
  async saveEvaluation(evaluation: ShadowDecisionEvaluation): Promise<void> { save(this.evaluations, evaluation.evaluationId, evaluation, evaluation.inputDigest); }
}

function save<T extends { inputDigest: string }>(map: Map<string, T>, id: string, value: T, digest: string): void {
  const existing = map.get(id);
  if (existing && existing.inputDigest !== digest) throw new ShadowDecisionConflictError(`${id} exists with a different digest`);
  if (!existing) map.set(id, value);
}
