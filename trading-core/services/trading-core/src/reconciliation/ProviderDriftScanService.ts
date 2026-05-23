import type { ReconciliationWorkerCandidate, ReconciliationRequest } from '../../../../packages/trading-contracts/src/index.js';
import { ProviderDriftDetector } from './ProviderDriftDetector.js';

export class ProviderDriftScanService {
  constructor(private readonly detector = new ProviderDriftDetector()) {}

  scan(requests: ReconciliationRequest[]): ReconciliationWorkerCandidate[] {
    return requests.flatMap((request) => this.detector.detect(request).map((finding) => ({
      id: `${request.context.correlationId}:provider-drift:${finding.providerId}`,
      tenantId: this.tenantId(request),
      candidateType: 'provider-drift',
      request,
      discoveredAt: request.now ?? new Date().toISOString(),
      reason: finding.message,
    })));
  }

  private tenantId(request: ReconciliationRequest): string {
    return request.context.daoId ?? request.context.userId ?? 'tenant:unknown';
  }
}
