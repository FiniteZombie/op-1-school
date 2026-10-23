import { describe, expect, it } from 'vitest';
import { countdownSeconds, formatCountdown, scaleMinutes, secondsLeft } from '../fast';

describe('fast', () => {
  it('divides minutes by 12: 4 minutes is 20 seconds', () => {
    expect(countdownSeconds(4, true)).toBe(20);
    expect(countdownSeconds(4, false)).toBe(240);
    expect(countdownSeconds(15, true)).toBe(75);
  });

  it('passes minutes through unless fast', () => {
    expect(scaleMinutes(4, false)).toBe(4);
    expect(scaleMinutes(4, true)).toBeCloseTo(0.3333, 4);
  });

  it('counts down from the segment start and stops at 0', () => {
    expect(secondsLeft(4, false, 1000, 1000 + 65_000)).toBe(175);
    expect(secondsLeft(4, true, 0, 99_000)).toBe(0);
  });

  it('formats m:ss', () => {
    expect(formatCountdown(175)).toBe('2:55');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});
