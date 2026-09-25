/**
 * Validation + param coercion against widgets.json, companies.json and lessons.json.
 * Every function collects problems into `errors` / `warnings` arrays instead of throwing,
 * so the build can report everything at once.
 */

const FRONTMATTER_KEYS = ['slug', 'title', 'summary', 'minutes', 'level', 'unit', 'relatedLessons', 'metrics', 'tags', 'updated'];

/** Build lookup context from the three JSON files. */
export function makeContext({ spec, companies, lessons }) {
  const byTicker = new Map((companies?.companies ?? []).map((c) => [c.ticker, c]));
  const unitIds = new Map();
  const lessonIds = new Map();
  for (const u of lessons?.units ?? []) {
    unitIds.set(u.id, u);
    for (const l of u.lessons ?? []) lessonIds.set(l.id, { lesson: l, unit: u });
  }
  const banned = (spec.rules?.banned_phrases ?? []).map((p) => new RegExp(p, 'i'));
  return { spec, companies, byTicker, unitIds, lessonIds, banned };
}

/** Value of a catalog metric for a company (price lives at the top level). */
export function metricValue(company, key, spec) {
  if (key === 'price') return company.price ?? null;
  const info = spec.metrics[key];
  if (!info) return undefined;
  const bag = info.source === 'fundamentals' ? company.fundamentals : company.metrics;
  const v = bag?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isSampleCompany(company, ctx) {
  if (typeof company.fundamentals_is_sample === 'boolean') return company.fundamentals_is_sample;
  if (ctx.companies?.source !== 'fixture') return false;
  return !(ctx.spec.provenance?.real_fixture_tickers ?? []).includes(company.ticker);
}

function coerce(name, def, raw, ctx, err) {
  switch (def.type) {
    case 'string':
      return String(raw);
    case 'ticker': {
      const t = String(raw).toUpperCase();
      if (!ctx.byTicker.has(t)) return err(`unknown ticker "${raw}" for "${name}" (known: ${[...ctx.byTicker.keys()].join(', ')})`);
      return t;
    }
    case 'tickers': {
      const list = String(raw)
        .split(',')
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      const bad = list.filter((t) => !ctx.byTicker.has(t));
      if (bad.length) return err(`unknown ticker(s) ${bad.join(', ')} for "${name}"`);
      if (new Set(list).size !== list.length) return err(`duplicate tickers in "${name}"`);
      if (def.min && list.length < def.min) return err(`"${name}" needs at least ${def.min} tickers`);
      if (def.max && list.length > def.max) return err(`"${name}" allows at most ${def.max} tickers`);
      return list;
    }
    case 'metric':
      if (!(raw in ctx.spec.metrics)) return err(`unknown metric "${raw}" (see widgets.json → metrics)`);
      return raw;
    case 'history_metric':
      if (!ctx.spec.history_metrics.includes(raw)) return err(`"${raw}" is not a history series (allowed: ${ctx.spec.history_metrics.join(', ')})`);
      return raw;
    case 'lesson':
      if (!ctx.lessonIds.has(raw)) return err(`unknown lesson id "${raw}" (see data/lessons.json)`);
      return raw;
    case 'enum':
      if (!def.values.includes(raw)) return err(`"${name}" must be one of ${def.values.join(', ')} (got "${raw}")`);
      return raw;
    case 'number': {
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n)) return err(`"${name}" must be a number (got "${raw}")`);
      if (def.min !== undefined && n < def.min) return err(`"${name}" must be ≥ ${def.min}`);
      if (def.max !== undefined && n > def.max) return err(`"${name}" must be ≤ ${def.max}`);
      return n;
    }
    case 'boolean':
      if (raw === 'true' || raw === true) return true;
      if (raw === 'false' || raw === false) return false;
      return err(`"${name}" must be true or false`);
    default:
      return err(`spec error: unknown param type ${def.type}`);
  }
}

/**
 * Validate one widget block. Returns the normalized block ({type, kind, params}) or null.
 * Params are coerced (arrays, numbers, booleans) and defaults from widgets.json are filled in.
 */
