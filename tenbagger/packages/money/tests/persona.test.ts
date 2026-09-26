import { describe, expect, it } from 'vitest';
import {
  appendSnapshot, companyAnalogies, coverageCheck, estimateMonthlyFreeCashFlow, netWorth, scorecard, type Snapshot,
} from '../src/index.ts';
import { DEPOSITS, LATEST, LOG, PERSONA, STREAMS } from './helpers.ts';

describe('sample persona end-to-end (Alex, 20, sophomore — fictional)', () => {
  it('is clearly labelled sample data with made-up, generic accounts', () => {
    expect(PERSONA.sample).toBe(true);
    expect(PERSONA.sampleLabel).toBe('Sample data — link accounts later');
    expect(PERSONA.persona).toMatchObject({ name: 'Alex', age: 20, year: 'sophomore' });
    const names = new Set(PERSONA.snapshots.flatMap((s) => s.accounts.map((a) => a.name)));
    expect([...names].sort()).toEqual(['Brokerage', 'Checking', 'Roth IRA', 'Savings', 'Student credit card']);
    // No account numbers or institution identifiers anywhere.
    expect(JSON.stringify(PERSONA)).not.toMatch(/\d{6,}|routing|acct#|account number/i);
  });

  it('snapshot → hub: summary, coverage, scorecard, analogies', () => {
    const b = netWorth(LATEST);
    expect([b.liquidity.value, b.investments.value, b.debt.value, b.net.value]).toEqual([1250, 2900, 1120, 3030]);
    const cov = coverageCheck(LATEST, STREAMS, PERSONA.horizonDays);
    expect(cov.verdict).toBe('covered');
    expect(cov.dues[0]!.sentence.startsWith("You're fine for Oct 17")).toBe(true);
    const sc = scorecard(LOG, STREAMS, DEPOSITS);
    expect(sc.overall.grade).toBe('B');
    const an = companyAnalogies(b, { monthlyFreeCashFlow: estimateMonthlyFreeCashFlow(LOG) });
    expect(an).toHaveLength(5);
  });

  it('what happens next: hours still not submitted, card charged again — a new snapshot, history kept', () => {
    const next: Snapshot = {
      takenAt: '2026-10-12T20:00',
      note: 'Hours still not submitted; more charges on the card.',
      accounts: LATEST.accounts.map((a) =>
        a.id === 'chk' ? { ...a, balance: 400, asOf: '2026-10-12' } : a.id === 'card' ? { ...a, balance: 1300, asOf: '2026-10-12' } : { ...a, asOf: '2026-10-12' },
      ),
      liabilities: LATEST.liabilities,
    };
    const log2 = appendSnapshot(LOG, next);
    expect(log2).toHaveLength(LOG.length + 1);
    expect(LOG).toHaveLength(PERSONA.snapshots.length);
    // The pending Oct 9 paycheck never landed; with no streams re-dated, the check only counts tutoring.
    const stillPending = STREAMS.map((s) => (s.id === 'campus-job' ? { ...s, nextPayDate: '2026-10-23' } : s));
    const cov = coverageCheck(log2[log2.length - 1]!, stillPending, 30);
    const d = cov.dues[0]!;
    expect(d.cashNow).toBe(810);
    expect(d.expectedIncomeBefore).toBe(120);
    expect(d.afterPayInFull).toBe(-190);
    expect(d.verdict).toBe('covered_minimum_only');
    expect(d.sentence).toMatch(/you'd be \$190 short of the full \$1,120 statement balance/);
  });
});
