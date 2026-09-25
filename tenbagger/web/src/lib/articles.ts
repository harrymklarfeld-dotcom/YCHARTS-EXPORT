/**
 * Loads articles from content/articles/*.md at build time.
 *
 * Each file: YAML frontmatter + markdown body. Interactive widgets are fenced
 * code blocks whose language is `widget:<type>`, with a YAML or JSON body:
 *
 *   ```widget:metric
 *   ticker: COST
 *   metric: gross_margin
 *   ```
 *
 * Missing folder / files are fine: the site renders a placeholder instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { marked } from 'marked';
import site from '../../site.config.ts';
import { fromWeb } from './data.ts';

export type Segment =
  | { kind: 'html'; html: string }
  | { kind: 'widget'; type: string; props: Record<string, unknown>; raw: string; error?: string };

export type Article = {
  slug: string;
  title: string;
  description: string;
  date?: string;
  updated?: string;
  tickers: string[];
  metrics: string[];
  tags: string[];
  category?: string;
  level?: string;
  lessonId?: string;
  readingMinutes: number;
  segments: Segment[];
  headings: Array<{ id: string; text: string }>;
  data: Record<string, unknown>;
};

marked.setOptions({ gfm: true });

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const WIDGET_FENCE = /^(`{3,}|~{3,})\s*widget:([A-Za-z0-9_-]+)([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm;

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function asDate(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string' && v) return v;
  return undefined;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function parseWidgetBody(body: string, info: string): { props: Record<string, unknown>; error?: string } {
  const text = body.trim();
  const props: Record<string, unknown> = {};
  // Inline attributes on the fence line: ```widget:metric ticker=COST metric=roic
  for (const m of info.matchAll(/([A-Za-z_][\w-]*)=("[^"]*"|'[^']*'|\S+)/g)) {
    props[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!text) return { props };
  try {
    const parsed = parseYaml(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { props: { ...props, ...(parsed as object) } };
    if (Array.isArray(parsed)) return { props: { ...props, items: parsed } };
    return { props: { ...props, value: parsed } };
  } catch (e) {
    return { props, error: `Could not read widget settings: ${(e as Error).message.split('\n')[0]}` };
  }
}

function renderMarkdown(md: string, headings: Article['headings']): string {
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const plain = text.replace(/<[^>]+>/g, '');
    let id = slugify(plain) || `section-${headings.length + 1}`;
    while (headings.some((h) => h.id === id)) id += '-x';
    if (depth === 2) headings.push({ id, text: plain });
    const level = Math.min(6, Math.max(2, depth)); // the page owns the single <h1>
    return `<h${level} id="${id}">${text}</h${level}>\n`;
  };
  return marked.parse(md, { renderer, async: false }) as string;
}

function parseArticle(file: string, extra: Record<string, unknown> = {}): Article | null {
  let src: string;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  let data: Record<string, unknown> = {};
  const fm = src.match(FRONTMATTER);
  if (fm) {
    try {
      data = (parseYaml(fm[1]) as Record<string, unknown>) ?? {};
    } catch {
      data = {};
    }
    src = src.slice(fm[0].length);
  }
  data = { ...extra, ...data };
  if (data.draft === true) return null;

  // Title: frontmatter, else first "# " heading.
  let title = typeof data.title === 'string' ? data.title : '';
  const h1 = src.match(/^#\s+(.+)$/m);
  if (h1 && (!title || h1[1].trim() === title)) {
    title = title || h1[1].trim();
    src = src.replace(h1[0], '');
  }
  const base = path.basename(file).replace(/\.mdx?$/, '');
  const slug = slugify(typeof data.slug === 'string' ? data.slug : base);
  title = title || base.replace(/-/g, ' ');

  const headings: Article['headings'] = [];
  const segments: Segment[] = [];
  let last = 0;
  for (const m of src.matchAll(WIDGET_FENCE)) {
    const before = src.slice(last, m.index);
    if (before.trim()) segments.push({ kind: 'html', html: renderMarkdown(before, headings) });
    const { props, error } = parseWidgetBody(m[4], m[3]);
    segments.push({ kind: 'widget', type: m[2].toLowerCase(), props, raw: m[4], error });
    last = (m.index ?? 0) + m[0].length;
  }
  const rest = src.slice(last);
  if (rest.trim()) segments.push({ kind: 'html', html: renderMarkdown(rest, headings) });

  const words = src.replace(WIDGET_FENCE, '').split(/\s+/).filter(Boolean).length;
  const firstPara = src
    .replace(WIDGET_FENCE, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('|'));
  const description =
    (typeof data.description === 'string' && data.description) ||
    (typeof data.summary === 'string' && data.summary) ||
    (firstPara ?? '').replace(/[*_`[\]]|\(http[^)]*\)/g, '').slice(0, 170);

  return {
    slug,
    title,
    description,
    date: asDate(data.date ?? data.published),
    updated: asDate(data.updated),
    tickers: asList(data.tickers ?? data.ticker).map((t) => t.toUpperCase()),
    metrics: asList(data.metrics ?? data.metric),
    tags: asList(data.tags),
    category: typeof data.category === 'string' ? data.category : undefined,
    level: typeof data.level === 'string' ? data.level : undefined,
    lessonId: typeof data.lesson === 'string' ? data.lesson : typeof data.lesson_id === 'string' ? data.lesson_id : undefined,
    readingMinutes: typeof data.reading_minutes === 'number' ? data.reading_minutes : Math.max(1, Math.round(words / 220)),
    segments,
    headings,
    data,
  };
}

let _articles: Article[] | null = null;

/** All published articles, newest first (then by title). */
export function articles(): Article[] {
  if (_articles) return _articles;
  const dir = fromWeb(site.data.articlesDir);
  // Optional index file: an array, or { articles: [...] }, keyed by slug.
  const indexRaw = (() => {
    try {
      return JSON.parse(fs.readFileSync(fromWeb(site.data.articlesIndex), 'utf8'));
    } catch {
      return null;
    }
  })();
  const indexList: Array<Record<string, unknown>> = Array.isArray(indexRaw)
    ? indexRaw
    : Array.isArray(indexRaw?.articles)
      ? indexRaw.articles
      : [];
  const bySlug = new Map(indexList.filter((a) => typeof a.slug === 'string').map((a) => [String(a.slug), a]));

  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.md$/i.test(f) && !f.startsWith('_') && f.toUpperCase() !== 'README.MD');
  } catch {
    files = [];
  }
  const list: Article[] = [];
  for (const f of files) {
    const base = f.replace(/\.md$/i, '');
    const a = parseArticle(path.join(dir, f), (bySlug.get(base) ?? {}) as Record<string, unknown>);
    if (a && !list.some((x) => x.slug === a.slug)) list.push(a);
  }
  list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title));
  _articles = list;
  return list;
}

export function articlesForTicker(t: string): Article[] {
  return articles().filter((a) => a.tickers.includes(t.toUpperCase()));
}
export function articlesForMetric(m: string): Article[] {
  return articles().filter((a) => a.metrics.includes(m));
}
