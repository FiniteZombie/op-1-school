/**
 * The backing band (SPEC §5.3): drums, bass and Rhodes-ish chords playing a
 * `Progression` against the transport.
 *
 * The maths (voicing, slots, swing, what to play on each sixteenth) lives in
 * `voicing.ts` and the drum data in `drumPatterns.ts`, both Tone-free and
 * tested; this file only turns `planSixteenth`'s hits into Tone notes, and is
 * checked on `/dev/spine` (decision 11). Tests import it as types only.
 *
 * - Scheduling: every `onSixteenth` from the transport plans that sixteenth
 *   at the event's audio time (plus swing on odd sixteenths, decision 1).
 *   Nothing uses a looping `Tone.Part`/`Sequence`: the transport runs
 *   unlooped and the loop is `absTick % loopTicks`.
 * - Tone nodes are made in the constructor, after `getAudioContext()` has
 *   installed the app's context. The instance owns them; `dispose()` frees
 *   them and is safe to call twice.
 * - A master gain is 0 while the transport is stopped, so notes already
 *   handed to Tone inside the lookahead are silent after a stop.
 */
import * as Tone from 'tone';
import type { ChordSlot, Progression, Unsubscribe } from '../types/music';
import { drumPatternFor, type DrumPattern, type DrumVoice } from './drumPatterns';
import { getAudioContext, type BeatEvent, type TransportEngine, type TransportStateChange } from './TransportEngine';
import {
  chordChangeTimesFor,
  midiToHz,
  planSixteenth,
  prepareProgression,
  slotAtAudioTime,
  type BackingPart,
  type PartMask,
  type PreparedProgression,
} from './voicing';

export { transportConfigFor } from './voicing';
export type { PartMask } from './voicing';

export interface VirtualPushSynth {
  /** Throws when `p.bars` differs from the transport's configured bars (configure it with `transportConfigFor(p)` first). */
  load(p: Progression): void;
  /** Takes effect from the next scheduled sixteenth. All parts off is silence with the transport still running. */
  setMask(parts: PartMask): void; // A1 wants bass only, etc.
  /** Throws before `load`. Slot 0 while the transport is stopped. */
  currentSlot(audioTime: number): { slot: ChordSlot; index: number };
  /** Audio times of the chord changes in the current loop iteration, for A0 scoring. Empty while stopped. */
  chordChangeTimes(): number[];
  /** Safe to call twice. */
  dispose(): void;
}

/** Fade for mask changes and stops, so held notes don't click. */
const RAMP_SEC = 0.01;
const PARTS: readonly BackingPart[] = ['drums', 'bass', 'chords'];

// placeholder: every sound parameter below (envelopes, filters, levels, the
// kick's pitch, note velocities) is a temporary starting point until the
// owner sets the sound.
const KICK_HZ = midiToHz(36);
const BASS_VELOCITY = 0.8;
const CHORD_VELOCITY = 0.45;

/**
 * `VirtualPushSynth` on Tone: `MembraneSynth` kick, `NoiseSynth` snare and
 * closed hat, `MonoSynth` bass, `PolySynth(FMSynth)` chords.
 */
export class ToneBackingSynth implements VirtualPushSynth {
  private prepared: PreparedProgression | null = null;
  private pattern: DrumPattern | null = null;
  private mask: PartMask = { drums: true, bass: true, chords: true };
  private appliedMask: PartMask = { ...this.mask };
  private disposed = false;
  private readonly unsubscribes: Unsubscribe[];

  private readonly master: Tone.Gain;
  private readonly partGains: Record<BackingPart, Tone.Gain>;
  private readonly kick: Tone.MembraneSynth;
  private readonly snare: Tone.NoiseSynth;
  private readonly hat: Tone.NoiseSynth;
  private readonly snareFilter: Tone.Filter;
  private readonly hatFilter: Tone.Filter;
  private readonly bass: Tone.MonoSynth;
  private readonly chords: Tone.PolySynth<Tone.FMSynth>;

