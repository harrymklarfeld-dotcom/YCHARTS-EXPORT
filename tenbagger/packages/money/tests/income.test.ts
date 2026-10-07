import { describe, expect, it } from 'vitest';
import { projectIncome, scheduledMonthlyIncome, weekday } from '../src/index.ts';
import { STREAMS, stream } from './helpers.ts';

describe('projectIncome — sample persona', () => {
  const deps = projectIncome(STREAMS, '2026-10-06', '2026-11-04');

  it('lists every paycheck in the window, sorted, with net amounts', () => {
    expect(deps.map((d) => [d.date, d.streamId, d.amount, d.basis])).toEqual([
      ['2026-10-09', 'campus-job', 287.14, 'pending'],
      ['2026-10-15', 'tutoring', 120, 'projected'],
      ['2026-10-23', 'campus-job', 294.5, 'projected'],
      ['2026-10-29', 'tutoring', 120, 'projected'],
    ]);
  });

  it('marks the unsubmitted-hours paycheck PENDING with the real unsubmitted hours', () => {
    const p = deps[0]!;
    expect(p.units).toBe(19.5);
    expect(p.gross).toBe(302.25); // 19.5 h × $15.50
    expect(p.amount).toBe(287.14); // − 5% withholding
    expect(p.note).toMatch(/Only lands if hours submitted/);
    expect(p.note).toMatch(/19\.5 hours/);
  });

  it('later paychecks are PROJECTED from the usual schedule and carry the condition', () => {
    const next = deps.find((d) => d.date === '2026-10-23')!;
    expect(next.units).toBe(20); // 10 h/week × 2 weeks
    expect(next.gross).toBe(310);
    expect(next.note).toBe('Assumes hours submitted on time');
    expect(deps.find((d) => d.streamId === 'tutoring')!.note).toBe('Assumes session reports filed on time');
  });

  it('typical monthly income from the schedule', () => {
    // campus 15.5 × 10 × 52 × 0.95 / 12 = 638.08; tutoring 30 × 2 × 52 / 12 = 260
    expect(scheduledMonthlyIncome(STREAMS)).toBe(898.08);
  });
});

