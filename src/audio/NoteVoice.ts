/**
 * The touch voice (plan decision 8): a small `PolySynth` that plays `touch`
 * notes from the `NoteBus`, so on-screen keys make a sound. Which events it
 * plays is `noteVoiceLogic.ts`; this file only turns those into Tone calls.
 * `createSpine()` builds it once; it lives as long as the page. Checked on
 * `/dev/spine`.
 */
import * as Tone from 'tone';
import type { NoteBus } from '../input/NoteInput';
import type { Unsubscribe } from '../types/music';
import { NoteVoiceLogic } from './noteVoiceLogic';
import { getAudioContext } from './TransportEngine';

export class NoteVoice {
  private readonly logic = new NoteVoiceLogic();
  private readonly synth: Tone.PolySynth<Tone.Synth>;
  private readonly off: Unsubscribe;

  /** `audioRunning` is the audio gate's state; nothing sounds while it's false. */
  constructor(
    bus: NoteBus,
    private readonly audioRunning: () => boolean,
  ) {
    getAudioContext(); // Tone nodes bind to the current context: make sure it's the app's.
    // placeholder: a soft sine-ish patch, quieter than the backing chords (-14 dB).
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.25 },
      volume: -18,
    }).toDestination();
    this.synth.maxPolyphony = 10;

    this.off = bus.onNote((e) => {
      const action = this.logic.apply(e, this.audioRunning());
      if (!action) return;
      // `Tone.immediate()` is `currentTime`; Tone's default time adds the 100 ms look-ahead.
      const freq = Tone.Frequency(action.note, 'midi').toFrequency();
      if (action.kind === 'attack') this.synth.triggerAttack(freq, Tone.immediate(), action.velocity);
      else this.synth.triggerRelease(freq, Tone.immediate());
    });
  }

  /** Releases every sounding note; call when audio stops running. */
  releaseAll(): void {
    const notes = this.logic.releaseAll();
    if (notes.length > 0) this.synth.releaseAll(Tone.immediate());
  }

  dispose(): void {
    this.off();
    this.synth.dispose();
  }
}
