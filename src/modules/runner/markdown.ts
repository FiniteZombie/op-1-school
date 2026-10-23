// The card markdown subset (plan L3): paragraphs, `#`–`###` headings, `-` and
// `1.` lists, `**bold**`, `*italic*` and `code`. Anything else stays text, and
// nothing is ever HTML: the parser returns plain data and the view renders it
// as React text nodes.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; children: Inline[] }
  | { kind: 'italic'; children: Inline[] }
  | { kind: 'code'; text: string };

export type Block =
  | { kind: 'p'; inline: Inline[] }
  | { kind: 'h'; level: 1 | 2 | 3; inline: Inline[] }
  | { kind: 'ul'; items: Inline[][] }
  | { kind: 'ol'; items: Inline[][] };

function push(out: Inline[], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last?.kind === 'text') last.text += text;
  else out.push({ kind: 'text', text });
}

const isSpace = (c: string | undefined): boolean => c === undefined || /\s/.test(c);

/** Where the closing `marker` of an emphasis opened before `from` is, or -1. A closer follows a non-space. */
function closer(s: string, from: number, marker: string): number {
  for (let i = s.indexOf(marker, from); i >= 0; i = s.indexOf(marker, i + 1)) {
    if (i === from || isSpace(s[i - 1])) continue;
    if (marker === '*' && (s[i + 1] === '*' || s[i - 1] === '*')) continue;
    return i;
  }
  return -1;
}

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i] as string;
    if (c === '`') {
      const end = s.indexOf('`', i + 1);
      if (end > i + 1) {
        out.push({ kind: 'code', text: s.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    } else if (c === '*' && s[i + 1] === '*' && !isSpace(s[i + 2])) {
      const end = closer(s, i + 2, '**');
      if (end > 0) {
        out.push({ kind: 'bold', children: parseInline(s.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    } else if (c === '*' && s[i + 1] !== '*' && !isSpace(s[i + 1])) {
      const end = closer(s, i + 1, '*');
      if (end > 0) {
        out.push({ kind: 'italic', children: parseInline(s.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    push(out, c);
    i++;
  }
  return out;
}

const HEADING = /^(#{1,3}) +(\S.*)$/;
const BULLET = /^- +(\S.*)$/;
const NUMBERED = /^\d+\. +(\S.*)$/;

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = (): void => {
    if (para.length) blocks.push({ kind: 'p', inline: parseInline(para.join(' ')) });
    para = [];
  };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (line === '') {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: 'h', level: (heading[1] as string).length as 1 | 2 | 3, inline: parseInline(heading[2] as string) });
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      const item = parseInline(((bullet ?? numbered) as RegExpExecArray)[1] as string);
      const last = blocks[blocks.length - 1];
      if (last?.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}
