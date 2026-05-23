import type {
  TradingEvent,
  TradingExecutionContext,
  TradingRiskDisclosure,
  UserRiskAcceptance,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';

export class DisclosureAcceptanceService {
  private readonly acceptances = new Map<string, UserRiskAcceptance>();

  constructor(initialAcceptances: UserRiskAcceptance[] = [], private readonly eventBus?: TradingEventBus) {
    for (const acceptance of initialAcceptances) {
      this.acceptances.set(this.key(acceptance.userId, acceptance.disclosureId), { ...acceptance });
    }
  }

  async accept(request: {
    context: TradingExecutionContext;
    disclosure: TradingRiskDisclosure;
    acceptedAt?: string;
    expiresAt?: string;
    correlationId?: string;
  }): Promise<UserRiskAcceptance> {
    if (request.context.executionDomain !== 'user' || !request.context.userId) {
      throw new Error('Disclosure acceptance requires user execution context.');
    }

    const acceptance: UserRiskAcceptance = {
      userId: request.context.userId,
      disclosureId: request.disclosure.id,
      disclosureVersion: request.disclosure.version,
      acceptedAt: request.acceptedAt ?? new Date().toISOString(),
      expiresAt: request.expiresAt,
      executionDomain: 'user',
    };
    this.acceptances.set(this.key(acceptance.userId, acceptance.disclosureId), acceptance);

    await this.publish({
      id: `${request.disclosure.id}:risk-disclosure-accepted`,
      type: 'RISK_DISCLOSURE_ACCEPTED',
      occurredAt: acceptance.acceptedAt,
      correlationId: request.correlationId ?? `risk-disclosure-accepted-${request.disclosure.id}`,
      source: 'compliance',
      userId: request.context.userId,
      strategyId: request.context.strategyId,
      strategyProductId: request.context.strategyProductId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      payload: {
        providerId: request.context.providerId,
        disclosureId: request.disclosure.id,
        disclosureVersion: request.disclosure.version,
      },
    });

    return { ...acceptance };
  }

  find(userId: string, disclosureId: string): UserRiskAcceptance | undefined {
    const acceptance = this.acceptances.get(this.key(userId, disclosureId));
    return acceptance ? { ...acceptance } : undefined;
  }

  listByUser(userId: string): UserRiskAcceptance[] {
    return [...this.acceptances.values()]
      .filter((acceptance) => acceptance.userId === userId)
      .map((acceptance) => ({ ...acceptance }));
  }

  private async publish(event: TradingEvent): Promise<void> {
    await this.eventBus?.publish(event);
  }

  private key(userId: string, disclosureId: string): string {
    return `${userId}:${disclosureId}`;
  }
}
