/**
 * Shared "no advice" language guard. Everything user-facing the screener produces
 * (preset copy, score explanations, style labels, concentration notes, the
 * "Ask the screener" restatement) must pass `findBannedPhrases(text) === []`.
 *
 * The list covers trading calls (buy/sell/hold), price targets, and rating
 * labels (Attractive, Avoid, Outperform, Overweight, top pick, …) — scores in
 * this package are educational percentiles, never ratings.
 */
export const BANNED_PHRASES: readonly RegExp[] = Object.freeze([
  /\bbuy(s|ing)?\b/i,
  /\bsell(s|ing)?\b/i,
  /\bhold\s+(rating|it|them|this|these)\b/i,
  /\bstrong\s+(buy|sell)\b/i,
  /\bprice\s+targets?\b/i,
  /\b(hold|buy|sell)\s+rating\b/i,
  /\brecommend(s|ed|ation|ations)?\b/i,
  /\bguarantee(s|d)?\s+(returns?|profits?|gains?)\b/i,
  /\bundervalued\b/i,
  /\bovervalued\b/i,
  /\bmust[- ]own\b/i,
  /\battractive\b/i,
  /\bavoid\b/i,
  /\b(out|under)perform(s|ing|er)?\b/i,
  /\b(over|under|equal)[- ]?weight\b/i,
  /\btop\s+picks?\b/i,
  /\bbargains?\b/i,
  /\bsure\s+thing\b/i,
  /\bstar\s+rating\b/i,
]);

/** Returns the patterns (as strings) that match `text`; empty = clean. */
export function findBannedPhrases(text: string): string[] {
  const hits: string[] = [];
  for (const re of BANNED_PHRASES) if (re.test(text)) hits.push(String(re));
  return hits;
}

export function isCleanLanguage(text: string): boolean {
  return findBannedPhrases(text).length === 0;
}