describe('projectIncome — schedules', () => {
  it('never invents paydays before nextPayDate, and steps forward when nextPayDate is before the window', () => {
    const s = stream({ id: 'j', nextPayDate: '2026-10-09' });
    expect(projectIncome([s], '2026-09-01', '2026-10-08')).toEqual([]);
    expect(projectIncome([s], '2026-10-10', '2026-11-30').map((d) => d.date)).toEqual(['2026-10-23', '2026-11-06', '2026-11-20']);
  });

  it('is inclusive of both ends and empty for reversed windows', () => {
    const s = stream({ id: 'j' });
    expect(projectIncome([s], '2026-10-09', '2026-10-09')).toHaveLength(1);
    expect(projectIncome([s], '2026-10-10', '2026-10-09')).toEqual([]);
  });

  it('drops a pending paycheck that falls before the window but keeps later ones projected', () => {
    const s = stream({ id: 'j', pendingUnsubmitted: { units: 8, periodEnd: '2026-10-03' }, condition: 'hours submitted' });
    const d = projectIncome([s], '2026-10-10', '2026-10-31');
    expect(d.map((x) => x.basis)).toEqual(['projected']);
  });

  it('attaches pending to the first payday on/after the period end (with lag)', () => {
    const s = stream({ id: 'j', periodLagDays: 6, pendingUnsubmitted: { units: 5, periodEnd: '2026-10-17' } });
    // Oct 9 covers the period ending Oct 3; Oct 23 covers the one ending Oct 17.
    const d = projectIncome([s], '2026-10-01', '2026-10-31');
    expect(d.map((x) => [x.date, x.basis, x.units])).toEqual([
      ['2026-10-09', 'projected', 20],
      ['2026-10-23', 'pending', 5],
    ]);
  });

  it('weekly and biweekly keep the weekday across DST changes', () => {
    const w = stream({ id: 'w', payFrequency: 'weekly', nextPayDate: '2026-10-23' });
    const ds = projectIncome([w], '2026-10-01', '2026-11-30').map((d) => d.date);
    expect(ds).toEqual(['2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27']);
    expect(new Set(ds.map(weekday))).toEqual(new Set([5]));
    const spring = stream({ id: 's', nextPayDate: '2027-03-05' });
    expect(projectIncome([spring], '2027-03-01', '2027-03-31').map((d) => d.date)).toEqual(['2027-03-05', '2027-03-19']);
  });

  it('monthly pay clamps to short months and returns to the anchor day', () => {
    const s = stream({ id: 'm', kind: 'salary', rate: 24000, payFrequency: 'monthly', nextPayDate: '2027-01-31' });
    const d = projectIncome([s], '2027-01-01', '2027-05-31');
    expect(d.map((x) => x.date)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
    expect(d.every((x) => x.gross === 2000)).toBe(true);
  });

  it('semimonthly defaults to the 15th and last day, across February and year end', () => {
    const s = stream({ id: 'sm', kind: 'salary', rate: 24000, payFrequency: 'semimonthly', nextPayDate: '2026-12-15' });
    const d = projectIncome([s], '2026-12-01', '2027-03-01').map((x) => x.date);
    expect(d).toEqual(['2026-12-15', '2026-12-31', '2027-01-15', '2027-01-31', '2027-02-15', '2027-02-28']);
    const custom = stream({ id: 'c', kind: 'other', rate: 100, payFrequency: 'semimonthly', semimonthlyDays: [20, 5], nextPayDate: '2026-10-05' });
    expect(projectIncome([custom], '2026-10-01', '2026-11-30').map((x) => x.date)).toEqual(['2026-10-05', '2026-10-20', '2026-11-05', '2026-11-20']);
  });

  it('moves weekend paydays to the previous business day when asked', () => {
    // Oct 31 2026 is a Saturday; Jan 31 2027 is a Sunday.
    const s = stream({ id: 'm', kind: 'other', rate: 500, payFrequency: 'monthly', nextPayDate: '2026-10-31', weekendRule: 'previous_business_day' });
    expect(projectIncome([s], '2026-10-01', '2027-01-31').map((x) => x.date)).toEqual(['2026-10-30', '2026-11-30', '2026-12-31', '2027-01-29']);
  });

  it('counts actual weekdays in the pay period when periodLagDays is set (month boundaries)', () => {
    // Paid on the 1st for the previous calendar month; Tue/Thu sessions.
    const s = stream({ id: 't', kind: 'per_session', rate: 30, schedule: { unitsPerWeek: 2, weekdays: [2, 4] }, payFrequency: 'monthly', nextPayDate: '2026-11-01', periodLagDays: 1 });
    const d = projectIncome([s], '2026-11-01', '2027-03-01');
    // Oct 2026: 5 Thu + 4 Tue = 9; Nov: 4 Tue + 4 Thu = 8; Dec: 5 Tue + 5 Thu = 10; Jan 2027: 4 Tue + 4 Thu = 8; Feb 2027: 4 + 4 = 8
    expect(d.map((x) => x.units)).toEqual([9, 8, 10, 8, 8]);
    expect(d[0]!.gross).toBe(270);
  });

  it('salary, other and withholding', () => {
    const sal = stream({ id: 's', kind: 'salary', rate: 52000, withholdingRate: 0.2 });
    const d = projectIncome([sal], '2026-10-09', '2026-10-09')[0]!;
    expect(d.gross).toBe(2000);
    expect(d.amount).toBe(1600);
    expect(d.units).toBeUndefined();
    const other = stream({ id: 'o', kind: 'other', rate: 75 });
    expect(projectIncome([other], '2026-10-09', '2026-10-09')[0]!.amount).toBe(75);
  });

  it('rejects invalid streams', () => {
    expect(() => projectIncome([stream({ id: 'x', nextPayDate: '2026-02-30' })], '2026-01-01', '2026-12-31')).toThrow(/nextPayDate/);
    expect(() => projectIncome([stream({ id: 'x', withholdingRate: 1.2 })], '2026-01-01', '2026-12-31')).toThrow(/withholding/);
    expect(() => projectIncome([stream({ id: 'x', rate: -1 })], '2026-01-01', '2026-12-31')).toThrow(/rate/);
  });
});
