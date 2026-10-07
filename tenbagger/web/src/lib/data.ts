/**
 * Build-time data loading. Everything here runs in Node during `astro build`
 * (never in the browser). Paths come from site.config.ts → data.
 */
import fs from 'node:fs';
import path from 'node:path';
import site from '../../site.config.ts';
import type { Company, CompaniesFile } from '../../../packages/screener/src/index.ts';

export type { Company } from '../../../packages/screener/src/index.ts';

/** Resolve a path from site.config (relative to the web/ folder). */
export function fromWeb(p: string): string {
  return path.resolve(process.cwd(), p);
}

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(fromWeb(p), 'utf8')) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- companies

let _companies: CompaniesFile | null = null;
export function companiesFile(): CompaniesFile {
  if (_companies) return _companies;
  const f = readJson<CompaniesFile>(site.data.companies);
  _companies = f ?? { schema_version: 1, generated_at: '', source: 'missing', companies: [] };
  return _companies;
}

export function companies(): Company[] {
  return [...companiesFile().companies].sort((a, b) => a.name.localeCompare(b.name));
}

export function companyByTicker(t: string): Company | undefined {
  return companiesFile().companies.find((c) => c.ticker.toUpperCase() === t.toUpperCase());
}

export function tickerSlug(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/** "Micron Technology, Inc." → "Micron Technology"; "The Coca-Cola Company" → "Coca-Cola". */
export function shortName(name: string): string {
  return name
    .replace(/^The\s+/i, '')
    .replace(/,?\s+(Inc\.?|Corporation|Corp\.?|Company|Co\.?|Incorporated|Ltd\.?|plc|N\.V\.|S\.A\.|Holdings,? Inc\.?)$/i, '')
    .replace(/\s+&\s+Co\.?$/i, '')
    .replace(/,$/, '')
    .trim();
}

/** Compact slice of each company for client-side islands (keeps pages small). */
export function screenerPayload(): Array<Pick<Company, 'ticker' | 'name' | 'sector' | 'industry' | 'metrics' | 'fundamentals'>> {
  return companies().map((c) => ({
    ticker: c.ticker,
    name: c.name,
    sector: c.sector,
    industry: c.industry,
    metrics: c.metrics,
    fundamentals: c.fundamentals,
  }));
}

export function anySamplePrices(): boolean {
  return companiesFile().companies.some((c) => c.price_is_sample);
}

// ---------------------------------------------------------------- lessons

export type Question = {
  id: string;
  type: 'multiple_choice' | 'numeric' | 'true_false' | 'compare' | 'order';
  prompt: string;
  choices?: string[];
  answer: number | boolean | number[];
  tolerance?: number;
  unit?: 'percent' | 'usd' | 'multiple' | 'none';
  explanation: string;
  source?: { ticker?: string; fy?: number; metrics?: string[]; formula?: string };
};
export type Lesson = { id: string; title: string; xp: number; intro: string; questions: Question[] };
export type Unit = { id: string; title: string; summary: string; order: number; lessons: Lesson[] };
export type LessonsFile = { schema_version: number; disclaimer?: string; units: Unit[] };

let _lessons: LessonsFile | null = null;
export function lessonsFile(): LessonsFile {
  if (_lessons) return _lessons;
  _lessons = readJson<LessonsFile>(site.data.lessons) ?? { schema_version: 1, units: [] };
  return _lessons;
}

export function findLesson(id: string): { unit: Unit; lesson: Lesson } | null {
  for (const unit of lessonsFile().units) {
    const lesson = unit.lessons.find((l) => l.id === id);
    if (lesson) return { unit, lesson };
  }
  return null;
}

/** Lessons whose questions cite a metric (used for "practice this" links). */
export function lessonsForMetric(metric: string): Array<{ unit: Unit; lesson: Lesson }> {
  const out: Array<{ unit: Unit; lesson: Lesson }> = [];
  for (const unit of lessonsFile().units) {
    for (const lesson of unit.lessons) {
      if (lesson.questions.some((q) => q.source?.metrics?.includes(metric))) out.push({ unit, lesson });
    }
  }
  return out;
}

/** Questions that use a given company (for "practice with this company"). */
export function questionsForTicker(ticker: string): Question[] {
  const out: Question[] = [];
  for (const unit of lessonsFile().units)
    for (const lesson of unit.lessons)
      for (const q of lesson.questions) if (q.source?.ticker === ticker && q.type !== 'order') out.push(q);
  return out;
}

/**
 * Pick demo questions: prefer a varied mix of types (multiple choice, compare,
 * true/false) so visitors see what a lesson feels like.
 */
export function demoQuestions(lessonId: string, n: number): { lesson: Lesson | null; questions: Question[] } {
  const found = findLesson(lessonId) ?? (lessonsFile().units[0]?.lessons[0] ? { lesson: lessonsFile().units[0].lessons[0] } : null);
  if (!found) return { lesson: null, questions: [] };
  const qs = found.lesson.questions;
  const picked: Question[] = [];
  for (const t of ['multiple_choice', 'compare', 'true_false', 'numeric', 'order'] as const) {
    const q = qs.find((x) => x.type === t && !picked.includes(x));
    if (q && picked.length < n) picked.push(q);
  }
  for (const q of qs) if (picked.length < n && !picked.includes(q)) picked.push(q);
  return { lesson: found.lesson, questions: picked };
}
