import type {
  ManualOperatorReviewRequestModel,
  ProviderResyncRequestModel,
  ReconciliationRemediationRequest,
} from '../../../../packages/trading-contracts/src/index.js';
import { RuntimeRecoveryRequestRouter } from './RuntimeRecoveryRequestRouter.js';

export class ReconciliationRemediationRequestService {
  constructor(private readonly runtimeRecovery = new RuntimeRecoveryRequestRouter()) {}

  runtimeRecoveryRequest(request: ReconciliationRemediationRequest) {
    return this.runtimeRecovery.route(request);
  }

  providerResyncRequest(request: ReconciliationRemediationRequest): ProviderResyncRequestModel | undefined {
    if (request.requestType !== 'provider-resync-request') {
      return undefined;
    }
    return {
      id: `${request.id}:provider-resync-route`,
      remediationRequestId: request.id,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      providerId: request.context.providerId,
      executionDomain: request.context.executionDomain,
      requestOnly: true,
      providerMutationAllowed: false,
      rawProviderPayloadIncluded: false,
    };
  }

  manualOperatorReviewRequest(request: ReconciliationRemediationRequest, reason?: string): ManualOperatorReviewRequestModel | undefined {
    if (request.requestType !== 'manual-operator-review-request'
      && request.requestType !== 'reconciliation-retry-request'
      && request.requestType !== 'paper-validation-retry-request'
      && request.requestType !== 'controlled-resume-review-request') {
      return undefined;
    }
    return {
      id: `${request.id}:manual-operator-review`,
      remediationRequestId: request.id,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      executionDomain: request.context.executionDomain,
      reason: reason ?? request.reason ?? 'Manual operator review requested by reconciliation remediation workflow.',
      requestOnly: true,
      autoApprovalAllowed: false,
    };
  }
}

