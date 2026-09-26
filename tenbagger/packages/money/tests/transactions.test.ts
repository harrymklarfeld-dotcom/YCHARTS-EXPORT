import { describe, expect, it } from 'vitest';
import {
  averageDailySpend,
  cashRunwayDays,
  categorize,
  compareCategories,
  DEFAULT_CATEGORY_RULES,
  detectSubscriptions,
  merchantKey,
  paymentRebounds,
  spendingByCategory,
  spendingLeaks,
  spendingPace,
  type Transaction,
} from '../src/index.ts';
import { PERSONA } from './helpers.ts';

const TX = PERSONA.transactions as unknown as Transaction[];
let n = 0;
const t = (date: string, amount: number, name: string, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${++n}`, date, accountId: 'card', amount, name, ...extra });

describe('categorization (rule-based, editable)', () => {
  it('normalizes merchant names', () => {
    expect(merchantKey('RIDENOW *TRIP 4412')).toBe('ridenow trip');
    expect(merchantKey('Corner Grocery #031')).toBe('corner grocery');
  });
  it('matches keywords at word starts, first rule wins', () => {
    expect(categorize(t('2026-09-01', -4, 'BEANERY COFFEE'))).toBe('food'); // "fee" must not match "coffee"
    expect(categorize(t('2026-09-01', -12, 'RIDENOW TRIP'))).toBe('rideshare');
    expect(categorize(t('2026-09-01', -750, 'STUDENT CARD PAYMENT'))).toBe('card_payment');
    expect(categorize(t('2026-09-01', 353.4, 'CAMPUS PAYROLL DIR DEP'))).toBe('income');
    expect(categorize(t('2026-09-01', -2.99, 'CLOUDBOX STORAGE 200GB'))).toBe('subscriptions');
    expect(categorize(t('2026-09-01', -9, 'MYSTERY VENDOR'))).toBe('other');
    expect(categorize(t('2026-09-01', 5, 'MYSTERY VENDOR'))).toBe('income');
  });
  it('provider category, custom rules and user overrides (override wins)', () => {
    const x = t('2026-09-01', -20, 'SQ JAMIE STAND');
    expect(categorize({ ...x, category: 'food' })).toBe('food');
    expect(categorize(x, { rules: { ...DEFAULT_CATEGORY_RULES, food: ['jamie'] } })).toBe('food');
    expect(categorize({ ...x, category: 'food' }, { overrides: { 'sq jamie stand': 'entertainment' } })).toBe('entertainment');
  });
  it('every sample transaction lands in a known category', () => {
    const cats = new Set(TX.map((x) => categorize(x)));
    expect([...cats].every((c) => Object.keys(DEFAULT_CATEGORY_RULES).includes(c) || c === 'other')).toBe(true);
  });
});

describe('spendingByCategory / compareCategories / leaks', () => {
  const txs = [
    t('2026-08-03', -40, 'CORNER GROCERY'),
    t('2026-08-10', -20, 'RIDENOW TRIP'),
    t('2026-08-20', -300, 'STUDENT CARD PAYMENT', { accountId: 'chk' }),
    t('2026-09-02', -45, 'CORNER GROCERY'),
    t('2026-09-05', -30, 'RIDENOW TRIP'),
    t('2026-09-06', -25, 'RIDENOW TRIP'),
    t('2026-09-09', -60, 'ARENA CONCERT TICKETS'),
    t('2026-09-10', 500, 'CAMPUS PAYROLL DIR DEP', { accountId: 'chk' }),
    t('2026-09-11', -75, 'TRANSFER TO BROKERAGE', { accountId: 'chk' }),
  ];
  it('adds up spending only (no payments, transfers or income), largest first', () => {
    const s = spendingByCategory(txs, '2026-09');
    expect(s.total).toBe(160);
    expect(s.categories.map((c) => [c.category, c.total, c.count])).toEqual([
      ['entertainment', 60, 1],
      ['rideshare', 55, 2],
      ['groceries', 45, 1],
    ]);
    expect(s.categories[0]!.share).toBe(0.38);
    expect(spendingByCategory(txs, '2026-09', { through: '2026-09-05' }).total).toBe(75);
  });
  it('compares with the prior month and flags fast-growing categories', () => {
    const c = compareCategories(txs, '2026-09');
    expect(c.find((x) => x.category === 'rideshare')).toMatchObject({ current: 55, prior: 20, change: 35, changePct: 1.75 });
    const leaks = spendingLeaks(txs, '2026-09');
    expect(leaks.map((l) => l.category)).toEqual(['entertainment', 'rideshare']); // groceries +12.5% is not a leak
    expect(leaks[1]!.sentence).toBe('Rideshare: $55, up 175% from $20 the month before.');
  });
  it('sample persona: September books and rideshare grew fast', () => {
    const leaks = spendingLeaks(TX, '2026-09').map((l) => l.category);
    expect(leaks).toContain('books');
    expect(leaks).toContain('rideshare');
  });
});

describe('detectSubscriptions', () => {
  it('finds same-merchant, ~monthly, similar-amount charges', () => {
    const txs = [
      t('2026-07-12', -10.99, 'STREAMTUNES MUSIC'),
      t('2026-08-12', -10.99, 'STREAMTUNES MUSIC'),
      t('2026-09-12', -11.49, 'STREAMTUNES MUSIC'),
      t('2026-07-02', -14, 'NOODLE BAR'), // monthly-ish dates, but amounts differ too much
      t('2026-08-01', -9, 'NOODLE BAR'),
      t('2026-09-01', -15, 'NOODLE BAR'),
      t('2026-07-05', -5, 'CAMPUS CAFE'), // weekly: not monthly
      t('2026-07-12', -5, 'CAMPUS CAFE'),
      t('2026-07-19', -5, 'CAMPUS CAFE'),
      t('2026-07-10', -30, 'PINEPHONE WIRELESS'), // only two charges
      t('2026-08-10', -30, 'PINEPHONE WIRELESS'),
    ];
    const subs = detectSubscriptions(txs);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ merchant: 'streamtunes music', occurrences: 3, cadenceDays: 31, lastDate: '2026-09-12', nextExpected: '2026-10-13', lastAmount: 11.49, category: 'subscriptions' });
    expect(subs[0]!.monthlyCost).toBeCloseTo(10.96, 2);
    expect(detectSubscriptions(txs, { minOccurrences: 2 }).map((s) => s.merchant)).toEqual(['pinephone wireless', 'streamtunes music']);
  });
  it('sample persona: music, video, cloud storage and the phone bill', () => {
    expect(detectSubscriptions(TX).map((s) => s.merchant).sort()).toEqual(['cloudbox storage gb', 'flixbox video streaming', 'pinephone wireless', 'streamtunes music']);
  });
});

describe('pace, runway and card rebounds', () => {
  it('cashRunwayDays', () => {
    expect(cashRunwayDays(1250, 40)).toBe(31);
    expect(cashRunwayDays(1250, 0)).toBeNull();
    expect(cashRunwayDays(-5, 10)).toBe(0);
  });
  it('averageDailySpend over a window', () => {
    const d = averageDailySpend([t('2026-09-30', -30, 'CORNER GROCERY'), t('2026-09-01', -300, 'CORNER GROCERY'), t('2026-09-29', -500, 'STUDENT CARD PAYMENT')], '2026-09-30', 10);
    expect(d).toMatchObject({ value: 3, from: '2026-09-21', label: 'estimate' });
  });
  it('spendingPace projects month-to-date spending against income', () => {
    const p = spendingPace([t('2026-10-01', -50, 'CORNER GROCERY'), t('2026-10-02', 400, 'CAMPUS PAYROLL DIR DEP', { accountId: 'chk' })], '2026-10-05', { expectedIncomeRest: 200 });
    expect(p).toMatchObject({ daysElapsed: 5, daysInMonth: 31, spentSoFar: 50, incomeSoFar: 400, projectedSpend: 310, expectedIncome: 600, paceRatio: 0.52 });
  });
  it('paymentRebounds: charges after each card payment', () => {
    const r = paymentRebounds(TX, 'card');
    expect(r.map((x) => [x.date, x.paid])).toEqual([['2026-07-17', 480], ['2026-08-18', 730], ['2026-09-18', 750]]);
    const sep = r[2]!;
    expect(sep.outrun).toBe(true);
    expect(sep.share).toBeGreaterThanOrEqual(0.5);
    expect(sep.topMerchants[0]!.name).toBe('CAMPUS BOOKSTORE');
    expect(r[1]!.outrun).toBe(false);
  });
});
