import { describe, expect, it } from 'vitest';
import { bufferProgress, goalMonthly, goalTimeline, recommendStyle, replan, updateIncomeSource } from '../src/index.ts';
import { payoffPlan } from '../../money/src/index.ts';
import { hourly, paycheck, profile } from './helpers.ts';

const AS_OF = '2026-10-05';

describe('goal timelines', () => {
  it('card payoff date comes from the money package payoffPlan', () => {
    const p = profile({
      balances: { asOf: AS_OF, basis: 'manual', cash: 0, card: { balance: 1120, apr: 0.2499, dueDate: '2026-10-17' } },
      goals: [{ id: 'cc', kind: 'pay_off_card', title: 'Pay off card', monthly: 200 }],
    });
    const t = goalTimeline(p.goals[0]!, p, AS_OF);
    const ref = payoffPlan(1120, 0.2499, 200);
    expect(t.months).toBe(ref.months);
    expect(t.interest).toBe(ref.totalInterest);
    expect(ref.months).toBe(7);
    expect(t.eta).toBe('2027-05-05');
    expect(t.label).toBe('estimate');
  });

  it('pay-off-by-date works out the monthly payment', () => {
    const p = profile({
      balances: { asOf: AS_OF, basis: 'manual', cash: 0, card: { balance: 1200, apr: 0 } },
      goals: [{ id: 'cc', kind: 'pay_off_card', title: 'Card', byDate: '2027-04-05' }],
    });
    expect(goalMonthly(p.goals[0]!, p, AS_OF)).toBe(200);
  });

  it('a payment below the interest never finishes (said plainly)', () => {
    const p = profile({ balances: { asOf: AS_OF, basis: 'manual', cash: 0, card: { balance: 2000, apr: 0.3 } }, goals: [{ id: 'cc', kind: 'pay_off_card', title: 'Card', monthly: 40 }] });
    const t = goalTimeline(p.goals[0]!, p, AS_OF);
    expect(t.months).toBeNull();
    expect(t.sentence).toMatch(/would not shrink/);
  });

  it('savings goals: months = ceil(remaining ÷ monthly), on-track vs date', () => {
    const p = profile({ goals: [{ id: 'roth', kind: 'roth', title: 'Roth', target: 1000, current: 300, monthly: 100, byDate: '2027-04-15' }] });
    const t = goalTimeline(p.goals[0]!, p, AS_OF);
    expect(t).toMatchObject({ remaining: 700, months: 7, eta: '2027-05-05', onTrack: false, progress: 0.3 });
  });

  it('roth defaults to Dec 31 and spreads the rest over the months left', () => {
    const p = profile({ goals: [{ id: 'roth', kind: 'roth', title: 'Roth', target: 600, current: 0 }] });
    expect(goalMonthly(p.goals[0]!, p, AS_OF)).toBe(200); // 3 months
  });
});

describe('buffer month', () => {
  it('target = one month of bills + envelopes; paychecks to go', () => {
    const p = profile({
      bills: [{ id: 'phone', name: 'Phone', amount: 30, dueDay: 8, kind: 'phone' }],
      categories: [{ id: 'food', title: 'Food', monthly: 270, kind: 'need', rollover: true }],
      balances: { asOf: AS_OF, basis: 'manual', cash: 0, savings: 180 },
    });
    const b = bufferProgress(p, { perPaycheck: 60 });
    expect(b).toMatchObject({ target: 300, current: 180, remaining: 120, paychecksToGo: 2, progress: 0.6 });
    expect(b.sentence).toBe('$180 of a $300 buffer month: 2 more paychecks at $60 each.');
  });
});

describe('style recommendation', () => {
  it('irregular income → paycheck-to-paycheck, with a reason', () => {
    const r = recommendStyle({ income: [hourly()], goals: [] });
    expect(r.style).toBe('paycheck');
    expect(r.reason).toMatch(/changes with your hours/);
  });
  it('steady pay + savings goal → pay yourself first; steady only → 50/30/20', () => {
    expect(recommendStyle({ income: [{ ...paycheck(), kind: 'salary', rate: 40000 }], goals: [{ id: 'e', kind: 'emergency_fund', title: 'E' }] }).style).toBe('pay_yourself_first');
    expect(recommendStyle({ income: [{ ...paycheck(), kind: 'salary', rate: 40000 }], goals: [] }).style).toBe('fifty_thirty_twenty');
  });
});

describe('re-plan when income changes', () => {
  it('fewer hours → lower baseline, the flexible bucket shrinks, sentences say so', () => {
    const before = profile({
      income: [hourly({ unitsPerWeek: 12 })],
      categories: [{ id: 'food', title: 'Food', monthly: 200, kind: 'need', rollover: true }],
    });
    const after = updateIncomeSource(before, 'lib', { unitsPerWeek: 8 }, '2026-10-06');
    expect(after.updatedAt).toBe('2026-10-06');
    expect(before.income[0]!.unitsPerWeek).toBe(12); // pure
    const r = replan(before, after, AS_OF);
    expect(r.baselineBefore).toBe(780);
    expect(r.baselineAfter).toBe(520);
    expect(r.change).toBe(-260);
    expect(r.changes[0]).toMatchObject({ id: 'flexible', from: 580, to: 320 });
    expect(r.sentences[0]).toBe('Your plan now counts $520 a month (−$260).');
  });
});
