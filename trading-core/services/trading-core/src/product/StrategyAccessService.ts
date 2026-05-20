import type {
  ExecutionQuota,
  StrategyProduct,
  UserRuntimeInstance,
  UserTradingProfile,
} from '../../../../packages/trading-contracts/src/index.js';

export interface ProductAccessState {
  strategyProducts?: StrategyProduct[];
  userProfiles?: UserTradingProfile[];
  runtimeInstances?: UserRuntimeInstance[];
  executionQuotas?: ExecutionQuota[];
  dailyExecutionCounts?: Record<string, number>;
  activeRuntimeCounts?: Record<string, number>;
  activeStrategyCounts?: Record<string, number>;
  concurrentPositionCounts?: Record<string, number>;
  daoMemberships?: Record<string, string[]>;
}

export class StrategyAccessService {
  private readonly strategyProducts = new Map<string, StrategyProduct>();
  private readonly userProfiles = new Map<string, UserTradingProfile>();
  private readonly runtimeInstances = new Map<string, UserRuntimeInstance>();
  private readonly executionQuotas = new Map<string, ExecutionQuota>();
  private readonly dailyExecutionCounts: Record<string, number>;
  private readonly activeRuntimeCounts: Record<string, number>;
  private readonly activeStrategyCounts: Record<string, number>;
  private readonly concurrentPositionCounts: Record<string, number>;
  private readonly daoMemberships: Record<string, string[]>;

  constructor(state: ProductAccessState = {}) {
    for (const product of state.strategyProducts ?? []) {
      this.strategyProducts.set(product.id, product);
    }
    for (const profile of state.userProfiles ?? []) {
      this.userProfiles.set(profile.userId, profile);
    }
    for (const runtime of state.runtimeInstances ?? []) {
      this.runtimeInstances.set(runtime.id, runtime);
    }
    for (const quota of state.executionQuotas ?? []) {
      this.executionQuotas.set(quota.strategyId, quota);
    }
    this.dailyExecutionCounts = state.dailyExecutionCounts ?? {};
    this.activeRuntimeCounts = state.activeRuntimeCounts ?? {};
    this.activeStrategyCounts = state.activeStrategyCounts ?? {};
    this.concurrentPositionCounts = state.concurrentPositionCounts ?? {};
    this.daoMemberships = state.daoMemberships ?? {};
  }

  getStrategyProduct(strategyProductId: string): StrategyProduct | undefined {
    return this.strategyProducts.get(strategyProductId);
  }

  getUserProfile(userId: string): UserTradingProfile | undefined {
    return this.userProfiles.get(userId);
  }

  getRuntimeInstance(runtimeInstanceId: string): UserRuntimeInstance | undefined {
    return this.runtimeInstances.get(runtimeInstanceId);
  }

  getExecutionQuota(strategyId: string): ExecutionQuota | undefined {
    return this.executionQuotas.get(strategyId);
  }

  getDailyExecutionCount(userId: string, strategyProductId: string): number {
    return this.dailyExecutionCounts[this.key(userId, strategyProductId)] ?? 0;
  }

  getActiveRuntimeCount(userId: string): number {
    return this.activeRuntimeCounts[userId] ?? 0;
  }

  getActiveStrategyCount(userId: string): number {
    return this.activeStrategyCounts[userId] ?? 0;
  }

  getConcurrentPositionCount(userId: string, strategyProductId: string): number {
    return this.concurrentPositionCounts[this.key(userId, strategyProductId)] ?? 0;
  }

  isDaoMember(userId: string, daoId: string): boolean {
    return (this.daoMemberships[userId] ?? []).includes(daoId);
  }

  private key(userId: string, strategyProductId: string): string {
    return `${userId}:${strategyProductId}`;
  }
}
