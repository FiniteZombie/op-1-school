// A drill on the fake transport and `FakeClockBridge(5000, 0.029)`, with a
// real `NoteBus` and `TouchInput`. Own stops run at once (`defer` calls
// through), and time moves in 10 ms steps so a restart lands on its loop end.
import { createFakeTransport, FakeClockBridge } from '../../../audio/__fakes__/FakeTransport';
import type { TapOffsets } from '../../../audio/tapWindow';
import { NoteBus } from '../../../input/NoteInput';
import { TouchInput } from '../../../input/TouchInput';
import { loadProgression } from '../../../theory';
import type { DrillForm } from '../../../types/drills';
import type { ProgressionSpec } from '../../../types/lessons';
import type { MidiNote, Progression } from '../../../types/music';
import { DrillController } from '../drill';
import type { LevelId } from '../levels';

/** Decision 6's measurements, injected: no test reads `TAP_OFFSETS`. */
export const OFFSETS: TapOffsets = {
  touch: { medianMs: -43.2, iqrMs: 46.5 },
  midi: { medianMs: -5.7, iqrMs: 46.7 },
};

export const NO_MEASUREMENT: TapOffsets = { touch: null, midi: null };

/** Seconds per beat at 90 BPM. */
export const BEAT = 60 / 90;
export const BAR = 4 * BEAT;

export function spec(
  id: string,
  key: ProgressionSpec['key'],
  romans: string[],
  beats = 4,
): ProgressionSpec {
  const total = romans.length * beats;
  return {
    id,
    key,
    bpm: 90,
    swing: 0.5,
    bars: total / 4,
    slots: romans.map((roman) => ({ roman, beats })),
    style: 'chillhop-rhodes',
    family: 'test',
  };
}

export interface HarnessOptions {
  level: LevelId;
  progression: ProgressionSpec | Progression;
  form?: DrillForm;
  minutes?: number;
  tapOffsets?: TapOffsets;
  /** Audio time of the first run's tick 0. */
  startAt?: number;
  bus?: NoteBus;
}

export async function harness(o: HarnessOptions) {
  const { transport, driver } = createFakeTransport();
  const clock = new FakeClockBridge(5000, 0.029);
  const touch = new TouchInput(() => 0);
  const bus = o.bus ?? new NoteBus();
  bus.register(touch);
  await bus.start('touch');

  const loaded: Progression[] = [];
  const backing = { load: (p: Progression) => loaded.push(p), setMask: () => {} };
  const first = o.progression.slots[0];
  const progression =
    first && 'chord' in first ? (o.progression as Progression) : loadProgression(o.progression as ProgressionSpec);

  /** Audio time of each run's tick 0. */
  const starts: number[] = [];
  transport.onStateChange((e) => {
    if (e.state === 'started') starts.push(e.audioTime);
  });

  const ctl = new DrillController({
    level: o.level,
    progression,
    form: o.form,
    minutes: o.minutes ?? 4,
    transport,
    clock,
    bus,
    backing,
    tapOffsets: o.tapOffsets ?? OFFSETS,
    defer: (fn) => fn(),
    now: () => 1000,
  });

  driver.advanceTo((o.startAt ?? 1) - driver.look);

  function stepTo(t: number): void {
    while (driver.time < t - 1e-12) driver.advanceTo(Math.min(t, driver.time + 0.01));
  }

  /** Steps to just before `heard`, then presses `note` so it's heard at `heard` (+ `lateMs`). */
  function play(note: MidiNote, heard: number, lateMs = 0): void {
    stepTo(heard - 0.2);
    const perfTs = clock.audibleAt(heard) + lateMs;
    touch.press(note, perfTs);
    touch.release(note, perfTs + 1);
  }

  /** A0's pad, `offset` ms from when `heard` sounds. */
  function pad(heard: number, offset: number): void {
    stepTo(heard - 0.2);
    ctl.pad(clock.audibleAt(heard) + offset);
  }

  function choose(value: string, heard: number): void {
    stepTo(heard - 0.2);
    ctl.choose(value, clock.audibleAt(heard));
  }

  return { ctl, transport, driver, clock, bus, touch, loaded, starts, stepTo, play, pad, choose };
}
