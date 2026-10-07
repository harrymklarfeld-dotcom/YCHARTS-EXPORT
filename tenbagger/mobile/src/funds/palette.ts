/**
 * Categorical series colours for fund/compare charts. Fixed order, never cycled.
 * Validated with the dataviz palette checker (lightness band, chroma, CVD, contrast)
 * against the app's light surface and dark surface (#151E30). Lines also differ by dash
 * pattern and carry direct end labels, so identity never relies on colour alone.
 */
export const SERIES_LIGHT = ['#0B7A57', '#B5721A', '#4A5FC1', '#B04E6E'] as const;
export const SERIES_DARK = ['#1FA876', '#B87D20', '#6F86E0', '#D0648A'] as const;
/** "Other" / unclassified buckets fold to a neutral. */
export const NEUTRAL_LIGHT = '#9AA1AC';
export const NEUTRAL_DARK = '#5A6478';
export const DASHES = [undefined, '7 4', '2 4', '10 3 2 3'] as const;

export function seriesColors(dark: boolean): readonly string[] {
  return dark ? SERIES_DARK : SERIES_LIGHT;
}
export function neutral(dark: boolean): string {
  return dark ? NEUTRAL_DARK : NEUTRAL_LIGHT;
}
