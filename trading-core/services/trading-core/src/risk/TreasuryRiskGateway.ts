import type { RiskCheckResult } from '../../../../packages/trading-contracts/src/index.js';
import type { ExecutionIntent } from '../application/ExecutionIntent.js';

export interface TreasuryRiskState {
  requestedTreasuryExposure?: number;
  maxTreasuryExposure?: number;
  requestedLeverage?: number;
  maxLeverage?: number;
  federationAllocationAllowed?: boolean;
}

export class TreasuryRiskGateway {
  constructor(private readonly state: TreasuryRiskState = {}) {}

  async check(intent: ExecutionIntent): Promise<RiskCheckResult> {
    if (intent.context.executionDomain !== 'treasury') {
      return { requestId: intent.request.requestId, status: 'approved', violations: [] };
    }

    const violations: string[] = [];
    if (
      this.state.maxTreasuryExposure !== undefined
      && (this.state.requestedTreasuryExposure ?? 0) > this.state.maxTreasuryExposure
    ) {
      violations.push('Treasury exposure exceeds policy limit');
    }
    if (this.state.maxLeverage !== undefined && (this.state.requestedLeverage ?? 0) > this.state.maxLeverage) {
      violations.push('Treasury leverage exceeds policy limit');
    }
    if (this.state.federationAllocationAllowed === false) {
      violations.push('Federation allocation limit blocks treasury execution');
    }

    return {
      requestId: intent.request.requestId,
      status: violations.length > 0 ? 'rejected' : 'approved',
      violations,
    };
  }
}
