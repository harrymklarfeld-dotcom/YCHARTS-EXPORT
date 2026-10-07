import fixture from '../../../../packages/money/tests/fixtures/alex.sample.json';
import sample from '../../../assets/data/money.sample.json';
import { getLesson } from '../../data';
import { findBannedPhrases, RUBRIC } from '../engine';
import { buildMoneyHub, describeStream, getSampleHub, sampleMoneyData } from '../hub';

describe('Money hub (bundled sample persona)', () => {
  it('bundles the same fictional persona the engine is tested with, clearly labelled', () => {
    expect(sample).toEqual(fixture);
    expect(sampleMoneyData.sample).toBe(true);
    expect(sampleMoneyData.sampleLabel).toBe('Sample data — link accounts later');
    expect(sampleMoneyData.persona.name).toBe('Alex');
  });

  it('computes summary, coverage, scorecard and analogies through the shared engine', () => {
    const hub = getSampleHub();
    expect(hub.breakdown.liquidity.value).toBe(1250);
    expect(hub.breakdown.investments.value).toBe(2900);
    expect(hub.breakdown.debt.value).toBe(1120);
    expect(hub.breakdown.net.value).toBe(3030);
    expect(hub.coverage.verdict).toBe('covered');
    expect(hub.coverage.dues[0].dueDate).toBe('2026-10-17');
    expect(hub.coverage.runway.length).toBe(31);
    expect(hub.scorecard.categories).toHaveLength(6);
    expect(hub.scorecard.overall.grade).toBe('B');
  });

  it('labels every income stream honestly (VERIFIED history, PROJECTED schedule, PENDING unsubmitted)', () => {
    const hub = getSampleHub();
    const campus = hub.streams.find((s) => s.stream.id === 'campus-job')!;
    expect(campus.chips).toEqual(['verified', 'projected', 'pending']);
    expect(campus.lastPaid).toMatchObject({ date: '2026-09-25', amount: 353.4 });
    expect(campus.upcoming[0]).toMatchObject({ date: '2026-10-09', basis: 'pending' });
    const tutoring = hub.streams.find((s) => s.stream.id === 'tutoring')!;
    expect(tutoring.chips).toEqual(['verified', 'projected']);
    expect(describeStream(campus.stream)).toBe('$15.50/hr · ~10 hrs/week · paid biweekly');
    expect(describeStream(tutoring.stream)).toBe('$30/session · 2×/week · paid biweekly');
  });

  it('every 10-K analogy opens a lesson that exists in the bundled curriculum', () => {
    for (const a of getSampleHub().analogies) expect(getLesson(a.lessonId)).toBeDefined();
  });

  it('uses educational wording only', () => {
    const hub = getSampleHub();
    const texts = [
      hub.coverage.headline,
      ...hub.coverage.dues.map((d) => d.sentence),
      ...hub.scorecard.categories.map((c) => c.reason),
      hub.scorecard.overall.reason,
      ...hub.analogies.map((a) => a.explanation),
      ...Object.values(RUBRIC).flatMap((r) => r.bands),
    ];
    for (const s of texts) expect(findBannedPhrases(s)).toEqual([]);
  });

  it('rejects out-of-order snapshots (append-only)', () => {
    expect(() => buildMoneyHub({ ...sampleMoneyData, snapshots: [...sampleMoneyData.snapshots].reverse() })).toThrow(/append-only/);
  });
});
