import { buildDashboard } from '../dashboard';
import { matchTransfers, spendingByCategory } from '../engine';
import { buildMockMoneyData, MOCK_INSTITUTIONS } from '../live/mockFixtures';

describe('Home across banks: transfers between your own accounts are not spending', () => {
  const now = new Date('2026-10-06T15:00:00Z');
  const data = buildMockMoneyData(MOCK_INSTITUTIONS.map((i) => ({ institutionId: i.id, lastSyncedAt: now.toISOString() })), now);
  const latest = data.snapshots[data.snapshots.length - 1];

  it('pairs Chase -> Ally and Chase -> Robinhood moves', () => {
    const m = matchTransfers(data.transactions ?? [], latest.accounts);
    const descs = (data.transactions ?? []).filter((t) => m.matchedIds.has(t.id)).map((t) => t.name);
    expect(descs).toEqual(expect.arrayContaining(['ONLINE TRANSFER TO ALLY BANK SAVINGS', 'TRANSFER FROM CHASE CHECKING', 'ROBINHOOD DEPOSIT', 'DEPOSIT FROM CHASE']));
  });

  it('spending on Home equals spending with the matched legs removed entirely', () => {
    const dash = buildDashboard(data, { workLog: [], categoryOverrides: {} } as never);
    const m = matchTransfers(data.transactions ?? [], latest.accounts);
    const without = (data.transactions ?? []).filter((t) => !m.matchedIds.has(t.id));
    expect(dash.spend.total).toBe(spendingByCategory(without, dash.spend.month).total);
    expect(dash.spend.categories.some((c) => (c as { category: string }).category === 'transfer')).toBe(false);
  });
});
