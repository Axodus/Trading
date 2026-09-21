import type { ShadowDecisionObservation, ShadowDecisionRequest } from '../../../../packages/trading-contracts/src/index.js';

export interface DecisionProvider {
  readonly providerId: string;
  readonly configured: boolean;
  evaluate(request: ShadowDecisionRequest): Promise<ShadowDecisionObservation>;
}

export type ShadowClock = () => Date;
export const systemShadowClock: ShadowClock = () => new Date();
