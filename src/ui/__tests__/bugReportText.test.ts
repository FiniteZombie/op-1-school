import { describe, expect, it } from 'vitest';
import { LOG_CAPACITY, type DiagnosticEntry } from '../../state/diagnostics';
import {
  ISSUE_NEW_URL,
  MAX_ISSUE_URL,
  REPORT_TEXT,
  browserOf,
  formatBugReport,
  issueLink,
  issueTitle,
  platformOf,
  type BugReport,
} from '../bugReportText';

const HEADER: Array<[string, string]> = [
  ['commit', 'abc1234'],
  ['at', '2026-10-28T12:00:00.000Z'],
  ['page', '/progression-trainer'],
];

const ENTRIES: DiagnosticEntry[] = [
  { t: 3200, kind: 'transport', text: 'started at 3.200', repeat: 1 },
  { t: 4210, kind: 'beat', text: '8 last 4.08 ctx 4.21 running | drums -11 bass -16 chords -inf | voices 16', repeat: 1 },
  { t: 12345, kind: 'warn', text: 'Max polyphony exceeded. Note dropped.', repeat: 30 },
];

function heartbeats(n: number): DiagnosticEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    t: 1000 * (i + 1),
    kind: 'beat' as const,
    text: `8 last ${(i + 0.9).toFixed(2)} ctx ${(i + 1).toFixed(2)} running | drums -11 bass -16 chords -19 | voices 4 #${i}`,
    repeat: 1,
  }));
}

function decode(url: string): URLSearchParams {
  expect(url.startsWith(`${ISSUE_NEW_URL}?`)).toBe(true);
  return new URLSearchParams(url.slice(ISSUE_NEW_URL.length + 1));
}

describe('formatBugReport', () => {
  it('puts the message first, then the header and log in a fenced block', () => {
    const text = formatBugReport({ message: '  first start was silent \n', header: HEADER, entries: ENTRIES });
    expect(text.split('\n')).toEqual([
      'first start was silent',
      '',
      '```text',
      'op-1-school bug report',
      'commit: abc1234',
      'at: 2026-10-28T12:00:00.000Z',
      'page: /progression-trainer',
      '',
      '[log, oldest first]',
      '+3.200 s transport started at 3.200',
      '+4.210 s beat 8 last 4.08 ctx 4.21 running | drums -11 bass -16 chords -inf | voices 16',
      '+12.345 s warn Max polyphony exceeded. Note dropped. (x30)',
      '```',
      '',
    ]);
  });

  it('says so when the log or the message is empty', () => {
    const text = formatBugReport({ message: '   ', header: [], entries: [] });
    expect(text).toContain(REPORT_TEXT.noMessage);
    expect(text).toContain(`${REPORT_TEXT.log}\n${REPORT_TEXT.noEntries}\n`);
  });

  it('says how many it dropped', () => {
    const text = formatBugReport({ message: 'x', header: [], entries: ENTRIES }, { dropOldest: 2 });
    expect(text).toContain(`${REPORT_TEXT.cut(2)}\n+12.345 s warn`);
    expect(text).not.toContain('transport started');
  });
});

describe('issueTitle', () => {
  it('uses the first line, cut to 60 characters', () => {
    expect(issueTitle('')).toBe('bug report');
    expect(issueTitle('  \n ')).toBe('bug report');
    expect(issueTitle('chords missing\nafter unlock')).toBe('bug: chords missing');
    const long = issueTitle('a'.repeat(100));
    expect(long).toBe(`bug: ${'a'.repeat(57)}...`);
  });
});

describe('issueLink', () => {
  it("doesn't cut a short report", () => {
    const r: BugReport = { message: 'chords missing', header: HEADER, entries: ENTRIES };
    const link = issueLink(r);
    expect(link).toMatchObject({ droppedEntries: 0, messageCut: false });
    const q = decode(link.url);
    expect(q.get('title')).toBe('bug: chords missing');
    expect(q.get('labels')).toBe('bug-report');
    expect(q.get('body')).toBe(formatBugReport(r));
    expect(q.get('body')).not.toContain('cut to fit');
  });

  it('drops the oldest entries of a full log to fit, keeping the newest', () => {
    const entries = heartbeats(LOG_CAPACITY);
    const r: BugReport = { message: 'first start: one chord, then silence\nstop/start fixed it', header: HEADER, entries };
    const link = issueLink(r);
    expect(link.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL);
    expect(link.droppedEntries).toBeGreaterThan(0);
    expect(link.messageCut).toBe(false);
    const body = decode(link.url).get('body') ?? '';
    expect(body).toContain(REPORT_TEXT.cut(link.droppedEntries));
    expect(body).toContain(`#${LOG_CAPACITY - 1}\n`);
    expect(body).not.toContain(`#${link.droppedEntries - 1}\n`);
    expect(body).toContain(`#${link.droppedEntries}\n`);
    expect(body).toBe(formatBugReport(r, { dropOldest: link.droppedEntries }));
    // The fewest: keeping one more entry wouldn't fit.
    const oneMore = new URLSearchParams({
      title: issueTitle(r.message),
      body: formatBugReport(r, { dropOldest: link.droppedEntries - 1 }),
      labels: 'bug-report',
    });
    expect(`${ISSUE_NEW_URL}?${oneMore}`.length).toBeGreaterThan(MAX_ISSUE_URL);
  });

  it('cuts a huge message once the log is gone, and still fits', () => {
    const r: BugReport = { message: 'z'.repeat(10_000), header: HEADER, entries: heartbeats(20) };
    const link = issueLink(r);
    expect(link.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL);
    expect(link.droppedEntries).toBe(20);
    expect(link.messageCut).toBe(true);
    const body = decode(link.url).get('body') ?? '';
    expect(body).toMatch(/^z+\.\.\.\n/);
    expect(body).toContain('commit: abc1234');
  });
});

describe('browserOf and platformOf', () => {
  const android =
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36';
  const windows =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
  const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

  it('reads Chrome on Android and Windows', () => {
    expect([browserOf(android), platformOf(android)]).toEqual(['chrome 156', 'android 10']);
    expect([browserOf(windows), platformOf(windows)]).toEqual(['chrome 156', 'windows']);
  });

  it('reads Firefox, and unknown for anything else', () => {
    expect(browserOf(firefox)).toBe('firefox 140');
    expect([browserOf('curl/8.0'), platformOf('curl/8.0')]).toEqual(['unknown', 'unknown']);
  });
});
