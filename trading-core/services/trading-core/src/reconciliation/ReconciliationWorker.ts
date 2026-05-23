import type {
  ReconciliationProposal,
  ReconciliationWorkerCandidate,
  ReconciliationWorkerRunResult,
} from '../../../../packages/trading-contracts/src/index.js';
import { ProviderReconciliationService } from './ProviderReconciliationService.js';
import { ReconciliationCandidateDiscoveryService } from './ReconciliationCandidateDiscoveryService.js';
import { ReconciliationProposalRepository } from './ReconciliationProposalRepository.js';
import { ReconciliationWorkerAuditService } from './ReconciliationWorkerAuditService.js';

export interface ReconciliationWorkerRunRequest {
  id?: string;
  correlationId: string;
  tenantId?: string;
  now?: string;
}

export interface ReconciliationWorkerDependencies {
  discovery?: ReconciliationCandidateDiscoveryService;
  reconciliation?: ProviderReconciliationService;
  proposals?: ReconciliationProposalRepository;
  audit?: ReconciliationWorkerAuditService;
}

export class ReconciliationWorker {
  private readonly discovery: ReconciliationCandidateDiscoveryService;
  private readonly reconciliation: ProviderReconciliationService;
  private readonly proposals: ReconciliationProposalRepository;
  private readonly audit: ReconciliationWorkerAuditService;

  constructor(deps: ReconciliationWorkerDependencies = {}) {
    this.discovery = deps.discovery ?? new ReconciliationCandidateDiscoveryService();
    this.reconciliation = deps.reconciliation ?? new ProviderReconciliationService();
    this.proposals = deps.proposals ?? new ReconciliationProposalRepository();
    this.audit = deps.audit ?? new ReconciliationWorkerAuditService();
  }

  async run(request: ReconciliationWorkerRunRequest): Promise<ReconciliationWorkerRunResult> {
    const startedAt = request.now ?? new Date().toISOString();
    const runId = request.id ?? `reconciliation-worker:${request.correlationId}:${Date.parse(startedAt)}`;
    const proposals: ReconciliationProposal[] = [];
    const errors: string[] = [];
    let candidates: ReconciliationWorkerCandidate[] = [];

    await this.audit.workerStarted(runId, request.correlationId, request.tenantId, startedAt);

    try {
      candidates = await this.discovery.discover({ tenantId: request.tenantId });
      for (const candidate of candidates) {
        await this.audit.candidateFound(candidate);
        try {
          const proposal = await this.reconciliation.reconcile(candidate.request);
          if (proposal.state !== 'synchronized') {
            const pendingProposal: ReconciliationProposal = {
              ...proposal,
              reviewState: 'pending-review',
              id: `${candidate.id}:proposal`,
            };
            await this.proposals.save(pendingProposal);
            await this.audit.proposalCreated(pendingProposal);
            proposals.push(pendingProposal);
          }
        } catch (error) {
          errors.push(`Candidate ${candidate.id} failed: ${String(error)}`);
        }
      }
    } catch (error) {
      errors.push(`Discovery failed: ${String(error)}`);
    }

    const completedAt = new Date().toISOString();
    const result: ReconciliationWorkerRunResult = {
      id: runId,
      correlationId: request.correlationId,
      status: errors.length > 0 ? 'failed' : 'completed',
      startedAt,
      completedAt,
      candidatesScanned: candidates.length,
      proposalsCreated: proposals.length,
      proposals,
      errors,
    };
    await this.audit.workerCompleted(result);
    return result;
  }
}
