/**
 * Stub. Monophonic pitch by MPM in an `AudioWorkletProcessor`, plus its
 * main-thread wrapper (SPEC §5.1, §5.2), is Phase 3's Module 3 lane, which
 * owns this file by name and may reshape these signatures. Everything throws
 * `NotImplementedError`. Must stay Tone-free (decision 11).
 */
import { NotImplementedError } from '../types/errors';
import type { Unsubscribe } from '../types/music';

const REPLACED_BY = 'Phase 3, Module 3 lane';

export interface PitchEstimate {
  frequencyHz: number;
  /** MPM clarity, 0..1. */
  clarity: number;
  /** Audio time of the analysed window's end, seconds. */
  audioTime: number;
}

/** The pure MPM estimate over one window of samples; null when unpitched. */
export function detectPitch(_samples: Float32Array, _sampleRate: number): PitchEstimate | null {
  throw new NotImplementedError('detectPitch', REPLACED_BY);
}

/** The worklet wrapper: feed it an audio node, get pitch estimates back. */
export class PitchWorklet {
  start(_input: AudioNode): Promise<void> {
    throw new NotImplementedError('PitchWorklet.start', REPLACED_BY);
  }

  stop(): void {
    throw new NotImplementedError('PitchWorklet.stop', REPLACED_BY);
  }

  onPitch(_cb: (e: PitchEstimate) => void): Unsubscribe {
    throw new NotImplementedError('PitchWorklet.onPitch', REPLACED_BY);
  }
}
