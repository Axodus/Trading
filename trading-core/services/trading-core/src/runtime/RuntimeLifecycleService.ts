import type { TenantExecutionMetrics, UserRuntimeInstance } from '../../../../packages/trading-contracts/src/index.js';
import { RuntimeIsolationPolicy, RuntimeIsolationState } from './RuntimeIsolationPolicy.js';

export interface RuntimeRecord {
  runtime: UserRuntimeInstance;
  isolation: RuntimeIsolationState;
  telemetry: TenantExecutionMetrics;
}

export class RuntimeLifecycleService {
  private readonly runtimes = new Map<string, RuntimeRecord>();

  constructor(private readonly isolationPolicy = new RuntimeIsolationPolicy()) {}

  register(runtime: UserRuntimeInstance): RuntimeRecord {
    const record: RuntimeRecord = {
      runtime,
      isolation: this.isolationPolicy.createIsolationState(runtime),
      telemetry: {
        userId: runtime.userId,
        runtimeInstanceId: runtime.id,
        strategyProductId: runtime.strategyProductId,
        executionCount: 0,
      },
    };
    this.runtimes.set(runtime.id, record);
    return record;
  }

  suspend(runtimeInstanceId: string): UserRuntimeInstance {
    return this.updateStatus(runtimeInstanceId, 'suspended');
  }

  pause(runtimeInstanceId: string): UserRuntimeInstance {
    return this.updateStatus(runtimeInstanceId, 'paused');
  }

  resume(runtimeInstanceId: string): UserRuntimeInstance {
    return this.updateStatus(runtimeInstanceId, 'active');
  }

  stop(runtimeInstanceId: string): UserRuntimeInstance {
    return this.updateStatus(runtimeInstanceId, 'stopped');
  }

  markRecovering(runtimeInstanceId: string): UserRuntimeInstance {
    return this.updateStatus(runtimeInstanceId, 'recovering');
  }

  markDegraded(runtimeInstanceId: string): UserRuntimeInstance {
    return this.updateStatus(runtimeInstanceId, 'degraded');
  }

  terminate(runtimeInstanceId: string): UserRuntimeInstance {
    return this.updateStatus(runtimeInstanceId, 'terminated');
  }

  recover(runtimeInstanceId: string): UserRuntimeInstance {
    return this.updateStatus(runtimeInstanceId, 'active');
  }

  incrementExecution(runtimeInstanceId: string, executedAt = new Date().toISOString()): TenantExecutionMetrics {
    const record = this.requireRecord(runtimeInstanceId);
    record.telemetry.executionCount += 1;
    record.telemetry.lastExecutionAt = executedAt;
    return { ...record.telemetry };
  }

  get(runtimeInstanceId: string): RuntimeRecord | undefined {
    const record = this.runtimes.get(runtimeInstanceId);
    if (!record) {
      return undefined;
    }

    return {
      runtime: { ...record.runtime },
      isolation: { ...record.isolation },
      telemetry: { ...record.telemetry },
    };
  }

  listByUser(userId: string): RuntimeRecord[] {
    return [...this.runtimes.values()]
      .filter((record) => record.runtime.userId === userId)
      .map((record) => ({
        runtime: { ...record.runtime },
        isolation: { ...record.isolation },
        telemetry: { ...record.telemetry },
      }));
  }

  private updateStatus(runtimeInstanceId: string, status: UserRuntimeInstance['status']): UserRuntimeInstance {
    const record = this.requireRecord(runtimeInstanceId);
    record.runtime = {
      ...record.runtime,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.runtimes.set(runtimeInstanceId, record);
    return { ...record.runtime };
  }

  private requireRecord(runtimeInstanceId: string): RuntimeRecord {
    const record = this.runtimes.get(runtimeInstanceId);
    if (!record) {
      throw new Error(`Runtime not found: ${runtimeInstanceId}`);
    }

    return record;
  }
}
