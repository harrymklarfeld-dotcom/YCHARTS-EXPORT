import { getMetricInfo } from './catalog.ts';
import { describeCondition, getValue, ScreenError, testValue, validateScreen } from './engine.ts';
import type { Company, Filter, Screen } from './types.ts';

export interface FunnelStep {
  /** 0-based position of the filter in the screen. */
  index: number;
  filter: Filter;
  /** e.g. "P/E < 25x". */
  label: string;
  /** Companies still in the funnel before this filter. */
  before: number;
  /** Companies left after this filter (cumulative: all filters up to and including this one). */
  after: number;
  /** before − after. */
  removed: number;
  /** Of `removed`, how many had no data for this metric (rather than failing the test). */
  removedForMissingData: number;
}

export interface FunnelOutput {
  /** Companies considered. */
  start: number;
  steps: FunnelStep[];
  /** Same as `runScreen(...).results.length`. */
  final: number;
  /** The step that removed the most companies (first one wins ties); null with no filters or no removals. */
  biggestCut: FunnelStep | null;
}

/**
 * Apply a screen's filters one at a time, in order, and count how many
 * companies survive each step. Pure; does not sort.
 *
 * The order matters for the per-step numbers (not for the final count): the
 * same filter removes fewer companies when it runs after a stricter one.
 *
 * @throws ScreenError if the screen is malformed.
 */
export function funnel(companies: readonly Company[], screen: Screen | readonly Filter[]): FunnelOutput {
  const s: Screen = Array.isArray(screen)
    ? { id: 'funnel', name: 'funnel', description: '', filters: [...screen] }
    : (screen as Screen);
  const issues = validateScreen(s);
  if (issues.length) throw new ScreenError(issues);

  let remaining: readonly Company[] = companies;
  const steps: FunnelStep[] = [];
  s.filters.forEach((filter, index) => {
    const before = remaining.length;
    let missing = 0;
    const next: Company[] = [];
    for (const c of remaining) {
      const v = getValue(c, filter.metric);
      if (v === null) missing++;
      else if (testValue(v, filter)) next.push(c);
    }
    const info = getMetricInfo(filter.metric);
    steps.push({
      index,
      filter,
      label: `${info?.shortLabel ?? filter.metric} ${describeCondition(filter)}`,
      before,
      after: next.length,
      removed: before - next.length,
      removedForMissingData: missing,
    });
    remaining = next;
  });

  let biggestCut: FunnelStep | null = null;
  for (const st of steps) if (st.removed > 0 && (!biggestCut || st.removed > biggestCut.removed)) biggestCut = st;

  return { start: companies.length, steps, final: remaining.length, biggestCut };
}
