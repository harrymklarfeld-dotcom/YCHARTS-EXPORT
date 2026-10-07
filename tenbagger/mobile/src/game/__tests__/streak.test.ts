import { displayedStreak, INITIAL_STREAK, isStreakSafeToday, recordActivity } from '../streak';

describe('streak', () => {
  it('starts at 1 on first activity', () => {
    const s = recordActivity(INITIAL_STREAK, '2026-09-01');
    expect(s).toEqual({ current: 1, longest: 1, lastActiveDay: '2026-09-01' });
  });

  it('does not double count the same day', () => {
    const s1 = recordActivity(INITIAL_STREAK, '2026-09-01');
    expect(recordActivity(s1, '2026-09-01')).toBe(s1);
  });

  it('extends on consecutive days and resets after a gap', () => {
    let s = recordActivity(INITIAL_STREAK, '2026-09-01');
    s = recordActivity(s, '2026-09-02');
    s = recordActivity(s, '2026-09-03');
    expect(s.current).toBe(3);
    s = recordActivity(s, '2026-09-05');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(3);
  });

  it('ignores activity dated before the last active day (tz travel)', () => {
    const s = recordActivity(INITIAL_STREAK, '2026-09-02');
    expect(recordActivity(s, '2026-09-01')).toBe(s);
  });

  it('displays streak alive through today, broken after a missed day', () => {
    const s = { current: 4, longest: 4, lastActiveDay: '2026-09-10' };
    expect(displayedStreak(s, '2026-09-10')).toBe(4);
    expect(displayedStreak(s, '2026-09-11')).toBe(4);
    expect(displayedStreak(s, '2026-09-12')).toBe(0);
    expect(displayedStreak(INITIAL_STREAK, '2026-09-12')).toBe(0);
    expect(isStreakSafeToday(s, '2026-09-10')).toBe(true);
    expect(isStreakSafeToday(s, '2026-09-11')).toBe(false);
  });

  it('crosses month and year boundaries', () => {
    let s = recordActivity(INITIAL_STREAK, '2025-12-31');
    s = recordActivity(s, '2026-01-01');
    expect(s.current).toBe(2);
  });
});
