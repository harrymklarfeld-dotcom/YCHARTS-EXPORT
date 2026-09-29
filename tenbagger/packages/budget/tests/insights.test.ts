import { describe, expect, it } from 'vitest';
import { budgetInsights, buildBudget, insightText, type Insight } from '../src/index.ts';
import type { Transaction } from '../../money/src/index.ts';
import { ALEX, ALEX_AS_OF, ALEX_WORKLOG, MONEY, hourly, profile } from './helpers.ts';

const AS_OF = '2026-10-05';
const COMPANIES = [
  { ticker: 'COST', name: 'Costco', currentRatio: 1.0 },
  { ticker: 'AAPL', name: 'Apple', currentRatio: 0.89 },
];

const byType = (xs: Insight[], t: Insight['type']) => xs.filter((i) => i.type === t);

describe('insights', () => {
  it('pending pay: "Submit your N hours to unlock $X before <due date>" with the math', () => {
    const p = profile({
      income: [hourly({ rate: 15.5, paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 6, periodEnd: '2026-10-03' } })],
      balances: { asOf: AS_OF, basis: 'manual', cash: 500, card: { balance: 200, statementBalance: 200, dueDate: '2026-10-17' } },
    });
    const [i] = byType(budgetInsights({ profile: p, asOf: AS_OF }), 'pending_pay');
    expect(i!.title).toBe('Submit your 6 hours to unlock $93 before Oct 17');
    expect(i!.math[0]).toEqual({ label: '6 hours × $15.50', value: '$93.00' });
    expect(i!.tier).toBe('free');
    expect(i!.label).toBe('pending');
    expect(i!.link.route).toBe('/money/learn/income-volatility');
  });

  it('subscriptions insight ONLY appears when real transactions exist', () => {
    const p = profile({
      goals: [{ id: 'roth', kind: 'roth', title: 'Roth IRA', monthly: 25 }],
      bills: [{ id: 'music', name: 'Music', amount: 10.99, dueDay: 12, kind: 'subscription' }, { id: 'tv', name: 'Video', amount: 15.49, dueDay: 21, kind: 'subscription' }],
    });
    expect(byType(budgetInsights({ profile: p, asOf: AS_OF }), 'subscriptions')).toEqual([]);
    expect(byType(budgetInsights({ profile: p, asOf: AS_OF, transactions: [] }), 'subscriptions')).toEqual([]);
    let n = 0;
    const tx = (date: string, amount: number, name: string): Transaction => ({ id: `t${n++}`, date, accountId: 'card', amount, name });
    const txs = ['07', '08', '09'].flatMap((m) => [tx(`2026-${m}-12`, -10.99, 'STREAMTUNES MUSIC'), tx(`2026-${m}-21`, -27.99, 'FLIXBOX VIDEO STREAMING')]);
    const [s] = byType(budgetInsights({ profile: p, asOf: AS_OF, transactions: txs }), 'subscriptions');
    expect(s!.title).toMatch(/^Your 2 subscriptions total \$3\d\.\d\d\/mo$/);
    expect(s!.body).toMatch(/Cancelling Flixbox Video Streaming alone .* would cover the \$25\/mo for Roth IRA/);
    expect(s!.tier).toBe('pro');
    expect(s!.options).toContain('Keep them all');
  });

  it('card payoff: $60 instead of $25, months and interest saved from payoffPlan', () => {
    const p = profile({
      balances: { asOf: AS_OF, basis: 'manual', cash: 400, card: { balance: 600, statementBalance: 600, minimumDue: 25, dueDate: '2026-10-17', apr: 0.2499 } },
      goals: [{ id: 'cc', kind: 'pay_off_card', title: 'Pay off card', monthly: 25 }],
    });
    const [i] = byType(budgetInsights({ profile: p, asOf: AS_OF }), 'card_payoff_faster');
    expect(i!.title).toMatch(/^Paying \$60 instead of \$25 on the card clears it by \w+ 2027 and saves about \$\d+ of interest$/);
    expect(i!.math.map((m) => m.label)).toEqual(['At $25/mo', 'At $60/mo', 'APR (monthly rate = APR ÷ 12)']);
  });

  it('liquidity ratio picks the closest company current ratio and links lesson u5-l4', () => {
    const p = profile({
      bills: [{ id: 'rent', name: 'Rent', amount: 400, dueDay: 1, kind: 'rent' }],
      balances: { asOf: AS_OF, basis: 'manual', cash: 448, card: { balance: 0 } },
    });
    const [i] = byType(budgetInsights({ profile: p, asOf: AS_OF, companies: COMPANIES }), 'liquidity_ratio');
    expect(i!.title).toBe("Your liquidity ratio is 1.12× — like Costco's current ratio (1.00×)");
    expect(i!.link).toMatchObject({ kind: 'lesson', id: 'u5-l4', route: '/lesson/u5-l4' });
  });

  it('short before payday is amber (never "red"), ranked first, with options', () => {
    const p = profile({
      income: [hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 20, periodEnd: '2026-10-03' } })],
      balances: { asOf: AS_OF, basis: 'manual', cash: 200, card: { balance: 400, statementBalance: 400, minimumDue: 25, dueDate: '2026-10-12' } },
    });
    const xs = budgetInsights({ profile: p, asOf: AS_OF });
    expect(xs[0]!.type).toBe('safe_short');
    expect(xs[0]!.tone).toBe('amber');
    expect(xs[0]!.title).toBe('$250 to find before payday');
    expect(xs[0]!.options[0]).toBe('Confirm the $300 of pending pay');
    expect(xs.every((i) => (i.tone as string) !== 'red')).toBe(true);
  });

  it('ranking is deterministic', () => {
    const a = budgetInsights({ profile: ALEX, asOf: ALEX_AS_OF, transactions: MONEY.transactions ?? [], deposits: MONEY.deposits ?? [], workLog: ALEX_WORKLOG, companies: COMPANIES });
    const b = budgetInsights({ profile: ALEX, asOf: ALEX_AS_OF, transactions: MONEY.transactions ?? [], deposits: MONEY.deposits ?? [], workLog: ALEX_WORKLOG, companies: COMPANIES });
    expect(a).toEqual(b);
    for (let k = 1; k < a.length; k++) expect(a[k - 1]!.score).toBeGreaterThanOrEqual(a[k]!.score);
  });

  it('fresh start on the 1st–3rd of the month', () => {
    const xs = budgetInsights({ profile: profile(), asOf: '2026-11-01' });
    expect(byType(xs, 'fresh_start')[0]!.title).toBe('New month, new ledger');
  });
});

