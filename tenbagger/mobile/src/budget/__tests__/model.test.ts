import fixture from '../../../../packages/budget/tests/fixtures/alex.budget.json';
import sample from '../../../assets/data/budget.sample.json';
import moneySample from '../../../assets/data/money.sample.json';
import { findBudgetBannedPhrases, insightText, quickSetup } from '../engine';
import { budgetSample, buildView, companyRatios, dayChips, moneyText, parseMoney, shouldShowOnboarding } from '../model';

describe('budget sample (fictional Alex)', () => {
  it('bundles the same fixture the engine is tested with', () => {
    expect(sample).toEqual(fixture);
    expect(budgetSample.sample).toBe(true);
    expect(budgetSample.persona.name).toBe('Alex');
  });

  it('is consistent with the Money hub sample (same jobs, card and due date)', () => {
    const streams = (moneySample as { streams: { id: string }[] }).streams.map((s) => s.id);
    for (const id of streams) expect(budgetSample.profile.income.some((s) => s.id === id)).toBe(true);
    const last = (moneySample as { snapshots: { liabilities: { dueDate: string; statementBalance: number }[] }[] }).snapshots.at(-1)!;
    expect(budgetSample.profile.balances.card?.dueDate).toBe(last.liabilities[0]!.dueDate);
    expect(budgetSample.profile.balances.card?.statementBalance).toBe(last.liabilities[0]!.statementBalance);
  });

  it('sample view: linked data from the Money sample, insights with lesson links, clean voice', () => {
    const v = buildView({ profile: null, sampleMode: true, today: '2026-09-26' });
    expect(v.source).toBe('sample');
    expect(v.asOf).toBe('2026-10-05');
    const b = v.budget!;
    expect(b.linked).toBe(true);
    expect(b.safe.until).toBe('2026-10-15');
    expect(b.insights.map((i) => i.type)).toEqual(expect.arrayContaining(['pending_pay', 'subscriptions', 'liquidity_ratio', 'card_payoff_faster']));
    for (const i of b.insights) expect(findBudgetBannedPhrases(insightText(i))).toEqual([]);
  });
});

describe('own plan', () => {
  it('no profile → no budget; onboarding shows on first launch only', () => {
    expect(buildView({ profile: null, sampleMode: false, today: '2026-09-26' }).source).toBe('none');
    expect(shouldShowOnboarding({ profile: null, onboardingSeen: false, sampleMode: false })).toBe(true);
    expect(shouldShowOnboarding({ profile: null, onboardingSeen: true, sampleMode: false })).toBe(false);
  });

  it('quick setup profile → hero number without any linking; subscriptions never faked', () => {
    const p = quickSetup({ asOf: '2026-09-26', cash: 640, nextPayday: '2026-10-02', nextPayAmount: 186, card: { balance: 350, dueDate: '2026-09-30' }, bill: { name: 'Rent', amount: 450, dueDay: 1 } });
    const v = buildView({ profile: p, sampleMode: false, today: '2026-09-26' });
    expect(v.source).toBe('mine');
    expect(v.budget!.safe.amount).toBe(-235); // 640 − 350 card − 450 rent (Oct 1, before the Oct 2 payday) − 75 cushion
    expect(v.budget!.safe.status).toBe('short');
    expect(v.budget!.insights.some((i) => i.type === 'subscriptions')).toBe(false);
    expect(v.budget!.progress.pct).toBe(40);
  });

  it('company current ratios come from the bundled companies', () => {
    expect(companyRatios().length).toBeGreaterThan(0);
  });
});

describe('input helpers', () => {
  it('parseMoney / moneyText', () => {
    expect(parseMoney('$1,120.50')).toBe(1120.5);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(moneyText(15.5)).toBe('15.50');
    expect(moneyText(840)).toBe('840');
  });
  it('dayChips', () => {
    expect(dayChips('2026-10-05', 2)).toEqual([
      { date: '2026-10-06', label: 'Tue Oct 6' },
      { date: '2026-10-07', label: 'Wed Oct 7' },
    ]);
  });
});
