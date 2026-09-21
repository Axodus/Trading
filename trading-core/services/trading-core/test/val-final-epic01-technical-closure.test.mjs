/**
 * AXODUS-TRADING-EPIC-01 / VAL-FINAL
 * Technical Closure Conformance Tests
 *
 * This suite preserves the VAL-FINAL-P0-001 evidence and becomes the mandatory
 * regression for FIX-FINAL-01 exact Harness capital conservation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TradingHarnessCoordinator,
  HarnessAuthorityBypassAttemptError,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import {
  FixedDecimal,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';

const now = '2026-09-20T12:00:00.000Z';

function makeDependencies({
  requestedCapital,
  approvedCapital,
  requestedQuantity = '1.000000000000',
  riskCapital = approvedCapital,
  riskQuantity = requestedQuantity,
  requestedLeverage = '2.000000000000',
  riskLeverage = requestedLeverage,
  tradingCapital = riskCapital,
  tradingQuantity = riskQuantity,
  tradingLeverage = riskLeverage,
  executionCapital = tradingCapital,
  executionQuantity = tradingQuantity,
  executionLeverage = tradingLeverage,
}) {
  return {
    marketState: { marketStateId: 'ms_val_final_precision', observedAt: now },
    opportunity: { opportunityId: 'opp_val_final_precision' },
    tradeProposal: {
      proposalId: 'proposal_val_final_precision',
      strategyRevisionId: 'rev-1',
      sizing: { requestedCapital, requestedQuantity, leverage: requestedLeverage },
    },
    portfolioDecision: {
      portfolioDecisionId: 'portfolio_val_final_precision',
      approvedCapital,
    },
    riskDecision: {
      riskDecisionId: 'risk_val_final_precision',
      strategyRevisionId: 'rev-1',
      outcome: 'MODIFY',
      modifications: {
        effectiveCapital: riskCapital,
        effectiveQuantity: riskQuantity,
        effectiveLeverage: riskLeverage,
      },
      expiresAt: '2026-09-20T13:00:00.000Z',
    },
    tradingIntent: {
      intentId: 'intent_val_final_precision',
      strategyRevisionId: 'rev-1',
      approvedCapital: tradingCapital,
      approvedQuantity: tradingQuantity,
      approvedLeverage: tradingLeverage,
    },
    executionIntent: {
      executionIntentId: 'execution_intent_val_final_precision',
      strategyRevisionId: 'rev-1',
      authorizedCapital: tradingCapital,
      executionCapital,
      authorizedQuantity: tradingQuantity,
      executionQuantity,
      authorizedLeverage: tradingLeverage,
      executionLeverage,
    },
    executionAttempt: { attemptId: 'attempt_val_final_precision' },
    canonicalOrder: { canonicalOrderId: 'order_val_final_precision' },
    executionResult: { executionResultId: 'result_val_final_precision' },
    diagnostics: { diagnosticsId: 'diagnostics_val_final_precision' },
    pnlAttribution: {
      pnlAttributionId: 'pnl_val_final_precision',
      realizedGrossPnl: '0.000000000000',
      realizedNetPnl: '0.000000000000',
      canonicalFees: '0.000000000000',
      accountingCurrency: 'USDT',
    },
    feedbackSnapshot: { feedbackSnapshotId: 'feedback_val_final_precision' },
    performanceEvaluation: { evaluationId: 'performance_val_final_precision' },
    driftAssessment: { assessmentId: 'drift_val_final_precision', classification: 'NORMAL' },
    governanceDecision: { governanceDecisionId: 'governance_val_final_precision', classification: 'CONTINUE' },
    safetyAssessment: { assessmentId: 'safety_val_final_precision', state: 'NORMAL' },
  };
}

async function runCapitalCase({ requestedCapital, approvedCapital, harnessRunId, ...economicOverrides }) {
  const coordinator = new TradingHarnessCoordinator();
  return coordinator.runAutonomousControlCycle({
    harnessRunId,
    environment: 'PAPER',
    mode: 'AUTONOMOUS_CYCLE',
    strategyId: 'strategy_val_final_precision',
    strategyRevisionId: 'rev-1',
    instrument: 'BTCUSDT',
    venue: 'paper',
    correlationId: `corr_${harnessRunId}`,
    causationId: `cause_${harnessRunId}`,
    asOf: now,
    dependencies: makeDependencies({ requestedCapital, approvedCapital, ...economicOverrides }),
  });
}

describe('AXODUS-TRADING-EPIC-01 / VAL-FINAL — Technical Closure Conformance', () => {
  it('rejects Risk MODIFY capital enlargement using exact decimal semantics above Number safe integer range', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_precision_fractional_safe_integer_plus_one',
        requestedCapital: '9007199254740992.000000000000',
        approvedCapital: '9007199254740992.000000000001',
      }),
      HarnessAuthorityBypassAttemptError
    );
  });

  it('rejects one whole-unit enlargement above Number.MAX_SAFE_INTEGER', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_precision_whole_unit',
        requestedCapital: '9007199254740992.000000000000',
        approvedCapital: '9007199254740993.000000000000',
      }),
      HarnessAuthorityBypassAttemptError
    );
  });

  it('rejects one atomic 12-decimal-unit enlargement at Number.MAX_SAFE_INTEGER - 1', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_precision_max_safe_minus_one',
        requestedCapital: '9007199254740990.000000000001',
        approvedCapital: '9007199254740990.000000000002',
      }),
      HarnessAuthorityBypassAttemptError
    );
  });

  it('rejects one atomic 12-decimal-unit enlargement at Number.MAX_SAFE_INTEGER', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_precision_max_safe',
        requestedCapital: '9007199254740991.000000000001',
        approvedCapital: '9007199254740991.000000000002',
      }),
      HarnessAuthorityBypassAttemptError
    );
  });

  it('rejects one atomic 12-decimal-unit enlargement at Number.MAX_SAFE_INTEGER + 2', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_precision_max_safe_plus_two',
        requestedCapital: '9007199254740993.000000000001',
        approvedCapital: '9007199254740993.000000000002',
      }),
      HarnessAuthorityBypassAttemptError
    );
  });

  it('allows exact capital equality at 12-decimal precision', async () => {
    const result = await runCapitalCase({
      harnessRunId: 'run_val_final_precision_equality',
      requestedCapital: '9007199254740992.000000000001',
      approvedCapital: '9007199254740992.000000000001',
    });
    assert.equal(result.run.status, 'COMPLETED');
  });

  it('allows lower approved capital under Risk MODIFY monotonicity', async () => {
    const result = await runCapitalCase({
      harnessRunId: 'run_val_final_precision_lower',
      requestedCapital: '9007199254740992.000000000002',
      approvedCapital: '9007199254740992.000000000001',
    });
    assert.equal(result.run.status, 'COMPLETED');
  });

  it('rejects a one-atomic-unit capital expansion between Risk and TradingIntent', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_risk_to_trading_atom_expansion',
        requestedCapital: '9007199254740992.000000000002',
        approvedCapital: '9007199254740992.000000000002',
        riskCapital: '9007199254740992.000000000001',
        tradingCapital: '9007199254740992.000000000002',
      }),
      HarnessAuthorityBypassAttemptError,
    );
  });

  it('rejects a one-atomic-unit capital expansion between ExecutionIntent authorization and execution', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_execution_capital_atom_expansion',
        requestedCapital: '9007199254740992.000000000002',
        approvedCapital: '9007199254740992.000000000002',
        riskCapital: '9007199254740992.000000000002',
        executionCapital: '9007199254740992.000000000003',
      }),
      HarnessAuthorityBypassAttemptError,
    );
  });

  it('rejects a one-atomic-unit quantity expansion through ExecutionIntent', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_execution_quantity_atom_expansion',
        requestedCapital: '1.000000000000',
        approvedCapital: '1.000000000000',
        requestedQuantity: '9007199254740992.000000000002',
        riskQuantity: '9007199254740992.000000000001',
        tradingQuantity: '9007199254740992.000000000001',
        executionQuantity: '9007199254740992.000000000002',
      }),
      HarnessAuthorityBypassAttemptError,
    );
  });

  it('allows downstream quantity reduction below Risk MODIFY authorized quantity', async () => {
    const result = await runCapitalCase({
      harnessRunId: 'run_val_final_quantity_lower_than_risk',
      requestedCapital: '1.000000000000',
      approvedCapital: '1.000000000000',
      requestedQuantity: '9007199254740992.000000000003',
      riskQuantity: '9007199254740992.000000000002',
      tradingQuantity: '9007199254740992.000000000001',
      executionQuantity: '9007199254740992.000000000001',
    });
    assert.equal(result.run.status, 'COMPLETED');
  });

  it('rejects a one-atomic-unit leverage expansion through ExecutionIntent', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_execution_leverage_atom_expansion',
        requestedCapital: '1.000000000000',
        approvedCapital: '1.000000000000',
        requestedLeverage: '3.000000000002',
        riskLeverage: '3.000000000001',
        tradingLeverage: '3.000000000001',
        executionLeverage: '3.000000000002',
      }),
      HarnessAuthorityBypassAttemptError,
    );
  });

  it('metamorphically rejects authorization plus one canonical atom at every capital boundary', async () => {
    const authorizedValues = [
      '0.000000000001',
      '9007199254740991.000000000001',
      '9007199254740992.000000000001',
      '9007199254740993.000000000001',
    ];

    for (const [index, authorized] of authorizedValues.entries()) {
      const attempted = FixedDecimal.from(authorized).add('0.000000000001').toString();
      await assert.rejects(
        () => runCapitalCase({
          harnessRunId: `run_val_final_metamorphic_capital_${index}`,
          requestedCapital: attempted,
          approvedCapital: attempted,
          riskCapital: authorized,
          tradingCapital: attempted,
        }),
        HarnessAuthorityBypassAttemptError,
      );
    }
  });

  it('fails closed for malformed or negative canonical economic values', async () => {
    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_malformed_capital',
        requestedCapital: 'not-a-decimal',
        approvedCapital: '1.000000000000',
      }),
      HarnessAuthorityBypassAttemptError,
    );

    await assert.rejects(
      () => runCapitalCase({
        harnessRunId: 'run_val_final_negative_quantity',
        requestedCapital: '1.000000000000',
        approvedCapital: '1.000000000000',
        requestedQuantity: '-1.000000000000',
      }),
      HarnessAuthorityBypassAttemptError,
    );
  });
});
