// Ticker / identifier hygiene shared by all provider normalizers.

const SHARE_CLASS = /^([A-Z]{1,6})[./ ]([A-Z])$/; // BRK.B, BRK/B, BRK B -> BRK-B (SEC/companies.json style)
const VALID_TICKER = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/;

/** Uppercase, trim, unify share-class separators. Returns null for blanks / garbage / cash pseudo-tickers. */
export function normalizeTicker(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let t = raw.trim().toUpperCase();
  if (!t) return null;
  if (t.startsWith("CUR:")) return null; // Plaid cash pseudo-ticker, e.g. CUR:USD
  const m = SHARE_CLASS.exec(t);
  if (m) t = `${m[1]}-${m[2]}`;
  return VALID_TICKER.test(t) ? t : null;
}

export function validCusip(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return /^[0-9A-Z]{9}$/.test(c) ? c : null;
}

export function validIsin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}[0-9A-Z]{10}$/.test(c) ? c : null;
}

/** Strip float noise (e.g. 0.1+0.2) without losing cents or fractional shares. */
export function clean(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function num(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x))) return Number(x);
  return null;
}
