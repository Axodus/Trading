import type { ReconciliationWorkerRunResult } from '../../../../packages/trading-contracts/src/index.js';
import { ReconciliationWorker, type ReconciliationWorkerRunRequest } from './ReconciliationWorker.js';

export class ReconciliationWorkerScheduler {
  constructor(private readonly worker: ReconciliationWorker) {}

  async runOnce(request: ReconciliationWorkerRunRequest): Promise<ReconciliationWorkerRunResult> {
    return this.worker.run(request);
  }
}
