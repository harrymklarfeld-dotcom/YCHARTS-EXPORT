import { describe, expect, it } from 'vitest';
import { interestAvoided, minimumOnlyPlan, payoffPlan, requiredMonthlyPayment, statementCycle, utilization } from '../src/index.ts';
import { LATEST } from './helpers.ts';

describe('utilization', () => {
  it('ratio and educational band', () => {
    expect(utilization(1120, 1500)).toMatchObject({ ratio: 0.75, at10: 150, at30: 450 });
    expect(utilization(1120, 1500).band!.id).toBe('high');
    expect(utilization(100, 1500).band!.id).toBe('low');
    expect(utilization(150, 1500).band!.id).toBe('moderate'); // exactly 10% is no longer "under 10%"
    expect(utilization(449, 1500).band!.id).toBe('moderate');
    expect(utilization(1500, 1500).band!.id).toBe('high');
    expect(utilization(1600, 1500).band!.id).toBe('over');
    expect(utilization(100, null)).toMatchObject({ ratio: null, band: null });
    expect(utilization(1120, 1500).sentence).toBe('$1,120 of a $1,500 limit is 75% utilization (30% to 100%).');
  });
  it('sample card carries a $1,500 limit', () => {
    expect(LATEST.accounts.find((a) => a.kind === 'credit_card')!.creditLimit).toBe(1500);
  });
});

describe('payoffPlan(balance, apr, monthlyPayment)', () => {
  it('months to payoff and total interest (monthly rate = APR/12)', () => {
    const p = payoffPlan(1000, 0.24, 100);
    expect(p.feasible).toBe(true);
    expect(p.months).toBe(12); // n = −ln(1 − rB/P) / ln(1 + r) = 11.27 → 12 payments
    expect(p.firstMonthInterest).toBe(20);
    expect(p.schedule[0]).toEqual({ month: 1, payment: 100, interest: 20, principal: 80, balance: 920 });
    expect(p.totalInterest).toBe(127.04);
    expect(p.totalPaid).toBe(1127.04);
    expect(p.schedule[p.schedule.length - 1]!.balance).toBe(0);
    expect(p.label).toBe('estimate');
  });
  it('zero APR is simple division; a payment that only covers interest never finishes', () => {
    expect(payoffPlan(600, 0, 100)).toMatchObject({ months: 6, totalInterest: 0 });
    const stuck = payoffPlan(1000, 0.24, 20);
    expect(stuck).toMatchObject({ feasible: false, months: null });
    expect(stuck.sentence).toMatch(/never shrink/);
    expect(payoffPlan(0, 0.24, 50)).toMatchObject({ months: 0, totalInterest: 0 });
  });
  it('more per month → fewer months and less interest', () => {
    const a = payoffPlan(1120, 0.2499, 75);
    const b = payoffPlan(1120, 0.2499, 150);
    expect(b.months!).toBeLessThan(a.months!);
    expect(b.totalInterest).toBeLessThan(a.totalInterest);
  });
  it('minimum-only takes years; requiredMonthlyPayment inverts the plan', () => {
    const m = minimumOnlyPlan(1120, 0.2499);
    expect(m.months!).toBeGreaterThan(60);
    expect(m.totalInterest).toBeGreaterThan(500);
    const pay = requiredMonthlyPayment(1120, 0.2499, 6);
    expect(pay).toBe(200.51);
    expect(payoffPlan(1120, 0.2499, pay).months).toBe(6);
    expect(requiredMonthlyPayment(600, 0, 6)).toBe(100);
  });
});

describe('statement cycle and interest avoided', () => {
  it('explains statement date vs due date', () => {
    const c = statementCycle(LATEST.liabilities[0]!);
    expect(c).toMatchObject({ statementDate: '2026-09-24', dueDate: '2026-10-17', graceDays: 23 });
    expect(c.steps[0]).toMatch(/Sep 24/);
    expect(c.steps.join(' ')).toMatch(/grace period/);
  });
  it('interest avoided by paying in full is about one month of interest', () => {
    expect(interestAvoided(1120, 0.2499)).toMatchObject({ perMonth: 23.32, perYear: 279.84, label: 'estimate' });
  });
});
