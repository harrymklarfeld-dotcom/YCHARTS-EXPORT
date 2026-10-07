import { daysBetween, type DayKey } from './day';

export type StreakState = {
  /** Consecutive local days with at least one completed lesson. */
  current: number;
  longest: number;
  /** Local day key of the most recent qualifying activity, or null if never. */
  lastActiveDay: DayKey | null;
};

export const INITIAL_STREAK: StreakState = { current: 0, longest: 0, lastActiveDay: null };

/**
 * Record learning activity on `today`. Only lesson completion should call this —
 * streaks reward learning, never trading.
 */
export function recordActivity(state: StreakState, today: DayKey): StreakState {
  if (state.lastActiveDay === null) {
    return { current: 1, longest: Math.max(1, state.longest), lastActiveDay: today };
  }
  const gap = daysBetween(state.lastActiveDay, today);
  if (gap <= 0) {
    // Same day (or clock moved backwards / tz travel): no change, never double count.
    return state;
  }
  const current = gap === 1 ? state.current + 1 : 1;
  return { current, longest: Math.max(state.longest, current), lastActiveDay: today };
}

/**
 * The streak to DISPLAY on `today`. A streak stays alive through today even if the
 * user hasn't practised yet; it only shows as broken once a full day was missed.
 */
export function displayedStreak(state: StreakState, today: DayKey): number {
  if (state.lastActiveDay === null) return 0;
  const gap = daysBetween(state.lastActiveDay, today);
  return gap <= 1 ? state.current : 0;
}

/** True if the user already extended the streak today. */
export function isStreakSafeToday(state: StreakState, today: DayKey): boolean {
  return state.lastActiveDay !== null && daysBetween(state.lastActiveDay, today) <= 0;
}
