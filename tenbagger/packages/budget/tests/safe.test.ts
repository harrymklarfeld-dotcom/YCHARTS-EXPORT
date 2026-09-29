import { describe, expect, it } from 'vitest';
import { quickSetup, safeToSpend, setupProgress } from '../src/index.ts';
import { hourly, paycheck, profile } from './helpers.ts';

const AS_OF = '2026-10-05'; // Monday; the paycheck lands Fri Oct 9

describe('safe to spend until payday', () => {
  it('cash − bills due by payday − cushion, with the equation adding up', () => {
    const p = profile({ bills: [{ id: 'phone', name: 'Phone', amount: 30, dueDay: 8, kind: 'phone' }, { id: 'rent', name: 'Rent', amount: 300, dueDay: 1, kind: 'rent' }] });
    const s = safeToSpend(p, AS_OF);
    expect(s.until).toBe('2026-10-09');
    expect(s.obligations.map((o) => o.id)).toEqual(['phone@2026-10-08']);
    // Rent on Nov 1 is after payday and the Oct 9 + Oct 23 paychecks cover it: nothing set aside.
    expect(s.reserve).toBe(0);
    expect(s.amount).toBe(420); // 500 − 30 − 50
    expect(s.days).toBe(4);
    expect(s.perDay).toBe(105);
    expect(s.status).toBe('comfortable');
    expect(s.label).toBe('manual');
    const sum = s.lines.filter((l) => l.op !== '=').reduce((t, l) => t + l.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(s.amount);
  });

  it('a bill due ON payday counts against today’s cash (a paycheck can land late)', () => {
    const s = safeToSpend(profile({ bills: [{ id: 'b', name: 'Bill', amount: 100, dueDay: 9, kind: 'other' }] }), AS_OF);
    expect(s.amount).toBe(350);
  });

  it('bills already paid are left out', () => {
    const p = profile({ bills: [{ id: 'b', name: 'Bill', amount: 100, dueDay: 7, kind: 'other' }] });
    expect(safeToSpend(p, AS_OF, { paid: ['b@2026-10-07'] }).amount).toBe(450);
  });

  it('card due BEFORE payday: the full planned payment comes out of cash', () => {
    const p = profile({ balances: { asOf: AS_OF, basis: 'manual', cash: 500, card: { balance: 300, statementBalance: 300, dueDate: '2026-10-08' } } });
    const s = safeToSpend(p, AS_OF);
    expect(s.obligations.map((o) => o.kind)).toEqual(['card']);
    expect(s.amount).toBe(150);
  });

  it('card due AFTER payday: the paycheck before it pays; only the gap is set aside', () => {
    const p = profile({ balances: { asOf: AS_OF, basis: 'manual', cash: 500, card: { balance: 600, statementBalance: 600, dueDate: '2026-10-12' } } });
    const s = safeToSpend(p, AS_OF);
    expect(s.obligations).toEqual([]);
    expect(s.reserve).toBe(200); // $400 paycheck on Oct 9 covers 400 of 600
    expect(s.setAside[0]!.obligation.kind).toBe('card');
    expect(s.amount).toBe(250); // 500 − 200 − 50
    expect(s.label).toBe('projected'); // relies on the projected paycheck
  });

  it('pending pay is excluded: it neither adds cash nor ends the window', () => {
    const base = profile({
      income: [hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 20, periodEnd: '2026-10-03' } })],
      bills: [{ id: 'b', name: 'Bill', amount: 40, dueDay: 20, kind: 'other' }],
    });
    const s = safeToSpend(base, AS_OF);
    // Oct 9 check is PENDING, so the window runs to the Oct 23 paycheck and the Oct 20 bill is inside it.
    expect(s.until).toBe('2026-10-23');
    expect(s.excludedPending.map((d) => [d.date, d.amount])).toEqual([['2026-10-09', 300]]);
    expect(s.amount).toBe(410);
    const more = safeToSpend({ ...base, income: [hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 60, periodEnd: '2026-10-03' } })] }, AS_OF);
    expect(more.amount).toBe(s.amount);
    expect(s.notes.join(' ')).toMatch(/pending pay is not counted/);
  });

  it('pending pay never funds a later bill either', () => {
    const p = profile({
      income: [hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 20, periodEnd: '2026-10-03' } })],
      balances: { asOf: AS_OF, basis: 'manual', cash: 500, card: { balance: 400, statementBalance: 400, dueDate: '2026-10-12' } },
    });
    const s = safeToSpend(p, AS_OF);
    expect(s.obligations.map((o) => o.kind)).toEqual(['card']); // due before the first PROJECTED paycheck (Oct 23)
    expect(s.amount).toBe(50);
  });

  it('zero income: a 14-day window, labelled ESTIMATE', () => {
    const s = safeToSpend(profile({ income: [], bills: [{ id: 'b', name: 'Bill', amount: 25, dueDay: 15, kind: 'other' }] }), AS_OF);
    expect(s.nextPaycheck).toBeNull();
    expect(s.until).toBe('2026-10-19');
    expect(s.amount).toBe(425);
    expect(s.label).toBe('estimate');
  });

  it('short is reported calmly, with the gap and the pending pay that would close it', () => {
    const p = profile({
      income: [hourly({ paidOnlyIfSubmitted: true, pendingUnsubmitted: { units: 20, periodEnd: '2026-10-03' } })],
      balances: { asOf: AS_OF, basis: 'manual', cash: 200, card: { balance: 400, statementBalance: 400, dueDate: '2026-10-12' } },
    });
    const s = safeToSpend(p, AS_OF);
    expect(s.status).toBe('short');
    expect(s.amount).toBe(-250);
    expect(s.perDay).toBe(0);
    expect(s.headline).toBe('$250 more is due before payday than you have');
    expect(s.sentence).toMatch(/would add \$300/);
  });

  it('savings is never counted as spendable', () => {
    const p = profile({ balances: { asOf: AS_OF, basis: 'manual', cash: 500, savings: 5000 } });
    expect(safeToSpend(p, AS_OF).amount).toBe(450);
  });

  it('a past card due date rolls forward monthly with the balance as an ESTIMATE', () => {
    const p = profile({ balances: { asOf: AS_OF, basis: 'manual', cash: 500, card: { balance: 120, statementBalance: 300, dueDate: '2026-09-07' } } });
    const s = safeToSpend(p, AS_OF);
    expect(s.obligations[0]).toMatchObject({ date: '2026-10-07', amount: 120, basis: 'estimate' });
  });

  it('automatic goal transfers inside the window count', () => {
    const p = profile({ goals: [{ id: 'roth', kind: 'roth', title: 'Roth', monthly: 50, transferDay: 7 }] });
    expect(safeToSpend(p, AS_OF).amount).toBe(400);
  });
});

