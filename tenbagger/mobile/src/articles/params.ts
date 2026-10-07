/**
 * Defensive widget param parsing for data/articles.json.
 * The content build already validated + coerced params; this layer re-checks shape at runtime so a
 * stale or hand-edited file degrades to an "unsupported widget" card instead of crashing the reader.
 */
import type { HistoryKey } from '../types/contract';
import type { Widget } from './types';

export const HISTORY_KEYS: HistoryKey[] = ['revenue', 'net_income', 'free_cash_flow', 'eps_diluted', 'gross_margin', 'operating_margin', 'total_debt', 'cash'];

type Params = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' ? String(v) : undefined);

export function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function bool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

export function tickerList(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const out: string[] = [];
  for (const x of raw) {
    const t = typeof x === 'string' ? x.trim().toUpperCase() : '';
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

const upper = (v: unknown) => str(v)?.toUpperCase();

function clampNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = num(v);
  if (n === undefined) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Turn a `{kind, params}` widget block into a typed Widget (or `unsupported` with a reason). */
export function parseWidget(kind: string, params: Params | null | undefined): Widget {
  const p: Params = params && typeof params === 'object' ? params : {};
  const caption = str(p.caption);
  const bad = (reason: string): Widget => ({ kind: 'unsupported', original: kind, reason });
  switch (kind) {
    case 'metric': {
      const ticker = upper(p.ticker);
      const metric = str(p.metric);
      if (!ticker || !metric) return bad('metric needs ticker and metric');
      return { kind: 'metric', ticker, metric, caption };
    }
    case 'compare': {
      const tickers = tickerList(p.tickers);
      const metric = str(p.metric);
      if (tickers.length < 2 || !metric) return bad('compare needs 2+ tickers and a metric');
      return { kind: 'compare', tickers: tickers.slice(0, 6), metric, caption };
    }
    case 'history': {
      const ticker = upper(p.ticker);
      const metric = str(p.metric) as HistoryKey | undefined;
      if (!ticker || !metric || !HISTORY_KEYS.includes(metric)) return bad('history needs ticker and a history metric');
      return { kind: 'history', ticker, metric, average: bool(p.average), caption };
    }
    case 'quiz': {
      const lesson = str(p.lesson);
      if (!lesson) return bad('quiz needs a lesson id');
      return { kind: 'quiz', lesson, caption };
    }
    case 'calculator': {
      const calc = str(p.kind);
      const ticker = upper(p.ticker);
      if (calc === 'pe') {
        const price = num(p.price);
        const eps = num(p.eps);
        if (!ticker && (price === undefined || eps === undefined)) return bad('P/E calculator needs ticker or price+eps');
        return { kind: 'calc_pe', ticker, price, eps, requiredReturn: clampNum(p.required_return, 0.09, 0.01, 0.3), caption };
      }
      if (calc === 'dcf') {
        const fcf = num(p.fcf);
        if (!ticker && fcf === undefined) return bad('DCF calculator needs ticker or fcf');
        return {
          kind: 'calc_dcf',
          ticker,
          fcf,
          growth: clampNum(p.growth, 0.05, -0.2, 0.4),
          discount: clampNum(p.discount, 0.09, 0.04, 0.2),
          terminal: clampNum(p.terminal, 15, 1, 40),
          years: Math.round(clampNum(p.years, 5, 1, 15)),
          netCash: num(p.net_cash),
          shares: num(p.shares),
          normalizedFcf: num(p.normalized_fcf),
          cyclical: bool(p.cyclical),
          caption,
        };
      }
      if (calc === 'liquidity') {
        return { kind: 'calc_liquidity', cash: clampNum(p.cash, 3000, 0, 1e9), card: clampNum(p.card, 1500, 0, 1e9), caption };
      }
      return bad(`unknown calculator kind "${calc ?? ''}"`);
    }
    default:
      return bad(`unknown widget "${kind}"`);
  }
}
