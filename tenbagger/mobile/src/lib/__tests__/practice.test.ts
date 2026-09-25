import { getCompanies, getUnits } from '../../data';
import { isCorrect } from '../../game';
import { generatedQuestions, practiceLessonFor } from '../practice';

describe('practice sets', () => {
  it('builds a non-empty practice lesson for every company', () => {
    for (const c of getCompanies()) {
      const l = practiceLessonFor(c, getUnits());
      expect(l.questions.length).toBeGreaterThan(0);
      expect(l.questions.length).toBeLessThanOrEqual(6);
      for (const q of l.questions) expect(q.source?.ticker).toBe(c.ticker);
    }
  });

  it('generated answers are read from the company data', () => {
    const cost = getCompanies().find((c) => c.ticker === 'COST')!;
    const qs = generatedQuestions(cost);
    const gm = qs.find((q) => q.id.endsWith('-gm'))!;
    expect(isCorrect(gm, { type: 'numeric', value: cost.metrics.gross_margin! })).toBe(true);
    const order = qs.find((q) => q.type === 'order')!;
    expect(isCorrect(order, { type: 'order', order: [0, 1, 2] })).toBe(true); // gross > operating > net
  });
});
