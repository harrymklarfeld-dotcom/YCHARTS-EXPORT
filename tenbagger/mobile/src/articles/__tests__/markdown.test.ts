import { inlineText, parseInline, parseMarkdown } from '../markdown';

describe('markdown subset', () => {
  it('parses headings, paragraphs (joined lines), quotes and rules', () => {
    const b = parseMarkdown('## Title\n\nLine one\nline two.\n\n> gross margin = **gross profit** ÷ revenue\n\n---\n\n### Small');
    expect(b.map((x) => x.type)).toEqual(['heading', 'paragraph', 'quote', 'rule', 'heading']);
    expect(b[0]).toMatchObject({ type: 'heading', level: 2 });
    expect(b[1].type === 'paragraph' && inlineText(b[1].content)).toBe('Line one line two.');
    expect(b[4]).toMatchObject({ level: 3 });
  });
  it('parses unordered and ordered lists with continuation lines', () => {
    const b = parseMarkdown('- one\n- two\n  continued\n\n3. c\n4. d');
    expect(b[0]).toMatchObject({ type: 'list', ordered: false });
    expect(b[0].type === 'list' && b[0].items.map(inlineText)).toEqual(['one', 'two continued']);
    expect(b[1]).toMatchObject({ type: 'list', ordered: true, start: 3 });
  });
  it('keeps fenced code verbatim', () => {
    const b = parseMarkdown('```\na **not bold**\n```\nafter');
    expect(b[0]).toEqual({ type: 'code', text: 'a **not bold**' });
    expect(b[1].type).toBe('paragraph');
  });
  it('parses inline bold, italic, code, links, nesting', () => {
    expect(parseInline('a **b *c*** `d` [e](https://x.y) *f* g_h_i')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'b', c: [{ t: 'text', v: 'b ' }, { t: 'i', c: [{ t: 'text', v: 'c' }] }] },
      { t: 'text', v: '* ' },
      { t: 'code', v: 'd' },
      { t: 'text', v: ' ' },
      { t: 'link', href: 'https://x.y', c: [{ t: 'text', v: 'e' }] },
      { t: 'text', v: ' ' },
      { t: 'i', c: [{ t: 'text', v: 'f' }] },
      { t: 'text', v: ' g_h_i' },
    ]);
  });
  it('does not treat a lone asterisk or multiplication as emphasis', () => {
    expect(inlineText(parseInline('price × shares * 2'))).toBe('price × shares * 2');
    expect(parseInline('price × shares * 2')).toHaveLength(1);
  });
});
