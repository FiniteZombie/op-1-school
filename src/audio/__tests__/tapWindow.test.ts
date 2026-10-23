import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeClockBridge } from '../__fakes__/FakeTransport';
import { offsetMs } from '../Clock';
import { TAP_OFFSETS, TAP_TOLERANCE_FLOOR_MS, tapVerdict, tapWindow, type TapOffsets, type TapSource } from '../tapWindow';

/**
 * Reads `TapOffsets` from the **Tap offsets** table (plan decision 6): the
 * last Android row per input in table order, `Field keys …` → `midi`,
 * `touch …` → `touch`; minus signs may be U+2212; the IQR cell's first
 * number. A source with no Android row throws instead of reading as null.
 */
function parseTapOffsets(markdown: string): TapOffsets {
  const start = markdown.indexOf('### Tap offsets');
  if (start < 0) throw new Error('no "### Tap offsets" section');
  const rest = markdown.slice(start + 1);
  const next = rest.search(/\n#{1,3} /);
  const section = next < 0 ? rest : rest.slice(0, next);
  const num = (cell: string, what: string): number => {
    const m = /^[-+]?\d+(?:\.\d+)?/.exec(cell.replace(/−/g, '-').trim());
    if (!m) throw new Error(`no number in the ${what} cell "${cell}"`);
    return Number(m[0]);
  };
  const found: Partial<Record<TapSource, { medianMs: number; iqrMs: number }>> = {};
  for (const line of section.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const [device = '', input = '', median = '', iqr = ''] = cells;
    if (!device.startsWith('Android')) continue;
    const source: TapSource | null = input.startsWith('Field keys') ? 'midi' : input.startsWith('touch') ? 'touch' : null;
    if (!source) continue;
    found[source] = { medianMs: num(median, 'median'), iqrMs: num(iqr, 'IQR') };
  }
  const out = {} as Record<TapSource, { medianMs: number; iqrMs: number }>;
  for (const s of ['midi', 'touch'] as const) {
    const m = found[s];
    if (!m) throw new Error(`Tap offsets has no Android row for ${s}`);
    out[s] = m;
  }
  return out;
}

/** decision 6's measurements, injected so a re-measured row doesn't break the worked example. */
const MEASURED: TapOffsets = {
  midi: { medianMs: -5.7, iqrMs: 46.7 },
  touch: { medianMs: -43.2, iqrMs: 46.5 },
};

describe('decision 6 worked example: touch, no calibration', () => {
  // A chord change at audio 10.000 s on FakeClockBridge(5000, 0.029) is heard at 15 029 ms.
  const clock = new FakeClockBridge(5000, 0.029);

  it('a tap at 14 999 ms is −30.0 ms and on', () => {
    const { offsetMs: o, calibrated } = offsetMs(14999, 10, clock);
    expect(o).toBeCloseTo(-30, 9);
    expect(tapVerdict(o, 'touch', calibrated, MEASURED)).toBe('on');
  });

  it('a tap at 15 039 ms is +10.0 ms, +53.2 from the median, and late', () => {
    const { offsetMs: o, calibrated } = offsetMs(15039, 10, clock);
    expect(o).toBeCloseTo(10, 9);
    expect(tapVerdict(o, 'touch', calibrated, MEASURED)).toBe('late');
  });

  it('the windows are −89.7…+3.3 ms for touch and −52.4…+41.0 ms for midi', () => {
    const t = tapWindow('touch', false, MEASURED);
    expect(t?.earliestMs).toBeCloseTo(-89.7, 9);
    expect(t?.latestMs).toBeCloseTo(3.3, 9);
    const m = tapWindow('midi', false, MEASURED);
    expect(m?.earliestMs).toBeCloseTo(-52.4, 9);
    expect(m?.latestMs).toBeCloseTo(41.0, 9);
  });
});

describe('tapWindow and tapVerdict', () => {
  const tight: TapOffsets = { midi: { medianMs: 0, iqrMs: 12 }, touch: null };

  it('an IQR under the floor gives a ±20 ms window', () => {
    expect(TAP_TOLERANCE_FLOOR_MS).toBe(20);
    expect(tapWindow('midi', false, tight)).toEqual({ centreMs: 0, toleranceMs: 20, earliestMs: -20, latestMs: 20 });
    expect(tapVerdict(19, 'midi', false, tight)).toBe('on');
    expect(tapVerdict(21, 'midi', false, tight)).toBe('late');
    expect(tapVerdict(-21, 'midi', false, tight)).toBe('early');
  });

  it('a tap exactly on either edge is on', () => {
    expect(tapVerdict(20, 'midi', false, tight)).toBe('on');
    expect(tapVerdict(-20, 'midi', false, tight)).toBe('on');
    expect(tapVerdict(3.3, 'touch', false, MEASURED)).toBe('on');
    expect(tapVerdict(-89.7, 'touch', false, MEASURED)).toBe('on');
    expect(tapVerdict(3.31, 'touch', false, MEASURED)).toBe('late');
    expect(tapVerdict(-89.71, 'touch', false, MEASURED)).toBe('early');
  });

  it('calibrated offsets centre on 0 with the same half-width', () => {
    expect(tapWindow('touch', true, MEASURED)).toEqual({ centreMs: 0, toleranceMs: 46.5, earliestMs: -46.5, latestMs: 46.5 });
    // −30 is on against the median, and still on against 0; −50 is on uncalibrated, early calibrated.
    expect(tapVerdict(-50, 'touch', false, MEASURED)).toBe('on');
    expect(tapVerdict(-50, 'touch', true, MEASURED)).toBe('early');
    expect(tapVerdict(40, 'touch', true, MEASURED)).toBe('on');
    expect(tapVerdict(40, 'touch', false, MEASURED)).toBe('late');
  });

  it('a source with no measurement, and mic, are unscored', () => {
    expect(tapWindow('touch', false, tight)).toBeNull();
    expect(tapVerdict(0, 'touch', false, tight)).toBe('unscored');
    expect(tapWindow('mic')).toBeNull();
    expect(tapVerdict(0, 'mic', false)).toBe('unscored');
    expect(tapVerdict(0, 'mic', true, MEASURED)).toBe('unscored');
  });
});

describe('TAP_OFFSETS and docs/HARDWARE_NOTES.md', () => {
  const notes = readFileSync(resolve(import.meta.dirname, '../../../docs/HARDWARE_NOTES.md'), 'utf8');

  it('match the Tap offsets table, row for row', () => {
    expect(TAP_OFFSETS).toEqual(parseTapOffsets(notes));
  });

  const header = '### Tap offsets\n\n| Device and browser | Input | Median (ms) | Spread, IQR (ms) | Date |\n| --- | --- | --- | --- | --- |\n';
  const field = (median: string, iqr: string) => `| Android 10, Chrome | Field keys (note 53) | ${median} | ${iqr} | 2026-10-23 |\n`;
  const touch = (median: string, iqr: string) => `| Android 10, Chrome | touch on \`Keyboard24\` | ${median} | ${iqr} | 2026-10-23 |\n`;

  it('the parser reads U+2212 minus signs, the IQR cell’s first number, and the last matching row', () => {
    const md = `${header}${field('−1.0', '10 (range −5 to +5)')}${touch('−43.2', '46.5 (range −154.2 to +3.8)')}| Windows 11, Chrome | touch | 99 | 99 | x |\n${field('−5.7', '46.7 (range −41.8 to +39.1)')}\n### MIDI clock out\n\n| Android 10 | Field keys | 1 | 1 | x |\n`;
    expect(parseTapOffsets(md)).toEqual({ midi: { medianMs: -5.7, iqrMs: 46.7 }, touch: { medianMs: -43.2, iqrMs: 46.5 } });
  });

  it('the parser fails when an Android row is missing', () => {
    expect(() => parseTapOffsets(`${header}${field('−5.7', '46.7')}`)).toThrow(/touch/);
    expect(() => parseTapOffsets(`${header}${touch('−43.2', '46.5')}`)).toThrow(/midi/);
    expect(() => parseTapOffsets('no table here')).toThrow();
  });
});
