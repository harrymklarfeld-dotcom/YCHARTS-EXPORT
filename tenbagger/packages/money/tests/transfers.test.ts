import { describe, expect, it } from 'vitest';
import {
  averageDailySpend,
  categorize,
  detectSubscriptions,
  findBannedPhrases,
  matchTransfers,
  paymentRebounds,
  personal10K,
  spendingByCategory,
  spendingLeaks,
  spendingPace,
  type Account,
  type Transaction,
} from '../src/index.ts';
import { PERSONA } from './helpers.ts';

// Fictional accounts across four institutions (no real personal data).
const ACCOUNTS: Pick<Account, 'id' | 'kind'>[] = [
  { id: 'chase_chk', kind: 'checking' },
  { id: 'ally_sav', kind: 'savings' },
  { id: 'rh', kind: 'brokerage' },
  { id: 'discover', kind: 'credit_card' },
];

let n = 0;
const t = (accountId: string, date: string, amount: number, name: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: `x${++n}`,
  date,
  accountId,
  amount,
  name,
  ...extra,
});

describe('matchTransfers', () => {
  it('Chase → Ally on the same day is one pair', () => {
    const out = t('chase_chk', '2026-09-10', -200, 'ONLINE TRANSFER TO ALLY');
    const inn = t('ally_sav', '2026-09-10', 200, 'DEPOSIT');
    const m = matchTransfers([out, inn], ACCOUNTS);
    expect(m.pairs).toEqual([
      {
        outflowId: out.id,
        inflowId: inn.id,
        fromAccountId: 'chase_chk',
        toAccountId: 'ally_sav',
        amount: 200,
        outflowDate: '2026-09-10',
        inflowDate: '2026-09-10',
        lagDays: 0,
        kind: 'transfer',
        hinted: true,
      },
    ]);
    expect([...m.matchedIds].sort()).toEqual([out.id, inn.id].sort());
  });

  it('a 3-day posting lag still pairs; 5 days does not (default window 4, inclusive)', () => {
    const out = t('chase_chk', '2026-09-10', -150.25, 'TRANSFER TO SAVINGS');
    const in3 = t('ally_sav', '2026-09-13', 150.25, 'INCOMING ACH');
    expect(matchTransfers([out, in3], ACCOUNTS).pairs[0]).toMatchObject({ lagDays: 3, amount: 150.25 });
    const in4 = t('ally_sav', '2026-09-14', 150.25, 'INCOMING ACH');
    expect(matchTransfers([out, in4], ACCOUNTS).pairs).toHaveLength(1);
    const in5 = t('ally_sav', '2026-09-15', 150.25, 'INCOMING ACH');
    expect(matchTransfers([out, in5], ACCOUNTS).pairs).toHaveLength(0);
    expect(matchTransfers([out, in5], ACCOUNTS, { windowDays: 5 }).pairs).toHaveLength(1);
  });

  it('amounts one cent apart never pair', () => {
    const m = matchTransfers(
      [t('chase_chk', '2026-09-10', -100, 'TRANSFER TO ALLY'), t('ally_sav', '2026-09-10', 99.99, 'TRANSFER FROM CHASE')],
      ACCOUNTS,
    );
    expect(m.pairs).toEqual([]);
    expect(m.matchedIds.size).toBe(0);
  });

  it('two equal transfers pair one-to-one by smallest gap, then earliest', () => {
    const o1 = t('chase_chk', '2026-09-01', -50, 'TRANSFER TO ALLY');
    const o2 = t('chase_chk', '2026-09-03', -50, 'TRANSFER TO ALLY');
    const i1 = t('ally_sav', '2026-09-02', 50, 'TRANSFER FROM CHASE');
    const i2 = t('ally_sav', '2026-09-03', 50, 'TRANSFER FROM CHASE');
    const m = matchTransfers([i2, o2, i1, o1], ACCOUNTS);
    expect(m.pairs.map((p) => [p.outflowId, p.inflowId, p.lagDays])).toEqual([
      [o1.id, i1.id, 1],
      [o2.id, i2.id, 0],
    ]);
    expect(m.matchedIds.size).toBe(4);
  });

  it('an extra equal leg stays unmatched (no leg is used twice)', () => {
    const o1 = t('chase_chk', '2026-09-01', -50, 'TRANSFER TO ALLY');
    const i1 = t('ally_sav', '2026-09-01', 50, 'TRANSFER FROM CHASE');
    const i2 = t('ally_sav', '2026-09-02', 50, 'TRANSFER FROM CHASE');
    const m = matchTransfers([o1, i1, i2], ACCOUNTS);
    expect(m.pairs.map((p) => p.inflowId)).toEqual([i1.id]);
    expect(m.matchedIds.has(i2.id)).toBe(false);
  });

  it('never pairs within the same account', () => {
    const m = matchTransfers(
      [t('chase_chk', '2026-09-10', -40, 'TRANSFER TO SAVINGS'), t('chase_chk', '2026-09-10', 40, 'TRANSFER REVERSAL')],
      ACCOUNTS,
    );
    expect(m.pairs).toEqual([]);
  });

  it('checking → linked card is a card_payment pair (no name hint needed)', () => {
    const out = t('chase_chk', '2026-09-20', -312.4, 'DISCOVER E-PYMT');
    const inn = t('discover', '2026-09-21', 312.4, 'INTERNET PMT RECEIVED');
    const m = matchTransfers([out, inn], ACCOUNTS);
    expect(m.pairs).toHaveLength(1);
    expect(m.pairs[0]).toMatchObject({ kind: 'card_payment', fromAccountId: 'chase_chk', toAccountId: 'discover' });
    expect(m.kindById.get(out.id)).toBe('card_payment');
    expect(categorize(out, { transfers: m })).toBe('card_payment');
    expect(categorize(inn, { transfers: m })).toBe('card_payment');
  });

  it('Plaid TRANSFER_OUT / TRANSFER_IN categories count as hints; unrelated equal amounts need a hint', () => {
    const out = t('chase_chk', '2026-09-05', -25, 'ROBINHOOD', { category: 'TRANSFER_OUT' });
    const inn = t('rh', '2026-09-06', 25, 'ACH DEPOSIT', { category: 'TRANSFER_IN' });
    expect(matchTransfers([out, inn], ACCOUNTS).pairs).toHaveLength(1);
    // A $20 lunch and a $20 refund in savings look alike but neither leg is transfer-like.
    const lunch = t('chase_chk', '2026-09-05', -20, 'TACO STAND');
    const refund = t('ally_sav', '2026-09-06', 20, 'REFUND');
    expect(matchTransfers([lunch, refund], ACCOUNTS).pairs).toHaveLength(0);
    expect(matchTransfers([lunch, refund], ACCOUNTS, { requireSignal: false }).pairs).toHaveLength(1);
  });

  it('a hint alone never makes a pair, and accounts outside the list are not the user\'s', () => {
    const lone = t('chase_chk', '2026-09-05', -60, 'TRANSFER TO J FRIEND', { category: 'TRANSFER_OUT' });
    expect(matchTransfers([lone], ACCOUNTS).pairs).toEqual([]);
    const other = t('someone_else', '2026-09-05', 60, 'TRANSFER FROM CHASE');
    expect(matchTransfers([lone, other], ACCOUNTS).pairs).toEqual([]);
  });
});

