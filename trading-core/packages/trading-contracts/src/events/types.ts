export type TradingOperationalEvent =
  | 'MARKET_DATA_RECEIVED'
  | 'SIGNAL_CREATED'
  | 'RISK_CHECK_REQUESTED'
  | 'RISK_CHECK_APPROVED'
  | 'RISK_CHECK_REJECTED'
  | 'EXECUTION_REQUESTED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELLED'
  | 'EXECUTION_FAILED'
  | 'GOVERNANCE_EXECUTION_BLOCKED'
  | 'EMERGENCY_SHUTDOWN_TRIGGERED';

export type TradingProductEvent =
  | 'STRATEGY_PRODUCT_PUBLISHED'
  | 'STRATEGY_ACCESS_GRANTED'
  | 'STRATEGY_ACCESS_REVOKED'
  | 'USER_RUNTIME_PROVISION_REQUESTED'
  | 'USER_RUNTIME_PROVISIONED'
  | 'USER_RUNTIME_SUSPENDED'
  | 'RUNTIME_QUOTA_EXCEEDED'
  | 'SUBSCRIPTION_TIER_CHANGED'
  | 'TOKEN_ACCESS_POLICY_FAILED'
  | 'BILLING_ENTITLEMENT_GRANTED'
  | 'BILLING_ENTITLEMENT_REVOKED';

export type TradingSecurityComplianceEvent =
  | 'CREDENTIAL_BINDING_CREATED'
  | 'CREDENTIAL_BINDING_REVOKED'
  | 'WALLET_RUNTIME_BINDING_CREATED'
  | 'RISK_DISCLOSURE_REQUIRED'
  | 'RISK_DISCLOSURE_ACCEPTED'
  | 'RISK_DISCLOSURE_MISSING';

export type TradingEventType =
  | TradingOperationalEvent
  | TradingProductEvent
  | TradingSecurityComplianceEvent;

export type TradingEventSource =
  | 'core'
  | 'agent'
  | 'provider'
  | 'governance'
  | 'risk'
  | 'product'
  | 'security'
  | 'compliance';

export interface TradingEvent<TType extends TradingEventType = TradingEventType, TPayload = Record<string, unknown>> {
  id: string;
  type: TType;
  occurredAt: string;
  correlationId: string;
  source: TradingEventSource;
  daoId?: string;
  federationId?: string;
  userId?: string;
  strategyId?: string;
  strategyProductId?: string;
  runtimeInstanceId?: string;
  payload: TPayload;
}
