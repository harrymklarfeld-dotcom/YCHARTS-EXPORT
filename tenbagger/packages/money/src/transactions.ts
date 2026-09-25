/**
 * Transactions: rule-based categories, spending by category, recurring subscriptions,
 * fast-growing "leaks", spending pace and cash runway.
 *
 * Everything here is descriptive: it sorts and adds up what already happened. Nothing
 * suggests what to cut, buy or cancel.
 */
import { addDays, daysInMonth, diffDays, monthKey, parts, toDayNumber } from './dates.ts';
import { formatUSD, round2 } from './format.ts';
import type { ISODate, NumberLabel, Transaction } from './types.ts';

// ---------------------------------------------------------------- categories

/** Category ids used by the default rules. Users can add their own (any string works). */
export const SPEND_CATEGORIES = [
  'income',
  'card_payment',
  'transfer',
  'groceries',
  'food',
  'rideshare',
  'subscriptions',
  'phone',
  'books',
  'shopping',
  'entertainment',
  'transport',
  'fees',
  'other',
] as const;

export const CATEGORY_TITLES: Record<string, string> = {
  income: 'Income',
  card_payment: 'Card payment',
  transfer: 'Transfer',
  groceries: 'Groceries',
  food: 'Eating out',
  rideshare: 'Rideshare',
  subscriptions: 'Subscriptions',
  phone: 'Phone',
  books: 'Books & supplies',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  transport: 'Transit',
  fees: 'Fees & interest',
  other: 'Other',
};

