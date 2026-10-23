import { describe, expect, it } from 'vitest';
import { F_MINOR_TURNAROUND } from '../../../theory/__tests__/fixtures';
import { BAR, BEAT, harness } from './harness';

// F minor ii°–V7–i–VI at 90 BPM, one bar each: bar 3 is Fm, so its target is A♭.
const T0 = 1;
const BAR3 = T0 + 2 * BAR;
const AB4 = 68;

describe('A6, target-note phrasing', () => {
  it('phrase: a phrase over bars 1–2 lands on A♭ at bar 3', async () => {
    const h = await harness({ level: 'A6', progression: F_MINOR_TURNAROUND, startAt: T0 });
    h.ctl.start();
    h.play(60, T0 + 0.5); // the phrase: not near a target (bar 1 of the run is excepted)
    h.play(63, T0 + BAR + BEAT);
    h.play(AB4, BAR3, -30);
    h.stepTo(T0 + 4 * BAR + 0.05);
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ form: 'phrase', targets: 1, landed: 1, on: 1, missed: 0 });
    expect(r?.score).toBe(1);
    expect(r?.offsets).toEqual([expect.objectContaining({ note: AB4, targetTick: 2 * 768, source: 'touch' })]);
    expect(r?.reveal).toEqual(['bar 1: B♭', 'bar 3: A♭']);
  });

  it('counts a later loop’s bar 1, and an early or wrong note doesn’t land', async () => {
    const h = await harness({ level: 'A6', progression: F_MINOR_TURNAROUND, startAt: T0 });
    h.ctl.start();
    h.play(AB4, BAR3, -100); // early against the touch window (−89.7 … +3.3 ms)
    h.play(70, T0 + 4 * BAR, -30); // loop 2's bar 1 (Gdim): B♭, landed
    h.play(61, T0 + 6 * BAR, -30); // D♭ on bar 3: wrong pitch, missed
    h.stepTo(T0 + 8 * BAR + 0.05);
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ targets: 3, landed: 1, on: 1, early: 1, missed: 1 });
    expect(r?.score).toBeCloseTo(1 / 3, 9);
  });

  it('call and response: a landing with the rest kept scores 1', async () => {
    const h = await harness({ level: 'A6', progression: F_MINOR_TURNAROUND, form: 'call-response', startAt: T0 });
    h.ctl.start();
    h.play(AB4, BAR3, -30);
    h.play(65, T0 + 3 * BAR + 0.3); // bar 4, the turnaround: after the rest
    h.stepTo(T0 + 4 * BAR + 0.05);
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ form: 'call-response', landed: 1, restBreaks: 0 });
    expect(r?.score).toBe(1);
  });

  it('call and response: an E♭ 400 ms after bar 3’s downbeat breaks the rest', async () => {
    const h = await harness({ level: 'A6', progression: F_MINOR_TURNAROUND, form: 'call-response', startAt: T0 });
    h.ctl.start();
    h.play(AB4, BAR3, -30);
    h.play(63, BAR3 + 0.4); // over the 333 ms half beat, before bar 4
    h.stepTo(T0 + 4 * BAR + 0.05);
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ landed: 1, restBreaks: 1, loops: 1 });
    expect(r?.score).toBe(0);
    expect(r?.counts.find((c) => c.label === 'rest breaks')).toEqual({ label: 'rest breaks', n: 1, state: 'bad' });
  });
});
