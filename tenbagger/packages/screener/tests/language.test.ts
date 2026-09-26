import { describe, expect, it } from 'vitest';
import { METRIC_CATALOG, PRESET_SCREENS } from '../src/index.ts';

// Educational only: no trading calls, no targets. Matches whole words, so
// "buyback" or "shareholders" are not flagged — but we avoid them anyway.
const BANNED = [
  /\bbuy(s|ing)?\b/i,
  /\bsell(s|ing)?\b/i,
  /\bstrong\s+buy\b/i,
  /\bprice\s+targets?\b/i,
  /\b(hold|buy|sell)\s+rating\b/i,
  /\brecommend(s|ed|ation)?\b/i,
  /\bguarantee(s|d)?\s+(returns?|profits?)\b/i,
  /\bundervalued\b/i,
  /\bmust[- ]own\b/i,
];

function allText(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of METRIC_CATALOG) {
    out.push([`catalog.${m.key}.label`, m.label]);
    out.push([`catalog.${m.key}.shortLabel`, m.shortLabel]);
    out.push([`catalog.${m.key}.explainer`, m.explainer]);
  }
  for (const p of PRESET_SCREENS) {
    out.push([`preset.${p.id}.name`, p.name]);
    out.push([`preset.${p.id}.description`, p.description]);
    out.push([`preset.${p.id}.caveat`, p.caveat]);
  }
  return out;
}

describe('no banned phrases', () => {
  it('catalog and presets contain no buy/sell/price-target language', () => {
    const hits: string[] = [];
    for (const [where, text] of allText()) {
      for (const re of BANNED) if (re.test(text)) hits.push(`${where}: ${re} in "${text}"`);
    }
    expect(hits).toEqual([]);
  });

  it('the checker itself catches banned phrases', () => {
    const sample = ['Strong Buy!', 'We sell here', 'price target of $50', 'Buying now'];
    for (const s of sample) expect(BANNED.some((re) => re.test(s)), s).toBe(true);
    expect(BANNED.some((re) => re.test('shareholders get buybacks'))).toBe(false);
  });
});
