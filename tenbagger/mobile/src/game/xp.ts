/**
 * XP rules. XP is earned ONLY by learning (answering lesson/practice questions).
 * Nothing in the app awards XP, streaks or badges for trading or holding securities.
 */

export const PERFECT_LESSON_BONUS = 5;
export const PRACTICE_XP_PER_CORRECT = 2;
/** Replaying a completed lesson is worth a reduced amount. */
export const REPLAY_FACTOR = 0.5;

export type LessonResult = {
  baseXp: number;
  mistakes: number;
  alreadyCompleted: boolean;
};

export function lessonXp({ baseXp, mistakes, alreadyCompleted }: LessonResult): number {
  const base = alreadyCompleted ? Math.round(baseXp * REPLAY_FACTOR) : baseXp;
  const bonus = mistakes === 0 ? PERFECT_LESSON_BONUS : 0;
  return Math.max(0, base + bonus);
}

export function practiceXp(correctFirstTry: number): number {
  return Math.max(0, correctFirstTry) * PRACTICE_XP_PER_CORRECT;
}

/** Levels grow gently: level n needs 50·n·(n+1)/2 total XP (50, 150, 300, …). */
export function levelForXp(totalXp: number): { level: number; intoLevel: number; levelSize: number } {
  let level = 1;
  let floor = 0;
  let size = 50;
  while (totalXp >= floor + size) {
    floor += size;
    level += 1;
    size = 50 * level;
  }
  return { level, intoLevel: totalXp - floor, levelSize: size };
}