describe('quick setup (4 inputs)', () => {
  it('cash, payday + amount, card + due date, one bill → a working hero number and 40% progress', () => {
    const p = quickSetup({
      asOf: AS_OF,
      cash: 640,
      nextPayday: '2026-10-09',
      nextPayAmount: 186,
      card: { balance: 350, dueDate: '2026-10-08' },
      bill: { name: 'Rent', amount: 450, dueDay: 1 },
    });
    expect(p.mode).toBe('quick');
    expect(p.goals.map((g) => g.kind)).toEqual(['cover_card']);
    expect(p.bills[0]).toMatchObject({ kind: 'rent', amount: 450, dueDay: 1 });
    const s = safeToSpend(p, AS_OF);
    // 640 − 350 card (Oct 8) − 75 cushion − 78 set aside: the Oct 9 + Oct 23 paychecks ($372) cover $372 of Nov 1 rent.
    expect(s.amount).toBe(137);
    expect(s.setAside.map((x) => [x.obligation.label, x.amount])).toEqual([['Rent', 78]]);
    const progress = setupProgress(p);
    expect(progress.pct).toBe(40);
    expect(progress.next).toBe('goals');
    expect(progress.reason).toMatch(/40% built/);
  });

  it('no card and no bill is fine', () => {
    const p = quickSetup({ asOf: AS_OF, cash: 100, nextPayday: '2026-10-09', nextPayAmount: 200 });
    expect(p.goals).toEqual([]);
    expect(p.balances.card).toBeUndefined();
    expect(safeToSpend(p, AS_OF).amount).toBe(25);
  });

  it('re-running quick setup replaces its own answers but keeps the rest', () => {
    const first = quickSetup({ asOf: AS_OF, cash: 100, nextPayday: '2026-10-09', nextPayAmount: 200, bill: { name: 'Phone', amount: 30, dueDay: 8 } });
    const withExtra = { ...first, income: [...first.income, paycheck({ id: 'side', name: 'Side gig' })] };
    const again = quickSetup({ asOf: AS_OF, cash: 300, nextPayday: '2026-10-09', nextPayAmount: 250, bill: { name: 'Phone', amount: 35, dueDay: 8 } }, withExtra);
    expect(again.income.map((s) => s.id)).toEqual(['main-pay', 'side']);
    expect(again.bills).toHaveLength(1);
    expect(again.bills[0]!.amount).toBe(35);
    expect(again.answered).toEqual(['quick']);
  });
});
