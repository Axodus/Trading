import type { BalanceSnapshot } from '../../../../packages/trading-contracts/src/index.js';
import { assertTenantExecutionContext } from './StateContext.js';
import type { PortfolioStateRecord, StateMutationContext } from './StateTypes.js';

export class PortfolioStateService {
  private readonly portfolios = new Map<string, PortfolioStateRecord>();

  save(context: StateMutationContext, snapshot: BalanceSnapshot): PortfolioStateRecord {
    assertTenantExecutionContext(context);
    const ownerId = context.userId ?? context.daoId ?? context.runtimeInstanceId;
    const state: PortfolioStateRecord = {
      ownerId: ownerId as string,
      ownerType: context.userId ? 'user' : 'treasury',
      runtimeInstanceId: context.runtimeInstanceId,
      providerId: snapshot.providerId,
      snapshot,
      updatedAt: snapshot.capturedAt,
    };
    this.portfolios.set(this.key(state.ownerId, snapshot.providerId), state);
    return state;
  }

  getLatest(ownerId: string, providerId: string): PortfolioStateRecord | undefined {
    return this.portfolios.get(this.key(ownerId, providerId));
  }

  list(): PortfolioStateRecord[] {
    return [...this.portfolios.values()];
  }

  private key(ownerId: string, providerId: string): string {
    return `${ownerId}:${providerId}`;
  }
}
