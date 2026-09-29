/**
 * Fund data layer. Reads tenbagger/data/funds.json (built by `python -m funds build`).
 * Malformed entries are dropped rather than crashing the app.
 */
import fundsJson from '../../../data/funds.json';
import type { Allocation, Fund, FundHolding, FundsFile, LookThrough } from './types';

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

function normAllocation(a: unknown): Allocation | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  return { stock: num(o.stock) ?? 0, bond: num(o.bond) ?? 0, cash: num(o.cash) ?? 0, commodity: num(o.commodity) ?? 0, other: num(o.other) ?? 0 };
}

function normLookThrough(l: unknown): LookThrough {
  const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
  return {
    weighted_pe: num(o.weighted_pe),
    weighted_fcf_yield: num(o.weighted_fcf_yield),
    weighted_roic: num(o.weighted_roic),
    coverage_pct: num(o.coverage_pct) ?? 0,
  };
}

export function normalizeFunds(raw: unknown): FundsFile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.funds) ? r.funds : [];
  const funds: Fund[] = [];
  for (const f of list) {
    if (!f || typeof f !== 'object') continue;
    const o = f as Record<string, unknown>;
    const ticker = str(o.ticker);
    if (!ticker) continue;
    const holdings: FundHolding[] = (Array.isArray(o.top_holdings) ? o.top_holdings : [])
      .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && !!str((h as Record<string, unknown>).name))
      .map((h) => ({ name: String(h.name), ticker: str(h.ticker)?.toUpperCase() ?? null, weight: num(h.weight), mapped: h.mapped === true }));
    const sw: Record<string, number | null> = {};
    if (o.sector_weights && typeof o.sector_weights === 'object') {
      for (const [k, v] of Object.entries(o.sector_weights as Record<string, unknown>)) sw[k] = num(v);
    }
    funds.push({
      ticker: ticker.toUpperCase(),
      name: str(o.name) ?? ticker,
      issuer: str(o.issuer) ?? '',
      category: str(o.category) ?? 'Fund',
      expense_ratio: num(o.expense_ratio),
      total_net_assets: num(o.total_net_assets),
      as_of: str(o.as_of),
      holdings_count: num(o.holdings_count),
      top_holdings: holdings,
      allocation: normAllocation(o.allocation),
      sector_weights: sw,
      look_through: normLookThrough(o.look_through),
      is_sample: o.is_sample !== false,
      note: str(o.note),
      sources: Array.isArray(o.sources) ? (o.sources as FundsFile['funds'][number]['sources']) : [],
    });
  }
  return {
    schema_version: num(r.schema_version) ?? 1,
    generated_at: str(r.generated_at) ?? '',
    source: str(r.source) ?? 'fixture',
    funds,
  };
}

const file = normalizeFunds(fundsJson as unknown);
const byTicker = new Map(file.funds.map((f) => [f.ticker, f]));

export function getFunds(): Fund[] {
  return file.funds;
}

export function getFund(ticker: string): Fund | undefined {
  return byTicker.get(ticker.toUpperCase());
}

export const fundsInfo = { source: file.source, generatedAt: file.generated_at };
