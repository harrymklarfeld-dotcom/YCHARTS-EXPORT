import { describe, expect, it } from 'vitest';
import { envelopeFor, envelopeHistory, envelopes, nextCarry, varianceReport, type SpendingCategory } from '../src/index.ts';
import type { Transaction } from '../../money/src/index.ts';
import { profile } from './helpers.ts';

const CATS: SpendingCategory[] = [
  { id: 'food', title: 'Eating out', monthly: 100, kind: 'want', rollover: true, matches: ['food'] },
  { id: 'rides', title: 'Rides', monthly: 50, kind: 'need', rollover: false, matches: ['rideshare'] },
  { id: 'other', title: 'Everything else', monthly: 20, kind: 'want', rollover: false, matches: ['other'] },
];
const p = profile({ categories: CATS, bills: [{ id: 'music', name: 'Music', amount: 11, dueDay: 12, kind: 'subscription' }] });
let n = 0;
const tx = (date: string, amount: number, name: string): Transaction => ({ id: `t${n++}`, date, accountId: 'card', amount, name });

const TXS = [
  tx('2026-09-02', -60, 'CAMPUS CAFE'),
  tx('2026-09-10', -30, 'PIZZA SLICE'),
  tx('2026-09-12', -11, 'STREAMTUNES MUSIC'),
  tx('2026-09-15', -45, 'RIDENOW TRIP'),
  tx('2026-09-20', 200, 'PAYMENT THANK YOU'),
  tx('2026-10-02', -130, 'DASHEATS DELIVERY'),
  tx('2026-10-03', -9, 'MYSTERY SHOP'),
];

describe('categorizing into envelopes', () => {
  it('uses the money categorizer; subscriptions are bills, card payments are not spending', () => {
    expect(envelopeFor(p, TXS[0]!)).toBe('food');
    expect(envelopeFor(p, TXS[2]!)).toBeNull();
    expect(envelopeFor(p, TXS[4]!)).toBeNull();
    expect(envelopeFor(p, TXS[6]!)).toBe('other'); // "shop" is shopping, which lands in "other" here
  });
});

describe('rollover', () => {
  it('leftover rolls forward; overspend too; clamped to one month; non-rollover resets', () => {
    expect(nextCarry({ rollover: true, remaining: 10, budget: 100 })).toBe(10);
    expect(nextCarry({ rollover: true, remaining: -30, budget: 100 })).toBe(-30);
    expect(nextCarry({ rollover: true, remaining: 250, budget: 100 })).toBe(100);
    expect(nextCarry({ rollover: true, remaining: -250, budget: 100 })).toBe(-100);
    expect(nextCarry({ rollover: false, remaining: 40, budget: 100 })).toBe(0);
  });

  it('history carries September’s leftover into October', () => {
    const [sep, oct] = envelopeHistory(p, ['2026-09', '2026-10'], { transactions: TXS });
    const food9 = sep!.envelopes.find((e) => e.id === 'food')!;
    expect(food9).toMatchObject({ spent: 90, remaining: 10, status: 'on_track' });
    const food10 = oct!.envelopes.find((e) => e.id === 'food')!;
    expect(food10).toMatchObject({ carried: 10, available: 110, spent: 130, remaining: -20, status: 'over' });
    expect(food10.sentence).toMatch(/no drama/);
    const rides10 = oct!.envelopes.find((e) => e.id === 'rides')!;
    expect(rides10.carried).toBe(0); // rides don't roll over
  });

  it('pace: early-month spending is only "watch" once over half the envelope', () => {
    const envs = envelopes(p, '2026-10', { transactions: [tx('2026-10-03', -40, 'CAMPUS CAFE')], asOf: '2026-10-05' });
    expect(envs.find((e) => e.id === 'food')!.status).toBe('on_track');
    const envs2 = envelopes(p, '2026-10', { transactions: [tx('2026-10-03', -60, 'CAMPUS CAFE')], asOf: '2026-10-05' });
    expect(envs2.find((e) => e.id === 'food')!.status).toBe('watch');
  });

  it('works without transactions (manual amounts)', () => {
    const envs = envelopes(p, '2026-10', { manualSpent: { food: 25 } });
    expect(envs.find((e) => e.id === 'food')).toMatchObject({ spent: 25, remaining: 75, label: 'manual' });
  });
});

describe('variance', () => {
  it('plan vs actual per envelope plus bills', () => {
    const v = varianceReport(p, '2026-09', { transactions: TXS });
    expect(v.rows.map((r) => [r.id, r.planned, r.actual, r.status])).toEqual([
      ['food', 100, 90, 'on_plan'],
      ['rides', 50, 45, 'on_plan'],
      ['other', 20, 0, 'under'],
      ['bills', 11, 11, 'on_plan'],
    ]);
    expect(v.spentActual).toBe(146);
    expect(v.sentence).toMatch(/\$35 under the plan/);
  });
});
