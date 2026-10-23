import { describe, expect, test } from 'vitest';
import { FOLLOWER_WINDOW, median, MIN_INTERVALS, PulseClockFollower } from '../ClockFollower';

/** Feeds `count` pulses `intervalMs` apart from `t0`; returns the last timestamp. */
function feed(f: PulseClockFollower, count: number, intervalMs: number, t0 = 1000): number {
  let t = t0;
  for (let i = 0; i < count; i += 1) {
    t = t0 + i * intervalMs;
    f.onPulse(t);
  }
  return t;
}

describe('PulseClockFollower', () => {
  test('100 pulses 25 ms apart read 100.0 ±0.1 BPM with confidence ≥ 0.95', () => {
    const f = new PulseClockFollower();
    feed(f, 100, 25);
    const e = f.estimate();
    expect(Math.abs(e.bpm - 100)).toBeLessThanOrEqual(0.1);
    expect(e.confidence).toBeGreaterThanOrEqual(0.95);
  });

  test('one doubled interval (a dropped pulse) moves it less than 0.1 BPM', () => {
    const f = new PulseClockFollower();
    const last = feed(f, 100, 25);
    const before = f.estimate().bpm;
    f.onPulse(last + 50); // pulse at last + 25 never arrived
    for (let i = 1; i <= 10; i += 1) f.onPulse(last + 50 + i * 25);
    const after = f.estimate();
    expect(Math.abs(after.bpm - before)).toBeLessThan(0.1);
    expect(after.confidence).toBeGreaterThanOrEqual(0.95);
  });

  test('with 10 pulses confidence and BPM are 0; 24 intervals are needed', () => {
    const f = new PulseClockFollower();
    feed(f, 10, 25);
    expect(f.estimate()).toMatchObject({ bpm: 0, confidence: 0 });
    const g = new PulseClockFollower();
    feed(g, MIN_INTERVALS, 25); // 23 intervals
    expect(g.estimate().confidence).toBe(0);
    g.onPulse(1000 + MIN_INTERVALS * 25);
    expect(g.estimate().confidence).toBe(1);
    expect(g.estimate().bpm).toBeCloseTo(100, 9);
  });

  test('a tempo change drops confidence, then settles on the new tempo within a window', () => {
    const f = new PulseClockFollower();
    let t = feed(f, 120, 25); // 100 BPM
    for (let i = 0; i < 30; i += 1) f.onPulse((t += 20)); // 125 BPM
    expect(f.estimate().confidence).toBeLessThan(0.8);
    for (let i = 0; i < FOLLOWER_WINDOW; i += 1) f.onPulse((t += 20));
    expect(Math.abs(f.estimate().bpm - 125)).toBeLessThanOrEqual(0.1);
    expect(f.estimate().confidence).toBe(1);
  });

  // Windows Chrome delivered the Field's echoed clock 12.9–42 ms apart at a
  // true 90 BPM (27.8 ms), and the old median-of-intervals read 83 BPM.
  describe('bunched delivery', () => {
    /** Deterministic 0..1 values, so the jitter is the same every run. */
    function lcg(seed: number): () => number {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) % 2 ** 32;
        return s / 2 ** 32;
      };
    }

    test('0–15 ms of arrival jitter at 90 BPM reads 90 ±0.2 with confidence ≥ 0.8', () => {
      const f = new PulseClockFollower();
      const period = 60000 / (90 * 24);
      const rand = lcg(7);
      for (let i = 0; i < 200; i += 1) f.onPulse(1000 + i * period + 15 * rand());
      const e = f.estimate();
      expect(Math.abs(e.bpm - 90)).toBeLessThanOrEqual(0.2);
      expect(e.confidence).toBeGreaterThanOrEqual(0.8);
    });

    test('arrivals batched on a 15.6 ms timer at 120 BPM read 120 ±0.2, where a median of intervals is off by more than 5 %', () => {
      const f = new PulseClockFollower();
      const period = 60000 / (120 * 24);
      const arrivals: number[] = [];
      for (let i = 0; i < 200; i += 1) arrivals.push(Math.ceil((1000 + i * period) / 15.6) * 15.6);
      for (const t of arrivals) f.onPulse(t);
      const e = f.estimate();
      expect(Math.abs(e.bpm - 120)).toBeLessThanOrEqual(0.2);
      expect(e.confidence).toBeGreaterThanOrEqual(0.8);
      const intervals = arrivals.slice(1).map((t, i) => t - (arrivals[i] as number));
      expect(Math.abs(median(intervals) - period) / period).toBeGreaterThan(0.05);
    });

    test('alternating 15 / 35 ms reads 100 BPM with full confidence', () => {
      const f = new PulseClockFollower();
      let t = 1000;
      for (let i = 0; i < 120; i += 1) f.onPulse((t += i % 2 ? 15 : 35));
      const e = f.estimate();
      expect(Math.abs(e.bpm - 100)).toBeLessThanOrEqual(0.1);
      expect(e.confidence).toBeGreaterThanOrEqual(0.95);
    });
  });

  test('0xFA clears the history and restarts the beat count', () => {
    const f = new PulseClockFollower();
    feed(f, 60, 25);
    expect(f.estimate().bpm).toBeGreaterThan(0);
    f.onStart(5000);
    expect(f.estimate()).toEqual({ bpm: 0, confidence: 0, phasePerfMs: 5000 });
    for (let i = 0; i < 30; i += 1) f.onPulse(5000 + i * 25);
    // Pulse counts 0 and 24 are beats.
    expect(f.estimate().phasePerfMs).toBe(5000 + 24 * 25);
    expect(f.running()).toBe(true);
    f.onStop();
    expect(f.running()).toBe(false);
  });

  test('phasePerfMs before any 0xFA counts from the first pulse', () => {
    const f = new PulseClockFollower();
    expect(Number.isNaN(f.estimate().phasePerfMs)).toBe(true);
    f.onPulse(700);
    expect(f.estimate().phasePerfMs).toBe(700);
    feed(f, 30, 25, 725); // counts 1..30; count 24 is at 725 + 23 × 25
    expect(f.estimate().phasePerfMs).toBe(725 + 23 * 25);
  });

  test('median of an even count is the mean of the middle two', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([5, 1, 3])).toBe(3);
  });
});
