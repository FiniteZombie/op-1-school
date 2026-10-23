import { describe, expect, it } from 'vitest';
import { loadProgression } from '../../../theory';
import { C_MAJOR_POP, F_MINOR_TURNAROUND, G_DORIAN_VAMP } from '../../../theory/__tests__/fixtures';
import type { Progression } from '../../../types/music';
import { usableFor } from '../levels';
import { spec } from './harness';

const C = { tonic: 0, mode: 'ionian' } as const;
const p = (romans: string[], beats = 4): Progression => loadProgression(spec(`test-${romans.join('-')}`, C, romans, beats));

describe('usableFor', () => {
  const pop = loadProgression(C_MAJOR_POP);
  const oneChord = p(['I', 'I']);

  it('A0 needs two distinct chords', () => {
    expect(usableFor('A0', pop)).toBe(true);
    expect(usableFor('A0', oneChord)).toBe(false);
  });

  it('A1 and A2 take anything', () => {
    expect(usableFor('A1', oneChord)).toBe(true);
    expect(usableFor('A2', oneChord)).toBe(true);
  });

  it('A3 needs a quality family for every chord', () => {
    expect(usableFor('A3', p(['ii7', 'V7', 'Imaj7', 'IVsus2']))).toBe(true);
    expect(usableFor('A3', loadProgression(G_DORIAN_VAMP))).toBe(false);
  });

  it('A4 needs a pair of consecutive chords that differ (identical pairs are skipped)', () => {
    expect(usableFor('A4', pop)).toBe(true);
    expect(usableFor('A4', oneChord)).toBe(false);
  });

  it('A5 needs a 7th or a 6th in every chord', () => {
    expect(usableFor('A5', p(['ii7', 'V7', 'I6', 'vi7']))).toBe(true);
    expect(usableFor('A5', loadProgression(F_MINOR_TURNAROUND))).toBe(false); // ii° and VI are triads
  });

  it('A6 needs even bars, and 4 for call and response', () => {
    expect(usableFor('A6', pop)).toBe(true);
    expect(usableFor('A6', pop, 'call-response')).toBe(true);
    expect(usableFor('A6', p(['I', 'V', 'vi']))).toBe(false); // 3 bars
    expect(usableFor('A6', loadProgression(G_DORIAN_VAMP))).toBe(true); // 2 bars
    expect(usableFor('A6', loadProgression(G_DORIAN_VAMP), 'call-response')).toBe(false);
  });
});
