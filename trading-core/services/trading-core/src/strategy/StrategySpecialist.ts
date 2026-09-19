import type { StrategyFamily } from '../../../../packages/trading-contracts/src/index.js';
import type { StrategyContext, StrategySpecialistResult } from './StrategyContext.js';

export interface StrategySpecialist {
  readonly specialistId: string;
  readonly strategyId: string;
  readonly supportedFamilies: readonly StrategyFamily[];
  evaluate(context: StrategyContext): Promise<StrategySpecialistResult> | StrategySpecialistResult;
}

export interface StrategySpecialistRegistry {
  register(specialist: StrategySpecialist): void;
  resolve(strategyId: string): StrategySpecialist | undefined;
  list(): readonly StrategySpecialist[];
}

export class InMemoryStrategySpecialistRegistry implements StrategySpecialistRegistry {
  private readonly specialists = new Map<string, StrategySpecialist>();

  register(specialist: StrategySpecialist): void {
    this.specialists.set(specialist.strategyId, specialist);
  }

  resolve(strategyId: string): StrategySpecialist | undefined {
    return this.specialists.get(strategyId);
  }

  list(): readonly StrategySpecialist[] {
    return [...this.specialists.values()];
  }
}
