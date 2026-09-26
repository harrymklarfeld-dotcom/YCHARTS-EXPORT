/**
 * Tiny Markdown parser for article bodies (pure, tested). Supports the subset in content/WIDGETS.md:
 * ##/### headings, paragraphs, **bold**, *italic*, `code`, [links](url), -/1. lists (one level),
 * > blockquotes, fenced code and --- rules. Anything else renders as plain text.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'b'; c: Inline[] }
  | { t: 'i'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] };

export type MdBlock =
  | { type: 'heading'; level: 2 | 3; content: Inline[] }
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { type: 'quote'; content: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'rule' };

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+?\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*?\*)|(_[^_\s][^_]*?_(?![A-Za-z0-9]))/;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  const pushText = (v: string) => {
    if (!v) return;
    const last = out[out.length - 1];
    if (last && last.t === 'text') last.v += v;
    else out.push({ t: 'text', v });
  };
  while (rest.length) {
    const m = INLINE_RE.exec(rest);
    if (!m || m.index === undefined) {
      pushText(rest);
      break;
    }
    pushText(rest.slice(0, m.index));
    const tok = m[0];
    if (m[1]) out.push({ t: 'code', v: tok.slice(1, -1) });
    else if (m[2]) out.push({ t: 'b', c: parseInline(tok.slice(2, -2)) });
    else if (m[3]) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      out.push({ t: 'link', href: lm[2], c: parseInline(lm[1]) });
    } else out.push({ t: 'i', c: parseInline(tok.slice(1, -1)) });
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

/** Plain text of inline nodes (for accessibility labels and search). */
export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : inlineText(n.c))).join('');
}

const UL = /^\s{0,3}[-*+]\s+(.*)$/;
const OL = /^\s{0,3}(\d+)[.)]\s+(.*)$/;

export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', content: parseInline(para.join(' ').trim()) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      flush();
      const code: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith(fence[1])) code.push(lines[j++]);
      blocks.push({ type: 'code', text: code.join('\n') });
      i = j;
      continue;
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ type: 'heading', level: h[1].length as 2 | 3, content: parseInline(h[2].trim()) });
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push({ type: 'rule' });
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) q.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      i--;
      blocks.push({ type: 'quote', content: parseInline(q.join(' ').trim()) });
      continue;
    }
    const ul = UL.exec(line);
    const ol = OL.exec(line);
    if (ul || ol) {
      flush();
      const ordered = !ul;
      const start = ol ? Number(ol[1]) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = ordered ? OL.exec(l) : UL.exec(l);
        if (m) items.push(ordered ? m[2] : m[1]);
        else if (l.trim() && /^\s{2,}\S/.test(l) && items.length) items[items.length - 1] += ` ${l.trim()}`;
        else break;
        i++;
      }
      i--;
      blocks.push({ type: 'list', ordered, start, items: items.map((s) => parseInline(s.trim())) });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