describe('spending / income skip matched internal transfers', () => {
  // A month with linked Chase checking, Ally savings and a Discover card.
  const txs: Transaction[] = [
    t('chase_chk', '2026-09-01', 800, 'CAMPUS PAYROLL DIR DEP'),
    t('chase_chk', '2026-09-02', -300, 'ONLINE BANKING XFER'), // to Ally, generic name → "other" without matching
    t('ally_sav', '2026-09-03', 300, 'INCOMING ACH CHASE'), // would look like income without matching
    t('chase_chk', '2026-09-04', -120, 'DISCOVER E-PYMT'),
    t('discover', '2026-09-05', 120, 'INTERNET PMT RECEIVED'),
    t('discover', '2026-09-06', -45, 'CORNER GROCERY'),
    t('discover', '2026-09-08', -15, 'TACO STAND'),
    t('chase_chk', '2026-09-09', -60, 'TRANSFER TO J FRIEND', { category: 'TRANSFER_OUT' }), // outside account: unchanged
  ];
  const m = matchTransfers(txs, ACCOUNTS);

  it('matches the two internal moves only', () => {
    expect(m.pairs.map((p) => [p.kind, p.amount])).toEqual([
      ['transfer', 300],
      ['card_payment', 120],
    ]);
  });

  it('spendingByCategory', () => {
    const before = spendingByCategory(txs, '2026-09');
    const after = spendingByCategory(txs, '2026-09', { transfers: m });
    expect(before.total).toBe(300 + 120 + 45 + 15 + 60); // xfer & card payment counted as "other"
    expect(after.total).toBe(45 + 15 + 60);
    expect(after.categories.map((c) => c.category).sort()).toEqual(['TRANSFER_OUT', 'food', 'groceries'].sort());
  });

  it('averageDailySpend and spendingPace (income no longer includes the Ally leg)', () => {
    expect(averageDailySpend(txs, '2026-09-30', 30, { transfers: m }).value).toBe(4);
    const before = spendingPace(txs, '2026-09-10');
    const after = spendingPace(txs, '2026-09-10', { transfers: m });
    expect(before.incomeSoFar).toBe(1220);
    expect(after.incomeSoFar).toBe(800);
    expect(after.spentSoFar).toBe(120);
    expect(findBannedPhrases(after.sentence)).toEqual([]);
  });

  it('leaks and subscriptions ignore matched legs', () => {
    const monthly = [1, 2, 3].flatMap((k) => {
      const d = `2026-0${6 + k}-15`;
      return [t('chase_chk', d, -9.99, 'ONLINE BANKING XFER'), t('ally_sav', d, 9.99, 'INCOMING ACH')];
    });
    expect(detectSubscriptions(monthly, { minOccurrences: 3 })).toHaveLength(1); // looks like a $9.99 subscription
    const mm = matchTransfers(monthly, ACCOUNTS, { requireSignal: false });
    expect(detectSubscriptions(monthly, { transfers: mm })).toHaveLength(0);
    expect(spendingLeaks(txs, '2026-09', { transfers: m }).map((l) => l.category)).not.toContain('other');
  });

  it('card payment rebounds still see the payment on the card side', () => {
    const r = paymentRebounds(txs, 'discover', { transfers: m });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ paid: 120, chargesAfter: 60 });
  });

  it('no pairs → identical results to before', () => {
    const empty = matchTransfers([], ACCOUNTS);
    const tx = PERSONA.transactions as unknown as Transaction[];
    expect(spendingByCategory(tx, '2026-09', { transfers: empty })).toEqual(spendingByCategory(tx, '2026-09'));
    expect(spendingPace(tx, '2026-09-20', { transfers: empty })).toEqual(spendingPace(tx, '2026-09-20'));
  });

  it('personal10K passes transfers through', () => {
    const base = { snapshots: [], transactions: txs, deposits: [], streams: [] };
    expect(personal10K('2026-09', { ...base, transfers: m }).cashFlow.moneyIn).toBe(800);
  });
});
