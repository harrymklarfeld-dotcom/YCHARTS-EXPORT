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
  // Credit / lending offers: the dashboard never offers or suggests borrowing products.
  /\bcash\s+advances?\b/i,
  /\bpayday\s+loans?\b/i,
  /\bpre-?approved\b/i,
  /\bapply\s+(now|today|for)\b/i,
  /\b(credit\s+)?limit\s+increase\b/i,
  /\bbalance\s+transfer\b/i,
  /\b(open|get)\s+a\s+(new\s+)?(credit\s+)?card\b/i,
  // Product picks.
  /\bbest\s+(stock|fund|etf|card|app)s?\b/i,
  /\btop\s+picks?\b/i,
];

export function findBannedPhrases(text: string): string[] {
  return BANNED_PHRASES.filter((re) => re.test(text)).map((re) => re.source);
}

export function isEducational(text: string): boolean {
  return findBannedPhrases(text).length === 0;
}
