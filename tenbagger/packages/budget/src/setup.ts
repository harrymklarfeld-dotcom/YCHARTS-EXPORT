/**
 * Setup: sensible defaults, the 4-input Quick setup, budgeting-style explanations and the
 * endowed-progress meter ("your plan is already 40% built, because…").
 */
import { addDays, isISODate, round2, type ISODate, type PayFrequency } from './money.ts';
import type { Bill, BudgetProfile, BudgetStyle, IncomeSource, SetupStep, SpendingCategory, Tightness } from './types.ts';

/** Starter envelopes (rough student-budget amounts; the user edits them). */
export const DEFAULT_CATEGORIES: readonly SpendingCategory[] = [
  { id: 'groceries', title: 'Groceries', monthly: 120, kind: 'need', rollover: true, matches: ['groceries'] },
  { id: 'eating_out', title: 'Eating out', monthly: 80, kind: 'want', rollover: true, matches: ['food'] },
  { id: 'getting_around', title: 'Rides & transit', monthly: 40, kind: 'need', rollover: true, matches: ['rideshare', 'transport'] },
  { id: 'fun', title: 'Fun', monthly: 50, kind: 'want', rollover: true, matches: ['entertainment'] },
  { id: 'stuff', title: 'Shopping & supplies', monthly: 40, kind: 'want', rollover: false, matches: ['shopping', 'books'] },
  { id: 'other', title: 'Everything else', monthly: 20, kind: 'want', rollover: false, matches: ['other', 'fees'] },
];

/** Cash cushion kept out of safe-to-spend, by comfort level. */
export const DEFAULT_BUFFER: Record<Tightness, number> = { tight: 100, balanced: 75, flexible: 40 };

export function bufferFor(p: Pick<BudgetProfile, 'comfort'>): number {
  return Math.max(0, p.comfort.buffer ?? DEFAULT_BUFFER[p.comfort.tightness]);
}

export type StyleInfo = { id: BudgetStyle; title: string; short: string; how: string; bestFor: string };

export const STYLES: Record<BudgetStyle, StyleInfo> = {
  paycheck: {
    id: 'paycheck',
    title: 'Paycheck-to-paycheck plan',
    short: 'Give each paycheck its jobs the day it lands.',
    how: 'When money arrives, it covers whatever is due before the next paycheck first, then your goals, and the rest is yours to spend. No monthly guess needed.',
    bestFor: 'Hours that change week to week, tutoring or gig pay, aid refunds.',
  },
  fifty_thirty_twenty: {
    id: 'fifty_thirty_twenty',
    title: '50/30/20',
    short: 'Half on needs, 30% on wants, 20% on savings and debt.',
    how: 'Take your monthly take-home pay and split it three ways. Rent, phone, groceries and rides are needs; fun and eating out are wants; goals and extra card payments are the 20%.',
    bestFor: 'Steady pay that is about the same every month.',
  },
  zero_based: {
    id: 'zero_based',
    title: 'Zero-based',
    short: 'Every dollar gets a job until $0 is left.',
    how: 'List the month’s income, then assign it to bills, envelopes and goals until nothing is unassigned. Anything extra goes to your cushion on purpose.',
    bestFor: 'People who like detail and want to see every dollar.',
  },
  pay_yourself_first: {
    id: 'pay_yourself_first',
    title: 'Pay yourself first',
    short: 'Goals come off the top; spend the rest guilt-free.',
    how: 'A set slice of each paycheck moves to savings or goals first. Bills come next, and whatever is left needs no tracking.',
    bestFor: 'Steady pay and people who hate tracking categories.',
  },
};

/** True when income moves around: hourly/session work, pay that needs submitting, lump-sum aid. */
export function hasIrregularIncome(p: Pick<BudgetProfile, 'income'>): boolean {
  if (p.income.length === 0) return true;
  return p.income.some(
    (s) => s.kind === 'hourly' || s.kind === 'per_session' || s.kind === 'stipend' || s.frequency === 'occasional' || s.paidOnlyIfSubmitted === true,
  );
}

