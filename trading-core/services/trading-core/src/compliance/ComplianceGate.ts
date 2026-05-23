import type {
  DisclosureRequirementTarget,
  TradingEvent,
  TradingExecutionContext,
  TradingRiskDisclosure,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { DisclosureAcceptanceService } from './DisclosureAcceptanceService.js';
import { DisclosureRequirementEvaluator } from './DisclosureRequirementEvaluator.js';
import { DisclosureVersionService } from './DisclosureVersionService.js';

export interface ComplianceDecision {
  approved: boolean;
  bypassed?: boolean;
  reason?: string;
  missingDisclosureIds: string[];
  expiredDisclosureIds: string[];
  versionMismatchDisclosureIds: string[];
}

export class ComplianceGate {
  constructor(
    private readonly acceptanceService: DisclosureAcceptanceService,
    private readonly requirementEvaluator = new DisclosureRequirementEvaluator(),
    private readonly versionService = new DisclosureVersionService(),
    private readonly eventBus?: TradingEventBus,
  ) {}

  async authorize(request: {
    context: TradingExecutionContext;
    target: DisclosureRequirementTarget;
    disclosures: TradingRiskDisclosure[];
    correlationId?: string;
  }): Promise<ComplianceDecision> {
    if (request.context.executionDomain === 'treasury') {
      return {
        approved: true,
        bypassed: true,
        missingDisclosureIds: [],
        expiredDisclosureIds: [],
        versionMismatchDisclosureIds: [],
      };
    }

    const required = this.requirementEvaluator.getRequiredDisclosures(request);
    for (const disclosure of required) {
      await this.publishDisclosureEvent(request.context, disclosure, 'RISK_DISCLOSURE_REQUIRED', request.correlationId);
    }

    const missingDisclosureIds: string[] = [];
    const expiredDisclosureIds: string[] = [];
    const versionMismatchDisclosureIds: string[] = [];

    for (const disclosure of required) {
      const acceptance = request.context.userId
        ? this.acceptanceService.find(request.context.userId, disclosure.id)
        : undefined;
      const status = this.versionService.validate(disclosure, acceptance);
      if (status === 'missing') {
        missingDisclosureIds.push(disclosure.id);
        await this.publishDisclosureEvent(request.context, disclosure, 'RISK_DISCLOSURE_MISSING', request.correlationId, 'Required disclosure acceptance is missing.');
      } else if (status === 'expired') {
        expiredDisclosureIds.push(disclosure.id);
        await this.publishDisclosureEvent(request.context, disclosure, 'RISK_DISCLOSURE_EXPIRED', request.correlationId, 'Disclosure acceptance is expired.');
      } else if (status === 'version-mismatch') {
        versionMismatchDisclosureIds.push(disclosure.id);
        await this.publishDisclosureEvent(request.context, disclosure, 'RISK_DISCLOSURE_MISSING', request.correlationId, 'Disclosure acceptance version is outdated.');
      }
    }

    const approved = missingDisclosureIds.length === 0
      && expiredDisclosureIds.length === 0
      && versionMismatchDisclosureIds.length === 0;

    if (!approved) {
      const reason = this.reason({ missingDisclosureIds, expiredDisclosureIds, versionMismatchDisclosureIds });
      await this.eventBus?.publish({
        id: `${request.target}:runtime-compliance-rejected`,
        type: 'RUNTIME_COMPLIANCE_REJECTED',
        occurredAt: new Date().toISOString(),
        correlationId: request.correlationId ?? `runtime-compliance-rejected-${request.target}`,
        source: 'compliance',
        userId: request.context.userId,
        strategyId: request.context.strategyId,
        strategyProductId: request.context.strategyProductId,
        runtimeInstanceId: request.context.runtimeInstanceId,
        payload: {
          providerId: request.context.providerId,
          target: request.target,
          reason,
          missingDisclosureIds,
          expiredDisclosureIds,
          versionMismatchDisclosureIds,
        },
      });

      return {
        approved: false,
        reason,
        missingDisclosureIds,
        expiredDisclosureIds,
        versionMismatchDisclosureIds,
      };
    }

    return {
      approved: true,
      missingDisclosureIds,
      expiredDisclosureIds,
      versionMismatchDisclosureIds,
    };
  }

  private async publishDisclosureEvent(
    context: TradingExecutionContext,
    disclosure: TradingRiskDisclosure,
    type: Extract<TradingEvent['type'], 'RISK_DISCLOSURE_REQUIRED' | 'RISK_DISCLOSURE_MISSING' | 'RISK_DISCLOSURE_EXPIRED'>,
    correlationId?: string,
    reason?: string,
  ): Promise<void> {
    await this.eventBus?.publish({
      id: `${disclosure.id}:${type.toLowerCase()}`,
      type,
      occurredAt: new Date().toISOString(),
      correlationId: correlationId ?? `${type.toLowerCase()}-${disclosure.id}`,
      source: 'compliance',
      userId: context.userId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      runtimeInstanceId: context.runtimeInstanceId,
      payload: {
        providerId: context.providerId,
        disclosureId: disclosure.id,
        disclosureVersion: disclosure.version,
        category: disclosure.category,
        reason,
      },
    });
  }

  private reason(input: Omit<ComplianceDecision, 'approved' | 'reason' | 'bypassed'>): string {
    if (input.missingDisclosureIds.length > 0) {
      return `Missing disclosure acceptance: ${input.missingDisclosureIds.join(', ')}`;
    }
    if (input.expiredDisclosureIds.length > 0) {
      return `Expired disclosure acceptance: ${input.expiredDisclosureIds.join(', ')}`;
    }
    return `Outdated disclosure acceptance: ${input.versionMismatchDisclosureIds.join(', ')}`;
  }
}
