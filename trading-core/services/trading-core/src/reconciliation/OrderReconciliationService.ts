import type { ProviderOrderSnapshot, ReconciliationFinding, ReconciliationRequest } from '../../../../packages/trading-contracts/src/index.js';

export class OrderReconciliationService {
  reconcile(request: ReconciliationRequest): ReconciliationFinding[] {
    const providerOrders = new Map((request.providerSnapshot.orders ?? []).map((order) => [order.providerOrderId, order]));
    const sovereignOrders = request.sovereignSnapshot.orders ?? [];
    const findings: ReconciliationFinding[] = [];

    for (const order of sovereignOrders) {
      const providerOrder = providerOrders.get(order.providerOrderId);
      if (!providerOrder) {
        findings.push(this.finding(request, order, undefined, 'Provider is missing an order tracked by sovereign state.'));
        continue;
      }
      if (providerOrder.status !== order.status) {
        findings.push(this.finding(request, order, providerOrder, 'Provider order status differs from sovereign state.'));
      }
    }

    for (const providerOrder of providerOrders.values()) {
      if (!sovereignOrders.some((order) => order.providerOrderId === providerOrder.providerOrderId)) {
        findings.push(this.finding(request, undefined, providerOrder, 'Provider has an order not tracked by sovereign state.'));
      }
    }

    return findings;
  }

  private finding(
    request: ReconciliationRequest,
    expected: ProviderOrderSnapshot | undefined,
    observed: ProviderOrderSnapshot | undefined,
    message: string,
  ): ReconciliationFinding {
    return {
      type: 'order-divergence',
      state: 'divergent',
      severity: 'warning',
      message,
      providerId: request.context.providerId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      providerOrderId: expected?.providerOrderId ?? observed?.providerOrderId,
      market: expected?.market ?? observed?.market,
      expected,
      observed,
    };
  }
}
