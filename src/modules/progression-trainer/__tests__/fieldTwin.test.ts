// The fake twin of the owner's `[field]` check: the same notes from the
// screen and from a MIDI input (through `WebMidiBridge` into the `NoteBus`)
// give the same A1 and A5 answers.
import { describe, expect, it } from 'vitest';
import { FakeMidiAccess, FakeMidiInput, fakeMidiNavigator } from '../../../input/__fakes__/FakeMidiPort';
import { WebMidiBridge } from '../../../input/MidiBridge';
import { NoteBus } from '../../../input/NoteInput';
import { C_MAJOR_POP } from '../../../theory/__tests__/fixtures';
import type { ProgressionSpec } from '../../../types/lessons';
import type { LevelId } from '../levels';
import { BAR, harness, spec } from './harness';

/** [MIDI note, heard at (s after tick 0)]. */
type Sequence = Array<[number, number]>;

const A1_NOTES: Sequence = [
  [48, 0.3],
  [43, BAR + 0.3],
  [47, 2 * BAR + 0.3],
  [41, 3 * BAR + 0.2],
  [53, 3 * BAR + 0.5],
];

const II_V = spec('test-ii-v', { tonic: 0, mode: 'ionian' }, ['ii7', 'V7']);
const A5_NOTES: Sequence = [
  [65, 0.3],
  [69, 0.6], // F and A over Dm7: no C, wrong
  [71, BAR + 0.2],
  [65, BAR + 0.5],
  [63, BAR + 0.8],
];

async function viaTouch(level: LevelId, progression: ProgressionSpec, notes: Sequence, loopSec: number) {
  const t0 = 1;
  const h = await harness({ level, progression, startAt: t0 });
  h.ctl.start();
  for (const [note, at] of notes) h.play(note, t0 + at);
  h.stepTo(t0 + loopSec + 0.05);
  h.ctl.stop();
  return h.ctl.finished();
}

async function viaMidi(level: LevelId, progression: ProgressionSpec, notes: Sequence, loopSec: number) {
  const t0 = 1;
  const input = new FakeMidiInput('field', 'OP-1 Field');
  const midi = new WebMidiBridge({ navigator: fakeMidiNavigator(new FakeMidiAccess([input])), perfNow: () => 0 });
  const bus = new NoteBus();
  bus.register(midi);
  expect(await midi.requestAccess()).toBe('granted');
  midi.select('field');
  await bus.start('midi');

  const h = await harness({ level, progression, startAt: t0, bus });
  const sources: string[] = [];
  bus.onNote((e) => sources.push(e.source));
  h.ctl.start();
  for (const [note, at] of notes) {
    h.stepTo(t0 + at - 0.2);
    const perfTs = h.clock.audibleAt(t0 + at);
    input.emit([0x90, note, 100], perfTs);
    input.emit([0x80, note, 0], perfTs + 1);
  }
  h.stepTo(t0 + loopSec + 0.05);
  h.ctl.stop();
  expect(new Set(sources)).toEqual(new Set(['midi']));
  return h.ctl.finished();
}

describe('the Field takes the same path as touch', () => {
  it('A1', async () => {
    const touch = await viaTouch('A1', C_MAJOR_POP, A1_NOTES, 4 * BAR);
    const midi = await viaMidi('A1', C_MAJOR_POP, A1_NOTES, 4 * BAR);
    expect(touch?.data).toMatchObject({ right: 3, wrong: 1, missed: 0 });
    expect(midi?.data).toEqual(touch?.data);
    expect(midi?.score).toBe(touch?.score);
  });

  it('A5', async () => {
    const touch = await viaTouch('A5', II_V, A5_NOTES, 2 * BAR);
    const midi = await viaMidi('A5', II_V, A5_NOTES, 2 * BAR);
    expect(touch?.data).toMatchObject({ right: 1, wrong: 1 });
    expect(midi?.data).toEqual(touch?.data);
    expect(midi?.score).toBe(touch?.score);
  });
});
