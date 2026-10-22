import { describe, expect, it } from 'vitest';
import { chordTones, loadProgression } from '../../theory';
import { F_MINOR_TURNAROUND, SPEC_FIXTURES } from '../../theory/__tests__/fixtures';
import type { Progression } from '../../types/music';
import { CHILLHOP_RHODES } from '../drumPatterns';
import {
  TransportCore,
  audioTimeOfAbsTick,
  sixteenthSeconds,
  swingOffsetSec,
  type TempoAnchor,
  type TransportDriver,
} from '../timing';
import {
  BASS_HIGH,
  BASS_LOW,
  VOICING_LOW,
  assertProgressionFits,
  bassNote,
  chordChangeTimesFor,
  planSixteenth,
  prepareProgression,
  slotAtAudioTime,
  slotIndexAtTick,
  slotStartTicks,
  swungTimeOfAbsTick,
  transportConfigFor,
  voiceChord,
  type BackingHit,
  type PartMask,
} from '../voicing';

const ALL: PartMask = { drums: true, bass: true, chords: true };
const fMinor = (): Progression => loadProgression(F_MINOR_TURNAROUND);

/** A hand-stepped driver: time moves only when the test sets it. */
class FakeDriver implements TransportDriver {
  time = 0;
  onPulse: ((t: number) => void) | null = null;
  ready() {
    return true;
  }
  now() {
    return this.time + 0.1;
  }
  currentTime() {
    return this.time;
  }
  lookAhead() {
    return 0.1;
  }
  start(_at: number, _bpm: number, onPulse: (t: number) => void) {
    this.onPulse = onPulse;
  }
  stop() {
    this.onPulse = null;
  }
  setBpmAt() {}
  emit(anchors: TempoAnchor[], from: number, to: number) {
    for (let t = from; t < to; t += 8) this.onPulse?.(audioTimeOfAbsTick(anchors, t));
  }
}

function runningTransport(p: Progression, startAt: number) {
  const driver = new FakeDriver();
  const core = new TransportCore(driver);
  core.configure(transportConfigFor(p));
  driver.time = startAt - 0.1;
  core.start(startAt);
  driver.time = startAt;
  return { driver, core };
}

describe('voicing (SPEC §5.3 fixtures)', () => {
  for (const spec of SPEC_FIXTURES) {
    it(`${spec.id}: chord ≥ 52, bass 40–51 below it, pitch classes = chordTones`, () => {
      for (const { chord } of loadProgression(spec).slots) {
        const voiced = voiceChord(chord);
        const bass = bassNote(chord);
        expect(Math.min(...voiced)).toBeGreaterThanOrEqual(VOICING_LOW);
        expect(bass).toBeGreaterThanOrEqual(BASS_LOW);
        expect(bass).toBeLessThanOrEqual(BASS_HIGH);
        expect(bass).toBeLessThan(Math.min(...voiced));
        expect(new Set(voiced.map((n) => n % 12))).toEqual(new Set(chordTones(chord)));
        expect(bass % 12).toBe(chord.bass ?? chord.root);
      }
    });
  }

  it('is root position from the lowest root ≥ 52, stacked upward', () => {
    const [gdim, c7, fm, db] = fMinor().slots.map((s) => voiceChord(s.chord));
    expect(gdim).toEqual([55, 58, 61]); // G3 B♭3 D♭4
    expect(c7).toEqual([60, 64, 67, 70]); // C4 E4 G4 B♭4
    expect(fm).toEqual([53, 56, 60]); // F3 A♭3 C4
    expect(db).toEqual([61, 65, 68]); // D♭4 F4 A♭4
    expect(voiceChord({ root: 4, quality: 'maj' })).toEqual([52, 56, 59]); // E3 is the floor
    expect(voiceChord({ root: 3, quality: 'maj7' })).toEqual([63, 67, 70, 74]);
  });

  it('puts a slash bass in the bass, not the voicing', () => {
    const dmOverA = loadProgression(SPEC_FIXTURES[3]).slots[1]?.chord;
    expect(dmOverA).toBeDefined();
    if (!dmOverA) return;
    expect(bassNote(dmOverA)).toBe(45); // A2
    expect(voiceChord(dmOverA)).toEqual([62, 65, 69]); // D4 F4 A4
  });
});

