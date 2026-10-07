import { describe, expect, it } from 'vitest';
import {
  benchmarkComparison,
  cardPayoffGoal,
  categoryTitle,
  coverageCheck,
  detectSubscriptions,
  emergencyFundGoal,
  findBannedPhrases,
  interestAvoided,
  IRA_CONTRIBUTION_LIMITS,
  minimumOnlyPlan,
  moneyAlerts,
  paymentRebounds,
  payoffPlan,
  pendingPayLedger,
  personal10K,
  rothTracker,
  spendingLeaks,
  spendingPace,
  statementCycle,
  utilization,
  UTILIZATION_BANDS,
  type Snapshot,
  type Transaction,
} from '../src/index.ts';
import { DEPOSITS, LATEST, PERSONA, STREAMS } from './helpers.ts';

const HISTORY = [...(PERSONA.monthEndSnapshots as unknown as Snapshot[]), ...(PERSONA.snapshots as unknown as Snapshot[])];
const TX = PERSONA.transactions as unknown as Transaction[];

function dashboardTexts(): string[] {
  const r = personal10K('2026-09', { snapshots: HISTORY, transactions: TX, deposits: DEPOSITS, streams: STREAMS, name: 'Alex', sample: true });
  const values = HISTORY.map((s) => ({ date: s.takenAt.slice(0, 10), value: s.accounts.filter((a) => a.kind === 'brokerage' || a.kind === 'retirement').reduce((t, a) => t + a.balance, 0) }));
  const pending = pendingPayLedger(STREAMS);
  const u = utilization(1120, 1500);
  return [
    ...UTILIZATION_BANDS.flatMap((b) => [b.title, b.text]),
    u.sentence, utilization(50, 1500).sentence, utilization(1600, 1500).sentence, utilization(5, null).sentence,
    ...statementCycle(LATEST.liabilities[0]!).steps,
    payoffPlan(1120, 0.2499, 100).sentence, payoffPlan(1120, 0.2499, 10).sentence, minimumOnlyPlan(1120, 0.2499).sentence,
    interestAvoided(1120, 0.2499).sentence,
    ...spendingLeaks(TX, '2026-09').map((l) => l.sentence),
    spendingPace(TX, '2026-10-05').sentence,
    ...detectSubscriptions(TX).map((s) => categoryTitle(s.category)),
    benchmarkComparison(values, PERSONA.investmentContributions, PERSONA.benchmark.prices)!.sentence,
    ...rothTracker(PERSONA.rothContributions, 2026).notes,
    ...Object.values(IRA_CONTRIBUTION_LIMITS).map((l) => l.source),
    ...pending.map((p) => p.reminder),
    emergencyFundGoal(8, 40, 410).detail, cardPayoffGoal(1120, 900, '2027-03-31', '2026-10-05', 120).detail,
    ...moneyAlerts({ coverage: coverageCheck(LATEST, STREAMS, 30), pending, utilization: u, rebounds: paymentRebounds(TX, 'card'), leaks: spendingLeaks(TX, '2026-09'), runwayDays: 12, subscriptions: detectSubscriptions(TX) })
      .flatMap((a) => [a.title, a.text]),
    r.title, r.shareText, ...r.analogs.flatMap((a) => [a.title, a.personal, a.company, a.text]),
  ];
}

describe('dashboard wording — banned-phrase scan', () => {
  it('no advice, product picks or credit offers in any generated sentence', () => {
    const texts = dashboardTexts();
    expect(texts.length).toBeGreaterThan(40);
    const hits = texts.flatMap((t) => findBannedPhrases(t).map((re) => `${re} in "${t}"`));
    expect(hits).toEqual([]);
  });

  it('the checker catches lending offers and product picks', () => {
    for (const s of [
      'Get a cash advance today',
      'Try a payday loan',
      "You're pre-approved",
      'Apply now for more credit',
      'Request a credit limit increase',
      'A balance transfer could help',
      'Open a new credit card',
      'The best ETFs for students',
      'Our top picks',
    ])
      expect(findBannedPhrases(s).length, s).toBeGreaterThan(0);
    for (const s of ['Cash covers 30 days', 'the statement balance', 'utilization under 30%', 'limit of $1,500', 'transfer to savings'])
      expect(findBannedPhrases(s), s).toEqual([]);
  });
});
