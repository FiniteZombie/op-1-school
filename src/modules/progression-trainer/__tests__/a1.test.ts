import { describe, expect, it } from 'vitest';
import { C_MAJOR_POP } from '../../../theory/__tests__/fixtures';
import type { A1Scorer } from '../a1';
import { BAR, harness } from './harness';

describe('A1, bass root as degree', () => {
  it('I–V–vi–IV in C: a G2 in slot 2 is right and reveals 5; an unanswered slot is wrong', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A1', progression: C_MAJOR_POP, startAt: t0 });
    h.ctl.start();
    h.play(48, t0 + 0.3); // C3 over C: right
    h.play(43, t0 + BAR + 0.3); // G2 over G: right
    h.play(52, t0 + BAR + 0.6); // a second note in the slot doesn't answer it
    h.play(47, t0 + 2 * BAR + 0.3); // B over Am: wrong
    // slot 4 (F) unanswered
    h.stepTo(t0 + 4 * BAR + 0.05);
    h.ctl.stop();

    const scorer = h.ctl.scorer as A1Scorer;
    expect(scorer.answer({ run: 0, iteration: 0, slot: 1 })).toEqual({ note: 43, right: true });
    const reveal = h.ctl.scorer.live({ run: 0, iteration: 0, slot: 2, absTick: 0, heard: 0 }).reveal;
    expect(reveal).toEqual({ text: '5 · right', state: 'ok' });

    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ slotsHeard: 4, right: 2, wrong: 1, missed: 1 });
    expect(r?.score).toBe(0.5);
    expect(r?.reveal).toEqual(['C: 1', 'G: 5', 'Am: 6', 'F: 4']);
    expect(r?.counts.map((c) => [c.label, c.state])).toEqual([
      ['right', 'ok'],
      ['wrong', 'bad'],
      ['missed', 'bad'],
    ]);
    expect(h.ctl.drill().phase).toBe('done');
  });

  it('answers in a loop that never completes are dropped', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A1', progression: C_MAJOR_POP, startAt: t0 });
    h.ctl.start();
    h.play(48, t0 + 0.3);
    h.stepTo(t0 + 4 * BAR + 0.05);
    h.play(48, t0 + 4 * BAR + 0.3); // loop 1, cut short by finish
    h.ctl.stop();
    expect(h.ctl.finished()?.data).toMatchObject({ slotsHeard: 4, right: 1, missed: 3 });
  });
});