export function recommendStyle(p: Pick<BudgetProfile, 'income' | 'goals'>): { style: BudgetStyle; reason: string } {
  if (hasIrregularIncome(p)) {
    return {
      style: 'paycheck',
      reason:
        'Your pay changes with your hours (or depends on submitting them), so a fixed monthly number would be a guess. Planning each paycheck when it lands only uses money that is actually there.',
    };
  }
  if (p.goals.some((g) => g.kind === 'emergency_fund' || g.kind === 'roth' || g.kind === 'save_for')) {
    return { style: 'pay_yourself_first', reason: 'Your pay is steady and you have savings goals, so taking the goal money off the top keeps things simple.' };
  }
  return { style: 'fifty_thirty_twenty', reason: 'Your pay is steady, so a simple three-way split is easy to keep up with.' };
}

export type QuickSetupInput = {
  asOf: ISODate;
  /** 1. Cash now (checking). */
  cash: number;
  /** 2. Next payday and roughly how much lands. */
  nextPayday: ISODate;
  nextPayAmount: number;
  payFrequency?: PayFrequency;
  /** 3. Card balance and due date (optional: no card is fine). */
  card?: { balance: number; dueDate: ISODate; apr?: number; minimumDue?: number } | null;
  /** 4. One big fixed bill (optional). */
  bill?: { name: string; amount: number; dueDay: number } | null;
};

/** A blank profile with sensible defaults. */
export function emptyProfile(asOf: ISODate): BudgetProfile {
  return {
    version: 1,
    createdAt: asOf,
    updatedAt: asOf,
    mode: 'quick',
    goals: [],
    income: [],
    bills: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, ...(c.matches ? { matches: [...c.matches] } : {}) })),
    balances: { asOf, basis: 'manual', cash: 0 },
    comfort: { tightness: 'balanced', notify: 'paycheck' },
    style: 'paycheck',
    answered: [],
  };
}

/** The 4-input Quick setup → a working profile (enough for "Safe to spend until payday"). */
export function quickSetup(input: QuickSetupInput, base?: BudgetProfile): BudgetProfile {
  const p = base ? { ...base } : emptyProfile(input.asOf);
  const pay: IncomeSource = {
    id: 'main-pay',
    name: 'Paycheck',
    kind: 'paycheck',
    rate: round2(Math.max(0, input.nextPayAmount)),
    frequency: input.payFrequency ?? 'biweekly',
    nextPayDate: input.nextPayday,
  };
  const income = [pay, ...p.income.filter((s) => s.id !== 'main-pay')];
  const bills: Bill[] = input.bill && input.bill.amount > 0
    ? [{ id: 'big-bill', name: input.bill.name || 'Big bill', amount: round2(input.bill.amount), dueDay: clampDay(input.bill.dueDay), kind: guessBillKind(input.bill.name) }, ...p.bills.filter((b) => b.id !== 'big-bill')]
    : p.bills.filter((b) => b.id !== 'big-bill');
  const card = input.card && input.card.balance > 0
    ? {
        name: 'Card',
        balance: round2(input.card.balance),
        statementBalance: round2(input.card.balance),
        dueDate: input.card.dueDate,
        ...(input.card.apr !== undefined ? { apr: input.card.apr } : {}),
        ...(input.card.minimumDue !== undefined ? { minimumDue: input.card.minimumDue } : {}),
      }
    : undefined;
  const goals = card && !p.goals.some((g) => g.kind === 'cover_card' || g.kind === 'pay_off_card')
    ? [{ id: 'cover-card', kind: 'cover_card' as const, title: 'Cover my card every month' }, ...p.goals]
    : p.goals;
  const { card: _old, ...restBalances } = p.balances;
  return {
    ...p,
    updatedAt: input.asOf,
    income,
    bills,
    goals,
    balances: { ...restBalances, asOf: input.asOf, basis: 'manual', cash: round2(Math.max(0, input.cash)), ...(card ? { card } : {}) },
    answered: uniq([...p.answered, 'quick']),
  };
}

