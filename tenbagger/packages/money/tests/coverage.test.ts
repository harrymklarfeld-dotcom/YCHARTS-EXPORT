import { describe, expect, it } from 'vitest';
import { coverageCheck, type Snapshot } from '../src/index.ts';
import { acct, LATEST, snap, STREAMS, stream } from './helpers.ts';

describe('coverageCheck — sample persona (Alex)', () => {
  const r = coverageCheck(LATEST, STREAMS, 30);
  const d = r.dues[0]!;

  it('builds the equation for the Oct 17 card due date', () => {
    expect(r.asOf).toBe('2026-10-05');
    expect(r.horizonEnd).toBe('2026-11-04');
    expect(r.cashNow).toBe(1250); // checking 840 + savings 410, NOT brokerage/Roth
    expect(r.dues).toHaveLength(1);
    expect(d.dueDate).toBe('2026-10-17');
    expect(d.daysAway).toBe(12);
    expect(d.projectedIncomeBefore).toBe(120);
    expect(d.pendingIncomeBefore).toBe(287.14);
    expect(d.expectedIncomeBefore).toBe(407.14);
    expect(d.statementBalance).toBe(1120);
    expect(d.minimumDue).toBe(25);
    expect(d.afterPayInFull).toBe(537.14);
    expect(d.afterMinimum).toBe(1632.14);
    expect(d.verdict).toBe('covered');
    expect(d.verdictWithoutPending).toBe('covered');
    expect(r.verdict).toBe('covered');
  });

  it('explains itself in plain English with honest labels', () => {
    expect(d.sentence).toBe(
      "You're fine for Oct 17: $1,250 cash + $407 expected before then − $1,120 statement balance leaves $537. That counts $287 of PENDING pay that only lands if hours submitted.",
    );
    expect(d.steps.map((s) => [s.op, s.amount, s.basis])).toEqual([
      ['+', 1250, 'verified'],
      ['+', 120, 'projected'],
      ['+', 287.14, 'pending'],
      ['−', -1120, 'verified'],
      ['=', 537.14, 'pending'], // the result is only as sure as its weakest input
    ]);
    const sum = d.steps.slice(0, -1).reduce((t, s) => t + s.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(d.steps.at(-1)!.amount);
    expect(r.assumptions.join(' ')).toMatch(/investments are not treated as spendable/);
  });

  it('produces a daily runway for charting', () => {
    expect(r.runway).toHaveLength(31);
    expect(r.runway[0]).toMatchObject({ date: '2026-10-05', payInFull: 1250, payMinimum: 1250, events: [] });
    const oct9 = r.runway.find((p) => p.date === '2026-10-09')!;
    expect(oct9.payInFull).toBe(1537.14);
    expect(oct9.events[0]).toMatchObject({ kind: 'deposit', basis: 'pending' });
    const oct17 = r.runway.find((p) => p.date === '2026-10-17')!;
    expect(oct17.payInFull).toBe(537.14);
    expect(oct17.payMinimum).toBe(1632.14);
    expect(r.runway.at(-1)!.payInFull).toBe(951.64); // + 294.50 + 120 later in October
    expect(r.lowPoint).toEqual({ date: '2026-10-17', cash: 537.14 });
  });
});

const base = (cash: number, statement: number, minimum: number, extra: Partial<Snapshot> = {}): Snapshot =>
  snap(
    '2026-10-05T09:00',
    [acct('chk', 'checking', cash), acct('brk', 'brokerage', 5000), acct('card', 'credit_card', statement, { name: 'Card' })],
    [{ accountId: 'card', statementBalance: statement, minimumDue: minimum, dueDate: '2026-10-17', apr: 0.2499 }],
    extra.note ?? '',
  );

describe('coverageCheck — verdicts', () => {
  it('"$200 short by Oct 17" when even the minimum is not covered', () => {
    const r = coverageCheck(base(100, 1000, 300), [], 30);
    expect(r.dues[0]!.verdict).toBe('short');
    expect(r.dues[0]!.afterMinimum).toBe(-200);
    expect(r.dues[0]!.sentence).toBe('$200 short by Oct 17, even for the $300 minimum.');
    expect(r.headline).toBe('$200 short by Oct 17.');
    expect(r.dues[0]!.steps.at(-1)).toMatchObject({ label: 'Short', amount: -900 });
  });

  it('covered_minimum_only mentions the gap and the APR', () => {
    const r = coverageCheck(base(300, 700, 35), [stream({ id: 't', kind: 'other', rate: 120, nextPayDate: '2026-10-15' })], 30);
    const d = r.dues[0]!;
    expect(d.verdict).toBe('covered_minimum_only');
    expect(d.afterPayInFull).toBe(-280);
    expect(d.sentence).toBe(
      "You can cover the $35 minimum by Oct 17, but you'd be $280 short of the full $700 statement balance. The unpaid part would carry interest at 24.99% APR.",
    );
    expect(r.headline).toMatch(/Minimums are covered, but you're \$280 short of paying Card in full by Oct 17/);
  });

  it('flags when the verdict depends on PENDING pay (unsubmitted hours)', () => {
    const s = stream({ id: 'job', condition: 'hours submitted', pendingUnsubmitted: { units: 20, periodEnd: '2026-10-03' } }); // $310 pending on Oct 9
    const d = coverageCheck(base(1000, 1100, 25), [s], 30).dues[0]!;
    expect(d.pendingIncomeBefore).toBe(310);
    expect(d.verdict).toBe('covered');
    expect(d.verdictWithoutPending).toBe('covered_minimum_only');
    expect(d.sentence).toMatch(/That counts \$310 of PENDING pay that only lands if hours submitted\./);
    expect(d.sentence).toMatch(/Without the pending pay, you'd be \$100 short of the full balance\./);
  });

  it('does not count a paycheck landing ON the due date unless asked', () => {
    const s = stream({ id: 'p', kind: 'other', rate: 500, nextPayDate: '2026-10-17' });
    expect(coverageCheck(base(700, 1000, 25), [s], 30).dues[0]!.verdict).toBe('covered_minimum_only');
    expect(coverageCheck(base(700, 1000, 25), [s], 30, { countSameDayDeposits: true }).dues[0]!.verdict).toBe('covered');
  });

  it('does not count income landing on the snapshot day (already in the balance)', () => {
    const s = stream({ id: 'p', kind: 'other', rate: 500, nextPayDate: '2026-10-05' });
    expect(coverageCheck(base(700, 1000, 25), [s], 30).dues[0]!.expectedIncomeBefore).toBe(0);
  });

  it('handles several due dates in order; earlier dues reduce later ones', () => {
    const s = snap('2026-10-05', [acct('chk', 'checking', 1000), acct('a', 'credit_card', 600), acct('b', 'loan', 5000)], [
      { accountId: 'b', statementBalance: 150, minimumDue: 150, dueDate: '2026-10-20' },
      { accountId: 'a', statementBalance: 600, minimumDue: 30, dueDate: '2026-10-10' },
    ]);
    const r = coverageCheck(s, [], 30);
    expect(r.dues.map((d) => d.accountId)).toEqual(['a', 'b']);
    expect(r.dues[1]!.earlierDueFull).toBe(600);
    expect(r.dues[1]!.earlierDueMinimum).toBe(30);
    expect(r.dues[1]!.afterPayInFull).toBe(250);
    expect(r.dues[1]!.afterMinimum).toBe(820);
    expect(r.dues[1]!.steps.some((x) => x.label === 'Due earlier in this window')).toBe(true);
  });

  it('ignores past and out-of-horizon due dates, includes due today', () => {
    const mk = (due: string) => snap('2026-10-05', [acct('chk', 'checking', 10), acct('c', 'credit_card', 100)], [{ accountId: 'c', statementBalance: 100, minimumDue: 25, dueDate: due }]);
    expect(coverageCheck(mk('2026-10-04'), [], 30).dues).toHaveLength(0);
    expect(coverageCheck(mk('2026-11-05'), [], 30).dues).toHaveLength(0);
    expect(coverageCheck(mk('2026-11-04'), [], 30).dues).toHaveLength(1);
    expect(coverageCheck(mk('2026-10-05'), [], 30).dues[0]!.daysAway).toBe(0);
    expect(coverageCheck(mk('2026-10-04'), [], 14).headline).toBe('Nothing is due in the next 14 days.');
  });

  it('uses available balance and an optional ESTIMATE for everyday spending', () => {
    const s = snap('2026-10-05', [acct('chk', 'checking', 900, { available: 800 }), acct('c', 'credit_card', 500)], [{ accountId: 'c', statementBalance: 500, minimumDue: 25, dueDate: '2026-10-15' }]);
    const r = coverageCheck(s, [], 10, { dailySpend: 20 });
    expect(r.cashNow).toBe(800);
    expect(r.dues[0]!.afterPayInFull).toBe(100); // 800 − 10 days × 20 − 500
    expect(r.dues[0]!.steps.find((x) => x.basis === 'estimate')?.amount).toBe(-200);
    expect(r.runway.at(-1)!.payInFull).toBe(100);
    expect(r.assumptions.join(' ')).toMatch(/ESTIMATE of \$20 per day/);
  });
});
