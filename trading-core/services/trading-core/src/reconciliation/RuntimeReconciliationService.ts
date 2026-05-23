import type { ProviderRuntimeSnapshot, ReconciliationFinding, ReconciliationRequest } from '../../../../packages/trading-contracts/src/index.js';

export class RuntimeReconciliationService {
  reconcile(request: ReconciliationRequest): ReconciliationFinding[] {
    const providerRuntimes = new Map((request.providerSnapshot.runtimes ?? []).map((runtime) => [runtime.runtimeInstanceId, runtime]));
    const sovereignRuntimes = request.sovereignSnapshot.runtimes ?? [];
    const findings: ReconciliationFinding[] = [];

    for (const runtime of sovereignRuntimes) {
      const providerRuntime = providerRuntimes.get(runtime.runtimeInstanceId);
      if (!providerRuntime) {
        findings.push(this.orphanFinding(request, runtime));
        continue;
      }
      if (providerRuntime.status !== runtime.status) {
        findings.push(this.driftFinding(request, runtime, providerRuntime));
      }
    }

    return findings;
  }

  private orphanFinding(request: ReconciliationRequest, runtime: ProviderRuntimeSnapshot): ReconciliationFinding {
    return {
      type: 'orphan-runtime',
      state: 'orphaned',
      severity: 'critical',
      message: `Runtime ${runtime.runtimeInstanceId} is tracked by Axodus but missing from provider snapshot.`,
      providerId: request.context.providerId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      expected: runtime,
      observed: undefined,
    };
  }

  private driftFinding(
    request: ReconciliationRequest,
    expected: ProviderRuntimeSnapshot,
    observed: ProviderRuntimeSnapshot,
  ): ReconciliationFinding {
    return {
      type: 'runtime-drift',
      state: observed.status === 'degraded' || observed.status === 'offline' ? 'degraded' : 'divergent',
      severity: observed.status === 'offline' ? 'critical' : 'warning',
      message: `Runtime ${expected.runtimeInstanceId} status differs from provider snapshot.`,
      providerId: request.context.providerId,
      runtimeInstanceId: expected.runtimeInstanceId,
      expected,
      observed,
    };
  }
}
