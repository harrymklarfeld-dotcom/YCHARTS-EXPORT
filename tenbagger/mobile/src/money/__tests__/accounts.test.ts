import { groupAccounts, sourcesLine } from '../accounts';
import type { Snapshot } from '../engine';
import { getSampleHub } from '../hub';

describe('Home: all accounts in one place', () => {
  it('groups the sample persona into Cash, Investing and Owed with totals that match the breakdown', () => {
    const hub = getSampleHub();
    const groups = groupAccounts(hub.latest);
    expect(groups.map((g) => g.id)).toEqual(['cash', 'investing', 'owed']);
    expect(groups[0].total).toBe(hub.breakdown.liquidity.value);
    expect(groups[1].total).toBe(hub.breakdown.investments.value);
    expect(groups[2].total).toBe(hub.breakdown.debt.value);
    const card = groups[2].rows[0];
    expect(card.note).toBe('75% of the $1,500 limit');
    expect(card.tab).toBe('credit');
    expect(sourcesLine(hub.latest)).toBe('4 linked · 1 added by hand');
  });

  it('lists a deferred student loan without counting it, drops empty groups and reports staleness', () => {
    const snap: Snapshot = {
      takenAt: '2026-10-05T09:00:00Z',
      accounts: [
        { id: 'c', name: 'Checking', kind: 'checking', balance: 100, asOf: '2026-10-02', basis: 'manual' },
        { id: 'l', name: 'Student loan', kind: 'loan', balance: 5500, asOf: '2026-10-05', basis: 'manual', deferred: true },
      ],
      liabilities: [],
    } as unknown as Snapshot;
    const groups = groupAccounts(snap);
    expect(groups.map((g) => g.id)).toEqual(['cash', 'owed']);
    expect(groups[0].rows[0].daysOld).toBe(3);
    expect(groups[1].total).toBe(0);
    expect(groups[1].rows[0].note).toMatch(/not counted/);
    expect(sourcesLine(snap)).toBe('2 added by hand');
  });
});
