import { describe, expect, it } from 'vitest';
import { loadProgression } from '../../../theory';
import { G_DORIAN_VAMP } from '../../../theory/__tests__/fixtures';
import { usableFor } from '../levels';
import { BAR, harness, spec } from './harness';

// Dm7, G7, Cmaj7, Bm7♭5: one of each seventh family.
const SEVENTHS = spec('test-sevenths', { tonic: 0, mode: 'ionian' }, ['ii7', 'V7', 'Imaj7', 'viiø7']);

describe('A3, chord quality', () => {
  it('the first tap in each heard slot answers it', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A3', progression: SEVENTHS, startAt: t0 });
    h.ctl.start();
    h.choose('m7', t0 + 0.3); // Dm7: right
    h.choose('7', t0 + 0.6); // a second tap doesn't count
    h.choose('7', t0 + BAR + 0.3); // G7: right
    h.choose('m7', t0 + 2 * BAR + 0.3); // Cmaj7: wrong
    // Bm7♭5 unanswered
    h.stepTo(t0 + 4 * BAR + 0.05);

    // The reveal of an answered slot names the quality and lights its guide tones.
    const live = h.ctl.scorer.live({ run: 0, iteration: 0, slot: 0, absTick: 0, heard: 0 });
    expect(live.reveal).toEqual({ text: 'm7 · right', state: 'ok' });
    expect(live.guide).toEqual([5, 0]); // F and C

    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ slotsHeard: 4, right: 2, wrong: 1, missed: 1 });
    expect(r?.score).toBe(0.5);
    expect(r?.reveal).toEqual(['ii7: m7', 'V7: 7', 'Imaj7: maj7', 'viiø7: m7b5']);
  });

  it('rejects a progression with a chord outside the five families', () => {
    expect(usableFor('A3', loadProgression(G_DORIAN_VAMP))).toBe(false); // Gm and C are triads
    expect(usableFor('A3', loadProgression(SEVENTHS))).toBe(true);
  });
});
