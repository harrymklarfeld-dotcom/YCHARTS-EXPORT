import { lessonStatuses, nextLessonId } from '../progress';
import type { Unit } from '../../types/contract';

const L = (id: string) => ({ id, title: id, xp: 10, intro: '', questions: [] });
const units: Unit[] = [
  { id: 'u2', title: 'b', summary: '', order: 2, lessons: [L('c'), L('d')] },
  { id: 'u1', title: 'a', summary: '', order: 1, lessons: [L('a'), L('b')] },
];

describe('path progress', () => {
  it('unlocks only the first lesson initially', () => {
    expect(lessonStatuses(units, {})).toEqual({ a: 'unlocked', b: 'locked', c: 'locked', d: 'locked' });
    expect(nextLessonId(units, {})).toBe('a');
  });
  it('unlocks across unit boundaries in order', () => {
    const st = lessonStatuses(units, { a: 1, b: 1 });
    expect(st).toEqual({ a: 'complete', b: 'complete', c: 'unlocked', d: 'locked' });
    expect(nextLessonId(units, { a: 1, b: 1, c: 1, d: 1 })).toBeNull();
  });
});
