import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatMultiple,
  formatPercent,
  formatRatio,
  formatUsd,
  formatValue,
  MISSING,
} from '../src/index.ts';

describe('formatters', () => {
  it('percent', () => {
    expect(formatPercent(0.312)).toBe('31%');
    expect(formatPercent(0.0456)).toBe('4.6%');
    expect(formatPercent(0.05)).toBe('5%');
    expect(formatPercent(-0.05)).toBe('-5%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(-0.0000001)).toBe('0%');
  });
  it('usd', () => {
    expect(formatUsd(254e9)).toBe('$254B');
    expect(formatUsd(1.23e9)).toBe('$1.2B');
    expect(formatUsd(-1.2e9)).toBe('-$1.2B');
    expect(formatUsd(3.456)).toBe('$3.46');
    expect(formatUsd(999.96e6)).toBe('$1B');
    expect(formatUsd(2.5e12)).toBe('$2.5T');
    expect(formatUsd(12_000)).toBe('$12K');
    expect(formatUsd(0)).toBe('$0');
  });
  it('multiple / ratio / count', () => {
    expect(formatMultiple(18.23)).toBe('18.2x');
    expect(formatMultiple(25)).toBe('25x');
    expect(formatRatio(1.5)).toBe('1.50');
    expect(formatCount(1.1e9)).toBe('1.1B');
  });
  it('missing values render as a dash, never NaN', () => {
    for (const f of [formatPercent, formatUsd, formatMultiple, formatRatio, formatCount]) {
      expect(f(null)).toBe(MISSING);
      expect(f(undefined)).toBe(MISSING);
      expect(f(Number.NaN)).toBe(MISSING);
      expect(f(Number.POSITIVE_INFINITY)).toBe(MISSING);
    }
  });
  it('formatValue uses the catalog unit', () => {
    expect(formatValue('roic', 0.31)).toBe('31%');
    expect(formatValue('pe', 18.2)).toBe('18.2x');
    expect(formatValue('market_cap', 3e12)).toBe('$3T');
  });
});
