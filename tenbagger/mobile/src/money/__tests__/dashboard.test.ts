// Node built-ins without @types/node (the app tsconfig only loads jest types).
declare const require: (m: string) => any;
declare const __dirname: string;
const { readFileSync, readdirSync } = require('fs') as { readFileSync: (p: string, e: string) => string; readdirSync: (p: string) => string[] };
const { join } = require('path') as { join: (...p: string[]) => string };
import { getLesson } from '../../data';
import { buildDashboard, completeMonths, DASH_TABS, EMPTY_LOCAL, reportFor } from '../dashboard';
import { findBannedPhrases } from '../engine';
import { sampleMoneyData } from '../hub';
import { LEARN_TOPICS } from '../learn';

describe('Money dashboard model (sample persona)', () => {
  const d = buildDashboard(sampleMoneyData);

  it('has the eight tabs in order', () => {
    expect(DASH_TABS).toEqual(['overview', 'investments', 'bank', 'credit', 'income', 'spending', 'goals', 'report']);
  });

  it('overview: net worth, change since the last snapshot, 6 months of history, events and alerts', () => {
    expect(d.breakdown.net.value).toBe(3030);
    expect(d.change).toMatchObject({ change: 140 });
    expect(d.series[0].date).toBe('2026-04-30');
    expect(d.series).toHaveLength(11);
    expect(d.events.length).toBeGreaterThanOrEqual(3);
    expect(d.events[0].date > d.asOf).toBe(true);
    expect(d.alerts[0].id).toBe('pending-campus-job');
    expect(d.freshness.daysOld).toBe(0);
  });

  it('credit: $1,500 limit, utilization band, rebound after Sep 18, interest avoided', () => {
    expect(d.card.utilization).toMatchObject({ ratio: 0.75 });
    expect(d.card.utilization!.band!.id).toBe('high');
    expect(d.card.rebounds.find((r) => r.date === '2026-09-18')!.outrun).toBe(true);
    expect(d.card.interestAvoided!.perMonth).toBe(23.32);
    expect(d.card.cycle!.graceDays).toBe(23);
  });

  it('bank & spending: runway, subscriptions, leaks, pace', () => {
    expect(d.runwayDays).toBeGreaterThan(0);
    expect(d.subscriptions.map((s) => s.merchant)).toContain('streamtunes music');
    expect(d.spendMonth).toBe('2026-09');
    expect(d.leaks.length).toBeGreaterThan(0);
    expect(d.pace.month).toBe('2026-10');
  });

  it('investments: holdings, allocation, benchmark ESTIMATE, Roth tracker', () => {
    expect(d.investments.holdings!.total).toBe(2900);
    expect(d.investments.allocation[0].key).toBe('US stock index fund');
    expect(d.investments.benchmark!.label).toBe('estimate');
    expect(d.investments.roth).toMatchObject({ year: 2026, contributed: 300, limit: 7500 });
  });

  it('income logger: logged hours raise pending pay; hours in the closed period feed the card check', () => {
    const before = d.pending.find((p) => p.streamId === 'campus-job')!;
    const after = buildDashboard(sampleMoneyData, { ...EMPTY_LOCAL, workLog: [{ id: 'a', streamId: 'campus-job', date: '2026-10-05', units: 5 }] });
    expect(after.pending.find((p) => p.streamId === 'campus-job')!.units).toBe(before.units + 5);
    const closed = buildDashboard(sampleMoneyData, { ...EMPTY_LOCAL, workLog: [{ id: 'b', streamId: 'campus-job', date: '2026-10-02', units: 2 }] });
    expect(closed.coverage.dues[0].pendingIncomeBefore).toBeGreaterThan(d.coverage.dues[0].pendingIncomeBefore);
    const submitted = buildDashboard(sampleMoneyData, { ...EMPTY_LOCAL, workLog: [{ id: 'c', streamId: 'campus-job', date: '2026-10-05', units: 5, submitted: true }] });
    expect(submitted.pending.find((p) => p.streamId === 'campus-job')!.units).toBe(before.units);
  });

  it('goals: editable targets change the model', () => {
    expect(d.goals.items.map((g) => g.id)).toEqual(['emergency', 'card', 'roth']);
    const g = buildDashboard(sampleMoneyData, { ...EMPTY_LOCAL, goals: { emergencyFundWeeks: 4, rothTarget: 600 } });
    expect(g.goals.items[0].target).toBeCloseTo(d.goals.items[0].target / 2, 1);
    expect(g.goals.items[2].progress).toBe(0.5);
  });

  it('category overrides re-bucket spending', () => {
    const g = buildDashboard(sampleMoneyData, { ...EMPTY_LOCAL, categoryOverrides: { 'campus bookstore': 'shopping' } });
    expect(g.spend.categories.find((c) => c.category === 'books')?.total ?? 0).toBeLessThan(d.spend.categories.find((c) => c.category === 'books')!.total);
  });

  it('report: Personal 10-K for complete months, lesson links exist, share text is clean', () => {
    expect(completeMonths(sampleMoneyData.transactions!, d.asOf)).toEqual(['2026-09', '2026-08']);
    const r = reportFor(sampleMoneyData, '2026-09');
    expect(r.incomeStatement.income).toBe(563.4);
    for (const a of r.analogs) expect(getLesson(a.lessonId)).toBeDefined();
    expect(r.shareText).not.toMatch(/\d{6,}|Checking|Savings|Brokerage/);
  });

  it('learn topics link to real lessons', () => {
    for (const topic of Object.values(LEARN_TOPICS)) for (const id of topic.lessons) expect(getLesson(id)).toBeDefined();
  });

  it('uses educational wording only (generated text + learn topics + tab source strings)', () => {
    const r = reportFor(sampleMoneyData, '2026-09');
    const texts = [
      ...d.alerts.flatMap((a) => [a.title, a.text]),
      ...d.leaks.map((l) => l.sentence),
      d.pace.sentence,
      d.card.utilization!.sentence,
      ...d.card.cycle!.steps,
      d.card.interestAvoided!.sentence,
      d.investments.benchmark!.sentence,
      ...d.investments.roth!.notes,
      ...d.pending.map((p) => p.reminder),
      ...d.goals.items.map((g) => g.detail),
      r.shareText,
      ...r.analogs.map((a) => a.text),
      ...Object.values(LEARN_TOPICS).flatMap((x) => [x.title, ...x.paragraphs]),
    ];
    for (const s of texts) expect(findBannedPhrases(s)).toEqual([]);
    // Literal copy in the tab components.
    const dir = join(__dirname, '..', 'dashboard');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      const strings = [...src.matchAll(/(['"`])((?:(?!\1).){12,}?)\1/g)].map((m) => m[2]).concat([...src.matchAll(/>([^<>{}]{12,})</g)].map((m) => m[1]));
      for (const s of strings) expect({ f, s, hits: findBannedPhrases(s) }).toEqual({ f, s, hits: [] });
    }
  });

  it('never touches XP: the money store and dashboard do not import the game rules or award XP', () => {
    for (const f of ['store.ts', 'dashboard.ts', 'MoneyScreen.tsx']) {
      const src = readFileSync(join(__dirname, '..', f), 'utf8');
      expect(src).not.toMatch(/awardLearningXp|from '\.\.\/game'|addXpToLog/);
    }
  });
});
