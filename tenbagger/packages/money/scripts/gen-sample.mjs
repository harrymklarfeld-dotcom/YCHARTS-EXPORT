#!/usr/bin/env node
/**
 * Enriches the FICTIONAL sample persona (Alex, 20) with dashboard data and writes it to both
 *   tests/fixtures/alex.sample.json   and   ../../mobile/assets/data/money.sample.json
 *
 * Deterministic (seeded PRNG). Existing keys (streams, deposits, snapshots) are kept as-is so
 * the engine's tests keep their numbers; this only adds/overwrites the dashboard keys:
 *   monthEndSnapshots, transactions, holdings, investmentContributions, benchmark,
 *   dividends, rothContributions, detectedStreams, goals
 * and sets creditLimit / statementDate on the card. Every name and number is made up.
 *
 * Run: node scripts/gen-sample.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'tests', 'fixtures', 'alex.sample.json');
const mobile = join(here, '..', '..', '..', 'mobile', 'assets', 'data', 'money.sample.json');
const data = JSON.parse(readFileSync(fixture, 'utf8'));

// ------------------------------------------------------------------ helpers
let seed = 20261005;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => Math.round((a + rand() * (b - a)) * 100) / 100;
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const DAY = 86400000;
const toD = (s) => new Date(`${s}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(toD(s).getTime() + n * DAY));
const dow = (s) => toD(s).getUTCDay();
const r2 = (n) => Math.round(n * 100) / 100;

const START = '2026-07-07';
const END = '2026-10-05'; // 91 days, inclusive
const days = [];
for (let d = START; d <= END; d = addDays(d, 1)) days.push(d);

const CARD_LIMIT = 1500;

// ------------------------------------------------------------------ card + statement details
for (const s of data.snapshots) {
  for (const a of s.accounts) if (a.kind === 'credit_card') a.creditLimit = CARD_LIMIT;
  for (const l of s.liabilities) l.statementDate = addDays(l.dueDate, -23);
}

// ------------------------------------------------------------------ month-end history (Apr–Jul)
const acctRow = (id, name, kind, balance, asOf, basis = 'verified', extra = {}) => ({ id, name, kind, balance, asOf, basis, ...extra });
const monthEnd = [
  ['2026-04-30', 410, 300, 640, 1900, 150, 'Month-end check-in. Spring term.'],
  ['2026-05-31', 980, 320, 380, 2020, 300, 'Month-end check-in. Added $150 to the Roth IRA.'],
  ['2026-06-30', 760, 350, 520, 2150, 300, 'Month-end check-in. Summer hours at the library.'],
  ['2026-07-31', 540, 370, 610, 2240, 300, 'Month-end check-in.'],
];
data.monthEndSnapshots = monthEnd.map(([d, chk, sav, card, brk, roth, note]) => ({
  takenAt: `${d}T21:00`,
  accounts: [
    acctRow('chk', 'Checking', 'checking', chk, d),
    acctRow('sav', 'Savings', 'savings', sav, d),
    acctRow('card', 'Student credit card', 'credit_card', card, d, 'verified', { creditLimit: CARD_LIMIT }),
    acctRow('brk', 'Brokerage', 'brokerage', brk, d),
    acctRow('roth', 'Roth IRA', 'retirement', roth, d, 'manual'),
  ],
  liabilities: [],
  note,
}));

// ------------------------------------------------------------------ transactions
const tx = [];
const add = (date, accountId, amount, name, variable = false) => tx.push({ date, accountId, amount: r2(amount), name, category: null, pending: false, basis: 'verified', variable });

// Income (mirrors `deposits` so both views agree).
const INCOME_NAME = { 'campus-job': 'CAMPUS PAYROLL DIR DEP', tutoring: 'TUTORING SESSIONS P2P', other: 'GIFT FROM FAMILY' };
for (const d of data.deposits) if (d.date >= START && d.date <= END) add(d.date, 'chk', d.amount, INCOME_NAME[d.streamId] ?? 'DEPOSIT');

// Card payments (checking → card) matching the snapshot paydowns.
for (const [date, amt] of [['2026-07-17', 480], ['2026-08-18', 730], ['2026-09-18', 750]]) {
  add(date, 'chk', -amt, 'STUDENT CARD PAYMENT');
  add(date, 'card', amt, 'PAYMENT THANK YOU');
}
// Transfers
for (const d of ['2026-08-01', '2026-09-01', '2026-10-01']) add(d, 'chk', -75, 'TRANSFER TO BROKERAGE');
for (const d of ['2026-07-15', '2026-08-15', '2026-09-15']) {
  add(d, 'chk', -10, 'TRANSFER TO SAVINGS');
  add(d, 'sav', 10, 'TRANSFER FROM CHECKING');
}
// Savings interest
for (const d of ['2026-07-31', '2026-08-31', '2026-09-30']) add(d, 'sav', between(0.28, 0.34), 'INTEREST PAID');

// Subscriptions (card) and phone bill (checking): same merchant, monthly, similar amount.
for (const m of ['07', '08', '09']) {
  add(`2026-${m}-12`, 'card', -10.99, 'STREAMTUNES MUSIC');
  add(`2026-${m}-21`, 'card', -15.49, 'FLIXBOX VIDEO STREAMING');
}
for (const m of ['08', '09', '10']) add(`2026-${m}-03`, 'card', -2.99, 'CLOUDBOX STORAGE 200GB');
for (const m of ['07', '08', '09']) add(`2026-${m}-08`, 'chk', -30, 'PINEPHONE WIRELESS');
add('2026-09-06', 'card', -4.99, 'STUDYPAL APP TRIAL'); // one-off, not recurring

// Everyday spending. Summer (Jul–Aug 24) is quieter; fall term (from Aug 25) picks up.
const CAFES = ['CAMPUS CAFE', 'BEANERY COFFEE', 'CORNER BAKERY CAFE'];
const EATS = ['NOODLE BAR', 'TACO STAND', 'SLICE PIZZA', 'GRILL BURGER'];
for (const d of days) {
  const fall = d >= '2026-08-25';
  const w = dow(d);
  if (w >= 1 && w <= 5 && rand() < (fall ? 0.6 : 0.35)) add(d, 'card', -between(3.5, 6.75), pick(CAFES), true);
  if (rand() < (fall ? 0.3 : 0.2)) add(d, 'card', -between(9, 16.5), pick(EATS), true);
  if (w === 6 || (fall && w === 3 && rand() < 0.5)) add(d, 'card', -between(22, 44), pick(['CAMPUS MARKET', 'CORNER GROCERY']), true);
  if (rand() < (fall ? 0.28 : 0.12)) add(d, 'card', -between(7.5, 18.5), 'RIDENOW TRIP', true);
  if (fall && (w === 5 || w === 6) && rand() < 0.45) add(d, 'card', -between(18, 29), 'DASHEATS DELIVERY', true);
  if (!fall && w === 5 && rand() < 0.4) add(d, 'chk', -between(8, 14), 'SLICE PIZZA');
}
// One-offs
add('2026-07-19', 'card', -14, 'CINEMA 8 MOVIE TICKETS');
add('2026-08-10', 'card', -36.5, 'DORM SUPPLIES STORE');
add('2026-08-25', 'chk', -45, 'CAMPUS TRANSIT PASS');
add('2026-08-27', 'card', -28.4, 'CAMPUS BOOKSTORE');
add('2026-09-10', 'card', -24, 'CINEMA 8 MOVIE TICKETS');
// Rebound after the Sep 18 paydown: textbooks, a concert, supplies.
add('2026-09-20', 'card', -186.4, 'CAMPUS BOOKSTORE');
add('2026-09-22', 'card', -64, 'TEXTBOOK RENTAL ONLINE');
add('2026-09-24', 'card', -42.75, 'DORM SUPPLIES STORE');
add('2026-09-26', 'card', -58, 'ARENA CONCERT TICKETS');
add('2026-10-03', 'card', -19.5, 'CINEMA 8 MOVIE TICKETS');

// Reconcile the card with the snapshots: in each window between card snapshots, card charges
// must equal (balance change + payments). Extra everyday charges move to the debit card
// (checking); a shortfall is filled with a few everyday card charges.
{
  const snaps = [...data.monthEndSnapshots, ...data.snapshots].map((s) => [s.takenAt.slice(0, 10), s.accounts.find((a) => a.id === 'card').balance]);
  const FILL = ['CAMPUS MARKET', 'DASHEATS DELIVERY', 'CORNER GROCERY', 'CAMPUS STORE'];
  for (let i = 1; i < snaps.length; i++) {
    const [from, b0] = snaps[i - 1];
    const [to, b1] = snaps[i];
    if (to < START) continue;
    const lo = from < START ? addDays(START, -1) : from;
    const inWin = tx.filter((t) => t.accountId === 'card' && t.date > lo && t.date <= to);
    const payments = inWin.filter((t) => t.amount > 0).reduce((x, t) => x + t.amount, 0);
    // Charges before START in a straddling window are unknown: count only the in-range share.
    const target = r2(b1 - b0 + payments - (from < START ? 0 : 0));
    let charges = inWin.filter((t) => t.amount < 0).reduce((x, t) => x - t.amount, 0);
    const movable = inWin.filter((t) => t.amount < 0 && t.variable).sort((a, b) => (a.date < b.date ? 1 : -1));
    while (charges > target + 0.001 && movable.length) {
      const t = movable.shift();
      t.accountId = 'chk';
      charges += t.amount;
    }
    let gap = r2(target - charges);
    const span = Math.max(1, Math.round((toD(to) - toD(lo)) / DAY));
    let k = 0;
    while (gap > 0.004) {
      const amt = r2(Math.min(gap, between(24, 46)));
      const d = addDays(lo, 1 + Math.floor(rand() * span));
      add(d > to ? to : d, 'card', -amt, FILL[k++ % FILL.length]);
      gap = r2(gap - amt);
    }
  }
}

tx.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.accountId.localeCompare(b.accountId) || a.name.localeCompare(b.name)));
data.transactions = tx.map(({ variable, ...t }, i) => ({ id: `tx-${String(i + 1).padStart(3, '0')}`, ...t }));

// ------------------------------------------------------------------ investments
const H = (accountId, ticker, name, kind, assetClass, shares, price, costBasis, basis) => ({ accountId, ticker, name, kind, assetClass, shares, price, costBasis, basis });
data.holdings = [
  H('brk', 'VOO', 'S&P 500 index ETF', 'etf', 'US stock index fund', 1.6, 612.4, 880, 'verified'),
  H('brk', 'NVDA', 'NVIDIA', 'stock', 'Single stock', 3, 182.1, 420, 'verified'),
  H('brk', 'AAPL', 'Apple', 'stock', 'Single stock', 2, 241.55, 430, 'verified'),
  H('brk', 'MU', 'Micron Technology', 'stock', 'Single stock', 1.5, 128.4, 150, 'verified'),
  H('brk', 'XLV', 'Health care sector ETF', 'etf', 'Sector fund', 1, 146.2, 142, 'verified'),
  H('brk', 'GLD', 'Gold ETF', 'etf', 'Gold', 0.5, 318, 150, 'verified'),
  H('brk', null, 'Cash', 'cash', 'Cash', 92.96, 1, 92.96, 'verified'),
  H('roth', 'VOO', 'S&P 500 index ETF', 'etf', 'US stock index fund', 0.45, 612.4, 262, 'manual'),
  H('roth', null, 'Cash', 'cash', 'Cash', 24.42, 1, 24.42, 'manual'),
];
data.investmentContributions = [
  ...['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'].map((date) => ({ date, amount: 75, accountId: 'brk' })),
  { date: '2026-05-20', amount: 150, accountId: 'roth' },
];
data.benchmark = {
  ticker: 'VOO',
  note: 'Made-up sample prices for the benchmark comparison.',
  prices: [
    ['2026-04-30', 560.2], ['2026-05-01', 561.0], ['2026-05-20', 571.3], ['2026-05-31', 575.8], ['2026-06-01', 576.0],
    ['2026-06-30', 588.1], ['2026-07-01', 588.4], ['2026-07-31', 594.6], ['2026-08-01', 593.9], ['2026-08-14', 598.2],
    ['2026-08-18', 597.0], ['2026-09-01', 601.3], ['2026-09-16', 605.9], ['2026-09-18', 606.4], ['2026-09-30', 609.8],
    ['2026-10-01', 610.5], ['2026-10-05', 612.4],
  ].map(([date, price]) => ({ date, price })),
};
data.dividends = [
  ['2026-05-14', 'AAPL', 'brk', 0.52], ['2026-06-26', 'VOO', 'brk', 2.61], ['2026-06-26', 'NVDA', 'brk', 0.03],
  ['2026-06-24', 'XLV', 'brk', 0.62], ['2026-06-26', 'VOO', 'roth', 0.66], ['2026-07-21', 'MU', 'brk', 0.17],
  ['2026-08-13', 'AAPL', 'brk', 0.52], ['2026-09-23', 'XLV', 'brk', 0.64], ['2026-09-25', 'VOO', 'brk', 2.7],
  ['2026-09-25', 'NVDA', 'brk', 0.03], ['2026-09-25', 'VOO', 'roth', 0.72],
].map(([date, ticker, accountId, amount]) => ({ date, ticker, accountId, amount }));
data.rothContributions = [
  { date: '2026-01-15', amount: 150, taxYear: 2026, accountId: 'roth' },
  { date: '2026-05-20', amount: 150, taxYear: 2026, accountId: 'roth' },
];

// ------------------------------------------------------------------ detected streams (backend shape)
const campus = data.deposits.filter((d) => d.streamId === 'campus-job');
const tut = data.deposits.filter((d) => d.streamId === 'tutoring');
const avg = (xs) => r2(xs.reduce((s, d) => s + d.amount, 0) / xs.length);
data.detectedStreams = [
  { id: 'det-payroll', name: 'CAMPUS PAYROLL DIR DEP', category: 'INCOME_WAGES', frequency: 'BIWEEKLY', status: 'MATURE', averageAmount: avg(campus), lastAmount: campus.at(-1).amount, lastDate: campus.at(-1).date, predictedNextDate: '2026-10-09', basis: 'verified', matchesStreamId: 'campus-job', asIncomeStream: null },
  { id: 'det-p2p', name: 'TUTORING SESSIONS P2P', category: 'TRANSFER_IN', frequency: 'BIWEEKLY', status: 'EARLY_DETECTION', averageAmount: avg(tut), lastAmount: tut.at(-1).amount, lastDate: tut.at(-1).date, predictedNextDate: '2026-10-15', basis: 'verified', matchesStreamId: 'tutoring', asIncomeStream: null },
];

// ------------------------------------------------------------------ goals (defaults; editable in the app)
data.goals = { emergencyFundWeeks: 8, cardPayoffBy: '2027-03-31', rothTarget: 1000, rothYear: 2026 };

const out = `${JSON.stringify(data, null, 2)}`;
writeFileSync(fixture, out);
writeFileSync(mobile, out);
console.log(`transactions: ${data.transactions.length}, month-end snapshots: ${data.monthEndSnapshots.length}, holdings: ${data.holdings.length}`);
