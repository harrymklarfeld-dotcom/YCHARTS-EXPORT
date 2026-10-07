/**
 * SANDBOX fixtures for MockMoneyClient. Every institution is a "(sandbox)" stand-in and every
 * number is made up for a FICTIONAL student, Jordan. Nothing here is real data or a real account.
 *
 * Dates are relative to the client's clock so the dashboard always looks current. Only accounts
 * from linked institutions appear; each account's `asOf` is that connection's last successful update.
 */
import { addDays, type Account, type Holding, type IncomeDeposit, type IncomeStream, type Liability, type Snapshot, type Transaction } from '../engine';
import type { DetectedStream, MoneyData } from '../hub';
import type { ConnectionStatus } from './types';

export type MockInstitution = {
  id: 'chase' | 'ally' | 'robinhood' | 'discover';
  name: string;
  /** What it adds, for the picker. */
  kind: string;
  /** Status the sandbox simulates right after linking (to show every chip). */
  simulate: ConnectionStatus;
  accountsCount: number;
};

export const MOCK_INSTITUTIONS: readonly MockInstitution[] = [
  { id: 'chase', name: 'Chase (sandbox)', kind: 'Checking', simulate: 'active', accountsCount: 1 },
  { id: 'ally', name: 'Ally Bank (sandbox)', kind: 'Savings', simulate: 'expiring', accountsCount: 1 },
  { id: 'robinhood', name: 'Robinhood (sandbox)', kind: 'Investing', simulate: 'active', accountsCount: 1 },
  { id: 'discover', name: 'Discover card (sandbox)', kind: 'Credit card', simulate: 'needs_relogin', accountsCount: 1 },
];

export function mockInstitution(id: string | null | undefined): MockInstitution | undefined {
  return MOCK_INSTITUTIONS.find((i) => i.id === id);
}

export type MockLinked = { institutionId: MockInstitution['id']; lastSyncedAt: string };

const SNAPSHOT_DAYS = [-21, -14, -7, 0];
/** Balance at each snapshot (oldest → latest), per account. Made up. */
const BALANCES = {
  chk: [512.4, 688.15, 455.9, 742.18],
  sav: [1050, 1050, 1200, 1350],
  card: [298.6, 341.25, 455.1, 412.5],
};

const HOLDINGS: Omit<Holding, 'accountId'>[] = [
  { ticker: 'VTI', name: 'Total US stock market ETF (sample price)', kind: 'etf', assetClass: 'US stock index fund', shares: 2.1, price: 285.4, costBasis: 540, basis: 'verified' },
  { ticker: 'AAPL', name: 'Apple (sample price)', kind: 'stock', assetClass: 'Single stock', shares: 1.5, price: 228.1, costBasis: 310, basis: 'verified' },
  { ticker: null, name: 'Cash in brokerage', kind: 'cash', assetClass: 'Cash', shares: 42.15, price: 1, costBasis: 42.15, basis: 'verified' },
];
const BRK_GROWTH = [0.95, 0.97, 0.99, 1];

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/** [dayOffset, accountKey, amount, name, category?] — signed amounts, + = money in. */
type TxRow = [number, 'chk' | 'sav' | 'card' | 'brk', number, string, string?];
const TX: TxRow[] = [
  [-16, 'chk', 312.4, 'CAMPUS CAFE PAYROLL DIR DEP', 'INCOME_WAGES'],
  [-2, 'chk', 298.75, 'CAMPUS CAFE PAYROLL DIR DEP', 'INCOME_WAGES'],
  [-15, 'chk', -48.21, "TRADER JOE'S"],
  [-11, 'chk', -9.5, 'CAMPUS LAUNDRY'],
  [-6, 'chk', -27.84, 'SAFEWAY'],
  [-3, 'chk', -14.6, 'CITY TRANSIT CARD'],
  // A transfer between two linked banks: one leg out of checking, one leg into savings (settles a day later).
  [-9, 'chk', -150, 'ONLINE TRANSFER TO ALLY BANK SAVINGS', 'TRANSFER_OUT'],
  [-8, 'sav', 150, 'TRANSFER FROM CHASE CHECKING', 'TRANSFER_IN'],
  [-1, 'sav', 0.42, 'INTEREST PAID', 'INCOME_INTEREST'],
  // Money moved to the brokerage, and a card payment from checking (both legs linked).
  [-12, 'chk', -50, 'ROBINHOOD DEPOSIT', 'TRANSFER_OUT'],
  [-12, 'brk', 50, 'DEPOSIT FROM CHASE', 'TRANSFER_IN'],
  [-5, 'chk', -120, 'DISCOVER E-PAYMENT', 'LOAN_PAYMENTS'],
  [-5, 'card', 120, 'INTERNET PAYMENT - THANK YOU', 'LOAN_PAYMENTS'],
  [-20, 'card', -11.99, 'SPOTIFY'],
  [-18, 'card', -13.45, 'CHIPOTLE'],
  [-13, 'card', -36.2, 'TARGET'],
  [-10, 'card', -18.4, 'UBER TRIP'],
  [-7, 'card', -6.75, 'CAMPUS STORE'],
  [-4, 'card', -22.1, 'THAI BASIL'],
  [-1, 'card', -15.49, 'NETFLIX'],
];

const ACCOUNT_OF = { chk: 'chase-chk', sav: 'ally-sav', card: 'discover-card', brk: 'rh-brk' } as const;
const INSTITUTION_OF = { chk: 'chase', sav: 'ally', card: 'discover', brk: 'robinhood' } as const;

