/**
 * Internal transfers: money moving between two of the user's OWN accounts (Chase checking →
 * Ally savings, checking → Discover card payment, checking → Robinhood).
 *
 * With every account linked, each such move shows up twice: an outflow in one account and an
 * inflow in another. Counted naively it looks like spending AND income. `matchTransfers` pairs
 * the two legs so spending / income totals can skip both (pass the result as
 * `CategorizeOptions.transfers`).
 *
 * Rules (descriptive only, nothing here suggests moving money):
 * - Both legs must exist: an outflow in account A and an inflow in a DIFFERENT account B, both
 *   in the `accounts` list (the user's own), same absolute amount to the cent, dated at most
 *   `windowDays` days apart (default 4, inclusive; either order, since banks post each side on
 *   their own schedule).
 * - One-to-one, greedy: candidate pairs sorted by smallest date gap, then earliest outflow date,
 *   then earliest inflow date, then ids (deterministic).
 * - A provider hint (`category` holding a Plaid personal_finance_category primary of
 *   TRANSFER_IN / TRANSFER_OUT / LOAN_PAYMENTS, see backend `transactions.category`) or a
 *   transfer-like name/category ("transfer to", "payment thank you", …) only marks a leg as
 *   transfer-like; it never creates a pair on its own. By default (`requireSignal`) a pair also
 *   needs at least one transfer-like leg OR a card/loan payment shape (asset account → card or
 *   loan), so two unrelated $20 transactions on nearby days are not merged.
 * - Unmatched legs (e.g. a transfer to a friend or to an account that is not linked) are left
 *   alone and keep their normal category.
 */
import { diffDays } from './dates.ts';
import { round2 } from './format.ts';
import { categorize, type CategorizeOptions } from './transactions.ts';
import type { Account, ISODate, Transaction } from './types.ts';

export type TransferKind = 'transfer' | 'card_payment' | 'loan_payment';

export type TransferPair = {
  outflowId: string;
  inflowId: string;
  fromAccountId: string;
  toAccountId: string;
  /** Positive dollars moved. */
  amount: number;
  outflowDate: ISODate;
  inflowDate: ISODate;
  /** inflowDate − outflowDate in days (negative when the receiving bank posted first). */
  lagDays: number;
  kind: TransferKind;
  /** At least one leg carried a provider or name hint. */
  hinted: boolean;
};

export type TransferMatch = {
  pairs: TransferPair[];
  /** Ids of every transaction that is one leg of a pair. */
  matchedIds: Set<string>;
  /** Leg id → pair kind (both legs of a pair share it). */
  kindById: Map<string, TransferKind>;
};

export type MatchTransfersOptions = CategorizeOptions & {
  /** Max days from outflow to inflow, inclusive. Default 4. */
  windowDays?: number;
  /** Require a transfer-like leg or a card/loan payment shape. Default true. */
  requireSignal?: boolean;
};

/** Plaid personal_finance_category primaries that describe money moving between accounts. */
export const TRANSFER_HINT_CATEGORIES: readonly string[] = ['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS'];

const TRANSFER_WORDS = /\b(transfer|xfer|e-?payment|online payment|payment thank you|autopay|card payment|deposit from|withdrawal to)\b/i;

/** A provider hint or a transfer-like name/category on this leg (never enough to pair on its own). */
export function isTransferHint(tx: Transaction, opts: CategorizeOptions = {}): boolean {
  if (tx.category && TRANSFER_HINT_CATEGORIES.includes(tx.category.toUpperCase())) return true;
  if (TRANSFER_WORDS.test(tx.name)) return true;
  const { transfers: _ignored, ...plain } = opts;
  const c = categorize(tx, plain);
  return c === 'transfer' || c === 'card_payment';
}

const cents = (x: number) => Math.round(Math.abs(x) * 100);
const ASSET_KINDS = new Set<Account['kind']>(['checking', 'savings', 'brokerage', 'retirement', 'crypto']);

function kindFor(to: Account['kind']): TransferKind {
  if (to === 'credit_card') return 'card_payment';
  if (to === 'loan') return 'loan_payment';
  return 'transfer';
}

/** Pair the two legs of transfers between the user's own accounts. See the file header for rules. */
export function matchTransfers(
  transactions: readonly Transaction[],
  accounts: readonly Pick<Account, 'id' | 'kind'>[],
  opts: MatchTransfersOptions = {},
): TransferMatch {
  const windowDays = opts.windowDays ?? 4;
  const requireSignal = opts.requireSignal ?? true;
  const kindOf = new Map(accounts.map((a) => [a.id, a.kind] as const));
  const own = transactions.filter((t) => kindOf.has(t.accountId) && t.amount !== 0 && Number.isFinite(t.amount));
  const outs = own.filter((t) => t.amount < 0);
  const ins = new Map<number, Transaction[]>();
  for (const t of own) if (t.amount > 0) ins.set(cents(t.amount), [...(ins.get(cents(t.amount)) ?? []), t]);

  const hintCache = new Map<string, boolean>();
  const hint = (t: Transaction) => {
    let h = hintCache.get(t.id);
    if (h === undefined) hintCache.set(t.id, (h = isTransferHint(t, opts)));
    return h;
  };

  type Cand = { out: Transaction; inn: Transaction; gap: number; lag: number; kind: TransferKind; hinted: boolean };
  const cands: Cand[] = [];
  for (const out of outs) {
    for (const inn of ins.get(cents(out.amount)) ?? []) {
      if (inn.accountId === out.accountId) continue;
      const lag = diffDays(out.date, inn.date);
      if (Math.abs(lag) > windowDays) continue;
      const fromKind = kindOf.get(out.accountId)!;
      const toKind = kindOf.get(inn.accountId)!;
      const kind = kindFor(toKind);
      const hinted = hint(out) || hint(inn);
      const paymentShape = kind !== 'transfer' && ASSET_KINDS.has(fromKind);
      if (requireSignal && !hinted && !paymentShape) continue;
      cands.push({ out, inn, gap: Math.abs(lag), lag, kind, hinted });
    }
  }
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  cands.sort(
    (a, b) =>
      a.gap - b.gap ||
      cmp(a.out.date, b.out.date) ||
      cmp(a.inn.date, b.inn.date) ||
      cmp(a.out.id, b.out.id) ||
      cmp(a.inn.id, b.inn.id),
  );

  const pairs: TransferPair[] = [];
  const matchedIds = new Set<string>();
  const kindById = new Map<string, TransferKind>();
  for (const c of cands) {
    if (matchedIds.has(c.out.id) || matchedIds.has(c.inn.id)) continue;
    matchedIds.add(c.out.id);
    matchedIds.add(c.inn.id);
    kindById.set(c.out.id, c.kind);
    kindById.set(c.inn.id, c.kind);
    pairs.push({
      outflowId: c.out.id,
      inflowId: c.inn.id,
      fromAccountId: c.out.accountId,
      toAccountId: c.inn.accountId,
      amount: round2(Math.abs(c.out.amount)),
      outflowDate: c.out.date,
      inflowDate: c.inn.date,
      lagDays: c.lag,
      kind: c.kind,
      hinted: c.hinted,
    });
  }
  pairs.sort((a, b) => cmp(a.outflowDate, b.outflowDate) || cmp(a.outflowId, b.outflowId));
  return { pairs, matchedIds, kindById };
}
