/**
 * Educational-voice guard. Everything the engine writes describes; it never tells the user
 * what to buy, sell or do. Tests scan every generated sentence with `findBannedPhrases`.
 */
export const BANNED_PHRASES: readonly RegExp[] = [
  /\bbuy(s|ing)?\b/i,
  /\bsell(s|ing)?\b/i,
  /\bhold\b/i,
  /\byou\s+should\b/i,
  /\byou\s+must\b/i,
  /\bshould\s+(pay|invest|move|transfer|open|close|cut)\b/i,
  /\brecommend(s|ed|ation|ations)?\b/i,
  /\bguarantee(s|d)?\b/i,
  /\bprice\s+targets?\b/i,
  /\binvest\s+in\b/i,
];

export function findBannedPhrases(text: string): string[] {
  return BANNED_PHRASES.filter((re) => re.test(text)).map((re) => re.source);
}

export function isEducational(text: string): boolean {
  return findBannedPhrases(text).length === 0;
}
