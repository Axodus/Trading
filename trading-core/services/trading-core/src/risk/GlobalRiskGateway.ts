import type { RiskCheckResult } from '../../../../packages/trading-contracts/src/index.js';
import type { RiskCheckTarget } from './RiskCheckTarget.js';

export interface GlobalRiskState {
  emergencyShutdown?: boolean;
  blockedProviderIds?: string[];
  volatilityBlocked?: boolean;
  liquidityBlocked?: boolean;
}

export class GlobalRiskGateway {
  constructor(private readonly state: GlobalRiskState = {}) {}

  async check(intent: RiskCheckTarget): Promise<RiskCheckResult> {
    const violations: string[] = [];
    if (this.state.emergencyShutdown) {
      violations.push('Global emergency shutdown is active');
    }
    if (this.state.blockedProviderIds?.includes(intent.context.providerId)) {
      violations.push(`Provider is blocked by global risk: ${intent.context.providerId}`);
    }
    if (this.state.volatilityBlocked) {
      violations.push('Global volatility protection is active');
    }
    if (this.state.liquidityBlocked) {
      violations.push('Global liquidity protection is active');
    }

    return {
      requestId: intent.request.requestId,
      status: violations.length > 0 ? 'rejected' : 'approved',
      violations,
    };
  }
}
