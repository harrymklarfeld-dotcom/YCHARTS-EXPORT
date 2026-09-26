/**
 * Articles data layer. Reads tenbagger/data/articles.json (built by tenbagger/content/build.mjs)
 * and normalizes it defensively: malformed articles are dropped, malformed widgets become
 * `unsupported` blocks.
 */
import articlesJson from '../../../data/articles.json';
import { parseWidget } from './params';
import { LEVELS, type Article, type ArticlesFile, type Block, type CatalogEntry, type Level } from './types';

const isStr = (v: unknown): v is string => typeof v === 'string';
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);

export function normalizeArticles(raw: unknown): ArticlesFile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const prov = (r.provenance ?? {}) as Record<string, unknown>;
  const metrics = (r.metrics && typeof r.metrics === 'object' ? r.metrics : {}) as Record<string, CatalogEntry>;
  const articles: Article[] = [];
  for (const a of Array.isArray(r.articles) ? r.articles : []) {
    if (!a || typeof a !== 'object') continue;
    const x = a as Record<string, unknown>;
    if (!isStr(x.slug) || !isStr(x.title) || !Array.isArray(x.blocks)) continue;
    const blocks: Block[] = [];
    for (const b of x.blocks as unknown[]) {
      const bb = (b ?? {}) as Record<string, unknown>;
      if (bb.type === 'markdown' && isStr(bb.md)) blocks.push({ type: 'markdown', md: bb.md });
      else if (bb.type === 'widget' && isStr(bb.kind)) blocks.push({ type: 'widget', widget: parseWidget(bb.kind, bb.params as Record<string, unknown>) });
    }
    const level = (LEVELS as string[]).includes(x.level as string) ? (x.level as Level) : 'beginner';
    articles.push({
      slug: x.slug,
      title: x.title,
      summary: isStr(x.summary) ? x.summary : '',
      minutes: typeof x.minutes === 'number' ? x.minutes : 5,
      level,
      unit: isStr(x.unit) ? x.unit : '',
      relatedLessons: strList(x.relatedLessons),
      metrics: strList(x.metrics),
      tags: strList(x.tags),
      updated: isStr(x.updated) ? x.updated : '',
      wordCount: typeof x.wordCount === 'number' ? x.wordCount : 0,
      widgetCount: blocks.filter((b) => b.type === 'widget').length,
      sampleTickers: strList(x.sampleTickers),
      blocks,
    });
  }
  return {
    schema_version: typeof r.schema_version === 'number' ? r.schema_version : 0,
    generated_at: isStr(r.generated_at) ? r.generated_at : '',
    provenance: { real_fixture_tickers: strList(prov.real_fixture_tickers) },
    metrics,
    articles,
  };
}

const file = normalizeArticles(articlesJson);
const bySlug = new Map(file.articles.map((a) => [a.slug, a]));

export const getArticlesFile = () => file;
export const getArticles = () => file.articles;
export const getArticle = (slug: string) => bySlug.get(slug);
export const getCatalogEntry = (key: string): CatalogEntry | undefined => file.metrics[key];

/** Filter by level ('all' for none) and a case-insensitive query over title, summary and tags. */
export function filterArticles(list: Article[], level: Level | 'all', query: string): Article[] {
  const q = query.trim().toLowerCase();
  return list.filter(
    (a) =>
      (level === 'all' || a.level === level) &&
      (!q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q))),
  );
}

/** The article after `slug` in library order (wraps to null at the end). */
export function nextArticle(slug: string): Article | null {
  const i = file.articles.findIndex((a) => a.slug === slug);
  return i >= 0 && i + 1 < file.articles.length ? file.articles[i + 1] : null;
}
