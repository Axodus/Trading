import type {
  ExecutionAttempt,
  ExecutionIntent,
  ProviderObservation,
} from '../../../../../../packages/trading-contracts/src/index.js';

export interface ControlledLifecycleAdapter {
  readonly adapterType: string;
  submitOrder(attempt: ExecutionAttempt, intent: ExecutionIntent): Promise<ProviderObservation>;
  queryOrder(clientOrderId: string, providerOrderId?: string): Promise<ProviderObservation>;
  cancelOrder(clientOrderId: string, providerOrderId?: string): Promise<ProviderObservation>;
  queryFills?(clientOrderId: string): Promise<ProviderObservation[]>;
}

