import type { ExecutionIntent } from '../application/ExecutionIntent.js';
import type { GateDecision } from '../product/ProductExecutionGate.js';
import { ConstitutionalStandingEvaluator, ConstitutionalStandingState } from './ConstitutionalStandingEvaluator.js';
import { FederationExecutionEvaluator, FederationExecutionState } from './FederationExecutionEvaluator.js';
import { TreasuryPolicyEvaluator, TreasuryPolicyState } from './TreasuryPolicyEvaluator.js';

export interface GovernanceExecutionState {
  constitutional: ConstitutionalStandingState;
  federation: FederationExecutionState;
  treasury: TreasuryPolicyState;
}

export interface GovernanceExecutionGuardOptions {
  constitutionalEvaluator?: ConstitutionalStandingEvaluator;
  federationEvaluator?: FederationExecutionEvaluator;
  treasuryPolicyEvaluator?: TreasuryPolicyEvaluator;
  approveByDefault?: boolean;
}

export class GovernanceExecutionGuard {
  private readonly constitutionalEvaluator?: ConstitutionalStandingEvaluator;
  private readonly federationEvaluator?: FederationExecutionEvaluator;
  private readonly treasuryPolicyEvaluator?: TreasuryPolicyEvaluator;
  private readonly approveByDefault: boolean;

  constructor(options: GovernanceExecutionGuardOptions | GovernanceExecutionState | boolean = false) {
    if (typeof options === 'boolean') {
      this.approveByDefault = options;
      return;
    }

    const hasExplicitOptions = 'constitutionalEvaluator' in options
      || 'federationEvaluator' in options
      || 'treasuryPolicyEvaluator' in options
      || 'approveByDefault' in options;
    if (hasExplicitOptions) {
      const explicit = options as GovernanceExecutionGuardOptions;
      this.constitutionalEvaluator = explicit.constitutionalEvaluator;
      this.federationEvaluator = explicit.federationEvaluator;
      this.treasuryPolicyEvaluator = explicit.treasuryPolicyEvaluator;
      this.approveByDefault = explicit.approveByDefault ?? false;
      return;
    }

    const state = options as GovernanceExecutionState;
    this.constitutionalEvaluator = new ConstitutionalStandingEvaluator(state.constitutional);
    this.federationEvaluator = new FederationExecutionEvaluator(state.federation);
    this.treasuryPolicyEvaluator = new TreasuryPolicyEvaluator(state.treasury);
    this.approveByDefault = false;
  }

  async authorize(intent: ExecutionIntent): Promise<GateDecision> {
    if (intent.context.executionDomain !== 'treasury') {
      return { approved: true };
    }

    if (this.constitutionalEvaluator || this.federationEvaluator || this.treasuryPolicyEvaluator) {
      for (const evaluator of [
        this.constitutionalEvaluator,
        this.federationEvaluator,
        this.treasuryPolicyEvaluator,
      ]) {
        const decision = evaluator?.evaluate(intent) ?? { approved: true };
        if (!decision.approved) {
          return decision;
        }
      }

      return { approved: true };
    }

    if (!this.approveByDefault) {
      return { approved: false, reason: 'Treasury execution requires governance approval' };
    }

    return { approved: true };
  }
}
