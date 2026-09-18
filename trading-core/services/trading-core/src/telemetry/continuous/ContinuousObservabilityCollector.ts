export type ContinuousObservabilityEventType =
  | 'INTENT_ADMITTED'
  | 'INTENT_REJECTED'
  | 'EXECUTION_CREATED'
  | 'ORDER_SUBMITTED'
  | 'PROVIDER_ACCEPTED'
  | 'PROVIDER_REJECTED'
  | 'ORDER_PARTIALLY_FILLED'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELLED'
  | 'EXECUTION_UNKNOWN'
  | 'RECONCILIATION_ATTEMPTED'
  | 'RECONCILIATION_COMPLETED'
  | 'RECONCILIATION_FAILED'
  | 'RECOVERY_RUN_STARTED'
  | 'RECOVERY_RUN_COMPLETED'
  | 'RISK_VIOLATION_BLOCKED'
  | 'KILL_SWITCH_TRIGGERED'
  | 'KILL_SWITCH_CLEARED'
  | 'POSITION_DIVERGENCE_DETECTED';

export interface ContinuousObservabilityEvent {
  eventId: string;
  eventType: ContinuousObservabilityEventType;
  timestamp: string;
  correlationId?: string;
  intentId?: string;
  attemptId?: string;
  executionClientOrderId?: string;
  providerOrderId?: string;
  details: Record<string, unknown>;
}

export class ContinuousObservabilityCollector {
  private readonly events: ContinuousObservabilityEvent[] = [];
  private readonly metrics = {
    intentsAdmitted: 0,
    intentsRejected: 0,
    executionsCreated: 0,
    ordersSubmitted: 0,
    ordersFilled: 0,
    ordersCancelled: 0,
    unknownExecutions: 0,
    reconciliationsAttempted: 0,
    reconciliationsSucceeded: 0,
    riskRejections: 0,
    killSwitchEvents: 0,
    positionDivergences: 0,
  };

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  record(event: Omit<ContinuousObservabilityEvent, 'eventId' | 'timestamp'> & { eventId?: string; timestamp?: string }): ContinuousObservabilityEvent {
    // Secret sanitization guarantee: verify no raw secrets in payload
    const sanitizedDetails = this.sanitize(event.details);
    const obsEvent: ContinuousObservabilityEvent = {
      eventId: event.eventId ?? `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      eventType: event.eventType,
      timestamp: event.timestamp ?? this.now(),
      correlationId: event.correlationId,
      intentId: event.intentId,
      attemptId: event.attemptId,
      executionClientOrderId: event.executionClientOrderId,
      providerOrderId: event.providerOrderId,
      details: sanitizedDetails,
    };

    this.events.push(obsEvent);
    this.updateMetrics(obsEvent.eventType);
    return obsEvent;
  }

  getEvents(): ContinuousObservabilityEvent[] {
    return [...this.events];
  }

  getEventsByType(type: ContinuousObservabilityEventType): ContinuousObservabilityEvent[] {
    return this.events.filter((e) => e.eventType === type);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  private updateMetrics(type: ContinuousObservabilityEventType) {
    switch (type) {
      case 'INTENT_ADMITTED': this.metrics.intentsAdmitted += 1; break;
      case 'INTENT_REJECTED': this.metrics.intentsRejected += 1; break;
      case 'EXECUTION_CREATED': this.metrics.executionsCreated += 1; break;
      case 'ORDER_SUBMITTED': this.metrics.ordersSubmitted += 1; break;
      case 'ORDER_FILLED': this.metrics.ordersFilled += 1; break;
      case 'ORDER_CANCELLED': this.metrics.ordersCancelled += 1; break;
      case 'EXECUTION_UNKNOWN': this.metrics.unknownExecutions += 1; break;
      case 'RECONCILIATION_ATTEMPTED': this.metrics.reconciliationsAttempted += 1; break;
      case 'RECONCILIATION_COMPLETED': this.metrics.reconciliationsSucceeded += 1; break;
      case 'RISK_VIOLATION_BLOCKED': this.metrics.riskRejections += 1; break;
      case 'KILL_SWITCH_TRIGGERED': case 'KILL_SWITCH_CLEARED': this.metrics.killSwitchEvents += 1; break;
      case 'POSITION_DIVERGENCE_DETECTED': this.metrics.positionDivergences += 1; break;
    }
  }

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lk = k.toLowerCase();
      if (lk.includes('secret') || lk.includes('password') || lk.includes('key') || lk.includes('auth') || lk.includes('token') || lk.includes('credential')) {
        clean[k] = '[REDACTED]';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        clean[k] = this.sanitize(v as Record<string, unknown>);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }
}