function clampDay(d: number): number {
  return Math.min(31, Math.max(1, Math.round(d || 1)));
}

function guessBillKind(name: string): Bill['kind'] {
  const n = name.toLowerCase();
  if (/rent|dorm|housing/.test(n)) return 'rent';
  if (/phone|wireless|mobile/.test(n)) return 'phone';
  if (/insur/.test(n)) return 'insurance';
  if (/electric|utilit|internet|wifi/.test(n)) return 'utilities';
  if (/stream|music|subscription|storage/.test(n)) return 'subscription';
  if (/bus|transit|parking|car/.test(n)) return 'transport';
  return 'other';
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Weight of each step in the "plan built" meter. Quick setup alone is 40%. */
export const STEP_WEIGHTS: Record<SetupStep, number> = {
  quick: 40,
  goals: 10,
  income: 15,
  bills: 10,
  spending: 10,
  balances: 5,
  comfort: 5,
  style: 5,
};

export const FULL_PLAN_STEPS: readonly SetupStep[] = ['goals', 'income', 'bills', 'spending', 'balances', 'comfort', 'style'];

export type SetupProgress = { pct: number; answered: SetupStep[]; next: SetupStep | null; reason: string };

/**
 * Endowed progress with a reason (Nunes & Drèze: the head start only works when it is explained).
 */
export function setupProgress(p: Pick<BudgetProfile, 'answered'>): SetupProgress {
  const answered = uniq(p.answered).filter((s) => s in STEP_WEIGHTS);
  const pct = Math.min(100, answered.reduce((t, s) => t + STEP_WEIGHTS[s], 0));
  const next = FULL_PLAN_STEPS.find((s) => !answered.includes(s)) ?? null;
  const reason = answered.includes('quick')
    ? pct >= 100
      ? 'Your plan is fully built. Edit any part whenever life changes.'
      : `Your plan is ${pct}% built: your cash, payday, card and biggest bill already give us your safe-to-spend. The rest fine-tunes it.`
    : 'Four quick answers (cash, payday, card, one bill) build 40% of your plan.';
  return { pct, answered, next, reason };
}

export function validateProfile(p: BudgetProfile): string[] {
  const errs: string[] = [];
  if (!isISODate(p.balances.asOf)) errs.push('balances.asOf must be YYYY-MM-DD');
  for (const s of p.income) {
    if (!(s.rate >= 0)) errs.push(`${s.id}: rate must be ≥ 0`);
    if (s.nextPayDate !== undefined && !isISODate(s.nextPayDate)) errs.push(`${s.id}: nextPayDate must be YYYY-MM-DD`);
    if (s.withholdingRate !== undefined && !(s.withholdingRate >= 0 && s.withholdingRate < 1)) errs.push(`${s.id}: withholdingRate must be in [0, 1)`);
    for (const d of s.disbursements ?? []) if (!isISODate(d.date)) errs.push(`${s.id}: disbursement date must be YYYY-MM-DD`);
  }
  for (const b of p.bills) {
    if (!(b.amount >= 0)) errs.push(`${b.id}: amount must be ≥ 0`);
    if (!(b.dueDay >= 1 && b.dueDay <= 31)) errs.push(`${b.id}: dueDay must be 1–31`);
  }
  for (const c of p.categories) if (!(c.monthly >= 0)) errs.push(`${c.id}: monthly must be ≥ 0`);
  const card = p.balances.card;
  if (card?.dueDate !== undefined && !isISODate(card.dueDate)) errs.push('card.dueDate must be YYYY-MM-DD');
  return errs;
}

/** Fresh-start moments: the 1st–3rd of a month, or the day after a paycheck. */
export function freshStartMoment(asOf: ISODate, lastPayday?: ISODate | null): 'new_month' | 'new_paycheck' | null {
  const day = Number(asOf.slice(8, 10));
  if (day <= 3) return 'new_month';
  if (lastPayday && addDays(lastPayday, 1) === asOf) return 'new_paycheck';
  return null;
}
