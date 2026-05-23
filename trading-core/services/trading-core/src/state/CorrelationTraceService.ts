import type { TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import { readString, toRecord } from './StateContext.js';
import type { ExecutionTrace, TradingAuditRecord } from './StateTypes.js';
import { TradingAuditService } from './TradingAuditService.js';
import { TradingEventQueryService } from './TradingEventQueryService.js';
import { eventProviderId } from './InMemoryTradingEventRepository.js';

export class CorrelationTraceService {
  constructor(
    private readonly events: TradingEventQueryService,
    private readonly audit: TradingAuditService = new TradingAuditService(),
  ) {}

  reconstruct(correlationId: string): ExecutionTrace {
    const events = this.events.byCorrelationId(correlationId);
    const auditRecords = this.audit.listByCorrelationId(correlationId);
    const firstEvent = events[0];
    const lastEvent = events.at(-1);
    const rejectionReason = firstString([
      ...auditRecords.map((record) => record.rejectionReason),
      ...events.map((event) => eventRejectionReason(event)),
    ]);

    return {
      correlationId,
      events,
      auditRecords,
      startedAt: firstEvent?.occurredAt,
      lastUpdatedAt: lastEvent?.occurredAt,
      userId: firstString(events.map((event) => event.userId)) ?? firstString(auditRecords.map((record) => record.userId)),
      daoId: firstString(events.map((event) => event.daoId)) ?? firstString(auditRecords.map((record) => record.daoId)),
      runtimeInstanceId: firstString(events.map((event) => event.runtimeInstanceId)) ?? firstString(auditRecords.map((record) => record.runtimeInstanceId)),
      providerId: firstString(events.map((event) => eventProviderId(event))) ?? firstString(auditRecords.map((record) => record.providerId)),
      strategyId: firstString(events.map((event) => event.strategyId)) ?? firstString(auditRecords.map((record) => record.strategyId)),
      strategyProductId: firstString(events.map((event) => event.strategyProductId)) ?? firstString(auditRecords.map((record) => record.strategyProductId)),
      rejectionReason,
    };
  }
}

function eventRejectionReason(event: TradingEvent): string | undefined {
  const payload = toRecord(event.payload);
  return readString(payload.reason) ?? readString(payload.rejectionReason);
}

function firstString(values: Array<string | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}
