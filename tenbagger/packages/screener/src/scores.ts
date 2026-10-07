import { getMetricInfo } from './catalog.ts';
import { getValue } from './engine.ts';
import { formatByUnit, isNum, type Unit } from './format.ts';
import type { Company, FieldKey } from './types.ts';

/**
 * Transparent, educational scores. NOT ratings.
 *
 * Each family score is the plain average of a few within-universe
 * percentiles. A percentile answers one question: "of the other companies in
 * this list that have this number, what share does this company beat?".
 * Everything is shown: the inputs, each percentile, and the formula text.
 * Change the universe and the scores change, because they are relative.
 */

export type ScoreFamilyId = 'quality' | 'value' | 'growth' | 'balance_sheet';

export interface ScoreComponentDef {
  id: string;
  label: string;
  /** Catalog key when the input is a stored metric; undefined when derived here. */
  metric?: FieldKey;
  /** Which direction ranks higher in this score. */
  better: 'higher' | 'lower';
  unit: Unit;
  /** How the input is computed, in words. */
  formula: string;
  /** Any special handling, in words. */
  note?: string;
  /** Value shown to people (null = no data). */
  read(c: Company): number | null;
  /** Value used for ranking, if different from `read` (e.g. negative D/E ranks as the most debt). */
  rankValue?(c: Company): number | null;
}

export interface ScoreFamilyInfo {
  id: ScoreFamilyId;
  label: string;
  /** What the family tries to summarize, in one sentence. */
  question: string;
  components: readonly ScoreComponentDef[];
  /** Minimum inputs with data needed to show a score. */
  minComponents: number;
  /** Full formula in words. */
  formula: string;
  /** What the score cannot see. */
  caveat: string;
}

/** D/E below zero means negative equity: rank it as the heaviest debt load, not the lightest. */
function deRank(c: Company): number | null {
  const v = getValue(c, 'debt_to_equity');
  if (v === null) return null;
  return v < 0 ? Number.MAX_VALUE : v;
}

function metricComponent(
  key: FieldKey,
  better: 'higher' | 'lower',
  extra: Partial<ScoreComponentDef> = {},
): ScoreComponentDef {
  const info = getMetricInfo(key)!;
  return {
    id: key,
    label: info.shortLabel,
    metric: key,
    better,
    unit: info.unit,
    formula: info.formula ?? info.label,
    read: (c) => getValue(c, key),
    ...extra,
  };
}

const DEBT_TO_EQUITY = metricComponent('debt_to_equity', 'lower', {
  note: 'Negative debt-to-equity (negative shareholder equity) ranks as the most debt, not the least.',
  rankValue: deRank,
});

const EBITDA_TO_EV: ScoreComponentDef = {
  id: 'ebitda_to_ev',
  label: 'EBITDA / EV',
  better: 'higher',
  unit: 'percent',
  formula: '1 / (EV/EBITDA): EV/EBITDA turned upside down, so a lower multiple ranks higher',
  note: 'Blank when EV/EBITDA is blank (EBITDA of zero or less).',
  read: (c) => {
    const v = getValue(c, 'ev_ebitda');
    return v === null || v <= 0 ? null : 1 / v;
  },
};

const NET_CASH_TO_ASSETS: ScoreComponentDef = {
  id: 'net_cash_to_assets',
  label: 'Net cash / assets',
  better: 'higher',
  unit: 'percent',
  formula: '(cash − total_debt) / total_assets',
  note: 'Scaled by total assets so a giant company does not win just for being big.',
  read: (c) => {
    const nc = getValue(c, 'net_cash') ?? (() => {
      const cash = getValue(c, 'cash');
      const debt = getValue(c, 'total_debt');
      return cash === null || debt === null ? null : cash - debt;
    })();
    const assets = getValue(c, 'total_assets');
    return nc === null || assets === null || assets <= 0 ? null : nc / assets;
  },
};

const PCT_RULE =
  'Each input’s percentile = the share of the other companies with that number that this company beats (ties count half), × 100. For inputs where lower ranks higher, the percentile is flipped (100 − percentile).';

function familyFormula(label: string, comps: readonly ScoreComponentDef[], min: number): string {
  const parts = comps.map((c) => `${c.label} (${c.better === 'higher' ? 'higher' : 'lower'} ranks higher)`);
  return `${label} = average of the percentiles of ${parts.join(', ')}. ${PCT_RULE} Needs at least ${min} of ${comps.length} inputs; missing inputs are left out of the average, not counted as zero.`;
}

function family(
  id: ScoreFamilyId,
  label: string,
  question: string,
  components: ScoreComponentDef[],
  caveat: string,
): ScoreFamilyInfo {
  const minComponents = Math.ceil(components.length / 2);
  return Object.freeze({
    id,
    label,
    question,
    components: Object.freeze(components),
    minComponents,
    formula: familyFormula(label, components, minComponents),
    caveat,
  });
}