describe('slots', () => {
  it('F minor ii°–V7–i–VI, one bar each: starts and lookups', () => {
    const { slots } = fMinor();
    expect(slotStartTicks(slots)).toEqual([0, 768, 1536, 2304]);
    expect(slotIndexAtTick(slots, 0)).toBe(0);
    expect(slotIndexAtTick(slots, 767)).toBe(0);
    expect(slotIndexAtTick(slots, 768)).toBe(1);
    expect(slotIndexAtTick(slots, 3071)).toBe(3);
    expect(slotIndexAtTick(slots, 3072)).toBe(0); // wraps
  });

  it('handles fractional beats', () => {
    const slots = [{ beats: 1.5 }, { beats: 2.5 }];
    expect(slotStartTicks(slots)).toEqual([0, 288]);
    expect(slotIndexAtTick(slots, 287)).toBe(0);
    expect(slotIndexAtTick(slots, 288)).toBe(1);
  });

  it('at 90 BPM through the transport, and across a BPM change', () => {
    const p = fMinor();
    const prepared = prepareProgression(p, transportConfigFor(p));
    const { driver, core } = runningTransport(p, 2);
    // 90 BPM: a bar is 2.6667 s.
    expect(slotAtAudioTime(core, prepared, 2).index).toBe(0);
    expect(slotAtAudioTime(core, prepared, 2 + 2.66).index).toBe(0);
    expect(slotAtAudioTime(core, prepared, 2 + 8 / 3).index).toBe(1);
    expect(slotAtAudioTime(core, prepared, 1).index).toBe(0); // before tick 0
    expect(slotAtAudioTime(core, prepared, 2 + 4 * (8 / 3)).index).toBe(0); // next loop
    expect(chordChangeTimesFor(core, prepared).map((t) => +t.toFixed(4))).toEqual([2, 4.6667, 7.3333, 10]);

    // 90 → 120 BPM: applied at the first beat after currentTime + lookAhead.
    driver.time = 2.5;
    core.configure({ ...core.config(), bpm: 120 });
    const anchor = core.tempoAnchors()[1];
    expect(anchor?.absTick).toBe(192);
    expect(anchor?.audioTime).toBeCloseTo(2 + 2 / 3, 9);
    // Bar 2 (tick 768) is now three 120-BPM beats after the anchor.
    const bar2 = 2 + 2 / 3 + 1.5;
    expect(chordChangeTimesFor(core, prepared)[1]).toBeCloseTo(bar2, 9);
    expect(slotAtAudioTime(core, prepared, bar2 - 0.01).index).toBe(0);
    expect(slotAtAudioTime(core, prepared, bar2).index).toBe(1);
    expect(slotAtAudioTime(core, prepared, bar2 + 4 - 0.01).index).toBe(2);
    expect(slotAtAudioTime(core, prepared, bar2 + 4 + 0.01).index).toBe(3);
  });

  it('slot 0 and no change times while stopped', () => {
    const p = fMinor();
    const prepared = prepareProgression(p, transportConfigFor(p));
    const core = new TransportCore(new FakeDriver());
    core.configure(transportConfigFor(p));
    expect(slotAtAudioTime(core, prepared, 12).index).toBe(0);
    expect(chordChangeTimesFor(core, prepared)).toEqual([]);
  });
});

describe('progression ↔ transport', () => {
  it('transportConfigFor takes bpm, swing and bars, in 4/4', () => {
    expect(transportConfigFor(fMinor())).toEqual({ bpm: 90, swing: 0.5, bars: 4, timeSig: [4, 4] });
    expect(() => transportConfigFor({ ...fMinor(), bpm: 400 })).toThrow(RangeError);
  });

  it('refuses a progression whose bars differ from the transport, naming both', () => {
    expect(() => assertProgressionFits(fMinor(), { bars: 2 })).toThrow(/4 bars.*configured for 2/);
    expect(() => assertProgressionFits(fMinor(), { bars: 4 })).not.toThrow();
  });
});