export function validateWidget(block, ctx, errors, where) {
  const spec = ctx.spec.widgets[block.kind];
  const at = `${where}:${block.line ?? '?'}`;
  if (!spec) {
    errors.push(`${at}: unknown widget "widget:${block.kind}" (known: ${Object.keys(ctx.spec.widgets).join(', ')})`);
    return null;
  }
  let defs = { ...spec.params };
  if (spec.variants) {
    const variant = spec.variants[block.params.kind];
    if (!variant) {
      errors.push(`${at}: widget:${block.kind} needs kind=${Object.keys(spec.variants).join('|')}`);
      return null;
    }
    defs = { ...defs, ...variant };
  }
  let ok = true;
  const params = {};
  for (const [name, raw] of Object.entries(block.params)) {
    const def = defs[name];
    if (!def) {
      errors.push(`${at}: widget:${block.kind} does not take "${name}" (allowed: ${Object.keys(defs).join(', ')})`);
      ok = false;
      continue;
    }
    let failed = false;
    const v = coerce(name, def, raw, ctx, (msg) => {
      errors.push(`${at}: widget:${block.kind}: ${msg}`);
      failed = true;
      return undefined;
    });
    if (failed) ok = false;
    else params[name] = v;
  }
  for (const [name, def] of Object.entries(defs)) {
    if (def.required && !(name in block.params)) {
      errors.push(`${at}: widget:${block.kind} is missing required "${name}"`);
      ok = false;
    } else if (!(name in params) && def.default !== undefined) params[name] = def.default;
  }
  if (!ok) return null;

  // Data checks: the number the widget will show must exist.
  const need = (ticker, metric) => {
    const c = ctx.byTicker.get(ticker);
    const v = metricValue(c, metric, ctx.spec);
    if (v === null || v === undefined) {
      errors.push(`${at}: ${ticker} has no value for "${metric}" in companies.json (pick another company or metric)`);
      ok = false;
    }
  };
  if (block.kind === 'metric') need(params.ticker, params.metric);
  if (block.kind === 'compare') for (const t of params.tickers) need(t, params.metric);
  if (block.kind === 'history') {
    const series = ctx.byTicker.get(params.ticker).history?.[params.metric] ?? [];
    if (series.filter(([, v]) => v !== null).length < 2) {
      errors.push(`${at}: ${params.ticker} has fewer than 2 years of "${params.metric}" history`);
      ok = false;
    }
  }
  if (block.kind === 'calculator') {
    const c = params.ticker ? ctx.byTicker.get(params.ticker) : null;
    if (params.kind === 'pe' && !c && (params.price === undefined || params.eps === undefined)) {
      errors.push(`${at}: calculator kind=pe needs ticker=… or both price=… and eps=…`);
      ok = false;
    }
    if (params.kind === 'dcf') {
      if (!c && params.fcf === undefined) {
        errors.push(`${at}: calculator kind=dcf needs ticker=… or fcf=…`);
        ok = false;
      }
      if (c && params.fcf === undefined && metricValue(c, 'free_cash_flow', ctx.spec) === null) {
        errors.push(`${at}: ${c.ticker} has no free_cash_flow; pass fcf=…`);
        ok = false;
      }
      if (params.discount !== undefined && params.growth !== undefined && params.growth >= params.discount) {
        // Not strictly needed (we use a terminal multiple) but it is almost always a typo.
        errors.push(`${at}: growth (${params.growth}) should be below the discount rate (${params.discount})`);
        ok = false;
      }
    }
  }
  if (!ok) return null;
  return { type: 'widget', kind: block.kind, params };
}

