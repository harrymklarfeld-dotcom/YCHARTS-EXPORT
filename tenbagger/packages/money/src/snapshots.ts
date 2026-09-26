/**
 * Append-only snapshot log. Snapshots are never edited or overwritten: trends come from history.
 */
import { isISODate } from './dates.ts';
import { DEBT_KINDS } from './networth.ts';
import type { AccountKind, Snapshot, SnapshotLog } from './types.ts';

export class SnapshotError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid snapshot: ${problems.join('; ')}`);
    this.name = 'SnapshotError';
    this.problems = problems;
  }
}

const TAKEN_AT = /^(\d{4}-\d{2}-\d{2})(T(\d{2}):(\d{2})(:(\d{2}))?)?$/;
const KINDS: readonly AccountKind[] = ['checking', 'savings', 'brokerage', 'retirement', 'crypto', 'credit_card', 'loan'];

/** Sortable key for takenAt: `YYYY-MM-DDTHH:MM:SS` (date-only means start of day). */
export function takenAtKey(takenAt: string): string {
  const m = TAKEN_AT.exec(takenAt);
  if (!m || !isISODate(m[1])) throw new RangeError(`Invalid takenAt "${takenAt}"`);
  return `${m[1]}T${m[3] ?? '00'}:${m[4] ?? '00'}:${m[6] ?? '00'}`;
}

export function validateSnapshot(s: Snapshot): string[] {
  const p: string[] = [];
  const m = TAKEN_AT.exec(s.takenAt ?? '');
  if (!m || !isISODate(m[1]) || Number(m[3] ?? 0) > 23 || Number(m[4] ?? 0) > 59 || Number(m[6] ?? 0) > 59) {
    p.push(`takenAt "${String(s.takenAt)}" must be YYYY-MM-DD or YYYY-MM-DDTHH:MM (local time, no timezone)`);
  }
  if (typeof s.note !== 'string') p.push('note must be a string');
  const ids = new Set<string>();
  for (const a of s.accounts ?? []) {
    if (!a.id) p.push('every account needs an id');
    else if (ids.has(a.id)) p.push(`duplicate account id "${a.id}"`);
    ids.add(a.id);
    if (!KINDS.includes(a.kind)) p.push(`${a.id}: unknown kind "${String(a.kind)}"`);
    if (!Number.isFinite(a.balance)) p.push(`${a.id}: balance must be a finite number`);
    if (DEBT_KINDS.includes(a.kind) && a.balance < 0) p.push(`${a.id}: debt balances are stored as positive amounts owed`);
    if (a.available !== undefined && !Number.isFinite(a.available)) p.push(`${a.id}: available must be a finite number`);
    if (!isISODate(a.asOf)) p.push(`${a.id}: asOf must be YYYY-MM-DD`);
    if (a.basis !== 'verified' && a.basis !== 'manual') p.push(`${a.id}: basis must be verified or manual`);
  }
  for (const l of s.liabilities ?? []) {
    const acct = (s.accounts ?? []).find((a) => a.id === l.accountId);
    if (!acct) p.push(`liability for unknown account "${l.accountId}"`);
    else if (!DEBT_KINDS.includes(acct.kind)) p.push(`liability "${l.accountId}" must point at a credit_card or loan`);
    if (!isISODate(l.dueDate)) p.push(`${l.accountId}: dueDate must be YYYY-MM-DD`);
    if (!(l.statementBalance >= 0)) p.push(`${l.accountId}: statementBalance must be ≥ 0`);
    if (!(l.minimumDue >= 0)) p.push(`${l.accountId}: minimumDue must be ≥ 0`);
    if (l.minimumDue > l.statementBalance) p.push(`${l.accountId}: minimumDue cannot exceed statementBalance`);
    if (l.apr !== undefined && !(l.apr >= 0 && l.apr < 1)) p.push(`${l.accountId}: apr is a decimal in [0, 1)`);
  }
  if (!Array.isArray(s.accounts)) p.push('accounts must be an array');
  if (!Array.isArray(s.liabilities)) p.push('liabilities must be an array');
  return p;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

/**
 * Returns a NEW frozen log with `snapshot` appended (the input log is untouched).
 * Throws `SnapshotError` if the snapshot is invalid or not strictly later than the last one.
 */
export function appendSnapshot(log: SnapshotLog, snapshot: Snapshot): SnapshotLog {
  const problems = validateSnapshot(snapshot);
  const last = log[log.length - 1];
  if (!problems.length && last && takenAtKey(snapshot.takenAt) <= takenAtKey(last.takenAt)) {
    problems.push(`takenAt ${snapshot.takenAt} must be later than the last snapshot (${last.takenAt}); the log is append-only`);
  }
  if (problems.length) throw new SnapshotError(problems);
  const copy = deepFreeze(JSON.parse(JSON.stringify(snapshot)) as Snapshot);
  return Object.freeze([...log, copy]);
}

/** Build a log from raw data, validating every step (monotonic, append-only rules). */
export function buildLog(snapshots: readonly Snapshot[]): SnapshotLog {
  return snapshots.reduce<SnapshotLog>((log, s) => appendSnapshot(log, s), Object.freeze([]) as SnapshotLog);
}

export function latest(log: SnapshotLog): Snapshot | undefined {
  return log[log.length - 1];
}
