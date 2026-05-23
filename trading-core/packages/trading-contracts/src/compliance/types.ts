import type { ExecutionDomain } from '../runtime/types.js';

export type DisclosureRequirementTarget =
  | 'runtime-provisioning'
  | 'runtime-resume'
  | 'execution-enable'
  | 'provider-activation'
  | 'leveraged-strategy'
  | 'strategy-product';

export interface TradingRiskDisclosure {
  id: string;
  version: string;
  category:
    | 'non-custodial'
    | 'automation-risk'
    | 'market-risk'
    | 'leverage-risk'
    | 'strategy-specific'
    | 'runtime-provider';
  title: string;
  contentRef: string;
  requiredFor: DisclosureRequirementTarget[];
}

export interface UserRiskAcceptance {
  userId: string;
  disclosureId: string;
  disclosureVersion: string;
  acceptedAt: string;
  expiresAt?: string;
  executionDomain: Extract<ExecutionDomain, 'user'>;
}
