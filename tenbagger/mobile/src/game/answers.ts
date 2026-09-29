import type { Question, QuestionUnit } from '../types/contract';

/** What the user submitted, per question type. */
export type Submission =
  | { type: 'multiple_choice' | 'compare'; index: number }
  | { type: 'numeric'; value: number }
  | { type: 'true_false'; value: boolean }
  | { type: 'order'; order: number[] };

export type UsdScale = 1 | 1e3 | 1e6 | 1e9;

/**
 * Convert what the user typed on the keypad into the contract's units:
 * percent → decimal ratio (12.6 → 0.126); usd → raw dollars (1.6 with B → 1.6e9).
 */
export function keypadToValue(input: string, unit: QuestionUnit | undefined, usdScale: UsdScale = 1): number | null {
  const cleaned = input.replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (unit === 'percent') return n / 100;
  if (unit === 'usd') return n * usdScale;
  return n;
}

/** Default tolerance when a numeric question omits one: 1% relative. */
export function effectiveTolerance(answer: number, tolerance?: number): number {
  if (typeof tolerance === 'number' && tolerance >= 0) return tolerance;
  return Math.max(Math.abs(answer) * 0.01, 1e-9);
}

export function isCorrect(q: Question, s: Submission): boolean {
  switch (q.type) {
    case 'multiple_choice':
    case 'compare':
      return (s.type === 'multiple_choice' || s.type === 'compare') && s.index === q.answer;
    case 'true_false':
      return s.type === 'true_false' && s.value === q.answer;
    case 'numeric': {
      if (s.type !== 'numeric') return false;
      const tol = effectiveTolerance(q.answer, q.tolerance);
      // small epsilon guards float noise at the tolerance edge
      return Math.abs(s.value - q.answer) <= tol + 1e-12 * Math.max(1, Math.abs(q.answer));
    }
    case 'order':
      return (
        s.type === 'order' &&
        s.order.length === q.answer.length &&
        s.order.every((v, i) => v === q.answer[i])
      );
  }
}
