import type { ShadowDecisionRequest } from '../../../../packages/trading-contracts/src/index.js';
import { shadowDigest } from './CanonicalShadowJson.js';
import type { ShadowDecisionDispatcher } from './ShadowDecisionDispatcher.js';
import { JEV_SHADOW_QUESTION_SET_V1 } from './ShadowQuestionSets.js';
import { createShadowDecisionSnapshot, type CreateShadowSnapshotInput } from './ShadowStateSerializer.js';

/**
 * Optional, one-way observation port at the TradeProposal boundary. Callers do
 * not await provider work and receive no decision that can enter Portfolio or
 * Risk. Removing this observer removes the complete SHADOW branch.
 */
export class ShadowTradeProposalObserver {
  constructor(
    private readonly dispatcher: ShadowDecisionDispatcher,
    private readonly timeoutMs = 5_000,
  ) {}

  observe(input: CreateShadowSnapshotInput): {
    dispatch: 'ENQUEUED' | 'DISABLED' | 'DROPPED';
    snapshotId: string;
    requestId: string;
  } {
    const snapshot = createShadowDecisionSnapshot(input);
    const requestId = `shadow-request:${shadowDigest({
      snapshotId: snapshot.snapshotId,
      questionSetId: snapshot.questionSet.questionSetId,
      questionSetVersion: snapshot.questionSet.questionSetVersion,
    })}`;
    const request: ShadowDecisionRequest = Object.freeze({
      requestId,
      snapshot,
      questions: JEV_SHADOW_QUESTION_SET_V1,
      requestedAt: input.capturedAt,
      timeoutMs: this.timeoutMs,
      inputDigest: shadowDigest({ requestId, snapshotId: snapshot.snapshotId }),
    });
    return { dispatch: this.dispatcher.enqueue(request), snapshotId: snapshot.snapshotId, requestId };
  }
}
