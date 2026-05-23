import type { PositionSnapshot, ReconciliationFinding, ReconciliationRequest } from '../../../../packages/trading-contracts/src/index.js';

export class PositionReconciliationService {
  reconcile(request: ReconciliationRequest): ReconciliationFinding[] {
    const expected = request.sovereignSnapshot.positions;
    const observed = request.providerSnapshot.positions;
    if (!expected || !observed) {
      return [];
    }

    const findings: ReconciliationFinding[] = [];
    const providerPositions = new Map(observed.positions.map((position) => [this.key(position), position]));

    for (const position of expected.positions) {
      const providerPosition = providerPositions.get(this.key(position));
      if (!providerPosition || providerPosition.quantity !== position.quantity || providerPosition.entryPrice !== position.entryPrice) {
        findings.push(this.finding(request, expected, observed, position.market));
      }
    }

    return findings;
  }

  private key(position: PositionSnapshot['positions'][number]): string {
    return `${position.market}:${position.side}`;
  }

  private finding(
    request: ReconciliationRequest,
    expected: PositionSnapshot,
    observed: PositionSnapshot,
    market: string,
  ): ReconciliationFinding {
    return {
      type: 'position-divergence',
      state: 'divergent',
      severity: 'critical',
      message: `Provider position for ${market} differs from sovereign state.`,
      providerId: request.context.providerId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      market,
      expected,
      observed,
    };
  }
}
