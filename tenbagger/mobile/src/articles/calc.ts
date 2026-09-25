/**
 * Calculator math for article widgets. Pure + unit-tested. The website mirrors these formulas
 * (tenbagger/content/WIDGETS.md → "Calculator math").
 */
import type { HistoryPoint } from '../types/contract';

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/* ----------------------------------------------------------------------------- P/E */

export type PeResult = { pe: number | null; earningsYield: number | null; impliedGrowth: number | null };

/** P/E (null if eps ≤ 0), earnings yield, and growth implied by `required ≈ earnings yield + growth`. */
export function peCalc(price: number, eps: number, requiredReturn = 0.09): PeResult {
  if (!finite(price) || price <= 0 || !finite(eps)) return { pe: null, earningsYield: null, impliedGrowth: null };
  const earningsYield = eps / price;
  return { pe: eps > 0 ? price / eps : null, earningsYield, impliedGrowth: requiredReturn - earningsYield };
}

/* ----------------------------------------------------------------------------- DCF */

export type DcfInput = { fcf: number; growth: number; discount: number; terminal: number; years: number; netCash?: number; shares?: number | null };
export type DcfResult = {
  rows: { year: number; fcf: number; pv: number }[];
  pvYears: number;
  pvTerminal: number;
  operatingValue: number;
  equityValue: number;
  perShare: number | null;
  /** PV of terminal ÷ (PV of years + PV of terminal); null when the total is ≤ 0. */
  terminalShare: number | null;
};

export function dcfCalc({ fcf, growth, discount, terminal, years, netCash = 0, shares }: DcfInput): DcfResult {
  const n = Math.max(1, Math.round(years));
  const rows: DcfResult['rows'] = [];
  let pvYears = 0;
  let f = fcf;
  for (let t = 1; t <= n; t++) {
    f *= 1 + growth;
    const pv = f / (1 + discount) ** t;
    rows.push({ year: t, fcf: f, pv });
    pvYears += pv;
  }
  const pvTerminal = (f * terminal) / (1 + discount) ** n;
  const operatingValue = pvYears + pvTerminal;
  const equityValue = operatingValue + (netCash ?? 0);
  return {
    rows,
    pvYears,
    pvTerminal,
    operatingValue,
    equityValue,
    perShare: finite(shares) && shares > 0 ? equityValue / shares : null,
    terminalShare: operatingValue > 0 ? pvTerminal / operatingValue : null,
  };
}

/** Mean of every non-null year of a history series. */
export function seriesMean(history: HistoryPoint[] | undefined | null): number | null {
  const vals = (history ?? []).map(([, v]) => v).filter(finite);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** The "normalized FCF" used by the DCF cyclical toggle: the mean of every reported year. */
export const normalizedFcf = seriesMean;

/* ----------------------------------------------------------------------------- Liquidity */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type LiquidityResult = { ratio: number | null; grade: Grade; cushion: number };

/** Same bands as packages/money gradeLiquidity: A ≥2 (or no card debt), B ≥1.5, C ≥1, D ≥0.75, else F. */
export function gradeLiquidity(ratio: number | null): Grade {
  if (ratio === null || ratio >= 2) return 'A';
  if (ratio >= 1.5) return 'B';
  if (ratio >= 1) return 'C';
  if (ratio >= 0.75) return 'D';
  return 'F';
}

export function liquidityCalc(cash: number, card: number): LiquidityResult {
  const c = Math.max(0, cash);
  const d = Math.max(0, card);
  const ratio = d > 0 ? c / d : null;
  return { ratio, grade: gradeLiquidity(ratio), cushion: c - d };
}

/* ----------------------------------------------------------------------------- slider ranges */

export type Range = { min: number; max: number; step: number };

/** A "nice" step (1, 2, 2.5 or 5 × 10^k) giving roughly `target` steps across `span`. */
export function niceStep(span: number, target = 200): number {
  if (!finite(span) || span <= 0) return 1;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

/** Snap to the step grid anchored at min, clamp to [min, max], and strip float noise. */
export function snap(v: number, r: Range): number {
  const clamped = Math.min(r.max, Math.max(r.min, v));
  const k = Math.round((clamped - r.min) / r.step);
  const out = Math.min(r.max, r.min + k * r.step);
  return Number(out.toPrecision(12));
}

export function dcfRanges(fcf: number, normalized: number | null) {
  const big = Math.max(Math.abs(fcf), Math.abs(normalized ?? 0), 1);
  const fmax = 3 * big;
  return {
    fcf: { min: 0, max: fmax, step: niceStep(fmax) },
    growth: { min: -0.1, max: 0.25, step: 0.005 },
    discount: { min: 0.05, max: 0.15, step: 0.0025 },
    terminal: { min: 5, max: 30, step: 0.5 },
  } satisfies Record<string, Range>;
}

export function peRanges(price: number, eps: number) {
  const pmax = Math.max(3 * Math.abs(price), 1);
  const e = Math.max(Math.abs(eps), 0.01);
  return {
    price: { min: niceStep(pmax), max: pmax, step: niceStep(pmax) },
    eps: { min: -e, max: 3 * e, step: niceStep(4 * e) },
    required: { min: 0.04, max: 0.15, step: 0.0025 },
  } satisfies Record<string, Range>;
}

export function liquidityRanges(cash: number, card: number) {
  return {
    cash: { min: 0, max: Math.max(20000, 3 * cash), step: 100 },
    card: { min: 0, max: Math.max(10000, 3 * card), step: 50 },
  } satisfies Record<string, Range>;
}

/** Slider label: 9% · 9.25% · −1.5% (up to 2 decimals, trailing zeros trimmed). */
export function pct(v: number): string {
  const s = Math.abs(v * 100).toFixed(2).replace(/\.?0+$/, '');
  return `${v < 0 && s !== '0' ? '−' : ''}${s}%`;
}
