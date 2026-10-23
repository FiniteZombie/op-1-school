import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from '../markdown';

const text = (t: string) => ({ kind: 'text', text: t });

describe('markdown subset', () => {
  it('reads paragraphs, and joins their lines', () => {
    expect(parseMarkdown('one\ntwo\n\nthree')).toEqual([
      { kind: 'p', inline: [text('one two')] },
      { kind: 'p', inline: [text('three')] },
    ]);
  });

  it('reads # to ### headings; #### and a missing space stay text', () => {
    expect(parseMarkdown('# a\n## b\n### c')).toEqual([
      { kind: 'h', level: 1, inline: [text('a')] },
      { kind: 'h', level: 2, inline: [text('b')] },
      { kind: 'h', level: 3, inline: [text('c')] },
    ]);
    expect(parseMarkdown('#### d')).toEqual([{ kind: 'p', inline: [text('#### d')] }]);
    expect(parseMarkdown('#e')).toEqual([{ kind: 'p', inline: [text('#e')] }]);
  });

  it('reads - and 1. lists, each run one list', () => {
    expect(parseMarkdown('- a\n- b\n\n1. c\n2. d')).toEqual([
      { kind: 'ul', items: [[text('a')], [text('b')]] },
      { kind: 'ol', items: [[text('c')], [text('d')]] },
    ]);
  });

  it('other list syntax is text', () => {
    expect(parseMarkdown('* a')).toEqual([{ kind: 'p', inline: [text('* a')] }]);
    expect(parseMarkdown('+ a')).toEqual([{ kind: 'p', inline: [text('+ a')] }]);
  });

  it('reads bold, italic and code, nested italic in bold', () => {
    expect(parseInline('a **b** *c* `d` e')).toEqual([
      text('a '),
      { kind: 'bold', children: [text('b')] },
      text(' '),
      { kind: 'italic', children: [text('c')] },
      text(' '),
      { kind: 'code', text: 'd' },
      text(' e'),
    ]);
    expect(parseInline('**a *b* c**')).toEqual([{ kind: 'bold', children: [text('a '), { kind: 'italic', children: [text('b')] }, text(' c')] }]);
  });

  it('leaves unclosed emphasis, spaced stars and empty code as text', () => {
    expect(parseInline('**a')).toEqual([text('**a')]);
    expect(parseInline('2 * 3 * 4')).toEqual([text('2 * 3 * 4')]);
    expect(parseInline('``')).toEqual([text('``')]);
  });

  it('keeps markup inside code as written', () => {
    expect(parseInline('`**x**`')).toEqual([{ kind: 'code', text: '**x**' }]);
  });

  it('keeps text that looks like HTML as text, in every position', () => {
    const html = '<script>alert(1)</script> <b>x</b> <img src=x onerror=y>';
    expect(parseMarkdown(html)).toEqual([{ kind: 'p', inline: [text(html)] }]);
    expect(parseMarkdown(`# ${html}`)).toEqual([{ kind: 'h', level: 1, inline: [text(html)] }]);
    expect(parseMarkdown(`- ${html}`)).toEqual([{ kind: 'ul', items: [[text(html)]] }]);
    expect(parseInline('**<i>x</i>**')).toEqual([{ kind: 'bold', children: [text('<i>x</i>')] }]);
    // Links and images are not in the subset either.
    expect(parseInline('[a](javascript:alert(1)) ![b](x)')).toEqual([text('[a](javascript:alert(1)) ![b](x)')]);
  });

  it('handles empty and CRLF input', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('a\r\n\r\nb')).toHaveLength(2);
  });
});
