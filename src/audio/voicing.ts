/**
 * The backing synth's maths, Tone-free so Vitest can cover it (decision 11).
 * `VirtualPushSynth.ts` turns what `planSixteenth` returns into Tone notes.
 *
 * - Register (row 5): the bass is `chord.bass ?? chord.root` in MIDI 40–51
 *   (E2–D♯3; phone speakers can't carry lower). The chord is voiced in root
 *   position: the root at the lowest MIDI note ≥ 52 (E3) with its pitch
 *   class, the other chord tones stacked upward. So the lowest note heard is
 *   always the bass.
 * - Swing (decision 1): an onset on an odd (off-beat) sixteenth is delayed by
 *   `swing / 3` of that sixteenth's length. Lengths come from the transport's
 *   tick → audio-time map, so they follow tempo changes.
 * - Slots: a slot of `beats` beats lasts `beats × 192` ticks (PPQ 192), from
 *   the sum of the slots before it. Chords are held for the whole slot; the
 *   bass is held to one sixteenth before the next slot (placeholder pattern).
 */
import { QUALITY_INTERVALS } from '../theory/chords';
import { pitchClass } from '../theory/pitch';
import type { Chord, ChordSlot, MidiNote, Progression } from '../types/music';
import { drumHitsAt, type DrumPattern, type DrumVoice } from './drumPatterns';
import { BEAT_TICKS, SIXTEENTH_TICKS, assertTransportConfig, loopTicks } from './timing';
import type { TransportConfig, TransportEngine } from './TransportEngine';

export const BASS_LOW: MidiNote = 40; // E2
export const BASS_HIGH: MidiNote = 51; // D♯3
export const VOICING_LOW: MidiNote = 52; // E3

/** The lowest MIDI note ≥ `low` with pitch class `pc`. */
function lowestAtOrAbove(pc: number, low: MidiNote): MidiNote {
  return low + pitchClass(pc - low);
}

/** The bass note: `chord.bass ?? chord.root`, in MIDI 40–51. */
export function bassNote(chord: Chord): MidiNote {
  return lowestAtOrAbove(chord.bass ?? chord.root, BASS_LOW);
}

/**
 * Root-position voicing: the root at the lowest MIDI note ≥ 52 with its pitch
 * class, then the chord tones (`QUALITY_INTERVALS`, the same source as
 * `chordTones`) stacked upward from it. Extensions and a slash bass are not
 * voiced.
 */
export function voiceChord(chord: Chord): MidiNote[] {
  const root = lowestAtOrAbove(chord.root, VOICING_LOW);
  return QUALITY_INTERVALS[chord.quality].map((i) => root + i);
}

/** Equal-tempered frequency of a MIDI note (A4 = 69 = 440 Hz). */
export function midiToHz(note: MidiNote): number {
  return 440 * 2 ** ((note - 69) / 12);
}

// ---------------------------------------------------------------------------
// Slots

/** Length of a slot in ticks (`beats × 192`, rounded). */
export function slotTicks(slot: Pick<ChordSlot, 'beats'>): number {
  return Math.round(slot.beats * BEAT_TICKS);
}

/** In-loop start tick of each slot. */
export function slotStartTicks(slots: readonly Pick<ChordSlot, 'beats'>[]): number[] {
  const starts: number[] = [];
  let beats = 0;
  for (const slot of slots) {
    starts.push(Math.round(beats * BEAT_TICKS));
    beats += slot.beats;
  }
  return starts;
}

/**
 * The index of the slot sounding at in-loop `tick`. Ticks wrap at the slots'
 * total length; a negative tick counts back from the end. Throws on no slots.
 */
export function slotIndexAtTick(slots: readonly Pick<ChordSlot, 'beats'>[], tick: number): number {
  if (slots.length === 0) throw new Error('slotIndexAtTick: no slots');
  const starts = slotStartTicks(slots);
  const total = Math.round(slots.reduce((sum, s) => sum + s.beats, 0) * BEAT_TICKS);
  const t = total > 0 ? ((tick % total) + total) % total : 0;
  let index = 0;
  for (let i = 0; i < starts.length; i++) {
    if ((starts[i] ?? 0) <= t) index = i;
    else break;
  }
  return index;
}

// ---------------------------------------------------------------------------
// Progression ↔ transport

/** The transport config a progression plays at: its BPM, swing and bars, in 4/4. Throws on an invalid one. */
export function transportConfigFor(p: Progression): TransportConfig {
  const cfg: TransportConfig = { bpm: p.bpm, swing: p.swing, bars: p.bars, timeSig: [4, 4] };
  assertTransportConfig(cfg);
  return cfg;
}

/** Throws when the progression's `bars` differs from the transport's, naming both. */
export function assertProgressionFits(p: Progression, cfg: Pick<TransportConfig, 'bars'>): void {
  if (p.bars !== cfg.bars) {
    throw new Error(
      `Progression "${p.id}" has ${p.bars} bars but the transport is configured for ${cfg.bars}; ` +
        'configure the transport with transportConfigFor(progression) first',
    );
  }
}

/** A progression with its ticks and notes worked out once, at `load`. */
export interface PreparedProgression {
  progression: Progression;
  loopTicks: number;
  starts: number[];
  lengths: number[];
  bass: MidiNote[];
  voicings: MidiNote[][];
}

