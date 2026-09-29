import { describe, expect, it } from 'vitest';
import { addDays, addMonthsClamped, diffDays, fromDayNumber, isISODate, shortDate, toDayNumber, weekday } from '../src/index.ts';

describe('date-only math', () => {
  it('round-trips day numbers across centuries and leap days', () => {
    for (const d of ['1970-01-01', '2000-02-29', '2024-02-29', '2026-10-17', '2100-03-01', '1899-12-31']) {
      expect(fromDayNumber(toDayNumber(d))).toBe(d);
    }
    expect(toDayNumber('1970-01-01')).toBe(0);
    let n = toDayNumber('2023-12-25');
    for (let i = 0; i < 1000; i++, n++) expect(toDayNumber(fromDayNumber(n))).toBe(n);
  });

  it('validates dates', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('2026-1-01')).toBe(false);
    expect(isISODate(20261001)).toBe(false);
    expect(() => toDayNumber('2026-02-30')).toThrow(RangeError);
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-05', '2026-10-17')).toBe(12);
    expect(diffDays('2026-12-25', '2027-01-08')).toBe(14);
  });

  it('is DST-insensitive: US and EU DST transitions are ordinary 1-day steps', () => {
    for (const [a, b] of [['2026-03-07', '2026-03-08'], ['2026-03-08', '2026-03-09'], ['2026-10-31', '2026-11-01'], ['2026-11-01', '2026-11-02'], ['2026-03-28', '2026-03-29'], ['2026-10-24', '2026-10-25']]) {
      expect(diffDays(a!, b!)).toBe(1);
      expect(addDays(a!, 1)).toBe(b);
    }
    // 14 days across the Nov 1 fall-back is still exactly two weeks and same weekday.
    expect(addDays('2026-10-23', 14)).toBe('2026-11-06');
    expect(weekday('2026-10-23')).toBe(weekday('2026-11-06'));
  });

  it('knows weekdays', () => {
    expect(weekday('1970-01-01')).toBe(4); // Thursday
    expect(weekday('2026-10-05')).toBe(1); // Monday
    expect(weekday('2026-10-17')).toBe(6); // Saturday
    expect(weekday('1969-12-31')).toBe(3);
  });

  it('clamps months to their last day while keeping the anchor', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-01-31', 2, 31)).toBe('2026-03-31');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsClamped('2026-11-30', 2)).toBe('2027-01-30');
    expect(addMonthsClamped('2026-03-15', -3)).toBe('2025-12-15');
  });

  it('formats short dates without Intl', () => {
    expect(shortDate('2026-10-17')).toBe('Oct 17');
    expect(shortDate('2027-01-01')).toBe('Jan 1');
  });
});
