import { describe, expect, it } from 'vitest';
import { ANALOGY_LESSONS, buildLog, companyAnalogies, estimateMonthlyFreeCashFlow, netWorth } from '../src/index.ts';
import { acct, LATEST, LOG, snap } from './helpers.ts';
import lessonsRaw from '../../../data/lessons.json' with { type: 'json' };

type LessonsFile = { units: { lessons: { id: string; title: string }[] }[] };
const lessons = lessonsRaw as unknown as LessonsFile;
const TITLES = new Map(lessons.units.flatMap((u) => u.lessons.map((l) => [l.id, l.title] as const)));

describe('companyAnalogies', () => {
  const a = companyAnalogies(netWorth(LATEST), { monthlyFreeCashFlow: estimateMonthlyFreeCashFlow(LOG) });

  it('pairs each personal number with a company metric', () => {
    expect(a.map((x) => [x.personal, x.company, x.lessonId])).toEqual([
      ['Liquidity ratio 1.12', 'Current ratio', 'u5-l4'],
      ['Net cash $130', 'Net cash (or net debt)', 'u5-l2'],
      ['Debt-to-net-worth 0.37', 'Debt-to-equity', 'u5-l3'],
      ['Net worth $3,030', 'Assets = liabilities + equity', 'u5-l1'],
      ['Monthly free cash flow +$64', 'Free cash flow', 'u4-l2'],
    ]);
    expect(a.find((x) => x.id === 'free_cash_flow')!.label).toBe('estimate');
  });

  it('links only to lessons that exist in data/lessons.json, on the matching topic', () => {
    expect(TITLES.get(ANALOGY_LESSONS.current_ratio)).toMatch(/current ratio/i);
    expect(TITLES.get(ANALOGY_LESSONS.net_cash)).toMatch(/net cash/i);
    expect(TITLES.get(ANALOGY_LESSONS.debt_to_equity)).toMatch(/debt-to-equity/i);
    expect(TITLES.get(ANALOGY_LESSONS.balance_sheet)).toMatch(/assets = liabilities \+ equity/i);
    expect(TITLES.get(ANALOGY_LESSONS.free_cash_flow)).toMatch(/free cash flow/i);
    for (const x of a) expect(TITLES.has(x.lessonId)).toBe(true);
  });

  it('free cash flow estimate: (cash − debt) change per 30.44 days, null without history', () => {
    // netCash Aug 14: 1000 − 980 = 20; Oct 5: 1250 − 1120 = 130 → +110 over 52 days
    expect(estimateMonthlyFreeCashFlow(LOG)).toEqual({ value: 64.39, label: 'estimate' });
    expect(estimateMonthlyFreeCashFlow(LOG.slice(0, 1))).toBeNull();
    const short = buildLog([snap('2026-10-01', [acct('chk', 'checking', 1)]), snap('2026-10-10', [acct('chk', 'checking', 2)])]);
    expect(estimateMonthlyFreeCashFlow(short)).toBeNull();
    const none = companyAnalogies(netWorth(snap('2026-10-01', [acct('chk', 'checking', 1)])));
    expect(none.find((x) => x.id === 'free_cash_flow')!.personal).toMatch(/needs 2\+ snapshots/);
    expect(none.find((x) => x.id === 'current_ratio')!.personalValue).toBeNull();
  });
});
