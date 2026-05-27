import type {
  ReconciliationRemediationRequest,
  RuntimeRecoveryRequestModel,
} from '../../../../packages/trading-contracts/src/index.js';

export class RuntimeRecoveryRequestRouter {
  route(request: ReconciliationRemediationRequest): RuntimeRecoveryRequestModel | undefined {
    if (request.requestType !== 'runtime-recovery-request') {
      return undefined;
    }
    if (!request.context.runtimeInstanceId) {
      return undefined;
    }
    return {
      id: `${request.id}:runtime-recovery-route`,
      remediationRequestId: request.id,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      providerId: request.context.providerId,
      executionDomain: request.context.executionDomain,
      requestOnly: true,
      mutatesRuntime: false,
    };
  }
}

