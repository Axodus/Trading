export type ProtectionExecutionModeV1 = 'CLOSE_ALL' | 'QUANTITY_BOUNDED';

export type ProtectionRuleTypeV1 = 'HARD_STOP' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'EMERGENCY_CLOSE';

export type TriggerPriceSourceV1 = 'CONTRACT_PRICE' | 'MARK_PRICE';

export type PositionSideModeV1 = 'ONE_WAY' | 'HEDGE';

export type ProtectionLifecycleStateV1 =
  | 'PENDING_SUBMISSION'
  | 'SUBMITTED'
  | 'RECONCILED_ACTIVE'
  | 'TRIGGERED'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'UNKNOWN_AWAITING_RECONCILIATION';

export type TradeProtectionLifecycleStateV1 =
  | 'ENTRY_SUBMITTED'
  | 'ENTRY_RECONCILED'
  | 'EXPOSURE_CONFIRMED'
  | 'PROTECTION_REQUIRED'
  | 'PROTECTION_SUBMITTED'
  | 'PROTECTION_RECONCILED'
  | 'TRADE_FULLY_ARMED'
  | 'UNPROTECTED_EXPOSURE'
  | 'EMERGENCY_RESOLVING'
  | 'EMERGENCY_RESOLVED'
  | 'TERMINAL_CLOSED';

export interface ProtectionRuleV1 {
  ruleId: string;
  ruleType: ProtectionRuleTypeV1;
  executionMode: ProtectionExecutionModeV1;
  triggerPrice: string;
  limitPrice?: string;
  triggerPriceSource: TriggerPriceSourceV1;
  enablePriceProtection?: boolean;
  quantity?: string; // Mandatório em QUANTITY_BOUNDED, proibido/ausente em CLOSE_ALL
  clientProtectionOrderId: string;
  providerProtectionOrderId?: string;
  state: ProtectionLifecycleStateV1;
  createdAt: string;
  updatedAt: string;
}

export interface PositionProtectionPlanV1 {
  planId: string;
  symbol: string;
  market: string;
  providerId: string;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  positionMode: PositionSideModeV1;
  confirmedExposureQuantity: string;
  rules: ProtectionRuleV1[];
  tradeState: TradeProtectionLifecycleStateV1;
  unprotectedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionProtectionCapabilitySnapshotV1 {
  providerId: string;
  environment: string;
  supportsCloseAll: boolean;
  supportsQuantityBounded: boolean;
  supportsStopMarket: boolean;
  supportsTakeProfitMarket: boolean;
  supportsTrailingStop: boolean;
  supportsMarkPriceTrigger: boolean;
  supportsPriceProtection: boolean;
  supportedPositionModes: PositionSideModeV1[];
  timestamp: string;
}

export interface EmergencyCloseCommandV1 {
  commandId: string;
  symbol: string;
  market: string;
  providerId: string;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  positionMode: PositionSideModeV1;
  quantity?: string;
  executionMode: ProtectionExecutionModeV1;
  reason: string;
  initiatedBy: 'trinity' | 'safety-supervisor' | 'risk-envelope' | 'manual-operator';
  createdAt: string;
}

export interface ProtectionSubmissionResultV1 {
  success: boolean;
  ruleId: string;
  clientProtectionOrderId: string;
  providerProtectionOrderId?: string;
  state: ProtectionLifecycleStateV1;
  error?: string;
  rejectionCode?: string;
  rawResponse?: Record<string, unknown>;
}

export interface ProtectionReconciliationResultV1 {
  ruleId: string;
  clientProtectionOrderId: string;
  providerProtectionOrderId?: string;
  state: ProtectionLifecycleStateV1;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  stopPrice?: string;
  origQty?: string;
  executedQty?: string;
  closePosition?: boolean;
  workingType?: string;
  priceProtect?: boolean;
  reconciledAt: string;
}
