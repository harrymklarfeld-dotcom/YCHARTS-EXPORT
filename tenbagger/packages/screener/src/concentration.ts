import type { Company } from './types.ts';

/**
 * A short teaching note shown when most results come from one sector.
 * `lessonId` points at a lesson in `tenbagger/data/lessons.json`
 * (`units[].lessons[].id`). The app should check the id exists and hide the
 * link if it does not.
 */
export interface SectorNote {
  /** One or two sentences. `{share}` and `{sector}` are filled in by `concentration`. */
  text: string;
  lessonId: string;
  /** Link text, e.g. "Learn why". */
  linkLabel: string;
}

/**
 * Sector-specific notes: what changes about the usual ratios in that sector.
 * Generic and data-driven: they describe how the metrics behave, never whether
 * the companies are worth owning.
 */
export const SECTOR_NOTES: Readonly<Record<string, SectorNote>> = Object.freeze({
  financials: {
    text: 'Most matches ({share}) are banks and other financial companies. P/E and P/B work differently for lenders: borrowing is their raw material, so debt-to-equity looks high and gross margin is often blank.',
    lessonId: 'u6-l4',
    linkLabel: 'Learn why',
  },
  'real estate': {
    text: 'Most matches ({share}) are real estate companies. Property owners carry a lot of debt and large depreciation charges, so net income and P/E can understate the cash they produce.',
    lessonId: 'u4-l1',
    linkLabel: 'Learn why',
  },
  utilities: {
    text: 'Most matches ({share}) are utilities. Regulated utilities fund power plants and grids with steady borrowing, so their debt-to-equity is usually higher than in other sectors.',
    lessonId: 'u5-l3',
    linkLabel: 'Learn why',
  },
  energy: {
    text: 'Most matches ({share}) are energy companies. Their profits rise and fall with oil and gas prices, so one year of P/E or margins can look very different from the next.',
    lessonId: 'u8-l4',
    linkLabel: 'Learn why',
  },
  materials: {
    text: 'Most matches ({share}) are materials companies. Commodity prices swing their profits, so a single year of P/E can mislead.',
    lessonId: 'u8-l4',
    linkLabel: 'Learn why',
  },
  technology: {
    text: 'Most matches ({share}) are technology companies. Software and chip makers often have very high gross margins, so compare them with each other before comparing them with, say, grocers.',
    lessonId: 'u2-l1',
    linkLabel: 'Learn why',
  },
  'consumer staples': {
    text: 'Most matches ({share}) are consumer staples companies. Grocers and household-goods makers often run thin margins on huge sales, so margin screens treat them very differently from software.',
    lessonId: 'u2-l4',
    linkLabel: 'Learn why',
  },
  'health care': {
    text: 'Most matches ({share}) are health care companies. Heavy research spending can push profits below zero for years, which leaves P/E blank.',
    lessonId: 'u3-l1',
    linkLabel: 'Learn why',
  },
});

/** Used for any sector without a specific note. */
export const GENERIC_SECTOR_NOTE: SectorNote = Object.freeze({
  text: 'Most matches ({share}) come from one sector: {sector}. What counts as a “normal” ratio differs a lot between industries, so compare these companies with each other first.',
  lessonId: 'u7-l2',
  linkLabel: 'Learn why',
});

export interface SectorShare {
  sector: string;
  count: number;
  /** 0–1. */
  share: number;
}

export interface ConcentrationOutput {
  total: number;
  /** Sorted by count desc, then sector name asc. */
  groups: SectorShare[];
  top: SectorShare | null;
  /** true when top.share > threshold and total >= minResults. */
  isConcentrated: boolean;
  threshold: number;
  /** Filled-in note when concentrated; otherwise null. */
  note: (SectorNote & { sector: string }) | null;
}

export interface ConcentrationOptions {
  /** Share (0–1) the top sector must EXCEED. Default 0.6. */
  threshold?: number;
  /** Fewer results than this are never "concentrated" (2 of 2 is not a pattern). Default 3. */
  minResults?: number;
}

type Row = Company | { company: Company };

function sectorOf(r: Row): string {
  const c = 'company' in r ? r.company : r;
  const s = (c.sector ?? '').trim();
  return s || 'Unknown';
}

function pctText(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/**
 * How concentrated a result set is by sector. Accepts companies or
 * `runScreen` results.
 */
export function concentration(results: readonly Row[], opts: ConcentrationOptions = {}): ConcentrationOutput {
  const threshold = opts.threshold ?? 0.6;
  const minResults = opts.minResults ?? 3;
  const counts = new Map<string, number>();
  for (const r of results) {
    const s = sectorOf(r);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const total = results.length;
  const groups: SectorShare[] = [...counts.entries()]
    .map(([sector, count]) => ({ sector, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || (a.sector < b.sector ? -1 : a.sector > b.sector ? 1 : 0));
  const top = groups[0] ?? null;
  const isConcentrated = !!top && total >= minResults && top.share > threshold && top.sector !== 'Unknown';
  let note: ConcentrationOutput['note'] = null;
  if (isConcentrated && top) {
    const base = SECTOR_NOTES[top.sector.toLowerCase()] ?? GENERIC_SECTOR_NOTE;
    note = {
      ...base,
      sector: top.sector,
      text: base.text.replace('{share}', pctText(top.share)).replace('{sector}', top.sector),
    };
  }
  return { total, groups, top, isConcentrated, threshold, note };
}
