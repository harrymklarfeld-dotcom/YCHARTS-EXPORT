import { describe, expect, it } from 'vitest';
import { completeMonths, incomeBaseline, percentile, plannedMonthly, projectedDeposits, toIncomeStreams } from '../src/index.ts';
import { hourly, paycheck, profile } from './helpers.ts';

describe('income sources → streams', () => {
  it('maps kinds, conditions and pending work; skips stipends and occasional money', () => {
    const streams = toIncomeStreams([
      hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 6, periodEnd: '2026-10-03' } }),
      { id: 'tut', name: 'Tutoring', kind: 'per_session', rate: 30, unitsPerWeek: 2, frequency: 'weekly', nextPayDate: '2026-10-10', paidOnlyIfSubmitted: true },
      { id: 'fam', name: 'Family', kind: 'allowance', rate: 100, frequency: 'occasional' },
      { id: 'aid', name: 'Aid refund', kind: 'stipend', rate: 0, frequency: 'monthly', disbursements: [{ date: '2026-10-20', amount: 900 }] },
      paycheck(),
    ]);
    expect(streams.map((s) => s.id)).toEqual(['lib', 'tut', 'job']);
    expect(streams[0]!.condition).toBe('hours submitted');
    expect(streams[1]!.condition).toBe('session reports filed');
    expect(streams[2]!.kind).toBe('other');
    expect(streams[0]!.pendingUnsubmitted).toEqual({ units: 6, periodEnd: '2026-10-03' });
  });

  it('projects pending vs projected paychecks and dated stipend disbursements', () => {
    const p = profile({
      income: [
        hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 6, periodEnd: '2026-10-03' } }),
        { id: 'aid', name: 'Aid refund', kind: 'stipend', rate: 0, frequency: 'monthly', disbursements: [{ date: '2026-10-20', amount: 900 }] },
      ],
    });
    const d = projectedDeposits(p, '2026-10-06', '2026-10-31');
    expect(d.map((x) => [x.date, x.streamId, x.basis, x.amount])).toEqual([
      ['2026-10-09', 'lib', 'pending', 90],
      ['2026-10-20', 'aid', 'projected', 900],
      ['2026-10-23', 'lib', 'projected', 300],
    ]);
  });
});

describe('planned monthly', () => {
  it('hourly = rate × hours × 52/12 net of withholding', () => {
    expect(plannedMonthly(hourly({ withholdingRate: 0.1 }), '2026-10-05').monthly).toBe(585); // 15×10×52/12×0.9
  });
  it('biweekly paycheck = amount × 26/12; occasional counts 0', () => {
    expect(plannedMonthly(paycheck(), '2026-10-05').monthly).toBe(866.67);
    const occ = plannedMonthly({ id: 'f', name: 'Family', kind: 'allowance', rate: 250, frequency: 'occasional' }, '2026-10-05');
    expect(occ).toMatchObject({ monthly: 0, counted: false });
  });
  it('stipend is spread over the months it covers, only while current', () => {
    const s = { id: 'aid', name: 'Aid', kind: 'stipend' as const, rate: 0, frequency: 'monthly' as const, disbursements: [{ date: '2026-08-25', amount: 1200, coversUntil: '2026-12-20' }] };
    expect(plannedMonthly(s, '2026-10-05').monthly).toBe(300); // 117 days ≈ 4 months
    expect(plannedMonthly(s, '2027-02-01').monthly).toBe(0);
  });
});

describe('conservative baseline', () => {
  const dep = (date: string, amount: number) => ({ date, amount, basis: 'verified' as const });

  it('percentile interpolates deterministically', () => {
    expect(percentile([400, 100, 300, 200], 0.25)).toBe(175);
    expect(percentile([], 0.25)).toBe(0);
    expect(percentile([50], 0.25)).toBe(50);
  });

  it('uses the 25th-percentile month for irregular history and never counts pending pay', () => {
    const p = profile({ income: [hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 20, periodEnd: '2026-10-03' } })] });
    const deposits = [dep('2026-06-10', 900), dep('2026-07-10', 300), dep('2026-08-10', 600), dep('2026-09-10', 450)];
    const b = incomeBaseline(p, '2026-10-05', { deposits });
    expect(b.history).toBe(412.5); // p25 of 300, 450, 600, 900
    expect(b.planned).toBe(650); // 15×10×52/12
    expect(b).toMatchObject({ monthly: 412.5, method: 'lower_of_both', label: 'estimate' });
    expect(b.pendingExcluded).toBe(300); // 20 h × $15, reported but never in the baseline
  });

  it('a zero-income month in the middle counts as $0', () => {
    const months = completeMonths([dep('2026-06-10', 500), dep('2026-08-10', 500), dep('2026-09-10', 500)], '2026-10-05');
    expect(months).toEqual([
      { month: '2026-06', total: 500 },
      { month: '2026-07', total: 0 },
      { month: '2026-08', total: 500 },
      { month: '2026-09', total: 500 },
    ]);
    const b = incomeBaseline(profile({ income: [] }), '2026-10-05', { deposits: [dep('2026-06-10', 500), dep('2026-08-10', 500), dep('2026-09-10', 500)] });
    expect(b.method).toBe('history_p25');
    expect(b.monthly).toBe(375);
  });

  it('needs 3 complete months of history; otherwise uses the schedule', () => {
    const b = incomeBaseline(profile(), '2026-10-05', { deposits: [dep('2026-09-10', 100)] });
    expect(b.history).toBeNull();
    expect(b.method).toBe('planned');
    expect(b.monthly).toBe(866.67);
  });

  it('no income at all → $0 plan, method none', () => {
    const b = incomeBaseline(profile({ income: [] }), '2026-10-05');
    expect(b).toMatchObject({ monthly: 0, method: 'none' });
    expect(b.sentence).toMatch(/\$0 a month/);
  });

  it('pending deposits in history are ignored', () => {
    const b = incomeBaseline(profile({ income: [] }), '2026-10-05', {
      deposits: [dep('2026-07-10', 500), dep('2026-08-10', 500), dep('2026-09-10', 500), { date: '2026-09-20', amount: 999, basis: 'pending' }],
    });
    expect(b.monthly).toBe(500);
  });
});
