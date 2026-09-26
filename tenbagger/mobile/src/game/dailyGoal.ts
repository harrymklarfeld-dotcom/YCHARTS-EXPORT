import type { DayKey } from './day';

export const DAILY_GOAL_OPTIONS = [10, 20, 30, 50] as const;
export const DEFAULT_DAILY_GOAL = 20;

export type XpLog = Record<DayKey, number>;

export function addXpToLog(log: XpLog, day: DayKey, xp: number, keepDays = 60): XpLog {
  const next: XpLog = { ...log, [day]: (log[day] ?? 0) + xp };
  const keys = Object.keys(next).sort();
  if (keys.length > keepDays) {
    for (const k of keys.slice(0, keys.length - keepDays)) delete next[k];
  }
  return next;
}

export function dailyProgress(log: XpLog, day: DayKey, goal: number) {
  const earned = log[day] ?? 0;
  const safeGoal = Math.max(1, goal);
  return { earned, goal: safeGoal, fraction: Math.min(1, earned / safeGoal), met: earned >= safeGoal };
}
