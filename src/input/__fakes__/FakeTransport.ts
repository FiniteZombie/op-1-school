/**
 * A real transport engine (`TransportCore` from `timing.ts`) over a
 * hand-stepped driver, and a fake `ClockBridge`, for tests. Because the
 * engine is the real one, tempo anchors, pulse ticks and swing behave exactly
 * as in the app; only time is fake.
 */
import type { ClockBridge, ClockSnapshot } from '../../audio/Clock';
import {
  audioTimeOfAbsTick,
  PULSE_TICKS,
  TransportCore,
  type TransportDriver,
} from '../../audio/timing';

/**
 * Like Tone: `now()` is `currentTime + lookAhead`, and `advanceTo` hands out
 * every pulse whose audio time is at or before the new `now()`, in order.
 */
export class FakeTransportDriver implements TransportDriver {
  readyFlag = true;
  time = 0;
  look = 0.1;
  core: TransportCore | null = null;
  private onPulse: ((t: number) => void) | null = null;
  private nextAbsTick = 0;

  ready(): boolean {
    return this.readyFlag;
  }
  now(): number {
    return this.time + this.look;
  }
  currentTime(): number {
    return this.time;
  }
  lookAhead(): number {
    return this.look;
  }
  start(_at: number, _bpm: number, onPulse: (t: number) => void): void {
    this.onPulse = onPulse;
    this.nextAbsTick = 0;
  }
  stop(): void {
    this.onPulse = null;
  }
  setBpmAt(): void {}

  /** Moves `currentTime` to `t` (seconds) and dispatches the pulses now due. */
  advanceTo(t: number): void {
    this.time = t;
    const core = this.core;
    while (this.onPulse && core) {
      const anchors = core.tempoAnchors();
      if (anchors.length === 0) return;
      const at = audioTimeOfAbsTick(anchors, this.nextAbsTick);
      if (at > this.now() + 1e-9) return;
      this.nextAbsTick += PULSE_TICKS;
      this.onPulse(at);
    }
  }
}

export function createFakeTransport(): { transport: TransportCore; driver: FakeTransportDriver } {
  const driver = new FakeTransportDriver();
  const transport = new TransportCore(driver);
  driver.core = transport;
  return { transport, driver };
}

/**
 * `audioToPerf(t) = originMs + 1000·t`; `audibleAt` adds `outputLatencySec`.
 * The default origin (5000 ms) is SPEC §3.3's worked example.
 */
export class FakeClockBridge implements ClockBridge {
  constructor(
    readonly originMs = 5000,
    readonly latencySec = 0,
  ) {}

  refresh(): void {}
  audioToPerf(audioSec: number): number {
    return this.originMs + 1000 * audioSec;
  }
  perfToAudio(perfMs: number): number {
    return (perfMs - this.originMs) / 1000;
  }
  outputLatencySec(): number {
    return this.latencySec;
  }
  audibleAt(audioSec: number): number {
    return this.audioToPerf(audioSec + this.latencySec);
  }
  snapshot(): ClockSnapshot {
    return {
      currentTime: 0,
      outputContextTime: null,
      gapMs: null,
      outputLatencyMs: this.latencySec * 1000,
      baseLatencyMs: null,
      path: 'fit',
      hasGetOutputTimestamp: false,
      hasOutputLatency: true,
      fitPairs: 0,
    };
  }
}
