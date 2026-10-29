import { describe, expect, it } from 'vitest';
import {
  DiagnosticsLog,
  ENTRY_TEXT_MAX,
  LOG_CAPACITY,
  clipText,
  consoleText,
  formatEntry,
  formatHeartbeat,
} from '../diagnostics';

function fakeLog(capacity?: number): { log: DiagnosticsLog; at: (ms: number) => void } {
  let now = 0;
  return { log: new DiagnosticsLog(() => now, capacity), at: (ms) => (now = ms) };
}

describe('DiagnosticsLog', () => {
  it('keeps entries in order with their times', () => {
    const { log, at } = fakeLog();
    at(10);
    log.add('page', 'visible');
    at(25.5);
    log.add('transport', 'started at 3.200');
    expect(log.snapshot()).toEqual([
      { t: 10, kind: 'page', text: 'visible', repeat: 1 },
      { t: 25.5, kind: 'transport', text: 'started at 3.200', repeat: 1 },
    ]);
  });

  it('drops the oldest past its capacity', () => {
    const { log, at } = fakeLog();
    for (let i = 0; i <= LOG_CAPACITY; i++) {
      at(i);
      log.add('note', `n${i}`);
    }
    const entries = log.snapshot();
    expect(entries).toHaveLength(LOG_CAPACITY);
    expect(entries[0]?.text).toBe('n1');
    expect(entries[LOG_CAPACITY - 1]?.text).toBe(`n${LOG_CAPACITY}`);
  });

  it('folds a repeat of the newest line into it, keeping its first time', () => {
    const { log, at } = fakeLog();
    at(1);
    log.add('warn', 'Max polyphony exceeded. Note dropped.');
    at(2);
    log.add('warn', 'Max polyphony exceeded. Note dropped.');
    at(3);
    log.add('warn', 'Max polyphony exceeded. Note dropped.');
    expect(log.snapshot()).toEqual([{ t: 1, kind: 'warn', text: 'Max polyphony exceeded. Note dropped.', repeat: 3 }]);
  });

  it("doesn't fold a repeat with a different line between, or of another kind", () => {
    const { log } = fakeLog();
    log.add('warn', 'a');
    log.add('warn', 'b');
    log.add('warn', 'a');
    log.add('error', 'a');
    expect(log.snapshot().map((e) => [e.kind, e.text, e.repeat])).toEqual([
      ['warn', 'a', 1],
      ['warn', 'b', 1],
      ['warn', 'a', 1],
      ['error', 'a', 1],
    ]);
  });

  it('hands out copies', () => {
    const { log } = fakeLog();
    log.add('note', 'x');
    const snap = log.snapshot();
    log.add('note', 'x');
    expect(snap[0]?.repeat).toBe(1);
  });
});

describe('clipText', () => {
  it('clips long text to the limit with ...', () => {
    const text = 'x'.repeat(ENTRY_TEXT_MAX + 50);
    const clipped = clipText(text);
    expect(clipped).toHaveLength(ENTRY_TEXT_MAX);
    expect(clipped.endsWith('...')).toBe(true);
  });

  it('leaves text at the limit alone', () => {
    const text = 'y'.repeat(ENTRY_TEXT_MAX);
    expect(clipText(text)).toBe(text);
  });

  it('puts a stack on one line', () => {
    expect(clipText('TypeError: x\n    at f (a.js:1:2)\n')).toBe('TypeError: x / at f (a.js:1:2)');
  });
});

describe('consoleText', () => {
  it('joins strings, errors and objects on one line', () => {
    expect(consoleText(['Max polyphony exceeded.', 'Note dropped.'])).toBe('Max polyphony exceeded. Note dropped.');
    expect(consoleText([new TypeError('x is undefined')])).toBe('TypeError: x is undefined');
    expect(consoleText(['state', { a: 1 }, 3, null])).toBe('state {"a":1} 3 null');
  });

  it("falls back to String for objects JSON can't take", () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(consoleText([loop])).toBe('[object Object]');
  });
});

describe('formatHeartbeat', () => {
  // 120 BPM: a sixteenth is 125 ms, so a one-second heartbeat sees 7 to 9.
  it('reads a healthy beat with one synth', () => {
    expect(
      formatHeartbeat({
        sixteenths: 8,
        lastAudioTime: 12.3,
        ctxTime: 12.41,
        ctxState: 'running',
        synths: [{ levels: { drums: -11.4, bass: -16, chords: -19.2 }, voices: 4 }],
      }),
    ).toBe('8 last 12.30 ctx 12.41 running | drums -11 bass -16 chords -19 | voices 4');
  });

  it('reads silence as -inf, and a stalled scheduler as 0', () => {
    expect(
      formatHeartbeat({
        sixteenths: 0,
        lastAudioTime: 3.2,
        ctxTime: 5.2,
        ctxState: 'running',
        synths: [{ levels: { drums: -Infinity, bass: -140, chords: -30 }, voices: 1 }],
      }),
    ).toBe('0 last 3.20 ctx 5.20 running | drums -inf bass -inf chords -30 | voices 1');
  });

  it('says when no backing synth is live', () => {
    expect(formatHeartbeat({ sixteenths: 8, lastAudioTime: null, ctxTime: 1, ctxState: 'running', synths: [] })).toBe(
      '8 last - ctx 1.00 running | no backing',
    );
  });
});

describe('formatEntry', () => {
  it('reads time in seconds, kind, text and repeats', () => {
    expect(formatEntry({ t: 12345, kind: 'warn', text: 'probe', repeat: 2 })).toBe('+12.345 s warn probe (x2)');
    expect(formatEntry({ t: 500.4, kind: 'page', text: 'hidden', repeat: 1 })).toBe('+0.500 s page hidden');
  });
});
