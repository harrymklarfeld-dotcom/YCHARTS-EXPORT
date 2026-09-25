/**
 * Forward-looking income: when money will actually land, and how sure we are.
 */
import { addDays, addMonthsClamped, daysInMonth, fromDayNumber, isISODate, makeDate, parts, toDayNumber, weekday } from './dates.ts';
import { round2 } from './format.ts';
import type { ExpectedDeposit, IncomeStream, ISODate, PayFrequency } from './types.ts';

export const PERIODS_PER_YEAR: Record<PayFrequency, number> = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };

/** Weeks of work one paycheck covers. */
export function weeksPerPeriod(f: PayFrequency): number {
  return 52 / PERIODS_PER_YEAR[f];
}

function semimonthlySlots(stream: IncomeStream): [number, number] {
  const [a, b] = stream.semimonthlyDays ?? [15, 31];
  return a <= b ? [a, b] : [b, a];
}

function slotDate(y: number, m: number, day: number): ISODate {
  return makeDate(y, m, Math.min(day, daysInMonth(y, m)));
}

/** Nominal (unadjusted) payday number `k` relative to `nextPayDate` (k may be negative). */
export function nominalPayDate(stream: IncomeStream, k: number): ISODate {
  const start = stream.nextPayDate;
  switch (stream.payFrequency) {
    case 'weekly':
      return addDays(start, 7 * k);
    case 'biweekly':
      return addDays(start, 14 * k);
    case 'monthly':
      return addMonthsClamped(start, k, parts(start).d);
    case 'semimonthly': {
      if (k === 0) return start;
      const [a, b] = semimonthlySlots(stream);
      let { y, m } = parts(start);
      const startN = toDayNumber(start);
      const step = k > 0 ? 1 : -1;
      let remaining = Math.abs(k);
      // Walk month by month over the two slots, skipping anything not strictly past `start`.
      for (let guard = 0; guard < 2000; guard++) {
        const slots = step > 0 ? [a, b] : [b, a];
        for (const s of slots) {
          const d = slotDate(y, m, s);
          const n = toDayNumber(d);
          if ((step > 0 && n > startN) || (step < 0 && n < startN)) {
            remaining -= 1;
            if (remaining === 0) return d;
          }
        }
        m += step;
        if (m === 13) {
          m = 1;
          y += 1;
        } else if (m === 0) {
          m = 12;
          y -= 1;
        }
      }
      throw new RangeError('semimonthly schedule did not converge');
    }
  }
}

function adjustForWeekend(stream: IncomeStream, d: ISODate): ISODate {
  if (stream.weekendRule !== 'previous_business_day') return d;
  const w = weekday(d);
  if (w === 6) return addDays(d, -1);
  if (w === 0) return addDays(d, -2);
  return d;
}

function unitWord(stream: IncomeStream): string {
  return stream.kind === 'per_session' ? 'sessions' : 'hours';
}

/** Hours/sessions one paycheck covers, or null for salary/other. */
function unitsForPaycheck(stream: IncomeStream, k: number): number | null {
  if (stream.kind !== 'hourly' && stream.kind !== 'per_session') return null;
  const { unitsPerWeek, weekdays } = stream.schedule;
  if (stream.periodLagDays !== undefined && weekdays.length > 0) {
    const lag = stream.periodLagDays;
    const end = addDays(nominalPayDate(stream, k), -lag);
    const start = addDays(nominalPayDate(stream, k - 1), -lag + 1);
    const perDay = unitsPerWeek / weekdays.length;
    let count = 0;
    for (let n = toDayNumber(start); n <= toDayNumber(end); n++) {
      if (weekdays.includes(weekday(fromDayNumber(n)))) count++;
    }
    return count * perDay;
  }
  return unitsPerWeek * weeksPerPeriod(stream.payFrequency);
}

function grossFor(stream: IncomeStream, units: number | null): number {
  switch (stream.kind) {
    case 'hourly':
    case 'per_session':
      return stream.rate * (units ?? 0);
    case 'salary':
      return stream.rate / PERIODS_PER_YEAR[stream.payFrequency];
    case 'other':
      return stream.rate;
  }
}

