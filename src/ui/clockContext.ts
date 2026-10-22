import type { AudioClockContext } from '../audio/Clock';

/**
 * The native `AudioContext` under Tone's. Tone wraps it in
 * standardized-audio-context, whose `AudioContext` has no `outputLatency` or
 * `getOutputTimestamp()`, so a `ClockBridge` over the wrapper would never see
 * either (decision 7's readout, SPEC §3.3's latency). The wrapper keeps the
 * native context in `_nativeAudioContext`; without one, the context is used
 * as is.
 */
export function clockContextOf(raw: unknown): AudioClockContext {
  const native = (raw as { _nativeAudioContext?: unknown } | null)?._nativeAudioContext;
  return (native ?? raw) as AudioClockContext;
}
