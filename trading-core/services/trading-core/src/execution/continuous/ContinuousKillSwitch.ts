export type KillSwitchTriggerReason =
  | 'UNKNOWN_EXECUTION'
  | 'RECONCILIATION_FAILED'
  | 'UNEXPECTED_OPEN_ORDER'
  | 'UNEXPECTED_POSITION'
  | 'POSITION_DIVERGENCE'
  | 'STALE_MARKET_DATA'
  | 'PERSISTENCE_FAILURE'
  | 'CREDENTIAL_FAILURE'
  | 'REPEATED_PROVIDER_FAILURE'
  | 'RISK_BREACH'
  | 'OPERATOR_STOP';

export interface KillSwitchState {
  active: boolean;
  reason?: KillSwitchTriggerReason;
  details?: string;
  triggeredAt?: string;
  clearedAt?: string;
  triggeredBy?: string;
}

export class ContinuousKillSwitch {
  private state: KillSwitchState = { active: false };

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  isActive(): boolean {
    return this.state.active;
  }

  getState(): KillSwitchState {
    return { ...this.state };
  }

  trigger(reason: KillSwitchTriggerReason, details?: string, triggeredBy = 'system'): KillSwitchState {
    this.state = {
      active: true,
      reason,
      details,
      triggeredAt: this.now(),
      triggeredBy,
    };
    return this.getState();
  }

  clear(operatorRationale: string, operatorId = 'operator'): KillSwitchState {
    if (!this.state.active) {
      return this.getState();
    }
    this.state = {
      active: false,
      clearedAt: this.now(),
      details: 'Cleared by ' + operatorId + ': ' + operatorRationale,
    };
    return this.getState();
  }
}
