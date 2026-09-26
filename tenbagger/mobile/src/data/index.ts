/**
 * Data layer. Screens import ONLY from here (`@/data` style: '../data').
 * Source files are chosen in ./sources.ts — that's the one-line swap to real data.
 */
import type { Company, Lesson, Unit } from '../types/contract';
import { normalizeCompanies, normalizeLessons } from './normalize';
import { rawCompanies, rawLessons } from './sources';

const companiesFile = normalizeCompanies(rawCompanies);
const lessonsFile = normalizeLessons(rawLessons);
const byTicker = new Map(companiesFile.companies.map((c) => [c.ticker, c]));
const lessonIndex = new Map<string, { lesson: Lesson; unit: Unit }>();
for (const u of lessonsFile.units) for (const l of u.lessons) lessonIndex.set(l.id, { lesson: l, unit: u });

export const dataInfo = {
  companiesSource: companiesFile.source,
  generatedAt: companiesFile.generated_at,
  isSample: companiesFile.source === 'fixture',
};

export function getCompanies(): Company[] {
  return companiesFile.companies;
}

export function getCompany(ticker: string): Company | undefined {
  return byTicker.get(ticker.toUpperCase());
}

export function getUnits(): Unit[] {
  return lessonsFile.units;
}

export function getLesson(id: string): { lesson: Lesson; unit: Unit } | undefined {
  return lessonIndex.get(id);
}

export { normalizeCompanies, normalizeLessons };
