/**
 * Stub. The mic source (transients and pitch → `NoteEvent`, through
 * `PitchWorklet`) is Phase 3's Module 3 lane, which owns this file by name.
 * Every method throws `NotImplementedError`, and nothing registers it on the
 * `NoteBus` yet.
 *
 * When it is built: SPEC §2.2.2 (headphones; `echoCancellation`,
 * `noiseSuppression` and `autoGainControl` off) and SPEC §3.3 (calibration is
 * mandatory for the mic).
 */
import { NotImplementedError } from '../types/errors';
import type { NoteEvent, Unsubscribe } from '../types/music';
import type { NoteInputSource } from './NoteInput';

const REPLACED_BY = 'Phase 3, Module 3 lane';

export class MicInput implements NoteInputSource {
  readonly id = 'mic' as const;

  available(): Promise<boolean> {
    throw new NotImplementedError('MicInput.available', REPLACED_BY);
  }

  start(): Promise<void> {
    throw new NotImplementedError('MicInput.start', REPLACED_BY);
  }

  stop(): void {
    throw new NotImplementedError('MicInput.stop', REPLACED_BY);
  }

  onNote(_cb: (e: NoteEvent) => void): Unsubscribe {
    throw new NotImplementedError('MicInput.onNote', REPLACED_BY);
  }
}
