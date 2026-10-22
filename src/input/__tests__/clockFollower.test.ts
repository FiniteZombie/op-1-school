import { describe, expect, test } from 'vitest';
import { median, MIN_INTERVALS, PulseClockFollower } from '../ClockFollower';

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
    expect(g.estimate().bpm).toBeCloseTo(100, 9); // seeded from the first median
  });

  test('smooths with α = 0.2 after a tempo change', () => {
    const f = new PulseClockFollower();
    let t = feed(f, 25, 25); // 24 intervals at 25 ms: seeded at 100 BPM
    for (let i = 0; i < 23; i += 1) f.onPulse((t += 20));
    // 24 × 25 ms and 23 × 20 ms: the median is still 25 ms.
    expect(f.estimate().bpm).toBeCloseTo(100, 9);
    f.onPulse((t += 20));
    // 24 of each: median 22.5 ms = 111.11 BPM; the estimate moves a fifth of the way.
    const raw = 60000 / (22.5 * 24);
    expect(f.estimate().bpm).toBeCloseTo(100 + 0.2 * (raw - 100), 9);
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
