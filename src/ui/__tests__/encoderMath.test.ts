import { describe, expect, it } from 'vitest';
import { angleOf, clamp01, dragValue, stepValue } from '../encoderMath';

describe('encoderMath', () => {
  it('clamps at 0 and 1', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(1.7)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(dragValue(0.9, 100, -500)).toBe(1); // dragged far up
    expect(dragValue(0.1, 100, 900)).toBe(0); // dragged far down
    expect(stepValue(0.995, 0.01)).toBe(1);
    expect(stepValue(0.005, -0.01)).toBe(0);
  });

  it('a 200 px drag up covers the full range; up increases', () => {
    expect(dragValue(0, 300, 100)).toBe(1);
    expect(dragValue(0.5, 300, 350)).toBeCloseTo(0.25, 10);
    expect(dragValue(0.5, 300, 280, 100)).toBeCloseTo(0.7, 10);
  });

  it('angles sweep −135° to +135°', () => {
    expect(angleOf(0)).toBe(-135);
    expect(angleOf(0.5)).toBe(0);
    expect(angleOf(1)).toBe(135);
    expect(angleOf(2)).toBe(135);
  });
});
