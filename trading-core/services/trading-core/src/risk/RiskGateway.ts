import type { RiskCheckResult } from '../../../../packages/trading-contracts/src/index.js';
import { GlobalRiskGateway, GlobalRiskState } from './GlobalRiskGateway.js';
import { TreasuryRiskGateway, TreasuryRiskState } from './TreasuryRiskGateway.js';
import { UserRuntimeRiskGateway, UserRuntimeRiskState } from './UserRuntimeRiskGateway.js';
import type { RiskCheckTarget } from './RiskCheckTarget.js';

export interface RiskGatewayState {
  global?: GlobalRiskState;
  treasury?: TreasuryRiskState;
  userRuntime?: UserRuntimeRiskState;
}

export interface RiskGatewayOptions {
  globalRiskGateway?: GlobalRiskGateway;
  treasuryRiskGateway?: TreasuryRiskGateway;
  userRuntimeRiskGateway?: UserRuntimeRiskGateway;
  approveByDefault?: boolean;
}

export class RiskGateway {
  private readonly globalRiskGateway?: GlobalRiskGateway;
  private readonly treasuryRiskGateway?: TreasuryRiskGateway;
  private readonly userRuntimeRiskGateway?: UserRuntimeRiskGateway;
  private readonly approveByDefault: boolean;

  constructor(options: RiskGatewayOptions | RiskGatewayState | boolean = false) {
    if (typeof options === 'boolean') {
      this.approveByDefault = options;
      return;
    }

    const hasExplicitOptions = 'globalRiskGateway' in options
      || 'treasuryRiskGateway' in options
      || 'userRuntimeRiskGateway' in options
      || 'approveByDefault' in options;
    if (hasExplicitOptions) {
      const explicit = options as RiskGatewayOptions;
      this.globalRiskGateway = explicit.globalRiskGateway;
      this.treasuryRiskGateway = explicit.treasuryRiskGateway;
      this.userRuntimeRiskGateway = explicit.userRuntimeRiskGateway;
      this.approveByDefault = explicit.approveByDefault ?? false;
      return;
    }

    const state = options as RiskGatewayState;
    this.globalRiskGateway = new GlobalRiskGateway(state.global);
    this.treasuryRiskGateway = new TreasuryRiskGateway(state.treasury);
    this.userRuntimeRiskGateway = new UserRuntimeRiskGateway(state.userRuntime);
    this.approveByDefault = false;
  }

  async check(intent: RiskCheckTarget): Promise<RiskCheckResult> {
    if (this.globalRiskGateway || this.treasuryRiskGateway || this.userRuntimeRiskGateway) {
      const violations: string[] = [];
      for (const gateway of [
        this.globalRiskGateway,
        this.treasuryRiskGateway,
        this.userRuntimeRiskGateway,
      ]) {
        const result = await gateway?.check(intent);
        if (result?.violations.length) {
          violations.push(...result.violations);
        }
      }

      return {
        requestId: intent.request.requestId,
        status: violations.length > 0 ? 'rejected' : 'approved',
        violations,
      };
    }

    if (!this.approveByDefault) {
      return {
        requestId: intent.request.requestId,
        status: 'rejected',
        violations: ['Risk approval required before provider execution'],
      };
    }

    return {
      requestId: intent.request.requestId,
      status: 'approved',
      violations: [],
    };
  }
}