export const MOCK_STREAM: IncomeStream = {
  id: 'cafe-job',
  name: 'Campus café shifts',
  kind: 'hourly',
  rate: 16,
  schedule: { unitsPerWeek: 12, weekdays: [2, 4, 6] },
  payFrequency: 'biweekly',
  nextPayDate: '2000-01-01', // replaced per build
  withholdingRate: 0.06,
  condition: 'hours submitted',
};

/** Builds MoneyData for the linked sandbox institutions. Throws if nothing is linked. */
export function buildMockMoneyData(linked: readonly MockLinked[], now: Date): MoneyData {
  if (linked.length === 0) throw new Error('No sandbox connections linked');
  const today = now.toISOString().slice(0, 10);
  const d = (n: number) => addDays(today, n);
  const syncedOn = new Map(linked.map((l) => [l.institutionId, l.lastSyncedAt.slice(0, 10)]));
  const has = (inst: MockInstitution['id']) => syncedOn.has(inst);
  /** Value as of `date`, but never newer than the connection's last update. */
  const asOfFor = (inst: MockInstitution['id'], date: string) => {
    const s = syncedOn.get(inst)!;
    return s < date ? s : date;
  };
  /** Index of the snapshot that a stale connection's balance is frozen at. */
  const frozenIdx = (inst: MockInstitution['id'], i: number) => {
    const s = syncedOn.get(inst)!;
    let k = i;
    while (k > 0 && d(SNAPSHOT_DAYS[k]) > s) k--;
    return k;
  };

  const snapshots: Snapshot[] = SNAPSHOT_DAYS.map((off, i) => {
    const date = d(off);
    const accounts: Account[] = [];
    const liabilities: Liability[] = [];
    if (has('chase')) {
      accounts.push({ id: 'chase-chk', name: 'Chase checking ••4821', kind: 'checking', balance: BALANCES.chk[frozenIdx('chase', i)], asOf: asOfFor('chase', date), basis: 'verified' });
    }
    if (has('ally')) {
      accounts.push({ id: 'ally-sav', name: 'Ally savings ••0937', kind: 'savings', balance: BALANCES.sav[frozenIdx('ally', i)], asOf: asOfFor('ally', date), basis: 'verified' });
    }
    if (has('robinhood')) {
      const k = frozenIdx('robinhood', i);
      const v = round2(HOLDINGS.reduce((s, h) => s + h.shares * h.price, 0) * BRK_GROWTH[k]);
      accounts.push({ id: 'rh-brk', name: 'Robinhood individual', kind: 'brokerage', balance: v, asOf: asOfFor('robinhood', date), basis: 'verified' });
    }
    if (has('discover')) {
      const k = frozenIdx('discover', i);
      accounts.push({ id: 'discover-card', name: 'Discover it ••5510', kind: 'credit_card', balance: BALANCES.card[k], asOf: asOfFor('discover', date), basis: 'verified', creditLimit: 1000 });
      liabilities.push({ accountId: 'discover-card', statementBalance: 388.2, minimumDue: 35, dueDate: d(12), apr: 0.2724, statementDate: d(-13) });
    }
    return { takenAt: `${date}T09:00`, accounts, liabilities, note: i === SNAPSHOT_DAYS.length - 1 ? 'Sandbox sync.' : 'Sandbox weekly check-in.' };
  });

  const transactions: Transaction[] = TX.filter(([off, acct]) => has(INSTITUTION_OF[acct]) && d(off) <= syncedOn.get(INSTITUTION_OF[acct])!).map(
    ([off, acct, amount, name, category], i) => ({
      id: `sbx-${i}`,
      date: d(off),
      accountId: ACCOUNT_OF[acct],
      amount,
      name,
      category: category ?? null,
      pending: off === -1,
      basis: 'verified',
    }),
  );

  const deposits: IncomeDeposit[] = has('chase')
    ? [
        { date: d(-16), amount: 312.4, streamId: 'cafe-job', basis: 'verified' },
        { date: d(-2), amount: 298.75, streamId: 'cafe-job', basis: 'verified' },
      ]
    : [];
  const detectedStreams: DetectedStream[] = has('chase')
    ? [
        {
          id: 'det-cafe',
          name: 'CAMPUS CAFE PAYROLL DIR DEP',
          category: 'INCOME_WAGES',
          frequency: 'BIWEEKLY',
          status: 'MATURE',
          averageAmount: 305.58,
          lastAmount: 298.75,
          lastDate: d(-2),
          predictedNextDate: d(12),
          basis: 'verified',
          matchesStreamId: 'cafe-job',
        },
      ]
    : [];

  return {
    sample: true,
    sampleLabel: 'Sandbox connections (mock mode)',
    persona: { name: 'Jordan', age: 19, year: 'first-year', blurb: 'Fictional student used for sandbox linking. Every number is made up.' },
    asOf: today,
    horizonDays: 30,
    streams: [{ ...MOCK_STREAM, nextPayDate: d(12) }],
    deposits,
    snapshots,
    transactions,
    holdings: has('robinhood') ? HOLDINGS.map((h) => ({ ...h, accountId: 'rh-brk' })) : [],
    investmentContributions: has('robinhood') ? [{ date: d(-12), amount: 50, accountId: 'rh-brk' }] : [],
    detectedStreams,
    goals: { emergencyFundWeeks: 6, cardPayoffBy: d(180), rothTarget: 500, rothYear: Number(today.slice(0, 4)) },
  };
}
