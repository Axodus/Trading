import type { ReconciliationFinding, ReconciliationRequest } from '../../../../packages/trading-contracts/src/index.js';

export class ProviderDriftDetector {
  detect(request: ReconciliationRequest): ReconciliationFinding[] {
    const expected = request.sovereignSnapshot.providerStatus;
    const observed = request.providerSnapshot.providerStatus;
    if (!expected) {
      return [];
    }

    if (expected.health === observed.health && expected.connected === observed.connected) {
      return [];
    }

    return [{
      type: 'provider-state-drift',
      state: observed.health === 'offline' ? 'degraded' : 'divergent',
      severity: observed.health === 'offline' ? 'critical' : 'warning',
      message: `Provider ${observed.providerId} state differs from sovereign state.`,
      providerId: observed.providerId,
      expected: {
        connected: expected.connected,
        health: expected.health,
      },
      observed: {
        connected: observed.connected,
        health: observed.health,
      },
    }];
  }
}
