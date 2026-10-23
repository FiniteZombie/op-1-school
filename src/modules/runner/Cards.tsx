// Renders `markdown.ts`'s blocks as React elements. Text only ever goes in as
// text children, so there's no way to get HTML out of a card.

import type { ReactNode } from 'react';
import { parseMarkdown, type Inline } from './markdown';

function Inlines({ items }: { items: Inline[] }): ReactNode {
  return items.map((it, i) => {
    switch (it.kind) {
      case 'text':
        return it.text;
      case 'code':
        return (
          <code key={i} className="rounded bg-bg px-1 font-mono text-sm">
            {it.text}
          </code>
        );
      case 'bold':
        return (
          <strong key={i}>
            <Inlines items={it.children} />
          </strong>
        );
      case 'italic':
        return (
          <em key={i}>
            <Inlines items={it.children} />
          </em>
        );
    }
  });
}

const HEADING_CLASS = { 1: 'text-lg font-bold', 2: 'text-base font-bold', 3: 'text-base font-semibold' } as const;

export function Markdown({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed" data-markdown="">
      {parseMarkdown(source).map((b, i) => {
        switch (b.kind) {
          case 'p':
            return (
              <p key={i}>
                <Inlines items={b.inline} />
              </p>
            );
          case 'h':
            return (
              <p key={i} role="heading" aria-level={b.level} className={HEADING_CLASS[b.level]}>
                <Inlines items={b.inline} />
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="list-disc pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines items={it} />
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="list-decimal pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines items={it} />
                  </li>
                ))}
              </ol>
            );
        }
      })}
    </div>
  );
}
