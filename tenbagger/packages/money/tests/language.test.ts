import { describe, expect, it } from 'vitest';
import {
  BANNED_PHRASES, buildLog, companyAnalogies, coverageCheck, estimateMonthlyFreeCashFlow, findBannedPhrases, netWorth, projectIncome, RUBRIC, scorecard, type Snapshot,
} from '../src/index.ts';
import { acct, DEPOSITS, LATEST, LOG, snap, STREAMS, stream } from './helpers.ts';

function textsFor(log: readonly Snapshot[], deposits = DEPOSITS, streams = STREAMS): string[] {
  const last = log[log.length - 1]!;
  const cov = coverageCheck(last, streams, 45);
  const sc = scorecard(log, streams, deposits);
  const an = companyAnalogies(netWorth(last), { monthlyFreeCashFlow: estimateMonthlyFreeCashFlow(log) });
  return [
    cov.headline, ...cov.assumptions,
    ...cov.dues.flatMap((d) => [d.sentence, ...d.steps.map((s) => s.label)]),
    ...projectIncome(streams, '2026-10-01', '2026-12-31').map((d) => d.note ?? ''),
    ...sc.categories.flatMap((c) => [c.title, c.reason, c.metric]), sc.overall.reason,
    ...an.flatMap((a) => [a.personal, a.company, a.companyFormula, a.explanation]),
    ...Object.values(RUBRIC).flatMap((r) => [r.title, r.measure, ...r.bands]),
  ];
}

describe('educational wording — banned-phrase scan', () => {
  const scenarios: Record<string, string[]> = {
    persona: textsFor(LOG),
    short: textsFor(buildLog([snap('2026-10-05', [acct('chk', 'checking', 100), acct('c', 'credit_card', 1000)], [{ accountId: 'c', statementBalance: 1000, minimumDue: 300, dueDate: '2026-10-17', apr: 0.3 }])]), [], []),
    minimumOnly: textsFor(
      buildLog([snap('2026-10-05', [acct('chk', 'checking', 1000), acct('c', 'credit_card', 1100)], [{ accountId: 'c', statementBalance: 1100, minimumDue: 25, dueDate: '2026-10-17', apr: 0.25 }])]),
      [],
      [stream({ id: 'j', condition: 'hours submitted', pendingUnsubmitted: { units: 20, periodEnd: '2026-10-03' } })],
    ),
    empty: textsFor(buildLog([snap('2026-10-05', [acct('chk', 'checking', 0)])]), [], []),
  };

  for (const [name, texts] of Object.entries(scenarios)) {
    it(`${name}: no buy/sell/should/recommend language`, () => {
      const hits = texts.flatMap((t) => findBannedPhrases(t).map((re) => `${re} in "${t}"`));
      expect(hits).toEqual([]);
      expect(texts.length).toBeGreaterThan(20);
    });
  }

  it('the checker itself catches advice phrasing', () => {
    for (const s of ['You should pay the card', 'Buy more index funds', 'sell your shares', 'We recommend saving', 'guaranteed returns', 'invest in bonds', 'hold this stock'])
      expect(findBannedPhrases(s).length, s).toBeGreaterThan(0);
    for (const s of ['holdings', 'the card balance exceeds your cash', 'investments', 'invested'])
      expect(findBannedPhrases(s), s).toEqual([]);
    expect(BANNED_PHRASES.length).toBeGreaterThan(5);
  });

  it('is deterministic', () => {
    expect(textsFor(LOG)).toEqual(textsFor(LOG));
    expect(JSON.stringify(coverageCheck(LATEST, STREAMS, 30))).toBe(JSON.stringify(coverageCheck(LATEST, STREAMS, 30)));
  });
});
