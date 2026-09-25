import { isRead, librarySummary, withOpened, withProgress, withRead, type ReadMap } from '../progress';
import type { Article } from '../types';

const art = (slug: string): Article => ({
  slug, title: slug, summary: '', minutes: 5, level: 'beginner', unit: 'u1', relatedLessons: [], metrics: [], tags: [], updated: '', wordCount: 0, widgetCount: 2, sampleTickers: [], blocks: [],
});

describe('reading progress', () => {
  it('only moves forward, in ≥5-point steps, snapping to 1 near the end', () => {
    let m: ReadMap = {};
    m = withProgress(m, 'a', 0.1);
    expect(m.a.progress).toBe(0.1);
    const same = withProgress(m, 'a', 0.12);
    expect(same).toBe(m);
    expect(withProgress(m, 'a', 0.05)).toBe(m);
    expect(withProgress(m, 'a', 0.985).a.progress).toBe(1);
    expect(withProgress(m, 'a', NaN)).toBe(m);
  });
  it('mark read / unread keeps other fields; read keeps the first timestamp', () => {
    let m = withOpened({}, 'a', 5);
    m = withRead(m, 'a', true, 10);
    m = withRead(m, 'a', true, 20);
    expect(m.a).toEqual({ progress: 1, lastOpenedAt: 5, readAt: 10 });
    expect(isRead(m, 'a')).toBe(true);
    m = withRead(m, 'a', false, 30);
    expect(isRead(m, 'a')).toBe(false);
    expect(m.a.lastOpenedAt).toBe(5);
  });
  it('library summary: counts, continue (latest opened unread), next unread', () => {
    const list = ['a', 'b', 'c'].map(art);
    let m: ReadMap = {};
    expect(librarySummary(list, m)).toEqual({ total: 3, read: 0, continueSlug: null, nextSlug: 'a' });
    m = withRead(m, 'a', true, 1);
    m = withOpened(m, 'c', 2);
    m = withOpened(m, 'b', 3);
    expect(librarySummary(list, m)).toEqual({ total: 3, read: 1, continueSlug: 'b', nextSlug: 'b' });
  });
});
