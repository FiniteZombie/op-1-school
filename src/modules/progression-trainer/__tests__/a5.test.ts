import { describe, expect, it } from 'vitest';
import { loadProgression } from '../../../theory';
import { mapLine, voiceLeadingMap } from '../a5';
import { BAR, harness, spec } from './harness';

const II_V = spec('test-ii-v', { tonic: 0, mode: 'ionian' }, ['ii7', 'V7']); // Dm7, G7

describe('A5, guide tones', () => {
  it('the voice-leading map: Dm7 → G7 moves C → B (−1) and holds F', () => {
    const p = loadProgression(II_V);
    const [row, wrap] = voiceLeadingMap(p);
    expect(row?.third).toEqual({ from: 5, to: 5, semitones: 0 });
    expect(row?.seventh).toEqual({ from: 0, to: 11, semitones: -1 });
    expect(mapLine(row!, p.key)).toBe('Dm7 → G7: F → F (0), C → B (−1)');
    expect(mapLine(wrap!, p.key)).toBe('G7 → Dm7: B → C (+1), F → F (0)');
  });

  it('a slot is right with both guide tones; half right is wrong', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A5', progression: II_V, startAt: t0 });
    h.ctl.start();
    h.play(65, t0 + 0.3); // F only over Dm7: half right
    h.play(71, t0 + BAR + 0.2); // B
    h.play(65, t0 + BAR + 0.5); // F: both of G7's guide tones
    h.play(63, t0 + BAR + 0.8); // E♭ over G7 in C: outside
    h.stepTo(t0 + 2 * BAR + 0.05);
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({
      slotsHeard: 2,
      right: 1,
      wrong: 1,
      missed: 0,
      classes: { 'chord-tone': 3, tension: 0, avoid: 0, outside: 1 },
    });
    expect(r?.score).toBe(0.5);
    expect(r?.map).toEqual(['Dm7 → G7: F → F (0), C → B (−1)', 'G7 → Dm7: B → C (+1), F → F (0)']);
  });
});
