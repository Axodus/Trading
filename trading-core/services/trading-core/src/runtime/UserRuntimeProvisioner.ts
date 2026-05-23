import type { RuntimeQuota, StrategyProduct, UserRuntimeInstance, UserTradingProfile } from '../../../../packages/trading-contracts/src/index.js';
import { RuntimeLifecycleService, RuntimeRecord } from './RuntimeLifecycleService.js';

export interface RuntimeProvisioningRequest {
  userId: string;
  strategyProduct: StrategyProduct;
  userProfile: UserTradingProfile;
  providerId: string;
}

export class RuntimeProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeProvisioningError';
  }
}

export class UserRuntimeProvisioner {
  constructor(private readonly lifecycleService: RuntimeLifecycleService) {}

  provision(request: RuntimeProvisioningRequest): RuntimeRecord {
    this.assertQuotaAvailable(request.userProfile.runtimeQuota, request.strategyProduct.runtimeLimits, request.userId);
    const now = new Date().toISOString();
    const runtime: UserRuntimeInstance = {
      id: `runtime-${request.userId}-${request.strategyProduct.id}-${request.providerId}`,
      userId: request.userId,
      strategyProductId: request.strategyProduct.id,
      providerId: request.providerId,
      executionDomain: 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    return this.lifecycleService.register(runtime);
  }

  private assertQuotaAvailable(userQuota: RuntimeQuota, productQuota: RuntimeQuota, userId: string): void {
    const activeRuntimes = this.lifecycleService.listByUser(userId)
      .filter((record) => record.runtime.status === 'active').length;
    const maxRuntimes = Math.min(userQuota.maxConcurrentRuntimes, productQuota.maxConcurrentRuntimes);
    if (activeRuntimes >= maxRuntimes) {
      throw new RuntimeProvisioningError('Runtime quota exhausted: max concurrent runtimes');
    }
  }
}
