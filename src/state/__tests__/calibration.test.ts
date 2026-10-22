import { describe, expect, test } from 'vitest';
import type { TimingOffset } from '../../types/music';
import { computeCalibration, defaultDevice, median } from '../calibration';

function offsets(values: number[]): TimingOffset[] {
  return values.map((offsetMs, i) => ({
    note: 60,
    targetTick: i * 192,
    offsetMs,
    source: 'touch',
    calibrated: false,
  }));
}

const meta = { source: 'touch', device: 'screen', outputLatencyMs: 40, measuredAt: 123 } as const;

describe('computeCalibration', () => {
  test('16 offsets with two outliers return their median', () => {
    const values = [20, 21, 19, 22, 18, 20, 21, 19, 20, 22, 18, 21, 19, 20, 400, -300];
    const rec = computeCalibration(offsets(values), meta);
    expect(rec.offsetMs).toBe(20); // sorted middle two are 20 and 20
    expect(rec).toMatchObject({ source: 'touch', device: 'screen', hits: 16, measuredAt: 123, outputLatencyMs: 40 });
  });

  test('an even count averages the middle two', () => {
    const values = Array.from({ length: 16 }, (_, i) => i); // 0..15, middle 7 and 8
    expect(computeCalibration(offsets(values), meta).offsetMs).toBe(7.5);
  });

  test('15 offsets throws', () => {
    expect(() => computeCalibration(offsets(new Array<number>(15).fill(10)), meta)).toThrow(/at least 16/);
  });
});

describe('median / defaultDevice', () => {
  test('odd count, even count, unsorted input', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow(RangeError);
  });

  test('touch is screen, mic is default', () => {
    expect(defaultDevice('touch')).toBe('screen');
    expect(defaultDevice('mic')).toBe('default');
  });
});
