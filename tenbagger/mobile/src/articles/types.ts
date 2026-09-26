/**
 * Types for tenbagger/data/articles.json (built by tenbagger/content/build.mjs).
 * Spec: tenbagger/content/WIDGETS.md.
 */
import type { HistoryKey } from '../types/contract';
import type { ValueFormat } from '../lib/format';

export type Level = 'beginner' | 'intermediate' | 'advanced';
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];

export type CatalogEntry = {
  label: string;
  short: string;
  format: ValueFormat;
  /** Where the value lives on a company: `metrics`, `fundamentals`, or top-level (`company`, i.e. price). */
  source: 'metrics' | 'fundamentals' | 'company';
  formula: string;
  terms?: [string, string];
  op?: string;
};

export type Widget =
  | { kind: 'metric'; ticker: string; metric: string; caption?: string }
  | { kind: 'compare'; tickers: string[]; metric: string; caption?: string }
  | { kind: 'history'; ticker: string; metric: HistoryKey; average: boolean; caption?: string }
  | { kind: 'quiz'; lesson: string; caption?: string }
  | { kind: 'calc_pe'; ticker?: string; price?: number; eps?: number; requiredReturn: number; caption?: string }
  | {
      kind: 'calc_dcf';
      ticker?: string;
      fcf?: number;
      growth: number;
      discount: number;
      terminal: number;
      years: number;
      netCash?: number;
      shares?: number;
      normalizedFcf?: number;
      cyclical: boolean;
      caption?: string;
    }
  | { kind: 'calc_liquidity'; cash: number; card: number; caption?: string }
  | { kind: 'unsupported'; original: string; reason: string };

export type Block = { type: 'markdown'; md: string } | { type: 'widget'; widget: Widget };

export type Article = {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  level: Level;
  unit: string;
  relatedLessons: string[];
  metrics: string[];
  tags: string[];
  updated: string;
  wordCount: number;
  widgetCount: number;
  sampleTickers: string[];
  blocks: Block[];
};

export type ArticlesFile = {
  schema_version: number;
  generated_at: string;
  provenance: { real_fixture_tickers: string[] };
  metrics: Record<string, CatalogEntry>;
  articles: Article[];
};
