/**
 * Portfolio X-ray: look through funds to see what you really own. Pure logic, no React.
 *
 * Input is either a weight list (`{ ticker, weight }`) or CONTRACT holdings rows
 * (`{ ticker, market_value, account_id, … }`) — the same code path handles both, so linked
 * brokerage holdings can replace the bundled sample later without changes here.
 *
 * Limits (shown in the UI): funds are seen through their listed top holdings only
 * (funds.json keeps up to 25). The rest of each fund is "unseen" and reported as such.
 */
import type { Allocation, Fund } from './types';

export type XrayInput = {
  ticker: string;
  /** Portfolio share; any scale (normalised). Used when present. */
  weight?: number | null;
  /** CONTRACT holdings shape: used when `weight` is absent. */
  market_value?: number | null;
  name?: string;
};

export type CompanyLike = {
  ticker: string;
  name: string;
  sector?: string | null;
  metrics?: { earnings_yield?: number | null; pe?: number | null; roic?: number | null; fcf_yield?: number | null } | null;
};

export type PositionKind = 'fund' | 'stock' | 'cash' | 'unknown';
export type Position = { ticker: string; name: string; kind: PositionKind; weight: number };

export type Exposure = {
  /** Ticker when known, else `name:<NAME>`. */
  key: string;
  ticker: string | null;
  name: string;
  direct: number;
  via: { fund: string; weight: number }[];
  total: number;
  /** In companies.json (can open its company page). */
  inCompanies: boolean;
};

export type XrayWarning = {
  kind: 'overlap' | 'concentration' | 'fund_overlap';
  severity: 'info' | 'caution';
  message: string;
  tickers: string[];
};

export type XrayResult = {
  positions: Position[];
  exposures: Exposure[];
  /** Portfolio share inside funds that we cannot see (beyond their listed holdings). */
  unseenFundWeight: number;
  sectors: { sector: string; weight: number }[];
  assetMix: Allocation;
  lookThrough: { pe: number | null; roic: number | null; fcfYield: number | null; coverage: number };
  warnings: XrayWarning[];
};

export const CASH_TICKERS = new Set(['CASH', '$CASH', 'USD', 'SPAXX', 'FDRXX', 'SWVXX', 'VMFXX']);
export const OVERLAP_MIN_TOTAL = 0.05;
export const CONCENTRATION_MIN = 0.1;
export const FUND_OVERLAP_MIN = 0.15;

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Normalise inputs to weights that sum to 1, merging duplicate tickers (e.g. two accounts). */
export function toWeights(inputs: XrayInput[]): { ticker: string; name?: string; weight: number }[] {
  const useWeights = inputs.some((i) => fin(i.weight));
  const merged = new Map<string, { ticker: string; name?: string; raw: number }>();
  for (const i of inputs) {
    const t = (i.ticker ?? '').trim().toUpperCase();
    if (!t) continue;
    const raw = useWeights ? i.weight : i.market_value;
    if (!fin(raw) || raw <= 0) continue;
    const cur = merged.get(t) ?? { ticker: t, name: i.name, raw: 0 };
    cur.raw += raw;
    merged.set(t, cur);
  }
  const total = [...merged.values()].reduce((s, m) => s + m.raw, 0);
  if (total <= 0) return [];
  return [...merged.values()].map((m) => ({ ticker: m.ticker, name: m.name, weight: m.raw / total }));
}

function earningsYield(m: CompanyLike['metrics']): number | null {
  if (!m) return null;
  if (fin(m.earnings_yield)) return m.earnings_yield;
  if (fin(m.pe) && m.pe > 0) return 1 / m.pe;
  return null;
}

function weightedMean(pairs: [number, number][]): number | null {
  const tw = pairs.reduce((s, [w]) => s + w, 0);
  return tw > 0 ? pairs.reduce((s, [w, v]) => s + w * v, 0) / tw : null;
}

