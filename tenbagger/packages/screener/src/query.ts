import { getMetricInfo, METRIC_CATALOG } from './catalog.ts';
import type { FieldKey, Filter, FilterOp } from './types.ts';

/**
 * Tiny natural-ish query language:
 *
 *   pe < 20 and roic > 15%
 *   market cap over 10b, dividend yield at least 2%
 *   debt/equity between 0 and 0.5
 *
 * - Conditions are joined by `and`, `&`, `&&`, `,` or `;` (no `or`).
 * - Metrics: contract keys (`ev_ebitda`), short labels (`EV/EBITDA`), labels, common aliases.
 * - Operators: > >= < <= = == ≥ ≤, over/above/more than/greater than/higher than,
 *   under/below/less than/lower than, at least, at most, between X and Y (inclusive).
 * - Numbers: 0.15, 15%, 1,000, $10b, 2.5m, 3 billion, 18x.
 * - Percent metrics: a bare number above 1 (e.g. `roic > 15`) is read as a
 *   percent (15%) and a warning is returned.
 */

export interface QueryIssue {
  message: string;
  /** 0-based character offset into the query. */
  position: number;
}

export interface ParseResult {
  ok: boolean;
  filters: Filter[];
  errors: QueryIssue[];
  warnings: QueryIssue[];
}

