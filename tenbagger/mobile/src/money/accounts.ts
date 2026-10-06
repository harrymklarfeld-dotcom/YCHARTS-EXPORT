/**
 * Home screen "All your accounts": groups the latest snapshot's accounts into Cash / Investing / Owed,
 * with section totals, freshness and a card-utilization note. Pure (no React); tested in
 * __tests__/accounts.test.ts. Read-only: nothing here moves money or awards XP.
 */
import { diffDays, utilization, type Account, type AccountKind, type Snapshot } from './engine';

export type AccountGroupId = 'cash' | 'investing' | 'owed';

export type AccountRow = {
  account: Account;
  /** "Checking", "Roth IRA" etc. (kind in plain words). */
  kindLabel: string;
  /** Days between the account's as-of date and the snapshot date (0 = current). */
  daysOld: number;
  /** Short extra line, e.g. "75% of the $1,500 limit" or "Deferred: not counted in net worth". */
  note?: string;
  /** Dashboard tab that explains this account. */
  tab: 'bank' | 'investments' | 'credit';
};

export type AccountGroup = {
  id: AccountGroupId;
  title: string;
  /** Sum of balances counted toward net worth (deferred loans are listed but not counted). */
  total: number;
  rows: AccountRow[];
};

const GROUP_OF: Record<AccountKind, AccountGroupId> = {
  checking: 'cash',
  savings: 'cash',
  brokerage: 'investing',
  retirement: 'investing',
  crypto: 'investing',
  credit_card: 'owed',
  loan: 'owed',
};

const KIND_LABEL: Record<AccountKind, string> = {
  checking: 'Checking',
  savings: 'Savings',
  brokerage: 'Brokerage',
  retirement: 'Retirement',
  crypto: 'Crypto',
  credit_card: 'Credit card',
  loan: 'Loan',
};

const TITLES: Record<AccountGroupId, string> = { cash: 'Cash', investing: 'Investing', owed: 'Owed' };
const TAB: Record<AccountGroupId, AccountRow['tab']> = { cash: 'bank', investing: 'investments', owed: 'credit' };
const ORDER: AccountGroupId[] = ['cash', 'investing', 'owed'];

function noteFor(a: Account): string | undefined {
  if (a.kind === 'credit_card' && a.creditLimit) {
    const u = utilization(a.balance, a.creditLimit);
    return u.ratio === null ? undefined : `${Math.round(u.ratio * 100)}% of the $${a.creditLimit.toLocaleString('en-US')} limit`;
  }
  if (a.kind === 'loan' && a.deferred) return 'Deferred: listed, not counted in net worth';
  if (a.available !== undefined && a.available !== a.balance) return `$${a.available.toLocaleString('en-US')} available now`;
  return undefined;
}

/** Groups a snapshot's accounts. Empty groups are dropped; order is Cash, Investing, Owed. */
export function groupAccounts(snapshot: Snapshot): AccountGroup[] {
  const date = snapshot.takenAt.slice(0, 10);
  const groups = new Map<AccountGroupId, AccountGroup>();
  for (const a of snapshot.accounts) {
    const id = GROUP_OF[a.kind];
    const g = groups.get(id) ?? { id, title: TITLES[id], total: 0, rows: [] };
    if (!(a.kind === 'loan' && a.deferred)) g.total += a.balance;
    g.rows.push({ account: a, kindLabel: KIND_LABEL[a.kind], daysOld: Math.max(0, diffDays(a.asOf, date)), note: noteFor(a), tab: TAB[id] });
    groups.set(id, g);
  }
  return ORDER.filter((id) => groups.has(id)).map((id) => groups.get(id)!);
}

/** "3 linked · 1 added by hand", for the section header. */
export function sourcesLine(snapshot: Snapshot): string {
  const linked = snapshot.accounts.filter((a) => a.basis === 'verified').length;
  const manual = snapshot.accounts.length - linked;
  return [linked ? `${linked} linked` : '', manual ? `${manual} added by hand` : ''].filter(Boolean).join(' · ');
}