export function prepareProgression(
  p: Progression,
  cfg: Pick<TransportConfig, 'bars' | 'timeSig'>,
): PreparedProgression {
  assertProgressionFits(p, cfg);
  if (p.slots.length === 0) throw new Error(`Progression "${p.id}" has no slots`);
  return {
    progression: p,
    loopTicks: loopTicks(cfg),
    starts: slotStartTicks(p.slots),
    lengths: p.slots.map(slotTicks),
    bass: p.slots.map((s) => bassNote(s.chord)),
    voicings: p.slots.map((s) => voiceChord(s.chord)),
  };
}

// ---------------------------------------------------------------------------
// Scheduling

export interface PartMask {
  drums: boolean;
  bass: boolean;
  chords: boolean;
}

export type BackingPart = keyof PartMask;

export type BackingHit =
  | { part: 'drums'; voice: DrumVoice; time: number; velocity: number }
  | { part: 'bass'; note: MidiNote; time: number; duration: number; slot: number }
  | { part: 'chords'; notes: MidiNote[]; time: number; duration: number; slot: number };

/** Absolute tick → audio time (the transport's `audioTimeOfAbsTick`). */
export type TickToTime = (absTick: number) => number;

/**
 * The audio time of `absTick` with swing applied: on a sixteenth boundary
 * with an odd sixteenth index, delayed by `swing / 3` of that sixteenth.
 * Off the sixteenth grid, or on an even sixteenth, it's the straight time.
 * (Bars are 4n sixteenths, so the parity of `absTick / 48` is the parity of
 * the sixteenth within the bar.)
 */
export function swungTimeOfAbsTick(absTick: number, swing: number, timeOf: TickToTime): number {
  const straight = timeOf(absTick);
  if (absTick % SIXTEENTH_TICKS !== 0 || (absTick / SIXTEENTH_TICKS) % 2 === 0) return straight;
  return straight + (swing / 3) * (timeOf(absTick + SIXTEENTH_TICKS) - straight);
}

/**
 * Everything to play for the sixteenth starting at `e.absTick` (in-loop
 * `e.tick`, sixteenth `e.sixteenth` within the bar): the drum step, and the
 * bass and chord of every slot that starts in `[tick, tick + 48)`. Masked
 * parts are left out.
 */
export function planSixteenth(
  e: { absTick: number; tick: number; sixteenth: number },
  prepared: PreparedProgression,
  pattern: DrumPattern,
  mask: PartMask,
  swing: number,
  timeOf: TickToTime,
): BackingHit[] {
  const hits: BackingHit[] = [];
  const at = (absTick: number) => swungTimeOfAbsTick(absTick, swing, timeOf);

  if (mask.drums) {
    const time = at(e.absTick);
    for (const { voice, velocity } of drumHitsAt(pattern, e.sixteenth)) {
      hits.push({ part: 'drums', voice, time, velocity });
    }
  }

  if (mask.bass || mask.chords) {
    const loopStart = e.absTick - e.tick;
    prepared.starts.forEach((start, slot) => {
      if (start < e.tick || start >= e.tick + SIXTEENTH_TICKS) return;
      const length = prepared.lengths[slot] ?? 0;
      if (length <= 0) return;
      const absStart = loopStart + start;
      const time = at(absStart);
      if (mask.chords) {
        hits.push({
          part: 'chords',
          notes: prepared.voicings[slot] ?? [],
          time,
          duration: at(absStart + length) - time,
          slot,
        });
      }
      if (mask.bass) {
        // Held to one sixteenth before the next slot; a slot of two sixteenths
        // or less holds half its length.
        const held = length > 2 * SIXTEENTH_TICKS ? length - SIXTEENTH_TICKS : length / 2;
        hits.push({
          part: 'bass',
          note: prepared.bass[slot] ?? BASS_LOW,
          time,
          duration: at(absStart + held) - time,
          slot,
        });
      }
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Slot queries through the transport's maps

/**
 * The slot sounding at `audioTime`: index 0 while the transport is stopped,
 * and for times before tick 0. Goes through the transport's tick ↔ time maps,
 * so it stays right across BPM changes.
 */
export function slotAtAudioTime(
  transport: Pick<TransportEngine, 'state' | 'absTickOfAudioTime'>,
  prepared: PreparedProgression,
  audioTime: number,
): { slot: ChordSlot; index: number } {
  let index = 0;
  if (transport.state() === 'started') {
    const abs = Math.max(0, transport.absTickOfAudioTime(audioTime));
    index = slotIndexAtTick(prepared.progression.slots, abs % prepared.loopTicks);
  }
  const slot = prepared.progression.slots[index];
  if (!slot) throw new Error(`Progression "${prepared.progression.id}" has no slot ${index}`);
  return { slot, index };
}

/**
 * The audio time of each slot start in the current loop iteration, ascending:
 * when the chord is heard, so a slot starting on an odd sixteenth includes
 * the swing delay (`config().swing`); slots on the beat are the straight
 * grid. Empty while the transport is stopped.
 */
export function chordChangeTimesFor(
  transport: Pick<TransportEngine, 'state' | 'audioTimeOfTick' | 'config'>,
  prepared: PreparedProgression,
): number[] {
  if (transport.state() !== 'started') return [];
  const swing = transport.config().swing;
  return prepared.starts.map((tick) =>
    swungTimeOfAbsTick(tick, swing, (t) => transport.audioTimeOfTick(t)),
  );
}
