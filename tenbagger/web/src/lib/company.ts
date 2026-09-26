/**
 * Plain-English sentences about a company, built only from companies.json.
 * Descriptive, never advice: no "buy", "sell", "undervalued", or targets.
 */
import {
  compareToPeers,
  formatMultiple,
  formatPercent,
  formatRatio,
  formatUsd,
  getMetricInfo,
  type Company,
  type FieldKey,
} from '../../../packages/screener/src/index.ts';
import { shortName } from './data.ts';

export { formatMultiple, formatPercent, formatRatio, formatUsd, getMetricInfo };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 0.128 → "12.8 cents" */
export function cents(ratio: number): string {
  const c = Math.abs(ratio * 100);
  const s = c >= 10 ? c.toFixed(1) : c.toFixed(1);
  return `${s.replace(/\.0$/, '')} ${c === 1 ? 'cent' : 'cents'}`;
}

export function fmt(key: string, v: number | null | undefined): string {
  const info = getMetricInfo(key);
  return info ? info.format(v) : isNum(v) ? String(v) : '—';
}

export type Sentence = { label: string; text: string; metric?: string };

export function breakdown(c: Company): Sentence[] {
  const n = shortName(c.name);
  const f = c.fundamentals;
  const m = c.metrics;
  const fy = `FY${c.latest_fy}`;
  const out: Sentence[] = [];

  if (isNum(f.revenue)) {
    const g = isNum(m.revenue_growth_yoy)
      ? `, ${m.revenue_growth_yoy >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(m.revenue_growth_yoy))} from the year before`
      : '';
    out.push({ label: 'Sales', metric: 'revenue', text: `In ${fy}, ${n} brought in ${formatUsd(f.revenue)} of revenue${g}.` });
  }
  if (isNum(m.gross_margin)) {
    out.push({
      label: 'After the cost of what it sells',
      metric: 'gross_margin',
      text: `${n} keeps ${cents(m.gross_margin)} of every sales dollar after paying for the products it sells (a ${formatPercent(m.gross_margin)} gross margin).`,
    });
  }
  if (isNum(m.operating_margin)) {
    out.push({
      label: 'After running the business',
      metric: 'operating_margin',
      text: `After paying staff, rent, research and marketing, ${cents(m.operating_margin)} of each dollar ${m.operating_margin >= 0 ? 'is left' : 'is lost'} as operating profit.`,
    });
  }
  if (isNum(m.net_margin)) {
    out.push({
      label: 'The bottom line',
      metric: 'net_margin',
      text:
        m.net_margin >= 0
          ? `After interest and taxes, ${cents(m.net_margin)} of every sales dollar ends up as profit for shareholders (${formatUsd(f.net_income)} in total).`
          : `After interest and taxes, ${n} lost ${cents(m.net_margin)} on every sales dollar (${formatUsd(f.net_income)} in total).`,
    });
  }
  if (isNum(f.free_cash_flow)) {
    const fcfm = isNum(m.fcf_margin) ? ` — ${cents(m.fcf_margin)} per sales dollar` : '';
    out.push({
      label: 'Cash it could hand out',
      metric: 'free_cash_flow',
      text:
        f.free_cash_flow >= 0
          ? `Operations produced ${formatUsd(f.operating_cash_flow)} of cash; after ${formatUsd(f.capex)} spent on equipment and buildings, ${formatUsd(f.free_cash_flow)} of free cash flow was left${fcfm}.`
          : `Spending on equipment and buildings (${formatUsd(f.capex)}) was more than the ${formatUsd(f.operating_cash_flow)} operations brought in, so free cash flow was ${formatUsd(f.free_cash_flow)}.`,
    });
  }
  if (isNum(f.cash) && isNum(f.total_debt)) {
    const net = f.cash - f.total_debt;
    out.push({
      label: 'Cash vs. debt',
      metric: 'net_cash',
      text:
        net >= 0
          ? `It holds ${formatUsd(f.cash)} of cash against ${formatUsd(f.total_debt)} of debt, so it has ${formatUsd(net)} more cash than debt.`
          : `It holds ${formatUsd(f.cash)} of cash against ${formatUsd(f.total_debt)} of debt: ${formatUsd(-net)} more debt than cash.`,
    });
  }
  if (isNum(m.current_ratio)) {
    out.push({
      label: 'Bills due this year',
      metric: 'current_ratio',
      text: `For every $1 of bills due within a year, it has $${formatRatio(m.current_ratio)} of cash and other short-term assets.`,
    });
  }
  if (isNum(m.roic)) {
    out.push({
      label: 'Return on the money invested',
      metric: 'roic',
      text: `Each $1 invested in the business (debt plus equity, minus spare cash) earned about ${cents(m.roic)} of after-tax operating profit last year.`,
    });
  } else if (isNum(m.roe)) {
    out.push({
      label: 'Return on shareholders’ money',
      metric: 'roe',
      text: `Each $1 of shareholders’ equity earned ${cents(m.roe)} of profit last year.`,
    });
  }
  if (isNum(m.pe)) {
    out.push({
      label: 'What the market pays',
      metric: 'pe',
      text: `At a share price of $${formatRatio(c.price)}${c.price_is_sample ? ' (sample)' : ''}, investors pay ${formatMultiple(m.pe)} its yearly earnings per share — about $${Math.round(m.pe)} for each $1 of profit.`,
    });
  }
  return out;
}

/** Metrics shown as cards on company pages, grouped. */
export const KEY_METRICS: Array<{ group: string; keys: FieldKey[] }> = [
  { group: 'Profitability', keys: ['gross_margin', 'operating_margin', 'net_margin', 'fcf_margin'] },
  { group: 'Returns', keys: ['roic', 'roe', 'roa'] },
  { group: 'Growth', keys: ['revenue_growth_yoy', 'revenue_cagr_3y', 'eps_growth_yoy'] },
  { group: 'Financial health', keys: ['net_cash', 'debt_to_equity', 'current_ratio'] },
  { group: 'Valuation (uses price)', keys: ['market_cap', 'pe', 'ps', 'ev_ebitda', 'fcf_yield', 'dividend_yield'] },
];

export function peerSentence(all: Company[], key: FieldKey, ticker: string): string | null {
  try {
    const r = compareToPeers(all, key, ticker);
    return r?.sentence ?? null;
  } catch {
    return null;
  }
}

/** Rank position of a company on a metric across all companies (1 = highest). */
export function rankOf(all: Company[], key: FieldKey, ticker: string): { rank: number; of: number } | null {
  const get = (c: Company) => ((c.metrics as Record<string, unknown>)[key] ?? (c.fundamentals as Record<string, unknown>)[key]) as number | null;
  const vals = all.filter((c) => isNum(get(c)));
  const me = vals.find((c) => c.ticker === ticker);
  if (!me) return null;
  const sorted = [...vals].sort((a, b) => (get(b) as number) - (get(a) as number));
  return { rank: sorted.indexOf(me) + 1, of: sorted.length };
}
