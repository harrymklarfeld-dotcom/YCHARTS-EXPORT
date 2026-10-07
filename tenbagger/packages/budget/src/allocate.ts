/**
 * Which paycheck pays which bill. Each obligation after the first payday is funded by paychecks
 * that land STRICTLY BEFORE its due date (latest first, then earlier ones); whatever they cannot
 * cover must be set aside from cash now. Pending paychecks never fund obligations.
 *
 * Processing obligations by due date is optimal here: every paycheck that can serve an earlier
 * obligation can also serve any later one, so the set-aside amount is the true minimum.
 */
import { round2, toDayNumber, type ExpectedDeposit } from './money.ts';
import type { Obligation } from './obligations.ts';

export type Funding = { obligationId: string; depositIndex: number; amount: number };

export type FundingResult = {
  fundings: Funding[];
  /** Per obligation id: the part no paycheck can reach in time (set aside from cash). */
  fromCash: Record<string, number>;
  /** Total to set aside from cash now. */
  reserve: number;
  /** Per deposit index: amount already committed to obligations. */
  committed: number[];
};

export function fundObligations(deposits: readonly ExpectedDeposit[], obligations: readonly Obligation[]): FundingResult {
  const left = deposits.map((d) => (d.basis === 'projected' ? d.amount : 0));
  const committed = deposits.map(() => 0);
  const fundings: Funding[] = [];
  const fromCash: Record<string, number> = {};
  let reserve = 0;
  for (const o of obligations) {
    let need = o.amount;
    const due = toDayNumber(o.date);
    for (let i = deposits.length - 1; i >= 0 && need > 0.004; i--) {
      if (toDayNumber(deposits[i]!.date) >= due || left[i]! <= 0) continue;
      const take = round2(Math.min(left[i]!, need));
      left[i] = round2(left[i]! - take);
      committed[i] = round2(committed[i]! + take);
      need = round2(need - take);
      fundings.push({ obligationId: o.id, depositIndex: i, amount: take });
    }
    if (need > 0.004) {
      fromCash[o.id] = round2(need);
      reserve = round2(reserve + need);
    }
  }
  return { fundings, fromCash, reserve, committed };
}
