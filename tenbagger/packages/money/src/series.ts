/**
 * Net-worth history, income extras (annualized income, the work-not-yet-cashed ledger) and goals.
 */
import { addDays, dateOf, diffDays, toDayNumber } from './dates.ts';
import { formatUSD, round2, weakestLabel } from './format.ts';
import { weeksPerPeriod } from './income.ts';
import { netWorth } from './networth.ts';
import type { IncomeDeposit, IncomeStream, ISODate, NumberLabel, Snapshot } from './types.ts';

// ---------------------------------------------------------------- net worth series

export type NetWorthPoint = {
  date: ISODate;
  takenAt: string;
  net: number;
  liquidity: number;
  investments: number;
  debt: number;
  label: NumberLabel;
};

/** One point per snapshot, in the order given (oldest first). */
export function netWorthSeries(snapshots: readonly Snapshot[]): NetWorthPoint[] {
  return snapshots.map((s) => {
    const b = netWorth(s);
    return { date: dateOf(s.takenAt), takenAt: s.takenAt, net: b.net.value, liquidity: b.liquidity.value, investments: b.investments.value, debt: b.debt.value, label: b.net.label };
  });
}

export type NetWorthChange = { from: NetWorthPoint; to: NetWorthPoint; change: number; pct: number | null; days: number; label: NumberLabel };

/** Latest point vs the one before it (or vs `back` points earlier). null with < 2 points. */
export function netWorthChange(series: readonly NetWorthPoint[], back = 1): NetWorthChange | null {
  if (series.length < 2) return null;
  const to = series[series.length - 1]!;
  const from = series[Math.max(0, series.length - 1 - back)]!;
  const change = round2(to.net - from.net);
  return {
    from,
    to,
    change,
    pct: from.net !== 0 ? round2(change / Math.abs(from.net)) : null,
    days: diffDays(from.date, to.date),
    label: weakestLabel([from.label, to.label]),
  };
}

// ---------------------------------------------------------------- income extras

/** Real (verified/manual) deposits in the `windowDays` ending `asOf`, scaled to a year. ESTIMATE. */
export function annualizedIncome(deposits: readonly IncomeDeposit[], asOf: ISODate, windowDays = 90): { value: number; windowTotal: number; windowDays: number; label: NumberLabel } {
  const from = addDays(asOf, -(windowDays - 1));
  const total = deposits
    .filter((d) => (d.basis === 'verified' || d.basis === 'manual') && d.date >= from && d.date <= asOf)
    .reduce((s, d) => s + d.amount, 0);
  return { value: round2((total / windowDays) * 365), windowTotal: round2(total), windowDays, label: 'estimate' };
}

/** A shift or session logged in the app but not yet submitted to payroll / filed. */
export type WorkEntry = { id: string; streamId: string; date: ISODate; units: number; submitted?: boolean };

export type PendingLine = {
  streamId: string;
  streamName: string;
  unitWord: 'hours' | 'sessions';
  /** From the stream's `pendingUnsubmitted` (already known to the engine). */
  carriedUnits: number;
  /** Logged in the app, not submitted. */
  loggedUnits: number;
  units: number;
  gross: number;
  net: number;
  condition: string;
  reminder: string;
  label: NumberLabel;
};

/**
 * The "work not yet cashed" ledger: per hourly/per-session stream, units done but not submitted
 * (the stream's own `pendingUnsubmitted` plus unsubmitted app entries) and what they would pay.
 */
export function pendingPayLedger(streams: readonly IncomeStream[], log: readonly WorkEntry[] = []): PendingLine[] {
  const out: PendingLine[] = [];
  for (const s of streams) {
    if (s.kind !== 'hourly' && s.kind !== 'per_session') continue;
    const carried = s.pendingUnsubmitted?.units ?? 0;
    const logged = log.filter((e) => e.streamId === s.id && !e.submitted).reduce((t, e) => t + e.units, 0);
    const units = round2(carried + logged);
    if (units <= 0) continue;
    const gross = round2(units * s.rate);
    const word = s.kind === 'per_session' ? 'sessions' : 'hours';
    const condition = s.condition ?? (word === 'hours' ? 'hours submitted' : 'session reports filed');
    out.push({
      streamId: s.id,
      streamName: s.name,
      unitWord: word,
      carriedUnits: carried,
      loggedUnits: round2(logged),
      units,
      gross,
      net: round2(gross * (1 - s.withholdingRate)),
      condition,
      reminder: `${units} ${word} for ${s.name} are not submitted yet: ${formatUSD(gross * (1 - s.withholdingRate))} that lands only once ${condition}.`,
      label: 'pending',
    });
  }
  return out;
}

/**
 * Fold unsubmitted app entries dated on/before a stream's `pendingUnsubmitted.periodEnd` into it
 * (so the coverage check sees them as PENDING pay). Later entries belong to the current period,
 * which the regular schedule already projects. Returns new stream objects.
 */
export function applyWorkLog(streams: readonly IncomeStream[], log: readonly WorkEntry[]): IncomeStream[] {
  return streams.map((s) => {
    const p = s.pendingUnsubmitted;
    if (!p) return s;
    const extra = log
      .filter((e) => e.streamId === s.id && !e.submitted && toDayNumber(e.date) <= toDayNumber(p.periodEnd))
      .reduce((t, e) => t + e.units, 0);
    return extra > 0 ? { ...s, pendingUnsubmitted: { ...p, units: round2(p.units + extra) } } : s;
  });
}

/** Typical units in one paycheck (for the "log a session" helper text). */
export function unitsPerPaycheck(s: IncomeStream): number {
  return round2(s.schedule.unitsPerWeek * weeksPerPeriod(s.payFrequency));
}

// ---------------------------------------------------------------- goals

export type GoalProgress = { id: string; title: string; target: number; current: number; progress: number; remaining: number; detail: string; label: NumberLabel };

function goal(id: string, title: string, target: number, current: number, detail: string, label: NumberLabel): GoalProgress {
  const t = Math.max(0, target);
  return { id, title, target: round2(t), current: round2(current), progress: t > 0 ? round2(Math.min(1, Math.max(0, current / t))) : 1, remaining: round2(Math.max(0, t - current)), detail, label };
}

/** Emergency fund: target = `weeks` × weekly spending; current = savings (or all cash). */
export function emergencyFundGoal(weeks: number, dailySpend: number, current: number, label: NumberLabel = 'estimate'): GoalProgress {
  const target = round2(weeks * 7 * dailySpend);
  return goal('emergency', 'Emergency fund', target, current, `${weeks} weeks of spending at about ${formatUSD(dailySpend * 7)} a week.`, weakestLabel([label, 'estimate']));
}

/** Card payoff by a date: progress = share of the starting balance already paid off. */
export function cardPayoffGoal(startBalance: number, balance: number, byDate: ISODate, asOf: ISODate, monthlyPaymentNeeded: number): GoalProgress {
  const months = Math.max(0, Math.round(diffDays(asOf, byDate) / 30.44));
  const g = goal('card', 'Card paid off', startBalance, startBalance - balance, `${formatUSD(balance)} left; about ${formatUSD(monthlyPaymentNeeded)} a month with no new charges reaches $0 in ${months} months.`, 'estimate');
  return g;
}

export function savingsTargetGoal(id: string, title: string, target: number, current: number, detail: string, label: NumberLabel = 'manual'): GoalProgress {
  return goal(id, title, target, current, detail, label);
}