describe('Alex (fictional sample) end to end', () => {
  const b = buildBudget({ profile: ALEX, asOf: ALEX_AS_OF, linked: MONEY, workLog: ALEX_WORKLOG, companies: COMPANIES });

  it('linked balances replace typed ones (verified) and income comes from the Money hub streams', () => {
    expect(b.linked).toBe(true);
    expect(b.profile.balances).toMatchObject({ basis: 'verified', cash: 840, savings: 410 });
    expect(b.profile.balances.card).toMatchObject({ balance: 1120, statementBalance: 1120, dueDate: '2026-10-17', apr: 0.2499 });
    expect(b.profile.income.map((s) => s.id)).toEqual(['campus-job', 'tutoring', 'family']);
  });

  it('baseline is the lower of schedule and a low-but-normal month; pending excluded', () => {
    expect(b.baseline.method).toBe('lower_of_both');
    expect(b.baseline.monthly).toBe(b.baseline.history);
    expect(b.baseline.pendingExcluded).toBeGreaterThan(280);
  });

  it('safe to spend: pending library pay excluded; window ends at the Oct 15 tutoring check', () => {
    expect(b.safe.until).toBe('2026-10-15');
    expect(b.safe.excludedPending.map((d) => d.streamId)).toContain('campus-job');
    expect(b.safe.status).not.toBe('short');
    expect(b.safe.setAside.map((s) => s.obligation.kind)).toContain('card');
  });

  it('paycheck plans add up and the tutoring check goes to the card due Oct 17', () => {
    const tut = b.paychecks.find((p) => p.deposit.streamId === 'tutoring')!;
    expect(tut.lines[0]!.kind).toBe('card');
    for (const pc of b.paychecks) expect(Math.round(pc.lines.reduce((t, l) => t + l.amount, 0) * 100) / 100).toBe(pc.deposit.amount);
  });

  it('insights include pending pay, subscriptions (from linked transactions), payoff and liquidity', () => {
    const types = b.insights.map((i) => i.type);
    for (const t of ['pending_pay', 'subscriptions', 'card_payoff_faster', 'liquidity_ratio'] as const) expect(types).toContain(t);
  });

  it('the same profile WITHOUT linking still works and never shows subscriptions', () => {
    const manual = buildBudget({ profile: ALEX, asOf: ALEX_AS_OF });
    expect(manual.linked).toBe(false);
    expect(manual.safe.amount).toBeGreaterThan(0);
    expect(manual.insights.some((i) => i.type === 'subscriptions')).toBe(false);
    expect(manual.progress.pct).toBe(100);
  });

  it('every insight is plain text with a link', () => {
    for (const i of b.insights) {
      expect(i.link.route).toMatch(/^\/(lesson|money\/learn|articles)\//);
      expect(insightText(i).length).toBeGreaterThan(20);
    }
  });
});
