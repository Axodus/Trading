import type { ProviderRuntimeSnapshot, ReconciliationFinding, ReconciliationRequest } from '../../../../packages/trading-contracts/src/index.js';

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

export class StaleExecutionStateDetector {
  detect(request: ReconciliationRequest): ReconciliationFinding[] {
    const now = Date.parse(request.now ?? new Date().toISOString());
    const staleAfterMs = request.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
    const runtimes = request.sovereignSnapshot.runtimes ?? [];
    const findings: ReconciliationFinding[] = [];

    for (const runtime of runtimes) {
      const age = now - Date.parse(runtime.updatedAt);
      if (age > staleAfterMs) {
        findings.push(this.finding(request, runtime, age));
      }
    }

    return findings;
  }

  private finding(
    request: ReconciliationRequest,
    runtime: ProviderRuntimeSnapshot,
    ageMs: number,
  ): ReconciliationFinding {
    return {
      type: 'stale-execution-state',
      state: 'stale',
      severity: 'warning',
      message: `Runtime ${runtime.runtimeInstanceId} has stale execution state.`,
      providerId: request.context.providerId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      expected: {
        maxAgeMs: request.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
      },
      observed: {
        updatedAt: runtime.updatedAt,
        ageMs,
      },
    };
  }
}
