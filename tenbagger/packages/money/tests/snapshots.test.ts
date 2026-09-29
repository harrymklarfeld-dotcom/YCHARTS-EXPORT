import { describe, expect, it } from 'vitest';
import { appendSnapshot, buildLog, SnapshotError, takenAtKey, validateSnapshot, type SnapshotLog } from '../src/index.ts';
import { acct, LOG, PERSONA, snap } from './helpers.ts';

describe('append-only snapshot log', () => {
  const s1 = snap('2026-10-01', [acct('chk', 'checking', 100)]);
  const s2 = snap('2026-10-01T18:30', [acct('chk', 'checking', 120)]);

  it('returns a new frozen log and never mutates the input', () => {
    const empty: SnapshotLog = [];
    const a = appendSnapshot(empty, s1);
    const b = appendSnapshot(a, s2);
    expect(empty).toHaveLength(0);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
    expect(Object.isFrozen(b)).toBe(true);
    expect(Object.isFrozen(b[1]!.accounts[0])).toBe(true);
    // The caller's object is copied, so editing it later cannot rewrite history.
    s2.accounts[0]!.balance = 9999;
    expect(b[1]!.accounts[0]!.balance).toBe(120);
    s2.accounts[0]!.balance = 120;
  });

  it('requires strictly increasing takenAt', () => {
    const a = appendSnapshot([], s2);
    expect(() => appendSnapshot(a, s1)).toThrow(SnapshotError);
    expect(() => appendSnapshot(a, s2)).toThrow(/append-only/);
    expect(takenAtKey('2026-10-01')).toBe('2026-10-01T00:00:00');
    expect(takenAtKey('2026-10-01T09:05')).toBe('2026-10-01T09:05:00');
  });

  it('validates shapes and honest-label basis', () => {
    const bad = snap('2026-10-01T25:00', [
      acct('x', 'checking', Number.NaN),
      acct('x', 'credit_card', -5),
      { ...acct('y', 'savings', 1), basis: 'guess' as never },
    ], [
      { accountId: 'zzz', statementBalance: 10, minimumDue: 1, dueDate: '2026-10-17' },
      { accountId: 'y', statementBalance: 10, minimumDue: 20, dueDate: '2026-13-01', apr: 25 },
    ]);
    const p = validateSnapshot(bad);
    expect(p.join('\n')).toMatch(/takenAt/);
    expect(p.join('\n')).toMatch(/balance must be a finite number/);
    expect(p.join('\n')).toMatch(/duplicate account id "x"/);
    expect(p.join('\n')).toMatch(/positive amounts owed/);
    expect(p.join('\n')).toMatch(/basis must be verified or manual/);
    expect(p.join('\n')).toMatch(/unknown account "zzz"/);
    expect(p.join('\n')).toMatch(/must point at a credit_card or loan/);
    expect(p.join('\n')).toMatch(/minimumDue cannot exceed/);
    expect(p.join('\n')).toMatch(/apr is a decimal/);
    expect(() => appendSnapshot([], bad)).toThrow(SnapshotError);
    try {
      appendSnapshot([], bad);
    } catch (e) {
      expect((e as SnapshotError).problems.length).toBeGreaterThan(5);
    }
  });

  it('the sample persona log is valid and in order', () => {
    expect(LOG).toHaveLength(PERSONA.snapshots.length);
    expect(() => buildLog([...LOG].reverse())).toThrow(/append-only/);
  });
});
