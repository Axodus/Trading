import type { ExecutionIntent, TradingExecutionReceipt } from '../application/ExecutionIntent.js';
import { ExecutionOrchestrator } from '../application/ExecutionOrchestrator.js';

export class TradingCore {
  constructor(private readonly executionOrchestrator: ExecutionOrchestrator) {}

  execute(intent: ExecutionIntent): Promise<TradingExecutionReceipt> {
    return this.executionOrchestrator.execute(intent);
  }
}