describe('planSixteenth', () => {
  const p = fMinor();
  const prepared = prepareProgression(p, transportConfigFor(p));
  const bpm = 90;
  const timeOf = (absTick: number) => 10 + absTick * (60 / (bpm * 192));
  const sixteenth = (n: number) => ({ absTick: n * 48, tick: (n * 48) % 3072, sixteenth: n % 16 });
  const plan = (n: number, mask: PartMask = ALL, swing = 0.5) =>
    planSixteenth(sixteenth(n), prepared, CHILLHOP_RHODES, mask, swing, timeOf);
  const parts = (hits: BackingHit[]) => hits.map((h) => (h.part === 'drums' ? h.voice : h.part));

  it('swing matches decision 1 at a constant tempo', () => {
    for (let n = 0; n < 4; n++) {
      const delay = swungTimeOfAbsTick(n * 48, 0.5, timeOf) - timeOf(n * 48);
      expect(delay).toBeCloseTo(swingOffsetSec(n, 0.5, bpm), 9);
    }
    expect(swungTimeOfAbsTick(48, 0.5, timeOf) - timeOf(48)).toBeCloseTo(0.02778, 4);
    expect(swungTimeOfAbsTick(50, 0.5, timeOf)).toBe(timeOf(50)); // off the grid
  });

  it('bar 1 downbeat: kick, hat, chord and bass of slot 0', () => {
    const hits = plan(0);
    expect(parts(hits)).toEqual(['kick', 'hat', 'chords', 'bass']);
    const chord = hits.find((h) => h.part === 'chords');
    const bass = hits.find((h) => h.part === 'bass');
    expect(chord && chord.part === 'chords' && chord.notes).toEqual([55, 58, 61]);
    expect(chord?.time).toBe(10);
    // The chord is held for the slot; the bass to one sixteenth before it
    // ends, i.e. to the 16th sixteenth, which is off-beat and so swung.
    expect(chord && 'duration' in chord && chord.duration).toBeCloseTo(8 / 3, 9);
    expect(bass && 'duration' in bass && bass.duration).toBeCloseTo(
      8 / 3 - sixteenthSeconds(bpm) + swingOffsetSec(15, 0.5, bpm),
      9,
    );
    expect(bass && bass.part === 'bass' && bass.note).toBe(43); // G2
  });

  it('off-beat hats move with swing; even ones and slot starts on the beat do not', () => {
    const odd = plan(1)[0];
    expect(odd?.time).toBeCloseTo(timeOf(48) + swingOffsetSec(1, 0.5, bpm), 9);
    expect(plan(1, ALL, 0)[0]?.time).toBe(timeOf(48));
    expect(plan(2)[0]?.time).toBe(timeOf(96));
    expect(parts(plan(16))).toEqual(['kick', 'hat', 'chords', 'bass']); // bar 2, slot 1
    expect(plan(16).at(-1)?.time).toBe(timeOf(768));
  });

  it('second loop iteration replays slot 0 at its absolute time', () => {
    const hits = planSixteenth(
      { absTick: 3072, tick: 0, sixteenth: 0 },
      prepared,
      CHILLHOP_RHODES,
      ALL,
      0.5,
      timeOf,
    );
    expect(hits.find((h) => h.part === 'chords')?.time).toBe(timeOf(3072));
  });

  it('masks parts; all masked plans nothing', () => {
    expect(parts(plan(0, { drums: false, bass: true, chords: true }))).toEqual(['chords', 'bass']);
    expect(parts(plan(0, { drums: true, bass: false, chords: true }))).toEqual(['kick', 'hat', 'chords']);
    expect(parts(plan(0, { drums: false, bass: true, chords: false }))).toEqual(['bass']);
    expect(plan(0, { drums: false, bass: false, chords: false })).toEqual([]);
  });
});
