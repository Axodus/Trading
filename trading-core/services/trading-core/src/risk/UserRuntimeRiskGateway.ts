import type { RiskCheckResult } from '../../../../packages/trading-contracts/src/index.js';
import type { ExecutionIntent } from '../application/ExecutionIntent.js';

export interface UserRuntimeRiskState {
  requestedUserExposure?: number;
  maxUserExposure?: number;
  beginnerSafeMode?: boolean;
  maxBeginnerQuantity?: number;
  exchangeWhitelist?: string[];
  quoteCurrencyWhitelist?: string[];
}

export class UserRuntimeRiskGateway {
  constructor(private readonly state: UserRuntimeRiskState = {}) {}

  async check(intent: ExecutionIntent): Promise<RiskCheckResult> {
    if (intent.context.executionDomain !== 'user') {
      return { requestId: intent.request.requestId, status: 'approved', violations: [] };
    }

    const violations: string[] = [];
    const [exchangeOrBase, quoteCurrency] = intent.request.market.split('-');
    if (this.state.maxUserExposure !== undefined && (this.state.requestedUserExposure ?? 0) > this.state.maxUserExposure) {
      violations.push('User exposure exceeds runtime risk limit');
    }
    if (this.state.beginnerSafeMode && Number(intent.request.quantity) > (this.state.maxBeginnerQuantity ?? 1)) {
      violations.push('Beginner-safe execution limit exceeded');
    }
    if (this.state.exchangeWhitelist && !this.state.exchangeWhitelist.includes(intent.context.providerId)) {
      violations.push(`Provider is not allowed for user runtime: ${intent.context.providerId}`);
    }
    if (this.state.quoteCurrencyWhitelist && quoteCurrency && !this.state.quoteCurrencyWhitelist.includes(quoteCurrency)) {
      violations.push(`Quote currency is not allowed: ${quoteCurrency}`);
    }
    if (!exchangeOrBase || !quoteCurrency) {
      violations.push('Market must include base and quote currency');
    }

    return {
      requestId: intent.request.requestId,
      status: violations.length > 0 ? 'rejected' : 'approved',
      violations,
    };
  }
}
