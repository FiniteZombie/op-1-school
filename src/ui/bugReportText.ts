/**
 * The bug report's text, and the prefilled GitHub new-issue URL that carries
 * it, cut to fit. Pure (tested in `__tests__/bugReportText.test.ts`); the box
 * is `BugReport.tsx`, and the header's live values come from
 * `diagnosticsCapture.ts`.
 *
 * The report is Markdown, read both pasted into a chat and as an issue: the
 * owner's text, then the header and the log in one fenced block.
 */
import { formatEntry, type DiagnosticEntry } from '../state/diagnostics';

export const ISSUE_NEW_URL = 'https://github.com/FiniteZombie/op-1-school/issues/new';
export const ISSUE_LABEL = 'bug-report';
/** GitHub refuses new-issue URLs much past 8 KB. */
export const MAX_ISSUE_URL = 8000;
const TITLE_MAX = 60;

// placeholder: the report's fixed wording and the issue title rule, until the owner decides.
export const REPORT_TEXT = {
  heading: 'op-1-school bug report',
  noMessage: '(no description)',
  noEntries: 'no entries',
  log: '[log, oldest first]',
  cut: (n: number) => `[cut to fit github: ${n} oldest entries dropped; the copied report is full]`,
  titlePrefix: 'bug: ',
  titleEmpty: 'bug report',
} as const;

export interface BugReport {
  message: string;
  /** Ordered `key: value` rows under the heading. */
  header: Array<[string, string]>;
  /** Oldest first. */
  entries: DiagnosticEntry[];
}

interface FormatOptions {
  /** Log entries left out from the oldest end; a line says how many. */
  dropOldest?: number;
  /** The message cut to this many characters, `...` included. */
  messageMax?: number;
}

export function formatBugReport(r: BugReport, opts: FormatOptions = {}): string {
  const drop = Math.min(opts.dropOldest ?? 0, r.entries.length);
  const kept = r.entries.slice(drop);
  const message = clip(r.message.trim(), opts.messageMax) || REPORT_TEXT.noMessage;
  const lines = [
    REPORT_TEXT.heading,
    ...r.header.map(([k, v]) => `${k}: ${v}`),
    '',
    REPORT_TEXT.log,
    ...(drop > 0 ? [REPORT_TEXT.cut(drop)] : []),
    ...(kept.length === 0 ? [REPORT_TEXT.noEntries] : kept.map(formatEntry)),
  ];
  return `${message}\n\n\`\`\`text\n${lines.join('\n')}\n\`\`\`\n`;
}

function clip(text: string, max: number | undefined): string {
  if (max === undefined || text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

/** `bug: ` and the message's first line, cut to 60 characters; `bug report` when empty. */
export function issueTitle(message: string): string {
  const first = message.trim().split('\n')[0]?.trim() ?? '';
  if (first === '') return REPORT_TEXT.titleEmpty;
  return REPORT_TEXT.titlePrefix + clip(first, TITLE_MAX);
}

function urlFor(title: string, body: string): string {
  return `${ISSUE_NEW_URL}?${new URLSearchParams({ title, body, labels: ISSUE_LABEL }).toString()}`;
}

export interface IssueLink {
  url: string;
  /** Log entries dropped to fit. */
  droppedEntries: number;
  messageCut: boolean;
}

/**
 * The new-issue URL, at most `max` characters: the oldest log entries go
 * first, and the message is cut only when the log is gone and it still
 * doesn't fit.
 */
export function issueLink(r: BugReport, max = MAX_ISSUE_URL): IssueLink {
  const title = issueTitle(r.message);
  const fits = (opts: FormatOptions) => urlFor(title, formatBugReport(r, opts)).length <= max;

  if (fits({})) return { url: urlFor(title, formatBugReport(r)), droppedEntries: 0, messageCut: false };

  // Past 0 the cut line is there, so the length only falls as more go: binary-search the fewest.
  const n = r.entries.length;
  if (n > 0 && fits({ dropOldest: n })) {
    let lo = 1;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (fits({ dropOldest: mid })) hi = mid;
      else lo = mid + 1;
    }
    return { url: urlFor(title, formatBugReport(r, { dropOldest: lo })), droppedEntries: lo, messageCut: false };
  }

  let lo = 0;
  let hi = r.message.trim().length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (fits({ dropOldest: n, messageMax: mid })) lo = mid;
    else hi = mid - 1;
  }
  return { url: urlFor(title, formatBugReport(r, { dropOldest: n, messageMax: lo })), droppedEntries: n, messageCut: true };
}

/** `chrome 156`, `edge 156`, `firefox 140` or `unknown`, from a user agent. */
export function browserOf(ua: string): string {
  const edge = /Edg\/(\d+)/.exec(ua);
  if (edge) return `edge ${edge[1]}`;
  const chrome = /Chrome\/(\d+)/.exec(ua);
  if (chrome) return `chrome ${chrome[1]}`;
  const firefox = /Firefox\/(\d+)/.exec(ua);
  if (firefox) return `firefox ${firefox[1]}`;
  return 'unknown';
}

/** `android 10`, `windows`, `mac`, `linux`, `ios` or `unknown`. Android's reduced UA names no phone model. */
export function platformOf(ua: string): string {
  const android = /Android (\d+(?:\.\d+)?)/.exec(ua);
  if (android) return `android ${android[1]}`;
  if (/iPhone|iPad/.test(ua)) return 'ios';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac OS X/.test(ua)) return 'mac';
  if (/Linux/.test(ua)) return 'linux';
  return 'unknown';
}