/** Index k of the paycheck that covers the unsubmitted work, if any. */
function pendingIndex(stream: IncomeStream): number | null {
  const p = stream.pendingUnsubmitted;
  if (!p) return null;
  const lag = stream.periodLagDays ?? 0;
  const target = toDayNumber(p.periodEnd);
  for (let k = 0; k < 400; k++) {
    if (toDayNumber(nominalPayDate(stream, k)) - lag >= target) return k;
  }
  return null;
}

export function validateStream(s: IncomeStream): string[] {
  const errs: string[] = [];
  if (!s.id) errs.push('stream id is required');
  if (!isISODate(s.nextPayDate)) errs.push(`${s.id}: nextPayDate must be YYYY-MM-DD`);
  if (!Number.isFinite(s.rate) || s.rate < 0) errs.push(`${s.id}: rate must be a non-negative number`);
  if (!(s.withholdingRate >= 0 && s.withholdingRate < 1)) errs.push(`${s.id}: withholdingRate must be in [0, 1)`);
  if (!Number.isFinite(s.schedule.unitsPerWeek) || s.schedule.unitsPerWeek < 0) errs.push(`${s.id}: unitsPerWeek must be ≥ 0`);
  if (s.pendingUnsubmitted && !isISODate(s.pendingUnsubmitted.periodEnd)) errs.push(`${s.id}: pendingUnsubmitted.periodEnd must be YYYY-MM-DD`);
  return errs;
}

/**
 * Every paycheck expected to land in `[from, to]` (inclusive), sorted by date then stream.
 *
 * - Regular paychecks are `projected`: rate × (units per week × weeks per period), net of withholding.
 * - The paycheck covering `pendingUnsubmitted` work is `pending`: it only lands if the
 *   stream's condition is met (e.g. hours submitted), and uses the actual unsubmitted units.
 * - Paydays before `nextPayDate` are never invented.
 */
export function projectIncome(streams: readonly IncomeStream[], from: ISODate, to: ISODate): ExpectedDeposit[] {
  const fromN = toDayNumber(from);
  const toN = toDayNumber(to);
  const out: ExpectedDeposit[] = [];
  if (toN < fromN) return out;
  for (const s of streams) {
    const errs = validateStream(s);
    if (errs.length) throw new RangeError(errs.join('; '));
    const pk = pendingIndex(s);
    for (let k = 0; k < 2000; k++) {
      const nominal = nominalPayDate(s, k);
      const nomN = toDayNumber(nominal);
      if (nomN > toN + 3) break; // weekend rule can move a date at most 2 days earlier
      const date = adjustForWeekend(s, nominal);
      const n = toDayNumber(date);
      if (n < fromN || n > toN) continue;
      const isPending = k === pk;
      const units = isPending ? (s.pendingUnsubmitted?.units ?? 0) : unitsForPaycheck(s, k);
      const gross = round2(grossFor(s, units));
      const amount = round2(gross * (1 - s.withholdingRate));
      const dep: ExpectedDeposit = {
        date,
        amount,
        gross,
        basis: isPending ? 'pending' : 'projected',
        streamId: s.id,
        streamName: s.name,
      };
      if (units !== null) dep.units = round2(units);
      if (isPending) {
        dep.note = `Only lands if ${s.condition ?? 'the work is submitted'}: ${round2(units ?? 0)} ${unitWord(s)} not submitted yet`;
      } else if (s.condition) {
        dep.note = `Assumes ${s.condition} on time`;
      }
      out.push(dep);
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.streamId.localeCompare(b.streamId)));
}

/** Typical monthly net income from the regular schedule (no pending adjustments). An ESTIMATE. */
export function scheduledMonthlyIncome(streams: readonly IncomeStream[]): number {
  let total = 0;
  for (const s of streams) {
    const per =
      s.kind === 'hourly' || s.kind === 'per_session'
        ? s.rate * s.schedule.unitsPerWeek * weeksPerPeriod(s.payFrequency)
        : grossFor(s, null);
    total += (per * PERIODS_PER_YEAR[s.payFrequency] * (1 - s.withholdingRate)) / 12;
  }
  return round2(total);
}
