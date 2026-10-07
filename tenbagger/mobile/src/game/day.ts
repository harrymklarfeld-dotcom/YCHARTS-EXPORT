/**
 * Timezone-safe calendar-day helpers.
 *
 * A "day key" is the user's LOCAL calendar date as `YYYY-MM-DD`. We never compare raw
 * timestamps for streaks: two instants 2 hours apart can be different days, and a "day"
 * can be 23 or 25 hours long around DST. Differences between day keys are computed on the
 * calendar (via Date.UTC), so they are always whole days.
 */

export type DayKey = string; // 'YYYY-MM-DD'

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/**
 * Local calendar date for `date`.
 * - `timeZone` (IANA, e.g. 'America/New_York') → uses Intl, independent of device tz.
 * - omitted → uses the device's local time zone.
 */
export function toDayKey(date: Date, timeZone?: string): DayKey {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(key: DayKey): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Invalid day key: ${key}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Whole calendar days from `a` to `b` (b − a). DST-proof. */
export function daysBetween(a: DayKey, b: DayKey): number {
  const pa = parseDayKey(a);
  const pb = parseDayKey(b);
  const ua = Date.UTC(pa.y, pa.m - 1, pa.d);
  const ub = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((ub - ua) / 86_400_000);
}

export function addDays(key: DayKey, n: number): DayKey {
  const p = parseDayKey(key);
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
