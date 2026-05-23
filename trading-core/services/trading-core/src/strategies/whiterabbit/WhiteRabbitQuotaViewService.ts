import type { WhiteRabbitQuotaView, WhiteRabbitRuntimeView } from '../../../../../packages/trading-contracts/src/index.js';

export class WhiteRabbitQuotaViewService {
  build(runtime: WhiteRabbitRuntimeView): WhiteRabbitQuotaView {
    return {
      activeStrategies: runtime.quotaUsage.activeStrategies,
      activeRuntimes: runtime.quotaUsage.activeRuntimes,
      dailyExecutions: runtime.quotaUsage.dailyExecutions,
      maxActiveStrategies: runtime.quotaUsage.maxActiveStrategies,
      maxConcurrentRuntimes: runtime.quotaUsage.maxConcurrentRuntimes,
      maxDailyExecutions: runtime.quotaUsage.maxDailyExecutions,
      exhausted: runtime.runtimeEnablement.blockers.some((blocker) => blocker.toLowerCase().includes('quota')),
    };
  }
}
