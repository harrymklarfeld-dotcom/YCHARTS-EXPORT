/**
 * "Optimize using the platforms": ranked, explainable, educational suggestions built from the
 * app's own tools (pending-pay ledger, subscription detector, payoff math, company ratios,
 * lessons). Each one shows its math and links to a lesson or explainer. They are OPTIONS, never
 * instructions, and never name a financial product, security or lender.
 */
import {
  addDays,
  detectSubscriptions,
  formatUSD,
  interestAvoided,
  monthKey,
  payoffPlan,
  pendingPayLedger,
  round2,
  shortDate,
  type CategorizeOptions,
  type IncomeDeposit,
  type ISODate,
  type NumberLabel,
  type Transaction,
  type WorkEntry,
} from './money.ts';
import { envelopes, type Envelope } from './envelopes.ts';
import { bufferProgress } from './goals.ts';
import { incomeBaseline, toIncomeStreams, type IncomeBaseline } from './income.ts';
import { billOccurrences, cardObligation, goalMonthly } from './obligations.ts';
import { planPaychecks, type PaycheckPlan } from './paycheck.ts';
import { buildMonthlyPlan } from './plan.ts';
import { safeToSpend, type SafeToSpend } from './safe.ts';
import { freshStartMoment } from './setup.ts';
import type { BudgetProfile } from './types.ts';

export type InsightType =
  | 'pending_pay'
  | 'safe_short'
  | 'card_cover'
  | 'card_payoff_faster'
  | 'subscriptions'
  | 'buffer_paychecks'
  | 'liquidity_ratio'
  | 'free_cash_flow'
  | 'envelope_watch'
  | 'income_baseline'
  | 'fresh_start';

export type InsightLink = { kind: 'lesson' | 'learn' | 'article'; id: string; title: string; route: string };

export type Insight = {
  id: string;
  type: InsightType;
  /** free = basic budget; pro = advanced insights (gate with the monetization config). */
  tier: 'free' | 'pro';
  /** amber = needs attention (never red); good = a win; info = worth knowing. */
  tone: 'info' | 'good' | 'amber';
  title: string;
  body: string;
  /** The math, one line each: label … value. */
  math: { label: string; value: string }[];
  /** Choices, not instructions. The user decides. */
  options: string[];
  /** Dollars this touches (for ranking and display). */
  impact: number;
  score: number;
  label: NumberLabel;
  link: InsightLink;
};

export type CompanyRatio = { ticker: string; name: string; currentRatio: number };

export type InsightInput = {
  profile: BudgetProfile;
  asOf: ISODate;
  deposits?: readonly IncomeDeposit[];
  /** Only real (linked or imported) transactions. Manual setup never fakes them. */
  transactions?: readonly Transaction[];
  workLog?: readonly WorkEntry[];
  companies?: readonly CompanyRatio[];
  categorize?: CategorizeOptions;
  /** Precomputed pieces (optional; computed when missing). */
  baseline?: IncomeBaseline;
  safe?: SafeToSpend;
};

const lesson = (id: string, title: string): InsightLink => ({ kind: 'lesson', id, title, route: `/lesson/${id}` });
const learn = (id: string, title: string): InsightLink => ({ kind: 'learn', id, title, route: `/money/learn/${id}` });

export const INSIGHT_LINKS = {
  currentRatio: lesson('u5-l4', 'Lesson: Current ratio'),
  fcf: lesson('u4-l2', 'Lesson: Free cash flow'),
  debt: lesson('u5-l3', 'Lesson: Debt-to-equity'),
  statementVsDue: learn('statement-vs-due', 'Statement date vs due date'),
  emergencyFund: learn('emergency-fund', 'Emergency fund'),
  incomeVolatility: learn('income-volatility', 'Income volatility'),
  personal10k: { kind: 'article', id: 'your-money-like-a-10k', title: 'Article: Your money like a 10-K', route: '/articles/your-money-like-a-10k' } as InsightLink,
} as const;

