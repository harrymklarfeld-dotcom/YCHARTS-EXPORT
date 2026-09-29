import type { Unit } from '../types/contract';

export type LessonStatus = 'locked' | 'unlocked' | 'complete';

/**
 * Linear path: the first lesson is always open; each lesson unlocks when the one
 * before it (across unit boundaries) is complete.
 */
export function lessonStatuses(units: Unit[], completed: Record<string, unknown>): Record<string, LessonStatus> {
  const out: Record<string, LessonStatus> = {};
  let prevDone = true;
  const ordered = [...units].sort((a, b) => a.order - b.order);
  for (const u of ordered) {
    for (const l of u.lessons) {
      const done = Boolean(completed[l.id]);
      out[l.id] = done ? 'complete' : prevDone ? 'unlocked' : 'locked';
      prevDone = done;
    }
  }
  return out;
}

/** The next lesson to take (first unlocked, not complete), or null when all are done. */
export function nextLessonId(units: Unit[], completed: Record<string, unknown>): string | null {
  const st = lessonStatuses(units, completed);
  for (const u of [...units].sort((a, b) => a.order - b.order)) {
    for (const l of u.lessons) if (st[l.id] === 'unlocked') return l.id;
  }
  return null;
}
