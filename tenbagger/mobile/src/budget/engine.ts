/**
 * Budget engine adapter. The logic lives in tenbagger/packages/budget (pure TS, no deps), consumed
 * like ../lib/screener.ts consumes packages/screener (Metro watches ../packages; Jest maps
 * @babel/runtime; tsconfig allows .ts imports). Budget screens import from here.
 */
export * from '../../../packages/budget/src/index';
export type { ExpectedDeposit, IncomeDeposit, ISODate, NumberLabel, Snapshot, Transaction, WorkEntry } from '../../../packages/money/src/index';
export { addDays, diffDays, formatUSD, LABEL_TEXT, shortDate, weekday, weekdayName } from '../../../packages/money/src/index';
