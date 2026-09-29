import { describe, expect, it } from 'vitest';
import {
  budgetInsights,
  buildBudget,
  buildMonthlyPlan,
  findBudgetBannedPhrases,
  goalTimelines,
  insightText,
  isBudgetVoice,
  planPaychecks,
  quickSetup,
  recommendStyle,
  replan,
  safeToSpend,
  setupProgress,
  STYLES,
  updateIncomeSource,
  type BudgetProfile,
  type BudgetStyle,
} from '../src/index.ts';
import type { Transaction } from '../../money/src/index.ts';
import { ALEX, ALEX_AS_OF, ALEX_WORKLOG, MONEY, hourly, profile } from './helpers.ts';

const STYLES_ALL: BudgetStyle[] = ['paycheck', 'fifty_thirty_twenty', 'zero_based', 'pay_yourself_first'];

function everySentence(p: BudgetProfile, asOf: string, txs?: Transaction[]): string[] {
  const out: string[] = [];
  for (const style of STYLES_ALL) {
    const q = { ...p, style };
    const b = buildBudget({ profile: q, asOf, linked: txs ? { transactions: txs, deposits: MONEY.deposits ?? [] } : null, workLog: ALEX_WORKLOG, companies: [{ ticker: 'COST', name: 'Costco', currentRatio: 1 }] });
    out.push(b.safe.headline, b.safe.sentence, ...b.safe.notes, ...b.safe.lines.map((l) => l.label));
    out.push(b.plan.sentence, ...b.plan.notes, ...b.plan.buckets.map((x) => x.title));
    out.push(...b.paychecks.map((x) => x.sentence), ...b.goals.map((g) => g.sentence), b.buffer.sentence, b.baseline.sentence);
    out.push(...b.envelopes.map((e) => e.sentence), b.progress.reason, b.recommended.reason);
    out.push(...b.insights.map(insightText));
  }
  return out;
}

describe('voice guard', () => {
  it('the guard itself catches advice, trades, lending offers and product picks', () => {
    for (const bad of [
      'You should pay the card',
      'Buy VOO',
      'sell your shares',
      'Get a cash advance',
      'Apply now for a limit increase',
      'Try a balance transfer',
      'Open a new credit card',
      'the best ETF for you',
      'we recommend this',
      'borrow $50 until payday',
      'Get paid early with our partner offer',
    ]) {
      expect(isBudgetVoice(bad), bad).toBe(false);
    }
    expect(isBudgetVoice('Paying $60 instead of $25 clears it by March 2027.')).toBe(true);
  });

  const txs = (MONEY.transactions ?? []) as Transaction[];
  const cases: [string, BudgetProfile, string, Transaction[] | undefined][] = [
    ['Alex linked', ALEX, ALEX_AS_OF, txs],
    ['Alex manual', ALEX, ALEX_AS_OF, undefined],
    [
      'short + pending',
      profile({
        income: [hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 20, periodEnd: '2026-10-03' } })],
        balances: { asOf: '2026-10-05', basis: 'manual', cash: 200, card: { balance: 400, statementBalance: 400, minimumDue: 25, apr: 0.29, dueDate: '2026-10-12' } },
        goals: [{ id: 'cc', kind: 'pay_off_card', title: 'Pay off card' }, { id: 'e', kind: 'emergency_fund', title: 'Buffer' }],
      }),
      '2026-10-05',
      undefined,
    ],
    ['zero income, new month', profile({ income: [] }), '2026-11-01', undefined],
    ['quick setup', quickSetup({ asOf: '2026-10-05', cash: 640, nextPayday: '2026-10-09', nextPayAmount: 186, card: { balance: 350, dueDate: '2026-10-08' }, bill: { name: 'Rent', amount: 450, dueDay: 1 } }), '2026-10-05', undefined],
  ];

  for (const [name, p, asOf, t] of cases) {
    it(`every generated sentence is educational: ${name}`, () => {
      const sentences = everySentence(p, asOf, t);
      expect(sentences.length).toBeGreaterThan(20);
      for (const s of sentences) expect(findBudgetBannedPhrases(s), s).toEqual([]);
    });
  }

  it('style explanations, setup copy and re-plan sentences are clean too', () => {
    const texts = [
      ...Object.values(STYLES).flatMap((s) => [s.title, s.short, s.how, s.bestFor]),
      setupProgress({ answered: [] }).reason,
      setupProgress({ answered: ['quick'] }).reason,
      recommendStyle({ income: [], goals: [] }).reason,
      ...replan(ALEX, updateIncomeSource(ALEX, 'campus-job', { unitsPerWeek: 6 }, ALEX_AS_OF), ALEX_AS_OF).sentences,
      ...goalTimelines(ALEX, ALEX_AS_OF).map((g) => g.sentence),
      ...planPaychecks(ALEX, ALEX_AS_OF, { monthly: 500 }).map((p) => p.sentence),
      buildMonthlyPlan(ALEX, { monthly: 0 }, ALEX_AS_OF).sentence,
      safeToSpend(ALEX, ALEX_AS_OF).headline,
      ...budgetInsights({ profile: ALEX, asOf: ALEX_AS_OF }).map(insightText),
    ];
    for (const s of texts) expect(findBudgetBannedPhrases(s), s).toEqual([]);
  });

  it('no insight names a ticker, fund or lender', () => {
    const b = buildBudget({ profile: ALEX, asOf: ALEX_AS_OF, linked: MONEY, workLog: ALEX_WORKLOG });
    for (const i of b.insights) expect(insightText(i)).not.toMatch(/\b(VOO|NVDA|AAPL|MU|XLV|ETF|index fund|brokerage account|lender|loan)\b/);
  });
});
