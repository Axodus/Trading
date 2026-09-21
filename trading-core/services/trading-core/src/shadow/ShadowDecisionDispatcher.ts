import type { ShadowDecisionRequest } from '../../../../packages/trading-contracts/src/index.js';
import type { DecisionProvider } from './DecisionProvider.js';
import type { ShadowDecisionRepository } from './ShadowDecisionRepository.js';

export interface ShadowDispatchTelemetry {
  enqueued: number;
  completed: number;
  failed: number;
  dropped: number;
  inFlight: number;
}

export class ShadowDecisionDispatcher {
  private readonly queue: ShadowDecisionRequest[] = [];
  private running = false;
  readonly telemetry: ShadowDispatchTelemetry = { enqueued: 0, completed: 0, failed: 0, dropped: 0, inFlight: 0 };

  constructor(
    private readonly provider: DecisionProvider | undefined,
    private readonly repository: ShadowDecisionRepository,
    private readonly maxQueueDepth = 100,
  ) {}

  enqueue(request: ShadowDecisionRequest): 'ENQUEUED' | 'DISABLED' | 'DROPPED' {
    if (!this.provider) return 'DISABLED';
    if (this.queue.length >= this.maxQueueDepth) {
      this.telemetry.dropped += 1;
      return 'DROPPED';
    }
    this.queue.push(request);
    this.telemetry.enqueued += 1;
    this.scheduleDrain();
    return 'ENQUEUED';
  }

  async whenIdle(): Promise<void> {
    while (this.running || this.queue.length > 0) await new Promise<void>((resolve) => setTimeout(resolve, 1));
  }

  private scheduleDrain(): void {
    if (this.running) return;
    this.running = true;
    queueMicrotask(() => { void this.drain(); });
  }

  private async drain(): Promise<void> {
    try {
      while (this.queue.length > 0) {
        const request = this.queue.shift()!;
        this.telemetry.inFlight += 1;
        try {
          await this.repository.saveSnapshot(request.snapshot);
          const observation = await this.provider!.evaluate(request);
          await this.repository.saveObservation(observation);
          this.telemetry.completed += 1;
        } catch {
          this.telemetry.failed += 1;
        } finally {
          this.telemetry.inFlight -= 1;
        }
      }
    } finally {
      this.running = false;
      if (this.queue.length > 0) this.scheduleDrain();
    }
  }
}
