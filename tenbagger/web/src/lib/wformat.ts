/**
 * Formatting + calculator math for article widgets, following content/WIDGETS.md
 * ("the app and the web must agree"). Pure functions: safe in Node and the browser.
 */
export type WFormat = 'percent' | 'usd' | 'multiple' | 'ratio' | 'per_share' | 'count';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const MINUS = '−';

function compact(abs: number): string | null {
  const tiers: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, s] of tiers) if (abs >= size * 0.9995) return `${(abs / size).toFixed(1)}${s}`;
  return null;
}

export function wfmt(format: WFormat | string, v: number | null | undefined): string {
  if (!isNum(v)) return '—';
  const neg = v < 0 ? MINUS : '';
  const a = Math.abs(v);
  switch (format) {
    case 'percent':
      return `${neg}${(a * 100).toFixed(1)}%`;
    case 'usd':
      return `${neg}$${compact(a) ?? a.toFixed(0)}`;
    case 'multiple':
      return `${neg}${a.toFixed(1)}×`;
    case 'ratio':
      return `${neg}${a.toFixed(2)}`;
    case 'per_share':
      return `${neg}$${a.toFixed(2)}`;
    case 'count':
      return `${neg}${compact(a) ?? a.toFixed(0)}`;
    default:
      return `${neg}${a.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

// ------------------------------------------------------------------ calculators

export function peCalc(price: number, eps: number, requiredReturn = 0.09) {
  const pe = eps > 0 ? price / eps : null;
  const ey = price > 0 ? eps / price : null;
  const implied = ey === null ? null : requiredReturn - ey;
  return { pe, earningsYield: ey, impliedGrowth: implied };
}

export function dcfCalc(o: { f0: number; g: number; r: number; m: number; n: number; netCash: number; shares: number | null }) {
  let pvYears = 0;
  for (let t = 1; t <= o.n; t++) pvYears += (o.f0 * Math.pow(1 + o.g, t)) / Math.pow(1 + o.r, t);
  const pvTerminal = (o.f0 * Math.pow(1 + o.g, o.n) * o.m) / Math.pow(1 + o.r, o.n);
  const value = pvYears + pvTerminal + o.netCash;
  const perShare = o.shares && o.shares > 0 ? value / o.shares : null;
  const denom = pvYears + pvTerminal;
  return { pvYears, pvTerminal, value, perShare, terminalShare: denom !== 0 ? pvTerminal / denom : null };
}

export function liquidityCalc(cash: number, card: number) {
  const ratio = card > 0 ? cash / card : null;
  const grade = ratio === null || ratio >= 2 ? 'A' : ratio >= 1.5 ? 'B' : ratio >= 1 ? 'C' : ratio >= 0.75 ? 'D' : 'F';
  return { ratio, grade, cushion: cash - card };
}

export const GRADE_TEXT: Record<string, string> = {
  A: 'Plenty of cushion',
  B: 'Comfortable',
  C: 'Covered, thin cushion',
  D: 'Tight',
  F: 'Card balance exceeds cash',
};
