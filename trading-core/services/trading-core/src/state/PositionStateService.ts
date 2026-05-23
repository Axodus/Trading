import type { PositionSnapshot } from '../../../../packages/trading-contracts/src/index.js';
import { assertTenantExecutionContext } from './StateContext.js';
import type { PositionState, StateMutationContext } from './StateTypes.js';

export class PositionStateService {
  private readonly positions = new Map<string, PositionState>();

  save(context: StateMutationContext, snapshot: PositionSnapshot): PositionState {
    assertTenantExecutionContext(context);
    const ownerId = context.userId ?? context.daoId ?? context.runtimeInstanceId;
    const state: PositionState = {
      ownerId: ownerId as string,
      ownerType: context.userId ? 'user' : 'treasury',
      runtimeInstanceId: context.runtimeInstanceId,
      providerId: snapshot.providerId,
      snapshot,
      updatedAt: snapshot.capturedAt,
    };
    this.positions.set(this.key(state.ownerId, snapshot.providerId), state);
    return state;
  }

  getLatest(ownerId: string, providerId: string): PositionState | undefined {
    return this.positions.get(this.key(ownerId, providerId));
  }

  list(): PositionState[] {
    return [...this.positions.values()];
  }

  private key(ownerId: string, providerId: string): string {
    return `${ownerId}:${providerId}`;
  }
}
