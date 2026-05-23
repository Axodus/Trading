import type { UserRuntimeInstance } from '../../../../packages/trading-contracts/src/index.js';

export interface RuntimeIsolationState {
  credentialBindingId: string;
  positionScopeId: string;
  balanceScopeId: string;
  executionStateScopeId: string;
}

export class RuntimeIsolationPolicy {
  createIsolationState(runtime: UserRuntimeInstance): RuntimeIsolationState {
    const scope = `${runtime.userId}:${runtime.id}:${runtime.strategyProductId}`;
    return {
      credentialBindingId: `credential:${scope}`,
      positionScopeId: `positions:${scope}`,
      balanceScopeId: `balances:${scope}`,
      executionStateScopeId: `execution:${scope}`,
    };
  }

  assertIsolated(left: RuntimeIsolationState, right: RuntimeIsolationState): boolean {
    return left.credentialBindingId !== right.credentialBindingId
      && left.positionScopeId !== right.positionScopeId
      && left.balanceScopeId !== right.balanceScopeId
      && left.executionStateScopeId !== right.executionStateScopeId;
  }
}
