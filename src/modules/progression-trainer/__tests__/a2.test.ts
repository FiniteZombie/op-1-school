import { describe, expect, it } from 'vitest';
import { C_MAJOR_POP, G_DORIAN_VAMP } from '../../../theory/__tests__/fixtures';
import { BAR, harness } from './harness';

describe('A2, pentatonic safety net', () => {
  it('counts clashes outside C major pentatonic, unscored', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A2', progression: C_MAJOR_POP, startAt: t0 });
    h.ctl.start();
    expect(h.ctl.scorer.live(null).guide).toEqual([0, 2, 4, 7, 9]);
    h.play(60, t0 + 0.3); // C
    h.play(65, t0 + 0.6); // F: clash
    h.play(71, t0 + BAR + 0.3); // B: clash
    h.play(69, t0 + 2 * BAR + 0.3); // A
    h.stepTo(t0 + 4 * BAR + 0.05);
    h.play(66, t0 + 4 * BAR + 0.3); // F♯ in a loop cut short: dropped
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.score).toBeUndefined();
    expect(r?.data).toEqual({ notes: 4, clashes: 2 });
    expect(r?.counts.find((c) => c.label === 'clashes')).toEqual({ label: 'clashes', n: 2, state: 'bad' });
    expect(r?.offsets).toBeUndefined();
  });

  it('a minor-third mode gets minor pentatonic', async () => {
    const h = await harness({ level: 'A2', progression: G_DORIAN_VAMP });
    expect(h.ctl.scorer.live(null).guide).toEqual([7, 10, 0, 2, 5]); // G B♭ C D F
  });
});
