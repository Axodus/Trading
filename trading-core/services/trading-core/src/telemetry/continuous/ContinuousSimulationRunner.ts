import { ContinuousObservabilityCollector } from './ContinuousObservabilityCollector.js';
import type { ContinuousTradingIntent, ContinuousIntentAdmissionService } from '../../admission/ContinuousIntentAdmissionService.js';
import type { ContinuousExecutionResult } from '../../execution/continuous/ContinuousExecutionRuntime.js';
import type { KillSwitchState } from '../../execution/continuous/ContinuousKillSwitch.js';
import type { ContinuousPositionReconciliationResult } from '../../execution/continuous/ContinuousPositionReconciliationService.js';
import type { ContinuousRiskEvaluationResult } from '../../execution/continuous/ContinuousRiskEnvelopeService.js';

export interface ContinuousSimulationSessionOptions {
  correlationId?: string;
  tenantId?: string;
  runSessionId?: string;
}

export interface SimulationExecutionRecord {
  intentId: string;
  outcome: 'ADMITTED' | 'REJECTED' | 'BLOCKED';
  attemptId?: string;
  executionClientOrderId?: string;
  rejectionCode?: string;
  createdAt: string;
}

export interface ContinuousSimulationSessionResult {
  sessionId: string;
  correlationId: string;
  tenantId: string;
  runSessionId: string;
  totalIntents: number;
  admittedCount: number;
  rejectedCount: number;
  blockedCount: number;
  records: SimulationExecutionRecord[];
  observability: {
    eventCount: number;
    metrics: ReturnType<ContinuousObservabilityCollector['getMetrics']>;
  };
}

export class ContinuousSimulationRunner {
  private readonly records: SimulationExecutionRecord[] = [];
  private sessionId = '';

  constructor(
    private readonly admissionService: ContinuousIntentAdmissionService,
    private readonly observability: ContinuousObservabilityCollector,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async runSession(
    intents: ContinuousTradingIntent[],
    positionReconciliation?: ContinuousPositionReconciliationResult,
    options: ContinuousSimulationSessionOptions = {},
  ): Promise<ContinuousSimulationSessionResult> {
    this.sessionId = `session-${this.now().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
    const correlationId = options.correlationId ?? `corr-${this.sessionId}`;
    const tenantId = options.tenantId ?? 'axodus-trading-tenant';
    const runSessionId = options.runSessionId ?? 'continuous-demo-session';

    for (const intent of intents) {
      const enrichedIntent = {
        ...intent,
        correlationId: intent.source.correlationId ?? correlationId,
        tenantId: intent.tenantId ?? tenantId,
        runSessionId: intent.runSessionId ?? runSessionId,
      };

      let record: SimulationExecutionRecord;
      try {
        const result = await this.admissionService.submitIntent(enrichedIntent, positionReconciliation);
        if (result.admitted) {
          record = {
            intentId: intent.intentId,
            outcome: 'ADMITTED',
            attemptId: result.durableAttempt?.attemptId,
            executionClientOrderId: result.executionResult?.durableAttempt?.executionClientOrderId,
            createdAt: this.now(),
          };
          this.observability.record({
            eventType: 'INTENT_ADMITTED',
            correlationId: enrichedIntent.source.correlationId,
            intentId: intent.intentId,
            attemptId: result.durableAttempt?.attemptId,
            executionClientOrderId: result.executionResult?.durableAttempt?.executionClientOrderId,
            details: {
              symbol: intent.symbol,
              side: intent.side,
              status: result.executionResult?.status,
              providerOrderId: result.executionResult?.durableAttempt?.providerOrderId,
              providerId: intent.providerId,
              source: intent.source.type,
            },
          });
        } else {
          const isBlocked = (result.rejectionCode ?? '').startsWith('KILL_SWITCH') || result.rejectionCode === 'POSITION_DIVERGENCE_UNRESOLVED';
          record = {
            intentId: intent.intentId,
            outcome: isBlocked ? 'BLOCKED' : 'REJECTED',
            rejectionCode: result.rejectionCode,
            createdAt: this.now(),
          };
          this.observability.record({
            eventType: 'INTENT_REJECTED',
            correlationId: enrichedIntent.source.correlationId,
            intentId: intent.intentId,
            details: {
              rejectionCode: result.rejectionCode,
              symbol: intent.symbol,
              reason: result.reason,
              source: intent.source.type,
            },
          });
        }
      } catch (err) {
        record = {
          intentId: intent.intentId,
          outcome: 'BLOCKED',
          rejectionCode: 'RUNTIME_ERROR',
          createdAt: this.now(),
        };
        this.observability.record({
          eventType: 'INTENT_REJECTED',
          correlationId: enrichedIntent.source.correlationId,
          intentId: intent.intentId,
          details: { error: err instanceof Error ? err.message : String(err), source: intent.source.type },
        });
      }

      this.records.push(record);
    }

    return {
      sessionId: this.sessionId,
      correlationId,
      tenantId,
      runSessionId,
      totalIntents: intents.length,
      admittedCount: this.records.filter((r) => r.outcome === 'ADMITTED').length,
      rejectedCount: this.records.filter((r) => r.outcome === 'REJECTED').length,
      blockedCount: this.records.filter((r) => r.outcome === 'BLOCKED').length,
      records: [...this.records],
      observability: {
        eventCount: this.observability.getEvents().length,
        metrics: this.observability.getMetrics(),
      },
    };
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
