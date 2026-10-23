/**
 * Which `NoteBus` events the touch voice (`NoteVoice.ts`) sounds, Tone-free
 * (plan decision 8). Only `touch` notes: the Field sounds by itself, so
 * voicing `midi` would double it, and `mic` is the player's own instrument.
 * Nothing is voiced while audio isn't running (before the audio gate, or
 * while the context is suspended), and an `off` is voiced only for a note
 * this voice started.
 */
import type { InputSource, MidiNote, NoteEvent } from '../types/music';

export const VOICED_SOURCES: readonly InputSource[] = ['touch'];

export type VoiceAction = { kind: 'attack'; note: MidiNote; velocity: number } | { kind: 'release'; note: MidiNote };

export class NoteVoiceLogic {
  private readonly sounding = new Set<MidiNote>();

  /** What to play for `e`, or null. `audioRunning` is the audio gate's state at the event. */
  apply(e: Pick<NoteEvent, 'kind' | 'note' | 'velocity' | 'source'>, audioRunning: boolean): VoiceAction | null {
    if (!VOICED_SOURCES.includes(e.source)) return null;
    if (e.kind === 'on') {
      if (!audioRunning || this.sounding.has(e.note)) return null;
      this.sounding.add(e.note);
      return { kind: 'attack', note: e.note, velocity: e.velocity };
    }
    if (!this.sounding.delete(e.note)) return null;
    return { kind: 'release', note: e.note };
  }

  /** Every sounding note, cleared (audio stopped running). */
  releaseAll(): MidiNote[] {
    const notes = [...this.sounding];
    this.sounding.clear();
    return notes;
  }
}
