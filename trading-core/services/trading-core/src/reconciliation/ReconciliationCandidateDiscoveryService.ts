import type { ReconciliationWorkerCandidate } from '../../../../packages/trading-contracts/src/index.js';

export interface ReconciliationDiscoveryFilter {
  tenantId?: string;
}

export class ReconciliationCandidateDiscoveryService {
  constructor(private readonly candidates: ReconciliationWorkerCandidate[] = []) {}

  add(candidate: ReconciliationWorkerCandidate): void {
    this.candidates.push(candidate);
  }

  async discover(filter: ReconciliationDiscoveryFilter = {}): Promise<ReconciliationWorkerCandidate[]> {
    return this.candidates
      .filter((candidate) => !filter.tenantId || candidate.tenantId === filter.tenantId)
      .map((candidate) => JSON.parse(JSON.stringify(candidate)) as ReconciliationWorkerCandidate);
  }
}