  constructor(private readonly transport: TransportEngine) {
    getAudioContext(); // Tone nodes bind to the current context: make sure it's the app's.

    this.master = new Tone.Gain(0).toDestination();
    this.partGains = {
      drums: new Tone.Gain(1).connect(this.master),
      bass: new Tone.Gain(1).connect(this.master),
      chords: new Tone.Gain(1).connect(this.master),
    };

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
      volume: -4,
    }).connect(this.partGains.drums);

    this.snareFilter = new Tone.Filter(1800, 'bandpass').connect(this.partGains.drums);
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
      volume: -6,
    }).connect(this.snareFilter);

    this.hatFilter = new Tone.Filter(7000, 'highpass').connect(this.partGains.drums);
    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      volume: -12,
    }).connect(this.hatFilter);

    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.08 },
      filter: { Q: 1, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.1, baseFrequency: 180, octaves: 2.5 },
      volume: -6,
    }).connect(this.partGains.bass);

    this.chords = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 1.2, sustain: 0.35, release: 0.6 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.15, release: 0.4 },
      volume: -14,
    }).connect(this.partGains.chords);
    this.chords.maxPolyphony = 16;

    this.unsubscribes = [
      transport.onSixteenth(this.handleSixteenth),
      transport.onStateChange(this.handleStateChange),
    ];
    if (transport.state() === 'started') this.handleStateChange({ state: 'started', audioTime: Tone.now() });
  }

  load(p: Progression): void {
    if (this.disposed) throw new Error('VirtualPushSynth.load: the synth is disposed');
    this.prepared = prepareProgression(p, this.transport.config());
    this.pattern = drumPatternFor(p.style);
  }

  setMask(parts: PartMask): void {
    this.mask = { drums: parts.drums, bass: parts.bass, chords: parts.chords };
    // While stopped the master gain is 0; the start handler applies the mask.
  }

  currentSlot(audioTime: number): { slot: ChordSlot; index: number } {
    if (!this.prepared) throw new Error('VirtualPushSynth.currentSlot: no progression loaded');
    return slotAtAudioTime(this.transport, this.prepared, audioTime);
  }

  chordChangeTimes(): number[] {
    if (!this.prepared) return [];
    return chordChangeTimesFor(this.transport, this.prepared);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.chords.releaseAll();
    for (const node of [
      this.kick,
      this.snare,
      this.hat,
      this.snareFilter,
      this.hatFilter,
      this.bass,
      this.chords,
      ...PARTS.map((p) => this.partGains[p]),
      this.master,
    ]) {
      node.dispose();
    }
    this.prepared = null;
  }

  // -------------------------------------------------------------------------

  private readonly handleStateChange = (e: TransportStateChange): void => {
    if (this.disposed) return;
    const master = this.master.gain;
    if (e.state === 'started') {
      master.cancelAndHoldAtTime(e.audioTime);
      master.setValueAtTime(1, e.audioTime);
      for (const part of PARTS) {
        const gain = this.partGains[part].gain;
        gain.cancelAndHoldAtTime(e.audioTime);
        gain.setValueAtTime(this.mask[part] ? 1 : 0, e.audioTime);
      }
      this.appliedMask = { ...this.mask };
    } else {
      master.cancelAndHoldAtTime(e.audioTime);
      master.linearRampToValueAtTime(0, e.audioTime + RAMP_SEC);
      this.bass.triggerRelease(e.audioTime);
      this.chords.releaseAll(e.audioTime);
    }
  };

  private readonly handleSixteenth = (e: BeatEvent): void => {
    if (this.disposed) return;
    this.applyMaskChanges(e.audioTime);
    const prepared = this.prepared;
    const pattern = this.pattern;
    if (!prepared || !pattern) return;

    const hits = planSixteenth(e, prepared, pattern, this.appliedMask, this.transport.config().swing, (t) =>
      this.transport.audioTimeOfAbsTick(t),
    );
    for (const hit of hits) {
      switch (hit.part) {
        case 'drums':
          this.playDrum(hit.voice, hit.time, hit.velocity);
          break;
        case 'bass':
          this.bass.triggerAttackRelease(midiToHz(hit.note), hit.duration, hit.time, BASS_VELOCITY);
          break;
        case 'chords':
          this.chords.triggerAttackRelease(hit.notes.map(midiToHz), hit.duration, hit.time, CHORD_VELOCITY);
          break;
      }
    }
  };

  /** Fades each part whose mask changed, from this sixteenth's grid time. */
  private applyMaskChanges(audioTime: number): void {
    for (const part of PARTS) {
      if (this.mask[part] === this.appliedMask[part]) continue;
      const gain = this.partGains[part].gain;
      gain.cancelAndHoldAtTime(audioTime);
      gain.linearRampToValueAtTime(this.mask[part] ? 1 : 0, audioTime + RAMP_SEC);
    }
    this.appliedMask = { ...this.mask };
  }

  private playDrum(voice: DrumVoice, time: number, velocity: number): void {
    switch (voice) {
      case 'kick':
        this.kick.triggerAttackRelease(KICK_HZ, 0.3, time, velocity);
        break;
      case 'snare':
        this.snare.triggerAttackRelease(0.15, time, velocity);
        break;
      case 'hat':
        this.hat.triggerAttackRelease(0.03, time, velocity);
        break;
    }
  }
}
