export type {
  Company,
  CompaniesFile,
  FieldKey,
  Filter,
  FilterOp,
  Fundamentals,
  FundamentalKey,
  History,
  HistorySeries,
  MetricKey,
  Metrics,
  Screen,
  SortDir,
} from './types.ts';

export {
  METRIC_CATALOG,
  METRIC_KEYS,
  FUNDAMENTAL_KEYS,
  getMetricInfo,
  isFieldKey,
  isMetricKey,
  formatValue,
} from './catalog.ts';
export type { MetricInfo, MetricCategory, Unit } from './catalog.ts';

export {
  MISSING,
  formatByUnit,
  formatCount,
  formatMultiple,
  formatPercent,
  formatRatio,
  formatUsd,
} from './format.ts';

export {
  FILTER_OPS,
  ScreenError,
  checkCompany,
  compareNullable,
  describeCondition,
  explainMatch,
  getValue,
  matchesScreen,
  runScreen,
  testValue,
  validateFilter,
  validateScreen,
} from './engine.ts';
export type {
  FilterCheck,
  FilterOutcome,
  MissingDataExclusion,
  RunScreenOutput,
  ScreenResult,
} from './engine.ts';

export { compareToPeers, median, percentileRank, sectorMedian } from './peers.ts';
export type { PeerComparison, PeerOptions } from './peers.ts';

export { PRESET_SCREENS, getPresetScreen } from './presets.ts';
export type { PresetScreen } from './presets.ts';

export {
  QueryParseError,
  normalizeMetricName,
  parseQuery,
  resolveMetric,
  safeParseQuery,
  suggestMetric,
} from './query.ts';
export type { ParseResult, QueryIssue } from './query.ts';
