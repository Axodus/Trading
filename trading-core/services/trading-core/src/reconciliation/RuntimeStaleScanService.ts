import type { ReconciliationWorkerCandidate, ReconciliationRequest } from '../../../../packages/trading-contracts/src/index.js';
import { StaleExecutionStateDetector } from './StaleExecutionStateDetector.js';

export class RuntimeStaleScanService {
  constructor(private readonly detector = new StaleExecutionStateDetector()) {}

  scan(requests: ReconciliationRequest[]): ReconciliationWorkerCandidate[] {
    return requests.flatMap((request) => this.detector.detect(request).map((finding) => ({
      id: `${request.context.correlationId}:stale-runtime:${finding.runtimeInstanceId ?? 'runtime'}`,
      tenantId: this.tenantId(request),
      candidateType: 'stale-runtime',
      request,
      discoveredAt: request.now ?? new Date().toISOString(),
      reason: finding.message,
    })));
  }

  private tenantId(request: ReconciliationRequest): string {
    return request.context.daoId ?? request.context.userId ?? 'tenant:unknown';
  }
}
