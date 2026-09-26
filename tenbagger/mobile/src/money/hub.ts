/**
 * Builds everything the Money tab shows from one bundled data file. Pure (no React), so it is
 * unit-tested in __tests__/hub.test.ts.
 *
 * ===================== THE SWAP POINT =====================
 * Today this reads the FICTIONAL sample persona in assets/data/money.sample.json.
 * When account linking lands, pass real snapshots/streams/deposits to `buildMoneyHub` instead.
 * ==========================================================
 */
import sampleJson from '../../assets/data/money.sample.json';
import {
  buildLog,
  companyAnalogies,
  coverageCheck,
  estimateMonthlyFreeCashFlow,
  formatUSD,
  netWorth,
  scorecard,
  type Analogy,
  type Breakdown,
  type CoverageReport,
  type ExpectedDeposit,
  type IncomeDeposit,
  type IncomeStream,
  type NumberLabel,
  type Scorecard,
  type Snapshot,
  type SnapshotLog,
  type Contribution,
  type Dividend,
  type Holding,
  type PricePoint,
  type Transaction,
} from './engine';

export type DetectedStream = {
  id: string;
  name: string;
  category: string | null;
  frequency: string;
  status: string;
  averageAmount: number | null;
  lastAmount: number | null;
  lastDate: string | null;
  predictedNextDate: string | null;
  basis: 'verified';
  /** Sample-only hint: which manual stream this detected stream mirrors (never counted twice). */
  matchesStreamId?: string;
};

export type MoneyGoals = { emergencyFundWeeks: number; cardPayoffBy: string; rothTarget: number; rothYear: number };

export type MoneyData = {
  sample: boolean;
  sampleLabel: string;
  persona: { name: string; age: number; year: string; blurb: string };
  /** Reference "today" for the data (the sample persona is frozen on this date). */
  asOf?: string;
  horizonDays: number;
  streams: IncomeStream[];
  deposits: IncomeDeposit[];
  /** Recent snapshots (the backend returns the last 90 days). */
  snapshots: Snapshot[];
  // ---- dashboard extras (all optional; the dashboard hides what is missing) ----
  /** Older month-end snapshots, oldest first, all before `snapshots`. */
  monthEndSnapshots?: Snapshot[];
  transactions?: Transaction[];
  holdings?: Holding[];
  investmentContributions?: Contribution[];
  benchmark?: { ticker: string; note?: string; prices: PricePoint[] };
  dividends?: Dividend[];
  rothContributions?: (Contribution & { taxYear?: number })[];
  detectedStreams?: DetectedStream[];
  goals?: MoneyGoals;
};

export type StreamView = {
  stream: IncomeStream;
  upcoming: ExpectedDeposit[];
  lastPaid: IncomeDeposit | null;
  /** Chips shown on the row, strongest first. */
  chips: NumberLabel[];
};

export type MoneyHub = {
  data: MoneyData;
  log: SnapshotLog;
  latest: Snapshot;
  breakdown: Breakdown;
  coverage: CoverageReport;
  scorecard: Scorecard;
  analogies: Analogy[];
  streams: StreamView[];
};

export const sampleMoneyData = sampleJson as unknown as MoneyData;

export function buildMoneyHub(data: MoneyData): MoneyHub {
  const log = buildLog(data.snapshots);
  const latest = log[log.length - 1];
  if (!latest) throw new Error('Money data needs at least one snapshot');
  const breakdown = netWorth(latest);
  const coverage = coverageCheck(latest, data.streams, data.horizonDays);
  const sc = scorecard(log, data.streams, data.deposits);
  const analogies = companyAnalogies(breakdown, { monthlyFreeCashFlow: estimateMonthlyFreeCashFlow(log) });
  const streams: StreamView[] = data.streams.map((s) => {
    const upcoming = coverage.deposits.filter((d) => d.streamId === s.id);
    const paid = data.deposits.filter((d) => d.streamId === s.id && (d.basis === 'verified' || d.basis === 'manual'));
    const lastPaid = paid.length ? paid.reduce((a, b) => (b.date > a.date ? b : a)) : null;
    const chips: NumberLabel[] = [];
    if (lastPaid) chips.push(lastPaid.basis === 'manual' ? 'manual' : 'verified');
    if (upcoming.some((d) => d.basis === 'projected')) chips.push('projected');
    if (upcoming.some((d) => d.basis === 'pending')) chips.push('pending');
    return { stream: s, upcoming, lastPaid, chips };
  });
  return { data, log, latest, breakdown, coverage, scorecard: sc, analogies, streams };
}

let cached: MoneyHub | null = null;
export function getSampleHub(): MoneyHub {
  if (!cached) cached = buildMoneyHub(sampleMoneyData);
  return cached;
}

/** "$15.50/hr · ~10 hrs/week · biweekly" */
export function describeStream(s: IncomeStream): string {
  const freq = s.payFrequency === 'semimonthly' ? 'twice a month' : s.payFrequency;
  switch (s.kind) {
    case 'hourly':
      return `$${s.rate.toFixed(2)}/hr · ~${s.schedule.unitsPerWeek} hrs/week · paid ${freq}`;
    case 'per_session':
      return `$${s.rate.toFixed(0)}/session · ${s.schedule.unitsPerWeek}×/week · paid ${freq}`;
    case 'salary':
      return `${formatUSD(s.rate)}/yr · paid ${freq}`;
    case 'other':
      return `$${s.rate.toFixed(2)} per payment · ${freq}`;
  }
}
