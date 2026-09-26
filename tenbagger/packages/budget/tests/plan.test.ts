import { describe, expect, it } from 'vitest';
import { buildMonthlyPlan, planPaychecks } from '../src/index.ts';
import { hourly, profile } from './helpers.ts';

const AS_OF = '2026-10-05';
const withSpending = (style: 'paycheck' | 'fifty_thirty_twenty' | 'zero_based' | 'pay_yourself_first') =>
  profile({
    style,
    bills: [{ id: 'rent', name: 'Rent', amount: 800, dueDay: 1, kind: 'rent' }],
    categories: [
      { id: 'groceries', title: 'Groceries', monthly: 200, kind: 'need', rollover: true },
      { id: 'fun', title: 'Fun', monthly: 300, kind: 'want', rollover: true },
      { id: 'food', title: 'Eating out', monthly: 100, kind: 'want', rollover: true },
    ],
    goals: [{ id: 'trip', kind: 'save_for', title: 'Trip', monthly: 150 }],
  });

describe('50/30/20', () => {
  it('targets are exactly 50/30/20 of income and the savings slice is topped up', () => {
    const plan = buildMonthlyPlan(withSpending('fifty_thirty_twenty'), { monthly: 2000 }, AS_OF);
    expect(plan.targets).toEqual({ needs: 1000, wants: 600, savings: 400 });
    expect(plan.totals).toEqual({ needs: 1000, wants: 400, savings: 400 });
    expect(plan.buckets.find((b) => b.id === 'cushion')!.planned).toBe(250);
    expect(plan.unassigned).toBe(200);
  });
  it('odd cents still add up to income', () => {
    const plan = buildMonthlyPlan(profile({ style: 'fifty_thirty_twenty' }), { monthly: 1234.57 }, AS_OF);
    const t = plan.targets!;
    expect(Math.round((t.needs + t.wants + t.savings) * 100) / 100).toBe(1234.57);
  });
  it('flags needs above the 50% line without judgement', () => {
    const plan = buildMonthlyPlan(withSpending('fifty_thirty_twenty'), { monthly: 1500 }, AS_OF);
    expect(plan.notes.join(' ')).toMatch(/above the 50% line/);
  });
});

describe('zero-based', () => {
  it('balances to exactly $0 with leftover given a job', () => {
    const plan = buildMonthlyPlan(withSpending('zero_based'), { monthly: 2000.37 }, AS_OF);
    expect(plan.unassigned).toBe(0);
    expect(plan.buckets.find((b) => b.id === 'cushion')!.planned).toBe(450.37);
    const total = plan.buckets.reduce((t, b) => t + b.planned, 0);
    expect(Math.round(total * 100) / 100).toBe(2000.37);
  });
  it('balances to $0 by trimming wants (proportionally) when the month is short', () => {
    const plan = buildMonthlyPlan(withSpending('zero_based'), { monthly: 1400 }, AS_OF);
    expect(plan.unassigned).toBe(0);
    expect(plan.trimmed).toBe(150);
    expect(plan.buckets.find((b) => b.id === 'env:fun')!.planned).toBe(187.5);
    expect(plan.buckets.find((b) => b.id === 'env:food')!.planned).toBe(62.5);
    expect(plan.buckets.find((b) => b.id === 'bill:rent')!.planned).toBe(800); // needs untouched
  });
  it('when even needs do not fit, the gap is shown (not hidden)', () => {
    const plan = buildMonthlyPlan(withSpending('zero_based'), { monthly: 900 }, AS_OF);
    expect(plan.unassigned).toBe(-250);
    expect(plan.fits).toBe(false);
  });
  it('zero-income month: plan is all gap, sentence stays calm', () => {
    const plan = buildMonthlyPlan(withSpending('zero_based'), { monthly: 0 }, AS_OF);
    expect(plan.income).toBe(0);
    expect(plan.sentence).toMatch(/only uses cash you already have/);
  });
});

describe('pay yourself first', () => {
  it('takes max(goals, rate × income) off the top, the rest is free to spend', () => {
    const plan = buildMonthlyPlan(withSpending('pay_yourself_first'), { monthly: 2000 }, AS_OF);
    expect(plan.totals.savings).toBe(200); // 10% (balanced) > $150 goal
    expect(plan.buckets.find((b) => b.id === 'flexible')!.planned).toBe(400); // 2000 − 1000 needs − 400 wants − 200
    expect(plan.unassigned).toBe(0);
  });
});

describe('per-paycheck plans', () => {
  it('lines add up to the paycheck, bills before goals, the rest flexible', () => {
    const p = profile({
      style: 'paycheck',
      income: [hourly({ rate: 15.5, unitsPerWeek: 6 })], // $186 every other Friday
      balances: { asOf: AS_OF, basis: 'manual', cash: 100, card: { balance: 40, statementBalance: 40, dueDate: '2026-10-14' } },
      goals: [{ id: 'roth', kind: 'roth', title: 'Roth IRA', monthly: 50 }, { id: 'cc', kind: 'cover_card', title: 'Cover my card' }],
    });
    const plans = planPaychecks(p, AS_OF, { monthly: 403, planned: 403 });
    const first = plans[0]!;
    expect(first.deposit).toMatchObject({ date: '2026-10-09', amount: 186 });
    expect(first.lines.map((l) => [l.kind, l.amount])).toEqual([
      ['card', 40],
      ['goal', 23.08],
      ['flexible', 122.92],
    ]);
    expect(first.sentence).toBe('When your $186 from Library job lands (Oct 9): $40 card, $23 Roth, $123 flexible.');
    for (const pc of plans) expect(Math.round(pc.lines.reduce((t, l) => t + l.amount, 0) * 100) / 100).toBe(pc.deposit.amount);
  });

  it('a pending paycheck never pays bills; it is labelled', () => {
    const p = profile({
      income: [hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 6, periodEnd: '2026-10-03' } })],
      bills: [{ id: 'phone', name: 'Phone', amount: 30, dueDay: 12, kind: 'phone' }],
    });
    const plans = planPaychecks(p, AS_OF, { monthly: 650 });
    expect(plans[0]!.deposit.basis).toBe('pending');
    expect(plans[0]!.lines.map((l) => l.kind)).toEqual(['flexible']);
    expect(plans[0]!.sentence).toMatch(/only lands once hours submitted/);
  });

  it('when bills take the whole paycheck, goals wait (flagged, not negative)', () => {
    const p = profile({
      bills: [{ id: 'rent', name: 'Rent', amount: 800, dueDay: 20, kind: 'rent' }],
      goals: [{ id: 'trip', kind: 'save_for', title: 'Trip', monthly: 100 }],
      balances: { asOf: AS_OF, basis: 'manual', cash: 0 },
    });
    const [first] = planPaychecks(p, AS_OF, { monthly: 866.67 });
    expect(first!.lines.map((l) => [l.kind, l.amount])).toEqual([['bill', 400], ['flexible', 0]]);
    expect(first!.goalsFullyFunded).toBe(false);
  });

  it('zero baseline: goals get a small equal slice of what actually lands', () => {
    const p = profile({ goals: [{ id: 'trip', kind: 'save_for', title: 'Trip', monthly: 100 }] });
    const [first] = planPaychecks(p, AS_OF, { monthly: 0 });
    expect(first!.lines.find((l) => l.kind === 'goal')!.amount).toBe(40);
  });
});
