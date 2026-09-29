import raw from './fixtures/alex.sample.json' with { type: 'json' };
import { buildLog, type Account, type IncomeDeposit, type IncomeStream, type Liability, type Snapshot, type SnapshotLog } from '../src/index.ts';

export const PERSONA = raw;
export const STREAMS = raw.streams as unknown as IncomeStream[];
export const DEPOSITS = raw.deposits as unknown as IncomeDeposit[];
export const LOG: SnapshotLog = buildLog(raw.snapshots as unknown as Snapshot[]);
export const LATEST: Snapshot = LOG[LOG.length - 1]!;

export function acct(id: string, kind: Account['kind'], balance: number, extra: Partial<Account> = {}): Account {
  return { id, name: id, kind, balance, asOf: '2026-10-05', basis: 'verified', ...extra };
}

export function snap(takenAt: string, accounts: Account[], liabilities: Liability[] = [], note = ''): Snapshot {
  return { takenAt, accounts, liabilities, note };
}

export function stream(extra: Partial<IncomeStream> & Pick<IncomeStream, 'id'>): IncomeStream {
  return {
    name: extra.id,
    kind: 'hourly',
    rate: 15.5,
    schedule: { unitsPerWeek: 10, weekdays: [1, 3, 5] },
    payFrequency: 'biweekly',
    nextPayDate: '2026-10-09',
    withholdingRate: 0,
    ...extra,
  };
}