export class QueryParseError extends Error {
  readonly errors: readonly QueryIssue[];
  readonly warnings: readonly QueryIssue[];
  constructor(errors: readonly QueryIssue[], warnings: readonly QueryIssue[] = []) {
    super(errors.map((e) => e.message).join(' '));
    this.name = 'QueryParseError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

// ---------------------------------------------------------------- aliases

export function normalizeMetricName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const EXTRA_ALIASES: Record<string, FieldKey> = {
  peratio: 'pe',
  priceearnings: 'pe',
  pricetoearnings: 'pe',
  pricesales: 'ps',
  pricetosales: 'ps',
  pricebook: 'pb',
  pricetobook: 'pb',
  de: 'debt_to_equity',
  debtequity: 'debt_to_equity',
  leverage: 'debt_to_equity',
  mcap: 'market_cap',
  marketcap: 'market_cap',
  cap: 'market_cap',
  size: 'market_cap',
  ev: 'enterprise_value',
  ebitda: 'ev_ebitda',
  evtoebitda: 'ev_ebitda',
  fcf: 'free_cash_flow',
  freecashflow: 'free_cash_flow',
  yield: 'dividend_yield',
  dividend: 'dividend_yield',
  dividends: 'dividend_yield',
  divyield: 'dividend_yield',
  dy: 'dividend_yield',
  opmargin: 'operating_margin',
  ebitmargin: 'operating_margin',
  profitmargin: 'net_margin',
  margin: 'net_margin',
  growth: 'revenue_growth_yoy',
  revenuegrowth: 'revenue_growth_yoy',
  salesgrowth: 'revenue_growth_yoy',
  revgrowth: 'revenue_growth_yoy',
  earningsgrowth: 'eps_growth_yoy',
  cagr: 'revenue_cagr_3y',
  revenuecagr: 'revenue_cagr_3y',
  revcagr: 'revenue_cagr_3y',
  salescagr: 'revenue_cagr_3y',
  '3yrevenuecagr': 'revenue_cagr_3y',
  revenuecagr3y: 'revenue_cagr_3y',
  '3ygrowth': 'revenue_cagr_3y',
  sales: 'revenue',
  revenues: 'revenue',
  profit: 'net_income',
  earnings: 'net_income',
  debt: 'total_debt',
  equity: 'total_equity',
  shares: 'shares_diluted',
  cashflow: 'operating_cash_flow',
  ocf: 'operating_cash_flow',
  da: 'd_and_a',
  depreciation: 'd_and_a',
};

const ALIASES: ReadonlyMap<string, FieldKey> = (() => {
  const m = new Map<string, FieldKey>();
  const add = (alias: string, key: FieldKey) => {
    const n = normalizeMetricName(alias);
    if (n && !m.has(n)) m.set(n, key);
  };
  for (const info of METRIC_CATALOG) add(info.key, info.key);
  for (const info of METRIC_CATALOG) add(info.shortLabel, info.key);
  for (const info of METRIC_CATALOG) add(info.label, info.key);
  for (const [alias, key] of Object.entries(EXTRA_ALIASES)) add(alias, key);
  return m;
})();

/** Resolve a user-typed metric name ("P/E", "roic", "market cap") to a contract key. */
export function resolveMetric(name: string): FieldKey | undefined {
  return ALIASES.get(normalizeMetricName(name));
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Closest known metric for a typo, or undefined if nothing is reasonably close. */
export function suggestMetric(name: string): FieldKey | undefined {
  const n = normalizeMetricName(name);
  if (!n) return undefined;
  let best: { key: FieldKey; d: number; alias: string } | undefined;
  for (const [alias, key] of ALIASES) {
    const d = levenshtein(n, alias);
    if (!best || d < best.d || (d === best.d && alias.length < best.alias.length)) {
      best = { key, d, alias };
    }
  }
  if (!best) return undefined;
  const limit = Math.max(1, Math.floor(n.length / 3));
  return best.d <= limit ? best.key : undefined;
}

// ---------------------------------------------------------------- tokens

type Token =
  | { t: 'word'; text: string; pos: number }
  | { t: 'num'; value: number; pct: boolean; raw: string; pos: number }
  | { t: 'op'; op: FilterOp; raw: string; pos: number }
  | { t: 'and'; raw: string; pos: number }
  | { t: 'sep'; raw: string; pos: number };

const SYMBOL_OPS: Array<[string, FilterOp]> = [
  ['>=', '>='],
  ['=>', '>='],
  ['≥', '>='],
  ['<=', '<='],
  ['=<', '<='],
  ['≤', '<='],
  ['==', '=='],
  ['>', '>'],
  ['<', '<'],
  ['=', '=='],
];

const SCALE: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mm: 1e6,
  mn: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  t: 1e12,
  tn: 1e12,
  trillion: 1e12,
};

const NUM_RE =
  /^([-+−]?)\$?([-+−]?)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:\s*(%|percent\b)|\s*(thousand|million|billion|trillion)\b|(bn|mm|mn|tn|k|m|b|t|x)(?![a-z0-9]))?/i;
const WORD_RE = /^(?:\d+(?:y|yr|yrs|year|years)\b|[a-z][a-z0-9_/'’-]*)/i;

function tokenize(text: string, errors: QueryIssue[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const ws = /^\s+/.exec(rest);
    if (ws) {
      i += ws[0].length;
      continue;
    }
    if (rest.startsWith('&&') || rest[0] === '&') {
      const raw = rest.startsWith('&&') ? '&&' : '&';
      tokens.push({ t: 'and', raw, pos: i });
      i += raw.length;
      continue;
    }
    if (rest[0] === ',' || rest[0] === ';') {
      tokens.push({ t: 'sep', raw: rest[0], pos: i });
      i += 1;
      continue;
    }
    if (rest.startsWith('!=') || rest.startsWith('<>')) {
      errors.push({ message: '"Not equal" is not supported. Try "<" or ">" instead.', position: i });
      i += 2;
      continue;
    }
    const sym = SYMBOL_OPS.find(([s]) => rest.startsWith(s));
    if (sym) {
      tokens.push({ t: 'op', op: sym[1], raw: sym[0], pos: i });
      i += sym[0].length;
      continue;
    }
    const word = WORD_RE.exec(rest);
    // A leading digit is only a word when it is "3y"-style; numbers win otherwise.
    const num = NUM_RE.exec(rest);
    if (num && !(word && /^\d/.test(word[0]))) {
      const sign = num[1] || num[2] ? -1 : 1;
      let value = Number(num[3]!.replace(/,/g, '')) * sign;
      const pct = Boolean(num[4]);
      const scaleWord = (num[5] ?? num[6] ?? '').toLowerCase();
      if (scaleWord && scaleWord !== 'x') value *= SCALE[scaleWord] ?? 1;
      if (pct) value /= 100;
      tokens.push({ t: 'num', value, pct, raw: num[0], pos: i });
      i += num[0].length;
      continue;
    }
    if (word) {
      tokens.push({ t: 'word', text: word[0], pos: i });
      i += word[0].length;
      continue;
    }
    errors.push({ message: `Unexpected character "${rest[0]}".`, position: i });
    i += 1;
  }
  return mergeWordOps(tokens);
}

const WORD_OPS: Array<[string[], FilterOp]> = [
  [['greater', 'than', 'or', 'equal', 'to'], '>='],
  [['less', 'than', 'or', 'equal', 'to'], '<='],
  [['greater', 'than'], '>'],
  [['more', 'than'], '>'],
  [['higher', 'than'], '>'],
  [['bigger', 'than'], '>'],
  [['less', 'than'], '<'],
  [['fewer', 'than'], '<'],
  [['lower', 'than'], '<'],
  [['smaller', 'than'], '<'],
  [['at', 'least'], '>='],
  [['at', 'most'], '<='],
  [['no', 'more', 'than'], '<='],
  [['no', 'less', 'than'], '>='],
  [['over'], '>'],
  [['above'], '>'],
  [['exceeds'], '>'],
  [['under'], '<'],
  [['below'], '<'],
  [['equals'], '=='],
  [['between'], 'between'],
];

/** Collapse word sequences like "at least" into op tokens, "and" into and tokens, drop filler "is". */
function mergeWordOps(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const lower = (tok: Token | undefined) => (tok && tok.t === 'word' ? tok.text.toLowerCase() : null);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (tok.t !== 'word') {
      out.push(tok);
      continue;
    }
    const w = tok.text.toLowerCase();
    if (w === 'and') {
      out.push({ t: 'and', raw: tok.text, pos: tok.pos });
      continue;
    }
    // Longest phrase first (WORD_OPS is ordered longest-first within each prefix).
    const phrase = WORD_OPS.find(([words]) => words.every((ww, k) => lower(tokens[i + k]) === ww));
    if (phrase) {
      out.push({ t: 'op', op: phrase[1], raw: phrase[0].join(' '), pos: tok.pos });
      i += phrase[0].length - 1;
      continue;
    }
    // "is"/"are" directly before an operator is filler: "pe is under 20".
    if ((w === 'is' || w === 'are') && i + 1 < tokens.length) {
      const next = tokens[i + 1]!;
      const nextWord = lower(next);
      if (next.t === 'op' || (nextWord && WORD_OPS.some(([words]) => words[0] === nextWord))) continue;
    }
    out.push(tok);
  }
  return out;
}

// ---------------------------------------------------------------- parser

function describe(tok: Token | undefined): string {
  if (!tok) return 'the end of the query';
  switch (tok.t) {
    case 'word':
      return `"${tok.text}"`;
    case 'num':
      return `the number "${tok.raw}"`;
    default:
      return `"${tok.raw}"`;
  }
}

/** Parse without throwing. `ok` is true when there are no errors. */
export function safeParseQuery(text: string): ParseResult {
  const errors: QueryIssue[] = [];
  const warnings: QueryIssue[] = [];
  const filters: Filter[] = [];
  const tokens = tokenize(text ?? '', errors);
  let i = 0;

  const isJoin = (tok: Token | undefined) => tok !== undefined && (tok.t === 'and' || tok.t === 'sep');
  /** Skip to just after the next joiner so one bad clause doesn't hide the others. */
  const recover = () => {
    while (i < tokens.length && !isJoin(tokens[i])) i++;
  };

  const normalizeValue = (key: FieldKey, tok: Extract<Token, { t: 'num' }>): number => {
    const info = getMetricInfo(key);
    if (info?.unit === 'percent' && !tok.pct && Math.abs(tok.value) > 1) {
      warnings.push({
        message: `Read "${tok.raw}" as ${tok.raw}% for ${info.shortLabel}. Write ${tok.value / 100} or ${tok.raw}% to be explicit.`,
        position: tok.pos,
      });
      return tok.value / 100;
    }
    return tok.value;
  };

  while (i < tokens.length) {
    while (isJoin(tokens[i])) i++;
    if (i >= tokens.length) break;

    // 1. metric: one or more words
    const start = tokens[i]!;
    const words: string[] = [];
    while (i < tokens.length && tokens[i]!.t === 'word') {
      words.push((tokens[i] as Extract<Token, { t: 'word' }>).text);
      i++;
    }
    if (words.length === 0) {
      errors.push({
        message: `Expected a metric name (like "pe" or "roic") but found ${describe(start)}.`,
        position: start.pos,
      });
      i++;
      recover();
      continue;
    }
    const name = words.join(' ');
    if (words.some((w) => w.toLowerCase() === 'or')) {
      errors.push({ message: 'Only "and" is supported for combining conditions, not "or".', position: start.pos });
      recover();
      continue;
    }
    const key = resolveMetric(name);
    if (!key) {
      const guess = suggestMetric(name);
      const hint = guess ? ` Did you mean "${guess}" (${getMetricInfo(guess)?.label})?` : ' Try names like pe, roic, fcf margin or market cap.';
      errors.push({ message: `Unknown metric "${name}".${hint}`, position: start.pos });
      recover();
      continue;
    }

    // 2. operator
    const opTok = tokens[i];
    if (!opTok || opTok.t !== 'op') {
      errors.push({
        message: `Expected a comparison like ">", "<" or "between" after "${name}" but found ${describe(opTok)}.`,
        position: opTok?.pos ?? text.length,
      });
      recover();
      continue;
    }
    i++;

    // 3. value(s)
    const first = tokens[i];
    if (!first || first.t !== 'num') {
      errors.push({
        message: `Expected a number after "${opTok.raw}" but found ${describe(first)}.`,
        position: first?.pos ?? text.length,
      });
      recover();
      continue;
    }
    i++;

    if (opTok.op === 'between') {
      const joiner = tokens[i];
      const joinerOk =
        joiner !== undefined &&
        (joiner.t === 'and' || (joiner.t === 'word' && joiner.text.toLowerCase() === 'to'));
      const second = joinerOk ? tokens[i + 1] : undefined;
      if (!joinerOk || !second || second.t !== 'num') {
        errors.push({
          message: `"between" needs two numbers, like "${name} between 0.1 and 0.2".`,
          position: opTok.pos,
        });
        recover();
        continue;
      }
      i += 2;
      let lo = normalizeValue(key, first);
      let hi = normalizeValue(key, second);
      if (lo > hi) {
        warnings.push({
          message: `Swapped the bounds of "between" so the smaller number comes first.`,
          position: opTok.pos,
        });
        [lo, hi] = [hi, lo];
      }
      filters.push({ metric: key, op: 'between', value: [lo, hi] });
    } else {
      filters.push({ metric: key, op: opTok.op, value: normalizeValue(key, first) });
    }

    // 4. must be followed by a joiner or the end
    const after = tokens[i];
    if (after && !isJoin(after)) {
      errors.push({
        message: `Expected "and" between conditions but found ${describe(after)}.`,
        position: after.pos,
      });
      recover();
    }
  }

  return { ok: errors.length === 0, filters: errors.length ? [] : filters, errors, warnings };
}

/**
 * Parse a query like "pe < 20 and roic > 0.15" into contract Filters.
 * @throws QueryParseError with every problem found (and their positions).
 */
export function parseQuery(text: string): Filter[] {
  const r = safeParseQuery(text);
  if (!r.ok) throw new QueryParseError(r.errors, r.warnings);
  return r.filters;
}