export function validateFrontmatter(fm, ctx, errors, where, expectedSlug) {
  for (const k of Object.keys(fm)) if (!FRONTMATTER_KEYS.includes(k)) errors.push(`${where}: unknown frontmatter key "${k}"`);
  for (const k of FRONTMATTER_KEYS) if (!(k in fm)) errors.push(`${where}: missing frontmatter "${k}"`);
  const str = (k) => typeof fm[k] === 'string' && fm[k].trim() !== '';
  if ('slug' in fm) {
    if (!str('slug') || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.slug)) errors.push(`${where}: slug must be kebab-case`);
    else if (expectedSlug && fm.slug !== expectedSlug) errors.push(`${where}: slug "${fm.slug}" must match the file name "${expectedSlug}.md"`);
  }
  if ('title' in fm && !str('title')) errors.push(`${where}: title must be a non-empty string`);
  if ('summary' in fm && !str('summary')) errors.push(`${where}: summary must be a non-empty string`);
  if ('minutes' in fm && !(Number.isInteger(fm.minutes) && fm.minutes >= 1 && fm.minutes <= 30)) errors.push(`${where}: minutes must be an integer 1-30`);
  if ('level' in fm && !ctx.spec.rules.levels.includes(fm.level)) errors.push(`${where}: level must be one of ${ctx.spec.rules.levels.join(', ')}`);
  if ('unit' in fm && !ctx.unitIds.has(fm.unit)) errors.push(`${where}: unknown unit "${fm.unit}" (known: ${[...ctx.unitIds.keys()].join(', ')})`);
  const list = (k, check, what) => {
    if (!(k in fm)) return;
    if (!Array.isArray(fm[k])) return errors.push(`${where}: ${k} must be a list`);
    for (const x of fm[k]) if (!check(x)) errors.push(`${where}: unknown ${what} "${x}" in ${k}`);
  };
  list('relatedLessons', (x) => ctx.lessonIds.has(x), 'lesson id');
  list('metrics', (x) => typeof x === 'string' && x in ctx.spec.metrics, 'metric');
  list('tags', (x) => typeof x === 'string' && /^[a-z0-9-]+$/.test(x), 'tag (lowercase-kebab)');
  if ('updated' in fm) {
    const d = String(fm.updated);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) errors.push(`${where}: updated must be YYYY-MM-DD`);
  }
}

/** Markdown subset guard: the app + web renderers support a small, predictable subset. */
export function validateMarkdown(md, errors, where) {
  const lines = md.split('\n');
  let inCode = false;
  lines.forEach((line, i) => {
    if (/^\s{0,3}(```|~~~)/.test(line)) inCode = !inCode;
    if (inCode) return;
    if (/^#\s/.test(line)) errors.push(`${where}: use "##" or "###" for headings (the title comes from frontmatter): "${line}"`);
    if (/^#{4,}\s/.test(line)) errors.push(`${where}: headings deeper than ### are not supported`);
    if (/!\[[^\]]*\]\(/.test(line)) errors.push(`${where}: images are not supported in articles (use a widget)`);
    if (/^\s*\|.*\|\s*$/.test(line)) errors.push(`${where}: markdown tables are not supported (use a list or a compare widget)`);
    if (/<\/?[a-zA-Z][^>]*>/.test(line)) errors.push(`${where}: raw HTML is not supported: "${line.trim().slice(0, 40)}"`);
  });
}

export function scanBanned(text, ctx) {
  const hits = [];
  for (const re of ctx.banned) {
    const m = re.exec(text);
    if (m) {
      const ctxText = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' ');
      hits.push(`${m[0]}" in "…${ctxText}…`);
    }
  }
  return hits;
}

/** Validate a parsed article. Returns normalized article or null. */
export function validateArticle(parsed, ctx, { file, expectedSlug, errors, warnings }) {
  const where = file;
  const before = errors.length;
  validateFrontmatter(parsed.frontmatter, ctx, errors, where, expectedSlug);
  const blocks = [];
  let widgets = 0;
  const prose = [parsed.frontmatter.title, parsed.frontmatter.summary];
  for (const b of parsed.blocks) {
    if (b.type === 'markdown') {
      validateMarkdown(b.md, errors, where);
      prose.push(b.md);
      blocks.push({ type: 'markdown', md: b.md });
    } else {
      const w = validateWidget(b, ctx, errors, where);
      if (w) {
        widgets++;
        if (w.params.caption) prose.push(w.params.caption);
        blocks.push(w);
      }
    }
  }
  const min = ctx.spec.rules.min_widgets ?? 0;
  if (parsed.blocks.filter((b) => b.type === 'widget').length < min) errors.push(`${where}: needs at least ${min} widgets`);
  for (const hit of scanBanned(prose.filter(Boolean).join('\n'), ctx)) {
    errors.push(`${where}: educational-voice guard: "${hit}" reads like advice; rephrase (see WIDGETS.md → Voice)`);
  }
  if (errors.length > before) return null;
  const sampleTickers = new Set();
  for (const b of blocks) {
    if (b.type !== 'widget') continue;
    for (const t of [b.params.ticker, ...(b.params.tickers ?? [])].filter(Boolean)) {
      if (isSampleCompany(ctx.byTicker.get(t), ctx)) sampleTickers.add(t);
    }
  }
  return { ...parsed.frontmatter, updated: String(parsed.frontmatter.updated), widgetCount: widgets, sampleTickers: [...sampleTickers].sort(), blocks };
}

export { isSampleCompany };
