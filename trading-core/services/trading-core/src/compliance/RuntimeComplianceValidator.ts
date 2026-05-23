import type { TradingExecutionContext, TradingRiskDisclosure } from '../../../../packages/trading-contracts/src/index.js';
import { ComplianceGate, type ComplianceDecision } from './ComplianceGate.js';

export class RuntimeComplianceValidator {
  constructor(private readonly complianceGate: ComplianceGate) {}

  validateProvisioning(request: {
    context: TradingExecutionContext;
    disclosures: TradingRiskDisclosure[];
    correlationId?: string;
  }): Promise<ComplianceDecision> {
    return this.complianceGate.authorize({
      ...request,
      target: 'runtime-provisioning',
    });
  }

  validateRuntimeResume(request: {
    context: TradingExecutionContext;
    disclosures: TradingRiskDisclosure[];
    correlationId?: string;
  }): Promise<ComplianceDecision> {
    return this.complianceGate.authorize({
      ...request,
      target: 'runtime-resume',
    });
  }

  validateExecutionEnablement(request: {
    context: TradingExecutionContext;
    disclosures: TradingRiskDisclosure[];
    correlationId?: string;
  }): Promise<ComplianceDecision> {
    return this.complianceGate.authorize({
      ...request,
      target: 'execution-enable',
    });
  }

  validateProviderActivation(request: {
    context: TradingExecutionContext;
    disclosures: TradingRiskDisclosure[];
    correlationId?: string;
  }): Promise<ComplianceDecision> {
    return this.complianceGate.authorize({
      ...request,
      target: 'provider-activation',
    });
  }
}
