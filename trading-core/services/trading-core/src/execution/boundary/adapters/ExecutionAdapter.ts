import type {
  ExecutionAdapterCapabilities,
  ExecutionIntent,
  ExecutionResultPayload,
} from '../../../../../../packages/trading-contracts/src/index.js';

export interface ExecutionAdapterOptions {
  evaluationTime?: string;
  haltActive?: boolean;
  healthState?: string;
  lifecycleState?: string;
}

export interface ExecutionAdapter {
  readonly adapterType: string;
  getCapabilities(): ExecutionAdapterCapabilities;
  executeDryRun(
    intent: ExecutionIntent,
    options?: ExecutionAdapterOptions,
  ): Promise<ExecutionResultPayload>;
}