function monthYear(d: ISODate): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}

/** "FLIXBOX VIDEO STREAMING" → "Flixbox Video Streaming". */
export function prettyMerchant(name: string): string {
  return name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function ceil5(n: number): number {
  return Math.ceil(n / 5 - 1e-9) * 5;
}

function addMonthsApprox(asOf: ISODate, months: number): ISODate {
  const y = Number(asOf.slice(0, 4));
  const m = Number(asOf.slice(5, 7)) - 1 + months;
  return `${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`;
}

export function budgetInsights(input: InsightInput): Insight[] {
  const { profile: p, asOf } = input;
  const cat = input.categorize ?? {};
  const baseline = input.baseline ?? incomeBaseline(p, asOf, input.deposits ? { deposits: input.deposits } : {});
  const safe = input.safe ?? safeToSpend(p, asOf);
  const plan = buildMonthlyPlan(p, baseline, asOf);
  const paychecks: PaycheckPlan[] = planPaychecks(p, asOf, baseline, { count: 4 });
  const out: Insight[] = [];
  const card = p.balances.card;
  const cardDue = cardObligation(p, asOf);

  // 1. Pending pay: work done, money not unlocked yet.
  const ledger = pendingPayLedger(toIncomeStreams(p.income), [...(input.workLog ?? [])]);
  for (const l of ledger) {
    if (l.net <= 0) continue;
    const deadline = cardDue && cardDue.date >= asOf ? cardDue.date : safe.until;
    const rate = l.units > 0 ? l.gross / l.units : 0;
    const helpsShort = safe.status === 'short';
    out.push({
      id: `pending:${l.streamId}`,
      type: 'pending_pay',
      tier: 'free',
      tone: helpsShort ? 'amber' : 'info',
      title: `Submit your ${l.units} ${l.units === 1 ? l.unitWord.replace(/s$/, '') : l.unitWord} to unlock ${formatUSD(l.net)} before ${shortDate(deadline)}`,
      body: `${l.streamName} pays only once ${l.condition}. Until then it is PENDING and left out of safe-to-spend.${helpsShort ? ` Once confirmed, safe-to-spend goes from ${formatUSD(safe.amount)} to about ${formatUSD(round2(safe.amount + l.net))}.` : ''}`,
      math: [
        { label: `${l.units} ${l.unitWord} × ${formatUSD(rate, { cents: true })}`, value: formatUSD(l.gross, { cents: true }) },
        { label: 'After withholding', value: formatUSD(l.net, { cents: true }) },
      ],
      options: [`Submit the ${l.unitWord} for ${l.streamName}`, 'Leave it for now (the plan already works without it)'],
      impact: l.net,
      score: 90 + (helpsShort ? 30 : 0) + Math.min(20, l.net / 20),
      label: 'pending',
      link: INSIGHT_LINKS.incomeVolatility,
    });
  }

  // 2. Short before payday (amber, never red).
  if (safe.status === 'short') {
    const gap = round2(-safe.amount);
    const pending = round2(safe.excludedPending.reduce((t, d) => t + d.amount, 0));
    const options: string[] = [];
    if (pending > 0) options.push(`Confirm the ${formatUSD(pending)} of pending pay`);
    if (safe.buffer > 0) options.push(`Use part of your ${formatUSD(safe.buffer)} cushion (that is what it is for)`);
    if (cardDue && cardDue.minimum !== undefined && cardDue.amount > cardDue.minimum) options.push(`Pay the ${formatUSD(cardDue.minimum)} card minimum by ${shortDate(cardDue.date)} and the rest after payday (interest applies to what carries over)`);
    options.push('Ask the biller to move a due date closer to payday');
    out.push({
      id: 'safe-short',
      type: 'safe_short',
      tier: 'free',
      tone: 'amber',
      title: `${formatUSD(gap)} to find before payday`,
      body: safe.sentence,
      math: safe.lines.map((l) => ({ label: l.label, value: formatUSD(l.amount, { signed: l.op !== '=' }) })),
      options,
      impact: gap,
      score: 150 + Math.min(30, gap / 10),
      label: safe.label,
      link: INSIGHT_LINKS.statementVsDue,
    });
  }

  // 3. Card payment coverage.
  if (card && cardDue && safe.status !== 'short') {
    const statement = card.statementBalance ?? card.balance;
    const paysAll = cardDue.amount >= statement;
    const carry = round2(Math.max(0, statement - cardDue.amount));
    const ia = interestAvoided(paysAll ? statement : carry, card.apr ?? 0);
    out.push({
      id: 'card-cover',
      type: 'card_cover',
      tier: 'free',
      tone: 'good',
      title: paysAll
        ? `Your ${formatUSD(cardDue.amount)} card payment on ${shortDate(cardDue.date)} is covered`
        : `Your planned ${formatUSD(cardDue.amount)} card payment on ${shortDate(cardDue.date)} is covered`,
      body: paysAll
        ? `Paying the full statement keeps interest at $0.${card.apr ? ` ${ia.sentence}` : ''}`
        : `The other ${formatUSD(carry)} carries over${card.apr ? `, about ${formatUSD(ia.perMonth, { cents: true })} of interest next month (ESTIMATE)` : ''}.`,
      math: [
        { label: 'Statement', value: formatUSD(statement) },
        { label: 'Planned payment', value: formatUSD(cardDue.amount) },
        ...(card.apr ? [{ label: paysAll ? 'Interest avoided next month' : 'Interest on the rest next month', value: formatUSD(ia.perMonth, { cents: true }) }] : []),
      ],
      options: [],
      impact: cardDue.amount,
      score: 40,
      label: cardDue.basis,
      link: INSIGHT_LINKS.statementVsDue,
    });
  }

  // 4. Card payoff: a bigger payment, with the interest math.
  if (card && card.balance > 0 && (card.apr ?? 0) > 0) {
    const payOff = p.goals.find((g) => g.kind === 'pay_off_card');
    const paysInFull = !payOff && (cardDue ? cardDue.amount >= (card.statementBalance ?? card.balance) : false);
    if (!paysInFull) {
      const current = round2(payOff ? goalMonthly(payOff, p, asOf) : Math.max(card.minimumDue ?? 25, 25));
      const alt = ceil5(current + 35);
      const a = payoffPlan(card.balance, card.apr!, current);
      const b = payoffPlan(card.balance, card.apr!, alt);
      if (b.months !== null) {
        const eta = addMonthsApprox(asOf, b.months);
        const saved = a.months !== null ? round2(a.totalInterest - b.totalInterest) : null;
        const extra = round2(alt - current);
        const flex = round2(Math.max(0, plan.buckets.find((x) => x.kind === 'flexible')?.planned ?? plan.unassigned));
        out.push({
          id: 'card-payoff',
          type: 'card_payoff_faster',
          tier: 'pro',
          tone: 'info',
          title:
            saved !== null
              ? `Paying ${formatUSD(alt)} instead of ${formatUSD(current)} on the card clears it by ${monthYear(eta)} and saves about ${formatUSD(saved)} of interest`
              : `At ${formatUSD(current)} a month the card balance barely moves; ${formatUSD(alt)} clears it by ${monthYear(eta)}`,
          body: `${a.sentence} ${b.sentence} That is ${formatUSD(extra)} more a month${flex > 0 ? `, out of about ${formatUSD(flex)} of flexible money in a low month` : ''}.`,
          math: [
            { label: `At ${formatUSD(current)}/mo`, value: a.months !== null ? `${a.months} mo · ${formatUSD(a.totalInterest)} interest` : 'never paid off' },
            { label: `At ${formatUSD(alt)}/mo`, value: `${b.months} mo · ${formatUSD(b.totalInterest)} interest` },
            { label: 'APR (monthly rate = APR ÷ 12)', value: `${(card.apr! * 100).toFixed(2)}%` },
          ],
          options: [`Keep ${formatUSD(current)} a month`, `Try ${formatUSD(alt)} a month`, 'Pick any amount in between'],
          impact: saved ?? b.totalInterest,
          score: 60 + Math.min(30, (saved ?? 100) / 10),
          label: 'estimate',
          link: INSIGHT_LINKS.debt,
        });
      }
    }
  }

  // 5. Subscriptions: ONLY from real transactions (never guessed from manual bills).
  if (input.transactions && input.transactions.length > 0) {
    const all = detectSubscriptions(input.transactions, cat);
    // Streaming/storage-type subscriptions only (a phone bill is recurring, but not optional).
    const subs = all.some((s) => s.category === 'subscriptions') ? all.filter((s) => s.category === 'subscriptions') : all.filter((s) => s.category !== 'phone');
    if (subs.length) {
      const total = round2(subs.reduce((t, s) => t + s.monthlyCost, 0));
      const goal = p.goals.find((g) => g.kind === 'roth') ?? p.goals.find((g) => g.kind === 'emergency_fund' || g.kind === 'save_for');
      const gm = goal ? goalMonthly(goal, p, asOf) : 0;
      const covering = gm > 0 ? [...subs].sort((x, y) => x.monthlyCost - y.monthlyCost).find((s) => s.monthlyCost >= gm) : undefined;
      const biggest = subs[0]!;
      const goalName = goal ? goal.title : 'your goals';
      const body = covering
        ? `Cancelling ${prettyMerchant(covering.name)} alone (${formatUSD(covering.monthlyCost, { cents: true })}/mo) would cover the ${formatUSD(gm)}/mo for ${goalName}.`
        : gm > 0
          ? `${prettyMerchant(biggest.name)} (${formatUSD(biggest.monthlyCost, { cents: true })}/mo) would cover ${Math.round((biggest.monthlyCost / gm) * 100)}% of the ${formatUSD(gm)}/mo for ${goalName}; all of them together cover ${Math.round(Math.min(1, total / gm) * 100)}%.`
          : `That is ${formatUSD(total * 12)} a year.`;
      out.push({
        id: 'subscriptions',
        type: 'subscriptions',
        tier: 'pro',
        tone: 'info',
        title: `Your ${subs.length} subscription${subs.length === 1 ? '' : 's'} total ${formatUSD(total, { cents: true })}/mo`,
        body: `${body} Found from charges that repeat about monthly. Keeping them is a fine answer too.`,
        math: [
          ...subs.map((s) => ({ label: `${prettyMerchant(s.name)} (${s.occurrences} charges)`, value: `${formatUSD(s.monthlyCost, { cents: true })}/mo` })),
          { label: 'Per year', value: formatUSD(total * 12) },
        ],
        options: ['Keep them all', 'Pause one for a month and see', ...(goal ? [`Send what one costs to ${goalName}`] : [])],
        impact: total,
        score: 50 + Math.min(25, total / 2),
        label: 'verified',
        link: INSIGHT_LINKS.fcf,
      });
    }
  }

  // 6. Buffer month: where the next paycheck could go.
  const firstFlexible = paychecks.find((x) => x.deposit.basis === 'projected' && x.flexible >= 10);
  if (firstFlexible) {
    const per = firstFlexible.deposit.amount;
    const bp = bufferProgress(p, { perPaycheck: per });
    if (bp.remaining > 0 && bp.target > 0 && bp.paychecksToGo !== null) {
      const n = bp.paychecksToGo;
      out.push({
        id: 'buffer',
        type: 'buffer_paychecks',
        tier: 'free',
        tone: 'info',
        title:
          n <= 1
            ? `Your ${firstFlexible.deposit.streamName} payment on ${shortDate(firstFlexible.deposit.date)} could finish your 1-month buffer`
            : `Put your next ${firstFlexible.deposit.streamName} payment toward the buffer: ${n} more paychecks like it reach a 1-month buffer`,
        body: `A buffer month is one month of planned spending (${formatUSD(bp.target)}) sitting in savings, so a slow month doesn't touch the card. You have ${formatUSD(bp.current)} so far.`,
        math: [
          { label: 'Buffer month (bills + envelopes)', value: formatUSD(bp.target) },
          { label: 'Saved', value: formatUSD(bp.current) },
          { label: `Paychecks of ${formatUSD(per)}`, value: `${n}` },
        ],
        options: ['Send it to savings when it lands', 'Split it: half buffer, half flexible', 'Keep it flexible this time'],
        impact: Math.min(per, bp.remaining),
        score: 35,
        label: bp.label,
        link: INSIGHT_LINKS.emergencyFund,
      });
    }
  }

  // 7. Liquidity ratio ↔ a company's current ratio.
  const monthEnd = addDays(asOf, 31);
  const shortTerm = round2(
    billOccurrences(p.bills, asOf, monthEnd).reduce((t, o) => t + o.amount, 0) + (card && cardDue && cardDue.date <= monthEnd ? (card.statementBalance ?? card.balance) : 0),
  );
  const liquid = round2((p.balances.cash ?? 0) + (p.balances.savings ?? 0));
  if (shortTerm > 0 && liquid > 0) {
    const ratio = round2(liquid / shortTerm);
    const peer = [...(input.companies ?? [])].filter((c) => c.currentRatio > 0).sort((x, y) => Math.abs(x.currentRatio - ratio) - Math.abs(y.currentRatio - ratio) || x.ticker.localeCompare(y.ticker))[0];
    out.push({
      id: 'liquidity',
      type: 'liquidity_ratio',
      tier: 'free',
      tone: ratio >= 1 ? 'good' : 'info',
      title: peer ? `Your liquidity ratio is ${ratio.toFixed(2)}× — like ${peer.name}'s current ratio (${peer.currentRatio.toFixed(2)}×)` : `Your liquidity ratio is ${ratio.toFixed(2)}×`,
      body: `Cash and savings ÷ what is due in the next month. Companies call it the current ratio: above 1.0× means everything due soon is covered by cash on hand${ratio >= 1 ? ', and yours is' : '; yours relies on upcoming pay'}.`,
      math: [
        { label: 'Cash + savings', value: formatUSD(liquid) },
        { label: 'Due within a month (bills + card statement)', value: formatUSD(shortTerm) },
        { label: 'Ratio', value: `${ratio.toFixed(2)}×` },
      ],
      options: [],
      impact: 0,
      score: 30,
      label: p.balances.basis === 'verified' ? 'verified' : 'manual',
      link: INSIGHT_LINKS.currentRatio,
    });
  }

  // 8. Monthly free cash flow.
  if (plan.income > 0 && (p.bills.length || p.categories.length)) {
    const spend = round2(p.bills.reduce((t, b) => t + b.amount, 0) + p.categories.reduce((t, c) => t + c.monthly, 0));
    const fcf = round2(plan.income - spend);
    out.push({
      id: 'fcf',
      type: 'free_cash_flow',
      tier: 'pro',
      tone: fcf >= 0 ? 'info' : 'amber',
      title: fcf >= 0 ? `Your monthly free cash flow is about ${formatUSD(fcf)}` : `In a low month, planned spending runs ${formatUSD(-fcf)} past income`,
      body:
        fcf >= 0
          ? 'Income minus bills and everyday spending: the money that can go to goals, like a company’s free cash flow funds buybacks or debt paydown.'
          : 'That is normal with irregular pay. Paycheck planning covers bills first, and better months make up the difference.',
      math: [
        { label: 'Income the plan counts', value: formatUSD(plan.income) },
        { label: 'Bills + envelopes', value: formatUSD(-spend) },
        { label: 'Free cash flow', value: formatUSD(fcf, { signed: true }) },
      ],
      options: [],
      impact: Math.abs(fcf),
      score: 25,
      label: 'estimate',
      link: INSIGHT_LINKS.fcf,
    });
  }

  // 9. Envelopes running ahead (needs real or manually-entered spending).
  if (input.transactions && input.transactions.length > 0) {
    const envs: Envelope[] = envelopes(p, monthKey(asOf), { ...cat, transactions: input.transactions, asOf });
    const spare = envs.filter((e) => e.kind === 'want' && e.remaining > 0).sort((a, b) => b.remaining - a.remaining || a.id.localeCompare(b.id));
    for (const e of envs.filter((x) => x.status === 'over').sort((a, b) => a.remaining - b.remaining).slice(0, 2)) {
      const over = round2(-e.remaining);
      const cover = spare.find((s) => s.id !== e.id && s.remaining >= over);
      out.push({
        id: `envelope:${e.id}`,
        type: 'envelope_watch',
        tier: 'free',
        tone: 'amber',
        title: `${e.title} is ${formatUSD(over)} past its envelope`,
        body: `${formatUSD(e.spent)} spent of ${formatUSD(e.available)} this month.${cover ? ` ${cover.title} has ${formatUSD(cover.remaining)} left and could cover it.` : ''} ${e.rollover ? 'With rollover, next month’s envelope absorbs the rest.' : 'Next month starts fresh.'}`,
        math: [
          { label: 'Envelope', value: formatUSD(e.budget) },
          ...(e.carried !== 0 ? [{ label: 'Carried in', value: formatUSD(e.carried, { signed: true }) }] : []),
          { label: 'Spent so far', value: formatUSD(e.spent) },
        ],
        options: [...(cover ? [`Move ${formatUSD(over)} from ${cover.title}`] : []), 'Let it roll into next month', 'Raise this envelope'],
        impact: over,
        score: 55 + Math.min(20, over / 5),
        label: 'verified',
        link: INSIGHT_LINKS.personal10k,
      });
    }
  }

  // 10. Why the plan counts the income it does.
  if (baseline.method !== 'none' && (baseline.history !== null || baseline.pendingExcluded > 0 || p.income.some((s) => s.kind === 'hourly' || s.kind === 'per_session'))) {
    const best = baseline.months.length ? Math.max(...baseline.months.map((m) => m.total)) : null;
    out.push({
      id: 'baseline',
      type: 'income_baseline',
      tier: 'pro',
      tone: 'info',
      title: `Your plan counts ${formatUSD(baseline.monthly)} a month, on purpose`,
      body: `${baseline.sentence}${best !== null ? ` Your best recent month was ${formatUSD(best)}; anything above the plan is a bonus for goals.` : ''}`,
      math: [
        { label: 'From your schedule', value: formatUSD(baseline.planned) },
        ...(baseline.history !== null ? [{ label: `Low-but-normal month (25th pct of ${baseline.months.length})`, value: formatUSD(baseline.history) }] : []),
        ...(baseline.pendingExcluded > 0 ? [{ label: 'Pending pay (not counted)', value: formatUSD(baseline.pendingExcluded) }] : []),
      ],
      options: [],
      impact: 0,
      score: 20,
      label: baseline.label,
      link: INSIGHT_LINKS.incomeVolatility,
    });
  }

  // 11. Fresh start.
  const moment = freshStartMoment(asOf, null);
  if (moment === 'new_month') {
    out.push({
      id: 'fresh-start',
      type: 'fresh_start',
      tier: 'free',
      tone: 'good',
      title: 'New month, new ledger',
      body: 'Envelopes reset today and last month is closed. Whatever happened, this month’s plan starts clean.',
      math: [],
      options: [],
      impact: 0,
      score: 15,
      label: 'manual',
      link: INSIGHT_LINKS.personal10k,
    });
  }

  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map((i) => ({ ...i, score: round2(i.score) }));
}

/** Every sentence an insight shows (for the voice guard). */
export function insightText(i: Insight): string {
  return [i.title, i.body, ...i.options, ...i.math.map((m) => `${m.label} ${m.value}`), i.link.title].join(' \n ');
}
