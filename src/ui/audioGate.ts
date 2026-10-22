/**
 * The audio gate's state, pure. Audio starts only from a tap (`initAudio()`,
 * i.e. `Tone.start()`); after that, a context the browser suspends or
 * interrupts (a phone call, a backgrounded tab) needs another tap.
 */

/** `off`: never started. `running`. `paused`: started, then suspended or interrupted. */
export type AudioState = 'off' | 'running' | 'paused';

/** From whether `initAudio()` has resolved and the context's `state` (`interrupted` is Safari's). */
export function audioStateOf(initialised: boolean, contextState: string): AudioState {
  if (!initialised) return 'off';
  return contextState === 'running' ? 'running' : 'paused';
}
