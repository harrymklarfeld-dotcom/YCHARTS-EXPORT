import { addDays, daysBetween, toDayKey } from '../day';

describe('day keys', () => {
  it('uses the local calendar date in the given IANA time zone', () => {
    // 2026-03-01 03:30 UTC is still Feb 28 in New York, already Mar 1 in Tokyo.
    const d = new Date(Date.UTC(2026, 2, 1, 3, 30));
    expect(toDayKey(d, 'America/New_York')).toBe('2026-02-28');
    expect(toDayKey(d, 'Asia/Tokyo')).toBe('2026-03-01');
    expect(toDayKey(d, 'UTC')).toBe('2026-03-01');
  });

  it('counts whole days across DST transitions', () => {
    // US spring-forward 2026-03-08, fall-back 2026-11-01
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    // Instants 23h apart across spring-forward are still consecutive local days
    const a = new Date('2026-03-07T12:00:00-05:00');
    const b = new Date('2026-03-08T12:00:00-04:00');
    expect(daysBetween(toDayKey(a, 'America/New_York'), toDayKey(b, 'America/New_York'))).toBe(1);
  });

  it('handles month/year/leap boundaries', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('device-local key is formatted YYYY-MM-DD', () => {
    expect(toDayKey(new Date(2026, 0, 5, 10))).toBe('2026-01-05');
  });
});
