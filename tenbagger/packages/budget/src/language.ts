/**
 * Voice guard for everything the budget engine writes. Reuses the Money hub's banned list
 * (no buy/sell/hold, no "you should", no lending offers, no product picks) and adds a few
 * budget-specific ones. Insights present OPTIONS with the math; the user decides.
 */
import { MONEY_BANNED_PHRASES } from './money.ts';

export const BUDGET_BANNED_PHRASES: readonly RegExp[] = [
  ...MONEY_BANNED_PHRASES,
  /\bborrow(ing)?\b/i,
  /\boverdraft\s+protection\b/i,
  /\bsign\s+up\s+(for|now)\b/i,
  /\bearly\s+(wage|pay)\s+access\b/i,
  /\bget\s+paid\s+early\b/i,
  /\bsponsored\b/i,
  /\bpartner\s+offer\b/i,
  /\bwe\s+suggest\b/i,
  /\bshould\b/i,
  /\bwasting\b/i,
  /\birresponsible\b/i,
  /\bbad\s+with\s+money\b/i,
];

export function findBudgetBannedPhrases(text: string): string[] {
  return BUDGET_BANNED_PHRASES.filter((re) => re.test(text)).map((re) => re.source);
}

export function isBudgetVoice(text: string): boolean {
  return findBudgetBannedPhrases(text).length === 0;
}