export function categoryTitle(id: string): string {
  return CATEGORY_TITLES[id] ?? id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Editable rule map: category → lowercase keywords matched against the merchant name.
 * Checked in insertion order, first match wins, so the specific money-movement rules
 * (payments, transfers, payroll) come before spending categories.
 */
export type CategoryRules = Readonly<Record<string, readonly string[]>>;

export const DEFAULT_CATEGORY_RULES: CategoryRules = {
  card_payment: ['card payment', 'payment thank you', 'autopay'],
  transfer: ['transfer to', 'transfer from'],
  income: ['payroll', 'dir dep', 'tutoring', 'gift from'],
  fees: ['interest charge', 'late fee', 'fee'],
  subscriptions: ['streaming', 'music', 'video', 'cloud storage', 'subscription'],
  phone: ['wireless', 'phone'],
  groceries: ['grocery', 'market'],
  rideshare: ['ride', 'scooter'],
  food: ['cafe', 'coffee', 'pizza', 'taco', 'noodle', 'burger', 'bakery', 'delivery', 'dining', 'food'],
  books: ['bookstore', 'textbook'],
  transport: ['transit', 'bus pass', 'parking'],
  entertainment: ['movie', 'concert', 'tickets', 'game'],
  shopping: ['store', 'shop', 'supplies'],
};

/** Categories that move money around rather than spend it. Excluded from spending totals. */
export const NON_SPENDING: readonly string[] = ['card_payment', 'transfer', 'income'];

/** Lowercased merchant with store numbers, ids and punctuation removed ("RIDENOW *TRIP 4412" → "ridenow trip"). */
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[#*]/g, ' ')
    .replace(/\b\d[\d-]*\b/g, ' ')
    .replace(/[^a-z& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type CategorizeOptions = {
  rules?: CategoryRules;
  /** User edits: merchantKey → category. Wins over everything. */
  overrides?: Readonly<Record<string, string>>;
};

/**
 * Category for one transaction: a user override for the merchant, then the provider's category,
 * then the first matching rule; otherwise `income` for money in and `other` for money out.
 */
export function categorize(tx: Transaction, opts: CategorizeOptions = {}): string {
  const key = merchantKey(tx.name);
  const o = opts.overrides?.[key];
  if (o) return o;
  if (tx.category) return tx.category;
  const rules = opts.rules ?? DEFAULT_CATEGORY_RULES;
  for (const [cat, words] of Object.entries(rules)) {
    if (words.some((w) => key.includes(w.toLowerCase()))) return cat;
  }
  return tx.amount > 0 ? 'income' : 'other';
}

export type CategorizedTransaction = Transaction & { category: string };

export function categorizeAll(txs: readonly Transaction[], opts: CategorizeOptions = {}): CategorizedTransaction[] {
  return txs.map((t) => ({ ...t, category: categorize(t, opts) }));
}

/** Money actually spent: outflows that are not payments, transfers or income reversals. */
export function isSpending(tx: Transaction, opts: CategorizeOptions = {}): boolean {
  return tx.amount < 0 && !NON_SPENDING.includes(categorize(tx, opts));
}

function inRange(date: ISODate, from: ISODate, to: ISODate): boolean {
  const n = toDayNumber(date);
  return n >= toDayNumber(from) && n <= toDayNumber(to);
}

export function monthBounds(month: string): { start: ISODate; end: ISODate; days: number } {
  const { y, m } = parts(`${month}-01`);
  const days = daysInMonth(y, m);
  return { start: `${month}-01`, end: `${month}-${String(days).padStart(2, '0')}`, days };
}

export function prevMonth(month: string): string {
  const { y, m } = parts(`${month}-01`);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- spending by category

export type CategoryTotal = { category: string; title: string; total: number; count: number; share: number };

export type CategorySpend = {
  month: string;
  from: ISODate;
  to: ISODate;
  total: number;
  categories: CategoryTotal[];
  label: NumberLabel;
};

/**
 * Spending by category for calendar month `month` (`YYYY-MM`), largest first.
 * Pass `through` to stop early (month-to-date). Totals are positive dollars spent.
 */
export function spendingByCategory(
  txs: readonly Transaction[],
  month: string,
  opts: CategorizeOptions & { through?: ISODate } = {},
): CategorySpend {
  const b = monthBounds(month);
  const to = opts.through && opts.through < b.end ? opts.through : b.end;
  const map = new Map<string, { total: number; count: number }>();
  let total = 0;
  let manual = false;
  for (const t of txs) {
    if (!inRange(t.date, b.start, to) || !isSpending(t, opts)) continue;
    const c = categorize(t, opts);
    const cur = map.get(c) ?? { total: 0, count: 0 };
    cur.total += -t.amount;
    cur.count += 1;
    map.set(c, cur);
    total += -t.amount;
    if (t.basis === 'manual') manual = true;
  }
  const categories = [...map.entries()]
    .map(([category, v]) => ({
      category,
      title: categoryTitle(category),
      total: round2(v.total),
      count: v.count,
      share: total > 0 ? round2(v.total / total) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  return { month, from: b.start, to, total: round2(total), categories, label: manual ? 'manual' : 'verified' };
}

export type CategoryChange = {
  category: string;
  title: string;
  current: number;
  prior: number;
  change: number;
  /** null when there was no prior spending in the category. */
  changePct: number | null;
};

/** Month vs the month before, per category (union of both), biggest current first. */
export function compareCategories(txs: readonly Transaction[], month: string, opts: CategorizeOptions = {}): CategoryChange[] {
  const cur = spendingByCategory(txs, month, opts);
  const pri = spendingByCategory(txs, prevMonth(month), opts);
  const ids = new Set([...cur.categories.map((c) => c.category), ...pri.categories.map((c) => c.category)]);
  return [...ids]
    .map((category) => {
      const current = cur.categories.find((c) => c.category === category)?.total ?? 0;
      const prior = pri.categories.find((c) => c.category === category)?.total ?? 0;
      return {
        category,
        title: categoryTitle(category),
        current,
        prior,
        change: round2(current - prior),
        changePct: prior > 0 ? round2((current - prior) / prior) : null,
      };
    })
    .sort((a, b) => b.current - a.current || a.category.localeCompare(b.category));
}

export type Leak = CategoryChange & { sentence: string };

/**
 * "Leaks": categories growing fast month over month — at least `minGrowth` (default +25%)
 * AND at least `minIncrease` dollars (default $20), or new categories above `minIncrease`.
 * Sorted by dollar increase.
 */
export function spendingLeaks(
  txs: readonly Transaction[],
  month: string,
  opts: CategorizeOptions & { minGrowth?: number; minIncrease?: number } = {},
): Leak[] {
  const minGrowth = opts.minGrowth ?? 0.25;
  const minIncrease = opts.minIncrease ?? 20;
  return compareCategories(txs, month, opts)
    .filter((c) => c.change >= minIncrease && (c.changePct === null || c.changePct >= minGrowth))
    .sort((a, b) => b.change - a.change)
    .map((c) => ({
      ...c,
      sentence:
        c.changePct === null
          ? `${c.title}: ${formatUSD(c.current)} this month, new compared with the month before.`
          : `${c.title}: ${formatUSD(c.current)}, up ${Math.round(c.changePct * 100)}% from ${formatUSD(c.prior)} the month before.`,
    }));
}

// ---------------------------------------------------------------- subscriptions

export type Subscription = {
  merchant: string;
  name: string;
  category: string;
  occurrences: number;
  dates: ISODate[];
  averageAmount: number;
  lastAmount: number;
  lastDate: ISODate;
  /** Median days between charges. */
  cadenceDays: number;
  nextExpected: ISODate;
  monthlyCost: number;
  annualCost: number;
  label: NumberLabel;
};

export type SubscriptionOptions = CategorizeOptions & {
  /** Minimum charges needed (default 2). */
  minOccurrences?: number;
  /** Allowed days between charges (default 26–35: roughly monthly). */
  minGapDays?: number;
  maxGapDays?: number;
  /** Max spread of amounts relative to the median (default 0.15 = ±15%). */
  amountTolerance?: number;
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Recurring charges: same merchant, roughly monthly (every gap within the window), and a
 * similar amount each time. Transfers, card payments and income are ignored.
 * `nextExpected` is last date + median gap (a PROJECTED date, not a promise).
 */
export function detectSubscriptions(txs: readonly Transaction[], opts: SubscriptionOptions = {}): Subscription[] {
  const minOcc = opts.minOccurrences ?? 2;
  const minGap = opts.minGapDays ?? 26;
  const maxGap = opts.maxGapDays ?? 35;
  const tol = opts.amountTolerance ?? 0.15;
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (!isSpending(t, opts)) continue;
    const k = merchantKey(t.name);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const out: Subscription[] = [];
  for (const [merchant, list] of groups) {
    if (list.length < minOcc) continue;
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const gaps = sorted.slice(1).map((t, i) => diffDays(sorted[i]!.date, t.date));
    if (!gaps.every((g) => g >= minGap && g <= maxGap)) continue;
    const amounts = sorted.map((t) => -t.amount);
    const med = median(amounts);
    if (med <= 0 || !amounts.every((a) => Math.abs(a - med) <= tol * med)) continue;
    const last = sorted[sorted.length - 1]!;
    const cadence = Math.round(median(gaps));
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const monthly = (avg * 30.44) / cadence;
    out.push({
      merchant,
      name: last.name,
      category: categorize(last, opts),
      occurrences: sorted.length,
      dates: sorted.map((t) => t.date),
      averageAmount: round2(avg),
      lastAmount: round2(-last.amount),
      lastDate: last.date,
      cadenceDays: cadence,
      nextExpected: addDays(last.date, cadence),
      monthlyCost: round2(monthly),
      annualCost: round2(monthly * 12),
      label: 'verified',
    });
  }
  return out.sort((a, b) => b.monthlyCost - a.monthlyCost || a.merchant.localeCompare(b.merchant));
}

// ---------------------------------------------------------------- pace & runway

export type DailySpend = { value: number; days: number; from: ISODate; to: ISODate; label: NumberLabel };

/** Average spending per day over the `windowDays` days ending on `asOf` (an ESTIMATE of the future). */
export function averageDailySpend(txs: readonly Transaction[], asOf: ISODate, windowDays = 30, opts: CategorizeOptions = {}): DailySpend {
  const from = addDays(asOf, -(windowDays - 1));
  const total = txs.filter((t) => inRange(t.date, from, asOf) && isSpending(t, opts)).reduce((s, t) => s - t.amount, 0);
  return { value: round2(total / windowDays), days: windowDays, from, to: asOf, label: 'estimate' };
}

/** Whole days of spending that `cash` covers at `dailySpend` per day. null when nothing is spent. */
export function cashRunwayDays(cash: number, dailySpend: number): number | null {
  if (!(dailySpend > 0)) return null;
  return Math.max(0, Math.floor(cash / dailySpend));
}

export type SpendingPace = {
  month: string;
  asOf: ISODate;
  daysElapsed: number;
  daysInMonth: number;
  spentSoFar: number;
  incomeSoFar: number;
  /** Spent so far ÷ days elapsed × days in month. ESTIMATE. */
  projectedSpend: number;
  /** Income so far + `expectedIncomeRest` (projected/pending pay still to land this month). */
  expectedIncome: number;
  /** projectedSpend ÷ expectedIncome; null without income. */
  paceRatio: number | null;
  sentence: string;
  label: NumberLabel;
};

/**
 * This month's spending pace vs income. Income counts inflows categorized `income`
 * (plus anything still expected, passed in by the caller from `projectIncome`).
 */
export function spendingPace(
  txs: readonly Transaction[],
  asOf: ISODate,
  opts: CategorizeOptions & { expectedIncomeRest?: number } = {},
): SpendingPace {
  const month = monthKey(asOf);
  const b = monthBounds(month);
  const daysElapsed = diffDays(b.start, asOf) + 1;
  const inMonth = txs.filter((t) => inRange(t.date, b.start, asOf));
  const spent = inMonth.filter((t) => isSpending(t, opts)).reduce((s, t) => s - t.amount, 0);
  const income = inMonth.filter((t) => t.amount > 0 && categorize(t, opts) === 'income').reduce((s, t) => s + t.amount, 0);
  const projected = (spent / daysElapsed) * b.days;
  const expected = income + Math.max(0, opts.expectedIncomeRest ?? 0);
  const ratio = expected > 0 ? round2(projected / expected) : null;
  const sentence =
    ratio === null
      ? `${formatUSD(spent)} spent in the first ${daysElapsed} days, with no income on record yet this month.`
      : `At this pace, spending reaches about ${formatUSD(projected)} this month against about ${formatUSD(expected)} of income (${Math.round(ratio * 100)}%).`;
  return {
    month,
    asOf,
    daysElapsed,
    daysInMonth: b.days,
    spentSoFar: round2(spent),
    incomeSoFar: round2(income),
    projectedSpend: round2(projected),
    expectedIncome: round2(expected),
    paceRatio: ratio,
    sentence,
    label: 'estimate',
  };
}

// ---------------------------------------------------------------- card payments vs charges

export type PaymentRebound = {
  date: ISODate;
  paid: number;
  /** Card purchases in the `windowDays` after the payment. */
  chargesAfter: number;
  share: number;
  outrun: boolean;
  topMerchants: { name: string; amount: number }[];
};

/**
 * Transaction-level rebound check for a card: after each payment, how much was charged again
 * within `windowDays` (default 14)? Outrun when charges reach `share` (default 50%) of the payment.
 */
export function paymentRebounds(
  txs: readonly Transaction[],
  cardAccountId: string,
  opts: CategorizeOptions & { windowDays?: number; share?: number } = {},
): PaymentRebound[] {
  const windowDays = opts.windowDays ?? 14;
  const shareMin = opts.share ?? 0.5;
  const card = txs.filter((t) => t.accountId === cardAccountId);
  const payments = card.filter((t) => t.amount > 0 && categorize(t, opts) === 'card_payment').sort((a, b) => (a.date < b.date ? -1 : 1));
  return payments.map((p) => {
    const end = addDays(p.date, windowDays);
    const charges = card.filter((t) => t.amount < 0 && t.date > p.date && t.date <= end && isSpending(t, opts));
    const total = charges.reduce((s, t) => s - t.amount, 0);
    const byMerchant = new Map<string, number>();
    for (const c of charges) byMerchant.set(c.name, (byMerchant.get(c.name) ?? 0) - c.amount);
    const share = p.amount > 0 ? total / p.amount : 0;
    return {
      date: p.date,
      paid: round2(p.amount),
      chargesAfter: round2(total),
      share: round2(share),
      outrun: share >= shareMin,
      topMerchants: [...byMerchant.entries()]
        .map(([name, amount]) => ({ name, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3),
    };
  });
}
