import { isCorrect, keypadToValue } from '../answers';
import type { Question } from '../../types/contract';

const base = { id: 'q', prompt: 'p', explanation: 'e' };

describe('answer checking', () => {
  it('multiple choice & compare', () => {
    const q: Question = { ...base, type: 'multiple_choice', choices: ['a', 'b'], answer: 1 };
    expect(isCorrect(q, { type: 'multiple_choice', index: 1 })).toBe(true);
    expect(isCorrect(q, { type: 'multiple_choice', index: 0 })).toBe(false);
    const c: Question = { ...base, type: 'compare', choices: ['KO', 'TGT'], answer: 0 };
    expect(isCorrect(c, { type: 'compare', index: 0 })).toBe(true);
  });

  it('true/false', () => {
    const q: Question = { ...base, type: 'true_false', answer: false };
    expect(isCorrect(q, { type: 'true_false', value: false })).toBe(true);
    expect(isCorrect(q, { type: 'true_false', value: true })).toBe(false);
  });

  it('numeric percent with absolute tolerance on decimals', () => {
    const q: Question = { ...base, type: 'numeric', answer: 0.12827, tolerance: 0.005, unit: 'percent' };
    expect(isCorrect(q, { type: 'numeric', value: keypadToValue('12.8', 'percent')! })).toBe(true);
    expect(isCorrect(q, { type: 'numeric', value: keypadToValue('13.3', 'percent')! })).toBe(true);
    expect(isCorrect(q, { type: 'numeric', value: keypadToValue('13.4', 'percent')! })).toBe(false);
    expect(isCorrect(q, { type: 'numeric', value: keypadToValue('0.128', 'none')! })).toBe(true);
  });

  it('numeric usd with scale and default tolerance', () => {
    const q: Question = { ...base, type: 'numeric', answer: 1.6e9, unit: 'usd' };
    expect(isCorrect(q, { type: 'numeric', value: keypadToValue('1.6', 'usd', 1e9)! })).toBe(true);
    expect(isCorrect(q, { type: 'numeric', value: keypadToValue('1600', 'usd', 1e6)! })).toBe(true);
    expect(isCorrect(q, { type: 'numeric', value: keypadToValue('1.7', 'usd', 1e9)! })).toBe(false);
  });

  it('keypad parsing rejects junk', () => {
    expect(keypadToValue('', 'none')).toBeNull();
    expect(keypadToValue('-', 'none')).toBeNull();
    expect(keypadToValue('1..2', 'none')).toBeNull();
    expect(keypadToValue('-4.5', 'none')).toBe(-4.5);
  });

  it('order requires exact sequence', () => {
    const q: Question = { ...base, type: 'order', choices: ['A', 'B', 'C'], answer: [1, 2, 0] };
    expect(isCorrect(q, { type: 'order', order: [1, 2, 0] })).toBe(true);
    expect(isCorrect(q, { type: 'order', order: [1, 0, 2] })).toBe(false);
    expect(isCorrect(q, { type: 'order', order: [1, 2] })).toBe(false);
  });

  it('type mismatch is never correct', () => {
    const q: Question = { ...base, type: 'true_false', answer: true };
    expect(isCorrect(q, { type: 'numeric', value: 1 })).toBe(false);
  });
});
