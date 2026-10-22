import { describe, expect, it, vi } from 'vitest';
import { CHILLHOP_RHODES, DRUM_VOICES, drumHitsAt, drumPatternFor } from '../drumPatterns';

function hitSteps(row: readonly number[]): number[] {
  return row.flatMap((v, i) => (v > 0 ? [i] : []));
}

describe('chillhop-rhodes pattern (placeholder)', () => {
  it('has 16 steps for every voice', () => {
    expect(CHILLHOP_RHODES.steps).toBe(16);
    for (const voice of DRUM_VOICES) expect(CHILLHOP_RHODES.velocities[voice]).toHaveLength(16);
  });

  it('kicks on 0, 7, 10 and snares on 4, 12', () => {
    expect(hitSteps(CHILLHOP_RHODES.velocities.kick)).toEqual([0, 7, 10]);
    expect(hitSteps(CHILLHOP_RHODES.velocities.snare)).toEqual([4, 12]);
  });

  it('has a closed hat on all 16 steps, even steps accented', () => {
    const hat = CHILLHOP_RHODES.velocities.hat;
    expect(hitSteps(hat)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    for (let i = 0; i < 16; i += 2) {
      expect(hat[i]).toBeGreaterThan(hat[i + 1] ?? Infinity);
    }
    expect(new Set(hat.filter((_, i) => i % 2 === 0)).size).toBe(1);
    expect(new Set(hat.filter((_, i) => i % 2 === 1)).size).toBe(1);
  });

  it('drumHitsAt lists the voices on a step, wrapping past the bar', () => {
    expect(drumHitsAt(CHILLHOP_RHODES, 0).map((h) => h.voice)).toEqual(['kick', 'hat']);
    expect(drumHitsAt(CHILLHOP_RHODES, 4).map((h) => h.voice)).toEqual(['snare', 'hat']);
    expect(drumHitsAt(CHILLHOP_RHODES, 1).map((h) => h.voice)).toEqual(['hat']);
    expect(drumHitsAt(CHILLHOP_RHODES, 23).map((h) => h.voice)).toEqual(['kick', 'hat']);
  });
});

describe('drumPatternFor', () => {
  it('returns chillhop-rhodes without a warning', () => {
    const warn = vi.fn();
    expect(drumPatternFor('chillhop-rhodes', warn)).toBe(CHILLHOP_RHODES);
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to chillhop-rhodes with one warning per style', () => {
    const warn = vi.fn();
    expect(drumPatternFor('lofi-house', warn)).toBe(CHILLHOP_RHODES);
    expect(drumPatternFor('lofi-house', warn)).toBe(CHILLHOP_RHODES);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('lofi-house');
    drumPatternFor('boombap-soul', warn);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
