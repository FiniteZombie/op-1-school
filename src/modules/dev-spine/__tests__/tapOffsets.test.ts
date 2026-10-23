import { describe, expect, it } from 'vitest';
import { FakeClockBridge } from '../../../audio/__fakes__/FakeTransport';
import { nearestBeatOffsetMs, tapRows, tapStats } from '../tapOffsets';

describe('nearestBeatOffsetMs', () => {
  // audioToPerf(t) = 5000 + 1000·t, heard 40 ms later; beats every 0.5 s from 10 s.
  const clock = new FakeClockBridge(5000, 0.04);

  it('measures from the beat as heard (SPEC §3.3 worked number)', () => {
    expect(nearestBeatOffsetMs(15062, 10, 0.5, clock)).toBeCloseTo(22, 9);
  });

  it('picks the heard beat even when latency puts the tap nearer the scheduled one before it', () => {
    // Beat 10.5 s is heard at 15540; a tap at 15530 is 10 ms early, not 30 ms past 10.5's schedule.
    expect(nearestBeatOffsetMs(15530, 10, 0.5, clock)).toBeCloseTo(-10, 9);
  });

  it('works on beats before beat zero', () => {
    expect(nearestBeatOffsetMs(14040 - 5, 10, 0.5, clock)).toBeCloseTo(-5, 9);
  });
});

describe('tapStats', () => {
  it('is null with no taps', () => {
    expect(tapStats([])).toBeNull();
    expect(tapRows(null)).toEqual([['taps', 'no taps yet']]);
  });

  it('gives last, median and interquartile spread', () => {
    const s = tapStats([10, -2, 4, 30, 6]);
    expect(s).toEqual({ count: 5, lastMs: 6, medianMs: 6, spreadMs: 6 });
    expect(tapRows(s)).toEqual([
      ['taps', '5'],
      ['last', '+6.0 ms'],
      ['median', '+6.0 ms'],
      ['spread (iqr)', '6.0 ms'],
    ]);
  });
});
