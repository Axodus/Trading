import type {
  ExecutionAttempt,
  ExecutionIntent,
  ProviderObservation,
} from '../../../../../../packages/trading-contracts/src/index.js';
import type { ControlledLifecycleAdapter } from './ControlledLifecycleAdapter.js';

export interface SimulatedAdapterBehavior {
  mode?: 'immediate_fill' | 'partial_fill_then_fill' | 'partial_fill_then_cancel' | 'reject' | 'timeout' | 'ack_only' | 'overfill';
  fillPrice?: string;
  firstFillQuantity?: string;
  secondFillQuantity?: string;
  rejectionReason?: string;
  providerOrderId?: string;
}

export class SimulatedControlledLifecycleAdapter implements ControlledLifecycleAdapter {
  public readonly adapterType = 'simulated_controlled_adapter';
  private orders = new Map<string, { status: string; filled: string; total: string; price: string; providerOrderId: string }>();

  constructor(private behavior: SimulatedAdapterBehavior = { mode: 'immediate_fill', fillPrice: '60000' }) {}

 public setBehavior(behavior: SimulatedAdapterBehavior): void {
   this.behavior = behavior;
 }

  public setOrder(
    clientOrderId: string,
    details: { status: string; filled?: string; total: string; price: string; providerOrderId?: string },
  ): void {
    this.orders.set(clientOrderId, {
      status: details.status,
      filled: details.filled ?? '0',
      total: details.total,
      price: details.price,
      providerOrderId: details.providerOrderId ?? `p-ord-${globalThis.crypto.randomUUID().slice(0, 8)}`,
    });
  }

  public updateOrderStatus(clientOrderId: string, status: string): void {
    const order = this.orders.get(clientOrderId);
    if (order) {
      order.status = status;
    }
  }

 public async submitOrder(attempt: ExecutionAttempt, intent: ExecutionIntent): Promise<ProviderObservation> {
    const now = new Date().toISOString();
    const providerOrderId = this.behavior.providerOrderId ?? `p-ord-${globalThis.crypto.randomUUID().slice(0, 8)}`;

    if (this.behavior.mode === 'timeout') {
      throw new Error('ETIMEDOUT: Connection timed out during order submission.');
    }

    if (this.behavior.mode === 'reject') {
      return {
        observationId: globalThis.crypto.randomUUID(),
        observationType: 'SUBMISSION_REJECT',
        provider: this.adapterType,
        venue: intent.venue,
        clientOrderId: attempt.clientOrderId,
        providerStatus: 'REJECTED',
        source: 'rest-submission',
        observedAt: now,
        rawPayloadDigest: `digest-reject-${attempt.clientOrderId}`,
      };
    }

    this.orders.set(attempt.clientOrderId, {
      status: this.behavior.mode === 'ack_only' ? 'OPEN' : 'FILLED',
      filled: this.behavior.mode === 'immediate_fill' ? intent.executionQuantity : '0',
      total: intent.executionQuantity,
      price: this.behavior.fillPrice ?? '60000',
      providerOrderId,
    });

    return {
      observationId: globalThis.crypto.randomUUID(),
      observationType: 'SUBMISSION_ACK',
      provider: this.adapterType,
      venue: intent.venue,
      clientOrderId: attempt.clientOrderId,
      providerOrderId,
      providerStatus: 'NEW',
      observedQuantity: intent.executionQuantity,
      observedPrice: this.behavior.fillPrice ?? '60000',
      source: 'rest-submission',
      observedAt: now,
      rawPayloadDigest: `digest-ack-${attempt.clientOrderId}`,
    };
  }

  public async queryOrder(clientOrderId: string, providerOrderId?: string): Promise<ProviderObservation> {
    const now = new Date().toISOString();
    const order = this.orders.get(clientOrderId);

    if (!order) {
      return {
        observationId: globalThis.crypto.randomUUID(),
        observationType: 'ORDER_STATUS',
        provider: this.adapterType,
        venue: 'binance',
        clientOrderId,
        providerOrderId,
        providerStatus: 'NOT_FOUND',
        source: 'rest-query',
        observedAt: now,
        rawPayloadDigest: `digest-query-notfound-${clientOrderId}`,
      };
    }

    return {
      observationId: globalThis.crypto.randomUUID(),
      observationType: 'ORDER_STATUS',
      provider: this.adapterType,
      venue: 'binance',
      clientOrderId,
      providerOrderId: order.providerOrderId,
      providerStatus: order.status,
      observedQuantity: order.total,
      observedPrice: order.price,
      source: 'rest-query',
      observedAt: now,
      rawPayloadDigest: `digest-query-${clientOrderId}`,
    };
  }

  public async cancelOrder(clientOrderId: string, providerOrderId?: string): Promise<ProviderObservation> {
    const now = new Date().toISOString();
    const order = this.orders.get(clientOrderId);

    if (order) {
      order.status = 'CANCELED';
    }

    return {
      observationId: globalThis.crypto.randomUUID(),
      observationType: 'CANCEL_ACK',
      provider: this.adapterType,
      venue: 'binance',
      clientOrderId,
      providerOrderId: providerOrderId ?? order?.providerOrderId,
      providerStatus: 'CANCELED',
      source: 'rest-cancellation',
      observedAt: now,
      rawPayloadDigest: `digest-cancel-${clientOrderId}`,
    };
  }

  public async queryFills(clientOrderId: string): Promise<ProviderObservation[]> {
    const now = new Date().toISOString();
    const order = this.orders.get(clientOrderId);
    if (!order) return [];

    if (this.behavior.mode === 'immediate_fill') {
      return [
        {
          observationId: globalThis.crypto.randomUUID(),
          observationType: 'FILL',
          provider: this.adapterType,
          venue: 'binance',
          clientOrderId,
          providerOrderId: order.providerOrderId,
          providerTradeId: `trade-${clientOrderId}-1`,
          observedQuantity: order.total,
          observedPrice: order.price,
          source: 'rest-query',
          observedAt: now,
          rawPayloadDigest: `digest-fill-${clientOrderId}-1`,
        },
      ];
    }

    if (this.behavior.mode === 'partial_fill_then_fill') {
      const p1 = this.behavior.firstFillQuantity ?? '0.002';
      const p2 = this.behavior.secondFillQuantity ?? '0.003';
      return [
        {
          observationId: globalThis.crypto.randomUUID(),
          observationType: 'PARTIAL_FILL',
          provider: this.adapterType,
          venue: 'binance',
          clientOrderId,
          providerOrderId: order.providerOrderId,
          providerTradeId: `trade-${clientOrderId}-p1`,
          observedQuantity: p1,
          observedPrice: order.price,
          source: 'rest-query',
          observedAt: now,
          rawPayloadDigest: `digest-fill-${clientOrderId}-p1`,
        },
        {
          observationId: globalThis.crypto.randomUUID(),
          observationType: 'FILL',
          provider: this.adapterType,
          venue: 'binance',
          clientOrderId,
          providerOrderId: order.providerOrderId,
          providerTradeId: `trade-${clientOrderId}-p2`,
          observedQuantity: p2,
          observedPrice: order.price,
          source: 'rest-query',
          observedAt: now,
          rawPayloadDigest: `digest-fill-${clientOrderId}-p2`,
        },
      ];
    }

    return [];
  }
}
