/**
 * FICTIONAL sample persona for the "Can I cover the card?" demo on the landing page.
 * Every number is made up. Edit freely.
 */
import type { IncomeStream, Snapshot } from '../../../packages/money/src/index.ts';

export const persona = {
  name: 'Jordan',
  blurb: 'Fictional sophomore. Works at the campus café and tutors chemistry. Every number is made up.',
  horizonDays: 30,
  /** Starting values for the sliders. */
  defaults: { cash: 720, statement: 780, dailySpend: 12, countPending: true },
  cardName: 'Student card',
  minimumDue: 35,
  apr: 0.2499,
  dueDate: '2026-10-14',
  asOf: '2026-10-05',
  pendingHours: 14,
  streams: [
    {
      id: 'cafe',
      name: 'Campus café',
      kind: 'hourly',
      rate: 16,
      schedule: { unitsPerWeek: 12, weekdays: [1, 3, 5] },
      payFrequency: 'biweekly',
      nextPayDate: '2026-10-09',
      withholdingRate: 0.07,
      condition: 'hours submitted',
      pendingUnsubmitted: { units: 14, periodEnd: '2026-10-04' },
    },
    {
      id: 'tutoring',
      name: 'Chem tutoring',
      kind: 'per_session',
      rate: 35,
      schedule: { unitsPerWeek: 2, weekdays: [2, 4] },
      payFrequency: 'biweekly',
      nextPayDate: '2026-10-16',
      withholdingRate: 0,
      condition: 'session reports filed',
    },
  ] as IncomeStream[],
};

export type DemoInputs = { cash: number; statement: number; dailySpend: number; countPending: boolean };

/** Build the engine inputs from slider values. */
export function buildScenario(inp: DemoInputs): { snapshot: Snapshot; streams: IncomeStream[] } {
  const p = persona;
  const checking = Math.round(inp.cash * 0.75);
  const snapshot: Snapshot = {
    takenAt: p.asOf,
    accounts: [
      { id: 'chk', name: 'Checking', kind: 'checking', balance: checking, asOf: p.asOf, basis: 'verified' },
      { id: 'sav', name: 'Savings', kind: 'savings', balance: inp.cash - checking, asOf: p.asOf, basis: 'verified' },
      { id: 'card', name: p.cardName, kind: 'credit_card', balance: inp.statement, asOf: p.asOf, basis: 'verified' },
    ],
    liabilities: [{ accountId: 'card', statementBalance: inp.statement, minimumDue: Math.min(p.minimumDue, inp.statement), dueDate: p.dueDate, apr: p.apr }],
    note: 'Sample persona',
  };
  return { snapshot, streams: p.streams };
}