function pct1(v: number): string {
  return `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
}

/** Lower-bound overlap of two funds: Σ min(wA, wB) over holdings both list. */
export function fundOverlap(a: Fund, b: Fund): number {
  const wb = new Map<string, number>();
  for (const h of b.top_holdings) if (h.ticker && fin(h.weight)) wb.set(h.ticker, (wb.get(h.ticker) ?? 0) + h.weight);
  let s = 0;
  for (const h of a.top_holdings) {
    if (!h.ticker || !fin(h.weight)) continue;
    const o = wb.get(h.ticker);
    if (o !== undefined) s += Math.min(h.weight, o);
  }
  return s;
}

export function xray(inputs: XrayInput[], funds: Fund[], companies: CompanyLike[]): XrayResult {
  const fundBy = new Map(funds.map((f) => [f.ticker.toUpperCase(), f]));
  const coBy = new Map(companies.map((c) => [c.ticker.toUpperCase(), c]));
  const weights = toWeights(inputs);

  const positions: Position[] = weights.map((w) => {
    const f = fundBy.get(w.ticker);
    const c = coBy.get(w.ticker);
    const kind: PositionKind = CASH_TICKERS.has(w.ticker) ? 'cash' : f ? 'fund' : c ? 'stock' : 'unknown';
    const name = f?.name ?? c?.name ?? w.name ?? (kind === 'cash' ? 'Cash' : w.ticker);
    return { ticker: w.ticker, name, kind, weight: w.weight };
  });

  // ---- company exposures
  const ex = new Map<string, Exposure>();
  const touch = (key: string, ticker: string | null, name: string): Exposure => {
    let e = ex.get(key);
    if (!e) {
      e = { key, ticker, name, direct: 0, via: [], total: 0, inCompanies: !!ticker && coBy.has(ticker) };
      ex.set(key, e);
    }
    return e;
  };
  let unseen = 0;
  const mix: Allocation = { stock: 0, bond: 0, cash: 0, commodity: 0, other: 0 };
  const sectors = new Map<string, number>();
  const addSector = (s: string, w: number) => sectors.set(s, (sectors.get(s) ?? 0) + w);

  for (const p of positions) {
    if (p.kind === 'cash') {
      mix.cash += p.weight;
      addSector('Cash', p.weight);
      continue;
    }
    if (p.kind === 'stock' || p.kind === 'unknown') {
      const c = coBy.get(p.ticker);
      const e = touch(p.ticker, p.ticker, c?.name ?? p.name);
      e.direct += p.weight;
      mix.stock += p.weight;
      addSector(c?.sector || 'Unclassified', p.weight);
      continue;
    }
    // fund
    const f = fundBy.get(p.ticker)!;
    let seen = 0;
    for (const h of f.top_holdings) {
      if (!fin(h.weight) || h.weight <= 0) continue;
      const tk = h.ticker ? h.ticker.toUpperCase() : null;
      const key = tk ?? `name:${h.name.toUpperCase()}`;
      const e = touch(key, tk, coBy.get(tk ?? '')?.name ?? h.name);
      const w = p.weight * h.weight;
      const existing = e.via.find((v) => v.fund === f.ticker);
      if (existing) existing.weight += w;
      else e.via.push({ fund: f.ticker, weight: w });
      seen += h.weight;
    }
    unseen += p.weight * Math.max(0, 1 - seen);
    const a = f.allocation ?? { stock: 1, bond: 0, cash: 0, commodity: 0, other: 0 };
    mix.stock += p.weight * a.stock;
    mix.bond += p.weight * a.bond;
    mix.cash += p.weight * a.cash;
    mix.commodity += p.weight * a.commodity;
    mix.other += p.weight * a.other;
    let sectorSum = 0;
    for (const [s, w] of Object.entries(f.sector_weights)) {
      if (!fin(w) || w <= 0) continue;
      addSector(s, p.weight * w);
      sectorSum += w;
    }
    const stockGap = a.stock - sectorSum;
    if (stockGap > 1e-9) addSector('Unclassified', p.weight * stockGap);
    if (a.bond > 0) addSector('Bonds', p.weight * a.bond);
    if (a.cash > 0) addSector('Cash', p.weight * a.cash);
    if (a.commodity > 0) addSector(f.category === 'Gold' ? 'Gold' : 'Commodities', p.weight * a.commodity);
    if (a.other > 0) addSector('Other', p.weight * a.other);
  }

  const exposures = [...ex.values()]
    .map((e) => ({ ...e, via: [...e.via].sort((x, y) => y.weight - x.weight), total: e.direct + e.via.reduce((s, v) => s + v.weight, 0) }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));

  // ---- look-through metrics over company exposures we have data for
  const eyPairs: [number, number][] = [];
  const roicPairs: [number, number][] = [];
  const fcfPairs: [number, number][] = [];
  let covered = 0;
  for (const e of exposures) {
    const c = e.ticker ? coBy.get(e.ticker) : undefined;
    if (!c) continue;
    covered += e.total;
    const ey = earningsYield(c.metrics);
    if (ey !== null) eyPairs.push([e.total, ey]);
    if (fin(c.metrics?.roic)) roicPairs.push([e.total, c.metrics!.roic!]);
    if (fin(c.metrics?.fcf_yield)) fcfPairs.push([e.total, c.metrics!.fcf_yield!]);
  }
  const ey = weightedMean(eyPairs);

  // ---- warnings
  const warnings: XrayWarning[] = [];
  for (const e of exposures) {
    const routes = (e.direct > 0 ? 1 : 0) + e.via.length;
    const label = e.ticker ?? e.name;
    if (routes >= 2 && e.total >= OVERLAP_MIN_TOTAL) {
      const parts = [e.direct > 0 ? `${pct1(e.direct)} direct` : null, ...e.via.map((v) => `${pct1(v.weight)} via ${v.fund}`)].filter(Boolean);
      warnings.push({
        kind: 'overlap',
        severity: e.total >= CONCENTRATION_MIN ? 'caution' : 'info',
        message: `${label}: ${parts.join(' + ')} = ${pct1(e.total)} of your money.`,
        tickers: [label],
      });
    } else if (e.total >= CONCENTRATION_MIN) {
      warnings.push({ kind: 'concentration', severity: 'caution', message: `${label} alone is ${pct1(e.total)} of your money.`, tickers: [label] });
    }
  }
  const fundPositions = positions.filter((p) => p.kind === 'fund');
  for (let i = 0; i < fundPositions.length; i++) {
    for (let j = i + 1; j < fundPositions.length; j++) {
      const a = fundBy.get(fundPositions[i].ticker)!;
      const b = fundBy.get(fundPositions[j].ticker)!;
      const o = fundOverlap(a, b);
      if (o >= FUND_OVERLAP_MIN) {
        warnings.push({
          kind: 'fund_overlap',
          severity: 'caution',
          message: `${a.ticker} and ${b.ticker} share at least ${Math.round(o * 100)}% of their holdings — owning both adds less variety than it looks.`,
          tickers: [a.ticker, b.ticker],
        });
      }
    }
  }

  return {
    positions,
    exposures,
    unseenFundWeight: unseen,
    sectors: [...sectors.entries()].map(([sector, weight]) => ({ sector, weight })).sort((a, b) => b.weight - a.weight),
    assetMix: mix,
    lookThrough: {
      pe: ey !== null && ey > 0 ? 1 / ey : null,
      roic: weightedMean(roicPairs),
      fcfYield: weightedMean(fcfPairs),
      coverage: covered,
    },
    warnings,
  };
}