export const SCORE_FAMILIES: readonly ScoreFamilyInfo[] = Object.freeze([
  family(
    'quality',
    'Quality',
    'How well does the business turn money into more money, without leaning on debt?',
    [metricComponent('roic', 'higher'), metricComponent('gross_margin', 'higher'), metricComponent('fcf_margin', 'higher'), DEBT_TO_EQUITY],
    'One fiscal year only. Banks often have no gross margin and naturally high debt, so their quality score leans on fewer inputs.',
  ),
  family(
    'value',
    'Value',
    'How much profit and cash does each dollar of company value come with, compared with this list?',
    [metricComponent('earnings_yield', 'higher'), metricComponent('fcf_yield', 'higher'), EBITDA_TO_EV],
    'A high value score only means the price is low relative to last year’s numbers. Prices can be low for good reasons, such as shrinking profits.',
  ),
  family(
    'growth',
    'Growth',
    'How fast have sales and earnings per share been growing, compared with this list?',
    [metricComponent('revenue_cagr_3y', 'higher'), metricComponent('eps_growth_yoy', 'higher')],
    'Past growth only. EPS growth swings wildly when last year’s profit was tiny.',
  ),
  family(
    'balance_sheet',
    'Balance sheet',
    'How much room does the company have to handle a bad year?',
    [DEBT_TO_EQUITY, metricComponent('current_ratio', 'higher'), NET_CASH_TO_ASSETS],
    'A snapshot at fiscal year end. Lenders (banks) are built on debt, so this score reads them very differently.',
  ),
]);

export const SCORE_FAMILY_IDS: readonly ScoreFamilyId[] = Object.freeze(SCORE_FAMILIES.map((f) => f.id));

export function getScoreFamily(id: string): ScoreFamilyInfo | undefined {
  return SCORE_FAMILIES.find((f) => f.id === id);
}

export interface ScoreComponent {
  id: string;
  label: string;
  metric?: FieldKey;
  better: 'higher' | 'lower';
  value: number | null;
  /** e.g. "31%", "—". */
  display: string;
  /** 0–100 (one decimal), already flipped for "lower ranks higher"; null = no data. */
  percentile: number | null;
  /** Companies with data for this input (including this one). */
  peers: number;
  formula: string;
  note?: string;
}

export interface FamilyScore {
  family: ScoreFamilyId;
  label: string;
  /** 0–100 integer, or null when fewer than `needed` inputs have data. */
  score: number | null;
  components: ScoreComponent[];
  /** Inputs with data. */
  used: number;
  needed: number;
  formula: string;
  /** e.g. "Average of 3 percentiles: 80, 64, 71 → 72". */
  working: string;
}

export interface CompanyScores {
  ticker: string;
  quality: FamilyScore;
  value: FamilyScore;
  growth: FamilyScore;
  balance_sheet: FamilyScore;
}

/**
 * Percentile of `v` within `sorted` (ascending, includes v itself):
 * (others strictly below + half of the others tied) / (n − 1) × 100.
 * A lone company gets 50.
 */
function midrankPercentile(sorted: readonly number[], v: number): number {
  const n = sorted.length;
  if (n <= 1) return 50;
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  const tiedOthers = Math.max(0, equal - 1);
  return ((below + tiedOthers / 2) / (n - 1)) * 100;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Compute all four scores for every company, relative to `companies`.
 * Pure and deterministic; output order = input order.
 */
export function scores(companies: readonly Company[]): CompanyScores[] {
  // Pre-sort each component's universe once.
  const universes = new Map<string, number[]>();
  for (const fam of SCORE_FAMILIES) {
    for (const comp of fam.components) {
      if (universes.has(comp.id)) continue;
      const vals: number[] = [];
      for (const c of companies) {
        const v = (comp.rankValue ?? comp.read)(c);
        if (isNum(v) || v === Number.MAX_VALUE) vals.push(v as number);
      }
      vals.sort((a, b) => a - b);
      universes.set(comp.id, vals);
    }
  }

  return companies.map((c) => {
    const out = { ticker: c.ticker } as CompanyScores;
    for (const fam of SCORE_FAMILIES) {
      const components: ScoreComponent[] = fam.components.map((comp) => {
        const value = comp.read(c);
        const rv = (comp.rankValue ?? comp.read)(c);
        const uni = universes.get(comp.id)!;
        let percentile: number | null = null;
        if (value !== null && rv !== null) {
          const p = midrankPercentile(uni, rv);
          percentile = round1(comp.better === 'higher' ? p : 100 - p);
        }
        const sc: ScoreComponent = {
          id: comp.id,
          label: comp.label,
          better: comp.better,
          value,
          display: formatByUnit(comp.unit, value),
          percentile,
          peers: uni.length,
          formula: comp.formula,
        };
        if (comp.metric) sc.metric = comp.metric;
        if (comp.note) sc.note = comp.note;
        return sc;
      });
      const ps = components.map((x) => x.percentile).filter((p): p is number => p !== null);
      const used = ps.length;
      const score = used >= fam.minComponents && used > 0 ? Math.round(ps.reduce((a, b) => a + b, 0) / used) : null;
      const working =
        score === null
          ? `Not enough data: ${used} of ${fam.components.length} inputs available, ${fam.minComponents} needed.`
          : `Average of ${used} percentile${used === 1 ? '' : 's'}: ${ps.map((p) => String(Math.round(p))).join(', ')} → ${score}`;
      out[fam.id] = {
        family: fam.id,
        label: fam.label,
        score: score === null ? null : Math.min(100, Math.max(0, score)),
        components,
        used,
        needed: fam.minComponents,
        formula: fam.formula,
        working,
      };
    }
    return out;
  });
}

/** Convenience: scores keyed by upper-case ticker. */
export function scoresByTicker(companies: readonly Company[]): Map<string, CompanyScores> {
  const m = new Map<string, CompanyScores>();
  for (const s of scores(companies)) m.set(s.ticker.toUpperCase(), s);
  return m;
}
