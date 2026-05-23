import type {
  AgentAutonomyLevel,
  AgentAutonomyPolicy as AgentAutonomyPolicyContract,
  AutonomousActionBoundary,
  AutonomousActionDecision,
} from '../../../../../packages/trading-contracts/src/index.js';

export class AgentAutonomyPolicy {
  constructor(private readonly profile: AgentAutonomyPolicyContract) {}

  evaluate(boundary: AutonomousActionBoundary): AutonomousActionDecision {
    if (boundary.context.executionDomain === 'treasury' && boundary.actionType !== 'analytics') {
      return this.reject(boundary, 'Treasury execution cannot be autonomously mutated.');
    }

    if (!this.isActionAllowedAtLevel(boundary.actionType, this.profile.autonomyLevel)) {
      return this.reject(boundary, `Autonomy level ${this.profile.autonomyLevel} cannot perform ${boundary.actionType}.`);
    }

    if (boundary.actionType === 'production-strategy-mutation') {
      if (!boundary.mutationPolicy) {
        return this.reject(boundary, 'Production mutation requires mutation policy.');
      }
      if (!boundary.mutationPolicy.simulationPolicy.simulationCompleted) {
        return this.reject(boundary, 'Production mutation blocked without simulation.');
      }
      if (!boundary.mutationPolicy.simulationPolicy.backtestCompleted) {
        return this.reject(boundary, 'Production mutation blocked without backtest.');
      }
      if (!boundary.mutationPolicy.simulationPolicy.paperValidationCompleted) {
        return this.reject(boundary, 'Production mutation blocked without paper validation.');
      }
      if (!boundary.mutationPolicy.governancePolicy.governanceApproved || !this.profile.governanceApproved) {
        return this.reject(boundary, 'Governance approval is required for production mutation.');
      }
      if (!boundary.mutationPolicy.governancePolicy.riskApproved || !this.profile.riskApproved) {
        return this.reject(boundary, 'Risk approval is required for production mutation.');
      }
    }

    return {
      approved: true,
      autonomyLevel: this.profile.autonomyLevel,
      actionType: boundary.actionType,
    };
  }

  canEscalateTo(nextLevel: AgentAutonomyLevel, governanceApproved: boolean): AutonomousActionDecision {
    if (nextLevel <= this.profile.autonomyLevel) {
      return {
        approved: true,
        autonomyLevel: this.profile.autonomyLevel,
        actionType: 'analytics',
      };
    }
    if (!governanceApproved || !this.profile.governanceApproved) {
      return {
        approved: false,
        reason: 'Governance approval is required for autonomy escalation.',
        autonomyLevel: this.profile.autonomyLevel,
        actionType: 'analytics',
      };
    }
    if (!this.profile.selfEscalationAllowed) {
      return {
        approved: false,
        reason: 'Self-escalating autonomy is not allowed.',
        autonomyLevel: this.profile.autonomyLevel,
        actionType: 'analytics',
      };
    }
    return {
      approved: true,
      autonomyLevel: nextLevel,
      actionType: 'analytics',
    };
  }

  private isActionAllowedAtLevel(actionType: AutonomousActionBoundary['actionType'], level: AgentAutonomyLevel): boolean {
    if (level === 0) {
      return actionType === 'analytics';
    }
    if (level === 1) {
      return ['analytics', 'request-simulation', 'request-backtest'].includes(actionType);
    }
    if (level === 2) {
      return ['analytics', 'request-simulation', 'request-backtest', 'paper-parameter-adjustment'].includes(actionType);
    }
    if (level === 3) {
      return ['analytics', 'request-simulation', 'request-backtest', 'paper-parameter-adjustment', 'controlled-execution-proposal'].includes(actionType);
    }
    return actionType !== 'treasury-execution-mutation';
  }

  private reject(boundary: AutonomousActionBoundary, reason: string): AutonomousActionDecision {
    return {
      approved: false,
      reason,
      autonomyLevel: this.profile.autonomyLevel,
      actionType: boundary.actionType,
    };
  }
}
