/**
 * Zero-dependency parser for Tenbagger articles.
 *
 *   ---                      <- YAML frontmatter (a small, documented subset)
 *   slug: gross-margin
 *   tags: [margins, basics]
 *   ---
 *   Markdown body with fenced widget blocks:
 *
 *   ```widget:metric ticker=COST metric=gross_margin
 *   ```
 *
 * Output: { frontmatter, blocks: [{type:'markdown', md} | {type:'widget', kind, params, line}] }
 * Params come out as raw strings here; ./validate.mjs coerces and checks them against widgets.json.
 */

export class ContentError extends Error {
  constructor(message, { file, line } = {}) {
    super(`${file ?? '<input>'}${line ? `:${line}` : ''}: ${message}`);
    this.file = file;
    this.line = line;
  }
}

/* ------------------------------------------------------------------ frontmatter */

/** Split `---\n...\n---\n` from the body. Returns { raw, body, bodyStartLine }. */
export function splitFrontmatter(text, file) {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!src.startsWith('---\n')) throw new ContentError('file must start with a "---" frontmatter block', { file, line: 1 });
  const end = src.indexOf('\n---', 4);
  if (end < 0) throw new ContentError('frontmatter is not closed with "---"', { file, line: 1 });
  const after = src.indexOf('\n', end + 4);
  const raw = src.slice(4, end + 1);
  const body = after < 0 ? '' : src.slice(after + 1);
  const bodyStartLine = raw.split('\n').length + 2;
  return { raw, body, bodyStartLine };
}

function parseScalar(v) {
  const s = v.trim();
  if (s === '') return '';
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const inner = s.slice(1, -1);
    return s.startsWith('"') ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner.replace(/''/g, "'");
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function splitFlowList(inner) {
  const out = [];
  let cur = '';
  let q = null;
  for (const ch of inner) {
    if (q) {
      cur += ch;
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim() !== '' || out.length) out.push(cur);
  return out.map((x) => parseScalar(x)).filter((x) => x !== '');
}

/**
 * YAML subset: `key: scalar`, `key: [a, b]`, `key:` followed by `  - item` lines,
 * `#` comment lines, quoted strings. No nesting beyond one list level.
 */
export function parseYamlSubset(raw, file, lineOffset = 1) {
  const out = {};
  const lines = raw.split('\n');
  let listKey = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = lineOffset + i;
    if (/^\s*(#.*)?$/.test(line)) continue;
    const item = /^\s+-\s+(.*)$/.exec(line) ?? /^-\s+(.*)$/.exec(line);
    if (item) {
      if (!listKey) throw new ContentError(`list item without a key: "${line.trim()}"`, { file, line: lineNo });
      out[listKey].push(parseScalar(item[1]));
      continue;
    }
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/.exec(line);
    if (!m) throw new ContentError(`cannot parse frontmatter line: "${line}"`, { file, line: lineNo });
    const [, key, rest] = m;
    if (key in out) throw new ContentError(`duplicate frontmatter key "${key}"`, { file, line: lineNo });
    const v = rest.replace(/\s+#.*$/, '').trim();
    if (v === '') {
      out[key] = [];
      listKey = key;
      continue;
    }
    listKey = null;
    if (v.startsWith('[')) {
      if (!v.endsWith(']')) throw new ContentError(`unclosed list for "${key}"`, { file, line: lineNo });
      out[key] = splitFlowList(v.slice(1, -1));
    } else out[key] = parseScalar(v);
  }
  return out;
}

/* ------------------------------------------------------------------ widget params */

/** `ticker=COST metric=gross_margin caption="Two words"` → { ticker:'COST', ... } (strings). */
export function parseParams(str, { file, line } = {}) {
  const params = {};
  const re = /\s*([A-Za-z_][A-Za-z0-9_]*)=("((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))\s*/y;
  let i = 0;
  const s = str.trim();
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) throw new ContentError(`bad widget parameter near "${s.slice(i, i + 30)}" (expected key=value)`, { file, line });
    const key = m[1];
    const val = m[3] !== undefined ? m[3].replace(/\\(.)/g, '$1') : m[4] !== undefined ? m[4] : m[5];
    if (key in params) throw new ContentError(`duplicate widget parameter "${key}"`, { file, line });
    params[key] = val;
    i = re.lastIndex;
  }
  return params;
}

/* ------------------------------------------------------------------ body */

const FENCE_OPEN = /^(\s{0,3})(`{3,}|~{3,})\s*(.*)$/;
const ONE_LINE_WIDGET = /^\s{0,3}`{3}widget:([a-z][a-z0-9_-]*)\b(.*?)`{3}\s*$/;

/**
 * Split a markdown body into markdown chunks and widget blocks.
 * Canonical widget form (a fenced block whose info string starts with `widget:`):
 *
 *   ```widget:compare tickers=COST,AAPL metric=roic
 *   caption="Optional extra params can also go on their own lines"
 *   ```
 *
 * The one-line form ```widget:quiz lesson=u2-l1``` is accepted too.
 */
export function parseBody(body, { file, lineOffset = 1 } = {}) {
  const lines = body.split('\n');
  const blocks = [];
  let md = [];
  const flushMd = () => {
    const text = md.join('\n').replace(/^\n+|\s+$/g, '');
    if (text) blocks.push({ type: 'markdown', md: text });
    md = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = lineOffset + i;
    const one = ONE_LINE_WIDGET.exec(line);
    if (one) {
      flushMd();
      blocks.push({ type: 'widget', kind: one[1], params: parseParams(one[2], { file, line: lineNo }), line: lineNo });
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (!open) {
      md.push(line);
      continue;
    }
    const fence = open[2];
    const info = open[3];
    const closeRe = new RegExp(`^\\s{0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`);
    let j = i + 1;
    while (j < lines.length && !closeRe.test(lines[j])) j++;
    if (j >= lines.length) throw new ContentError('code fence is never closed', { file, line: lineNo });
    const w = /^widget:([a-z][a-z0-9_-]*)\b(.*)$/.exec(info);
    if (w) {
      flushMd();
      let params = parseParams(w[2], { file, line: lineNo });
      for (let k = i + 1; k < j; k++) {
        if (!lines[k].trim() || lines[k].trim().startsWith('#')) continue;
        const extra = parseParams(lines[k], { file, line: lineOffset + k });
        for (const key of Object.keys(extra)) {
          if (key in params) throw new ContentError(`duplicate widget parameter "${key}"`, { file, line: lineOffset + k });
        }
        params = { ...params, ...extra };
      }
      blocks.push({ type: 'widget', kind: w[1], params, line: lineNo });
    } else {
      for (let k = i; k <= j; k++) md.push(lines[k]);
    }
    i = j;
  }
  flushMd();
  return blocks;
}

/** Full article parse (no validation). */
export function parseArticle(text, file) {
  const { raw, body, bodyStartLine } = splitFrontmatter(text, file);
  const frontmatter = parseYamlSubset(raw, file, 2);
  const blocks = parseBody(body, { file, lineOffset: bodyStartLine });
  return { frontmatter, blocks };
}

/** Prose word count (markdown blocks only; markup stripped). */
export function wordCount(blocks) {
  const text = blocks
    .filter((b) => b.type === 'markdown')
    .map((b) => b.md)
    .join(' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ');
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9$]/.test(w)).length;
}
