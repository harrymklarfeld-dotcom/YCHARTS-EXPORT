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

// ---------------------------------------------------------------- v2

export { funnel } from './funnel.ts';
export type { FunnelOutput, FunnelStep } from './funnel.ts';

export { concentration, GENERIC_SECTOR_NOTE, SECTOR_NOTES } from './concentration.ts';
export type { ConcentrationOptions, ConcentrationOutput, SectorNote, SectorShare } from './concentration.ts';

export { SCORE_FAMILIES, SCORE_FAMILY_IDS, getScoreFamily, scores, scoresByTicker } from './scores.ts';
export type {
  CompanyScores,
  FamilyScore,
  ScoreComponent,
  ScoreComponentDef,
  ScoreFamilyId,
  ScoreFamilyInfo,
} from './scores.ts';

export {
  SIZE_BUCKETS,
  STYLE_BOX_CONFIG,
  STYLE_BUCKETS,
  filterByStyle,
  sizeBucket,
  styleBox,
  styleBoxes,
} from './style.ts';
export type { SizeBucket, StyleBoxConfig, StyleBoxResult, StyleBucket, StyleFilter } from './style.ts';

export { BANNED_PHRASES, findBannedPhrases, isCleanLanguage } from './language.ts';

export {
  ASSIST_DISCLAIMER,
  ASSIST_LIMITS,
  ASSIST_SYNONYMS,
  ASSIST_TOOL,
  ASSIST_TOOL_NAME,
  buildAssistSystemPrompt,
  coerceAssistResult,
  describeFilterPlain,
  filtersAreFinite,
  mergeFilters,
  mockAssist,
  needsModel,
  normalizeAssistText,
  restateFilters,
  restatementNumbersMatch,
  validateAssistOutput,
} from './assist.ts';
export type { AssistInterpretation, AssistResult, AssistSource, AssistSynonym, AssistValidation } from './assist.ts';

export { CSV_ID_COLUMNS, catalogCsvColumn, csvCell, toCsv } from './export.ts';
export type { CsvColumn, CsvOptions } from './export.ts';
