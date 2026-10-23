import { describe, expect, it } from 'vitest';
import { loadProgression } from '../../../theory';
import { A_MINOR_PEDAL, C_MAJOR_POP } from '../../../theory/__tests__/fixtures';
import { PAD_NOTE } from '../../../types/drills';
import { a0Stage, mergeIdentical } from '../arrange';
import { BEAT, NO_MEASUREMENT, harness } from './harness';

const SLOT1 = 8 * BEAT; // stage 1: a change every 5.333 s at 90 BPM

describe('A0 arrangement', () => {
  it('merges identical chords, the wrap included, and repeats to whole bars', () => {
    const pedal = loadProgression(A_MINOR_PEDAL); // Am, Dm/A, G/A, Am
    expect(mergeIdentical(pedal.slots).map((s) => s.roman)).toEqual(['i', 'iv/1', 'VII/1']);
    const s1 = a0Stage(pedal, 0);
    expect([s1.slots.length, s1.bars]).toEqual([3, 6]);
    // 3 chords × 2 beats = 6 beats: repeated to 12 beats, 3 bars.
    const s3 = a0Stage(pedal, 2);
    expect(s3.slots.map((s) => s.beats)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(s3.bars).toBe(3);
  });
});

describe('A0 scoring', () => {
  it("decision 6's worked example: stage 1 on C_MAJOR_POP, a tap 30 ms ahead is on", async () => {
    const t0 = 10 - SLOT1; // slot 1's change sounds at audio 10.000 s
    const h = await harness({ level: 'A0', progression: C_MAJOR_POP, startAt: t0 });
    h.ctl.start();
    expect(h.loaded[0]?.slots.map((s) => s.beats)).toEqual([8, 8, 8, 8]);
    expect(h.clock.audibleAt(10)).toBeCloseTo(15_029, 6);

    h.pad(10, 14_999 - 15_029);
    h.stepTo(t0 + 4 * SLOT1 + 0.05); // loop 0 complete
    h.ctl.stop();
    expect(h.ctl.drill().phase).toBe('done');
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ changes: 3, on: 1, early: 0, late: 0, missed: 2, extra: 0 });
    expect(r?.score).toBeCloseTo(1 / 3, 9);
    expect(r?.offsets).toHaveLength(1);
    expect(r?.offsets?.[0]).toMatchObject({ note: PAD_NOTE, targetTick: 8 * 192, source: 'touch', calibrated: false });
    expect(r?.offsets?.[0]?.offsetMs).toBeCloseTo(-30, 6);
  });

  it('a tap 10 ms after the sound reads late against the touch median', async () => {
    const t0 = 10 - SLOT1;
    const h = await harness({ level: 'A0', progression: C_MAJOR_POP, startAt: t0 });
    h.ctl.start();
    h.pad(10, 15_039 - 15_029);
    h.stepTo(t0 + 4 * SLOT1 + 0.05);
    h.ctl.stop();
    expect(h.ctl.finished()?.data).toMatchObject({ on: 0, late: 1, missed: 2 });
  });

  it('steps down through every stage, counting each run’s changes', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A0', progression: C_MAJOR_POP, startAt: t0 });
    h.ctl.start();
    // Stage 1 (8 beats): the first downbeat isn't a change, slots 1–3 are.
    for (let k = 1; k <= 3; k++) h.pad(t0 + k * SLOT1, -30);
    h.stepTo(t0 + 4 * SLOT1 + 0.05);
    expect(h.loaded.map((p) => p.slots[0]?.beats)).toEqual([8, 4]);
    expect(h.ctl.scorer.live(null).stage).toBe('4 beats per chord');

    // Stage 2 (4 beats, 4 bars): after the drill's own restart the downbeat is a change (F → C).
    const t1 = h.starts[1] ?? NaN;
    expect(t1).toBeCloseTo(t0 + 4 * SLOT1, 1);
    for (let k = 0; k <= 3; k++) h.pad(t1 + k * 4 * BEAT, -30);
    h.stepTo(t1 + 16 * BEAT + 0.05);
    expect(h.loaded.map((p) => p.slots[0]?.beats)).toEqual([8, 4, 2]);

    // Stage 3 (2 beats, 2 bars): four changes a loop, and it stays there.
    const t2 = h.starts[2] ?? NaN;
    expect(h.loaded[2]?.bars).toBe(2);
    for (let k = 0; k <= 3; k++) h.pad(t2 + k * 2 * BEAT, -30);
    h.stepTo(t2 + 8 * BEAT + 0.05);
    expect(h.loaded).toHaveLength(3);
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ stageBeats: 2, changes: 11, on: 11, missed: 0, extra: 0 });
    expect(r?.score).toBe(1);
  });

  it('counts a tap near no change as extra', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A0', progression: C_MAJOR_POP, startAt: t0 });
    h.ctl.start();
    h.pad(t0 + 1, 0); // 4.3 s from slot 1's change: outside its 2.667 s window
    for (let k = 1; k <= 3; k++) h.pad(t0 + k * SLOT1, -30);
    h.stepTo(t0 + 4 * SLOT1 + 0.05);
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.data).toMatchObject({ changes: 3, on: 3, extra: 1 });
    expect(r?.score).toBeCloseTo(3 / 4, 9);
    expect(r?.counts.find((c) => c.label === 'extra')?.state).toBe('neutral');
  });

  it('a source with no measurement leaves loops unscored: the stage steps after two loops, the score is absent', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A0', progression: C_MAJOR_POP, startAt: t0, tapOffsets: NO_MEASUREMENT });
    h.ctl.start();
    for (let k = 1; k <= 3; k++) h.pad(t0 + k * SLOT1, -30);
    h.stepTo(t0 + 4 * SLOT1 + 0.05);
    expect(h.loaded).toHaveLength(1); // one unscored loop: no step yet
    for (let k = 4; k <= 7; k++) h.pad(t0 + k * SLOT1, -30);
    h.stepTo(t0 + 8 * SLOT1 + 0.05);
    expect(h.loaded).toHaveLength(2);
    h.ctl.stop();
    const r = h.ctl.finished();
    expect(r?.score).toBeUndefined();
    expect(r?.data).toMatchObject({ changes: 7, unscored: 7, on: 0 });
    expect(r?.counts.map((c) => c.label)).toContain('timing not scored yet');
    expect(r?.offsets).toHaveLength(7);
  });

  it('a key on the bus counts as a tap too', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A0', progression: C_MAJOR_POP, startAt: t0 });
    h.ctl.start();
    h.play(60, t0 + SLOT1, -30);
    h.stepTo(t0 + 4 * SLOT1 + 0.05);
    h.ctl.stop();
    expect(h.ctl.finished()?.offsets?.[0]).toMatchObject({ note: 60, source: 'touch' });
  });
});
