/**
 * Timezone-safe calendar math on date-only strings (`YYYY-MM-DD`).
 *
 * Every date is converted to an integer day number (days since 1970-01-01) with pure
 * arithmetic (Howard Hinnant's civil-from-days algorithm). No `Date` object, no local
 * timezone, so a DST change can never add or lose a day.
 */
import type { ISODate, Weekday } from './types.ts';

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string') return false;
  const m = RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Days in month `m` (1-12) of year `y`. */
export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export function parts(date: ISODate): { y: number; m: number; d: number } {
  if (!isISODate(date)) throw new RangeError(`Invalid date "${String(date)}" (expected YYYY-MM-DD)`);
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) };
}

/** Day number: days since 1970-01-01. */
export function toDayNumber(date: ISODate): number {
  const { y: y0, m, d } = parts(date);
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDayNumber(n: number): ISODate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromDayNumber(toDayNumber(date) + n);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(b) - toDayNumber(a);
}

/** 0 = Sunday … 6 = Saturday. 1970-01-01 was a Thursday. */
export function weekday(date: ISODate): Weekday {
  return (((toDayNumber(date) + 4) % 7) + 7) % 7 as Weekday;
}

export function makeDate(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Same day-of-month `n` months later, clamped to the month's last day (Jan 31 + 1 → Feb 28/29). */
export function addMonthsClamped(date: ISODate, n: number, anchorDay?: number): ISODate {
  const { y, m, d } = parts(date);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return makeDate(ny, nm, Math.min(anchorDay ?? d, daysInMonth(ny, nm)));
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

/** Date part of a snapshot `takenAt` (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM[:SS]`). */
export function dateOf(takenAt: string): ISODate {
  const d = takenAt.slice(0, 10);
  if (!isISODate(d)) throw new RangeError(`Invalid takenAt "${takenAt}"`);
  return d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Oct 17" — no Intl, identical on every platform. */
export function shortDate(date: ISODate): string {
  const { m, d } = parts(date);
  return `${MONTHS[m - 1]} ${d}`;
}

export function weekdayName(w: Weekday): string {
  return DAYS[w] ?? '';
}
