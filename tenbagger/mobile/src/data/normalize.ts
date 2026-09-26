import type { CompaniesFile, Company, LessonsFile, Question, Unit } from '../types/contract';

/**
 * Light runtime normalization. JSON from other agents is trusted to match CONTRACT.md,
 * but we defensively drop malformed entries instead of crashing the app.
 */
export function normalizeCompanies(raw: unknown): CompaniesFile {
  const f = raw as Partial<CompaniesFile> | null;
  const companies = Array.isArray(f?.companies) ? f!.companies : [];
  const valid = companies.filter(
    (c): c is Company => !!c && typeof c.ticker === 'string' && typeof c.name === 'string' && !!c.metrics && !!c.fundamentals,
  );
  return {
    schema_version: f?.schema_version ?? 1,
    generated_at: f?.generated_at ?? '',
    source: f?.source ?? 'unknown',
    companies: valid
      .map((c) => ({ ...c, ticker: c.ticker.toUpperCase(), history: c.history ?? {} }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
}

function validQuestion(q: Question): boolean {
  if (!q || typeof q.prompt !== 'string' || typeof q.id !== 'string') return false;
  switch (q.type) {
    case 'multiple_choice':
    case 'compare':
      return Array.isArray(q.choices) && typeof q.answer === 'number' && q.answer >= 0 && q.answer < q.choices.length;
    case 'numeric':
      return typeof q.answer === 'number' && Number.isFinite(q.answer);
    case 'true_false':
      return typeof q.answer === 'boolean';
    case 'order':
      return Array.isArray(q.choices) && Array.isArray(q.answer) && q.answer.length === q.choices.length;
    default:
      return false;
  }
}

export function normalizeLessons(raw: unknown): LessonsFile {
  const f = raw as Partial<LessonsFile> | null;
  const units = (Array.isArray(f?.units) ? f!.units : [])
    .filter((u): u is Unit => !!u && typeof u.id === 'string' && Array.isArray(u.lessons))
    .map((u) => ({
      ...u,
      lessons: u.lessons
        .map((l) => ({ ...l, xp: typeof l.xp === 'number' ? l.xp : 10, questions: (l.questions ?? []).filter(validQuestion) }))
        .filter((l) => l.questions.length > 0),
    }))
    .sort((a, b) => a.order - b.order);
  return { schema_version: f?.schema_version ?? 1, units };
}
