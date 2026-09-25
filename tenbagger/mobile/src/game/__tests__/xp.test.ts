import { lessonXp, levelForXp, PERFECT_LESSON_BONUS, practiceXp } from '../xp';
import { addXpToLog, dailyProgress } from '../dailyGoal';

describe('xp', () => {
  it('awards base + perfect bonus', () => {
    expect(lessonXp({ baseXp: 10, mistakes: 0, alreadyCompleted: false })).toBe(10 + PERFECT_LESSON_BONUS);
    expect(lessonXp({ baseXp: 10, mistakes: 2, alreadyCompleted: false })).toBe(10);
  });
  it('halves replays', () => {
    expect(lessonXp({ baseXp: 15, mistakes: 1, alreadyCompleted: true })).toBe(8);
  });
  it('practice xp per correct answer', () => {
    expect(practiceXp(4)).toBe(8);
    expect(practiceXp(-1)).toBe(0);
  });
  it('levels', () => {
    expect(levelForXp(0)).toEqual({ level: 1, intoLevel: 0, levelSize: 50 });
    expect(levelForXp(49).level).toBe(1);
    expect(levelForXp(50)).toEqual({ level: 2, intoLevel: 0, levelSize: 100 });
    expect(levelForXp(160)).toEqual({ level: 3, intoLevel: 10, levelSize: 150 });
  });
});

describe('daily goal', () => {
  it('accumulates xp per day', () => {
    let log = addXpToLog({}, '2026-09-25', 10);
    log = addXpToLog(log, '2026-09-25', 15);
    expect(dailyProgress(log, '2026-09-25', 20)).toEqual({ earned: 25, goal: 20, fraction: 1, met: true });
    expect(dailyProgress(log, '2026-09-26', 20)).toEqual({ earned: 0, goal: 20, fraction: 0, met: false });
  });
  it('prunes old days', () => {
    let log = {};
    for (let i = 1; i <= 9; i++) log = addXpToLog(log, `2026-09-0${i}`, 1, 5);
    expect(Object.keys(log).sort()).toEqual(['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09']);
  });
  it('guards against zero goal', () => {
    expect(dailyProgress({}, '2026-09-25', 0).goal).toBe(1);
  });
});
