import { describe, expect, test } from 'vitest';
import type { BeatEvent, TransportConfig } from '../TransportEngine';
import {
  absTickOfAudioTime,
  assertTransportConfig,
  audioTimeOfAbsTick,
  pruneAnchors,
  positionOfTick,
  PPQ,
  PULSE_TICKS,
  scheduleTempoChange,
  secondsPerTick,
  sixteenthSeconds,
  swingOffsetSec,
  type TempoAnchor,
  TransportCore,
  type TransportDriver,
  validateTransportConfig,
} from '../timing';

const CFG: TransportConfig = { bpm: 120, swing: 0, bars: 4, timeSig: [4, 4] };

describe('grid maths', () => {
  test('PPQ is 192 and a pulse is every 8 ticks', () => {
    expect(PPQ).toBe(192);
    expect(PULSE_TICKS).toBe(8);
    expect(secondsPerTick(120)).toBeCloseTo(1 / 384, 12);
  });

  test('at 90 BPM a sixteenth is 166.7 ms', () => {
    expect(sixteenthSeconds(90) * 1000).toBeCloseTo(166.667, 2);
  });

  test('swingOffsetSec at 90 BPM, swing 0.5: 0.02778 s on odd sixteenths, 0 on even', () => {
    for (let i = 0; i < 16; i++) {
      const off = swingOffsetSec(i, 0.5, 90);
      if (i % 2 === 1) expect(Math.abs(off - 0.02778)).toBeLessThanOrEqual(0.0001);
      else expect(off).toBe(0);
    }
    expect(swingOffsetSec(1, 0, 90)).toBe(0);
    // Swing 1 is triplet feel: the off-beat lands at 2/3 of the eighth.
    expect((sixteenthSeconds(90) + swingOffsetSec(1, 1, 90)) / (2 * sixteenthSeconds(90))).toBeCloseTo(2 / 3, 9);
  });

  test('positionOfTick counts bar and beat from 1, sixteenth 0–15, across loop iterations', () => {
    expect(positionOfTick(0, CFG)).toEqual({ bar: 1, beat: 1, sixteenth: 0, tick: 0, absTick: 0, iteration: 0 });
    expect(positionOfTick(48 * 15, CFG)).toMatchObject({ bar: 1, beat: 4, sixteenth: 15 });
    expect(positionOfTick(768, CFG)).toMatchObject({ bar: 2, beat: 1, sixteenth: 0, tick: 768 });
    expect(positionOfTick(3072 + 200, CFG)).toMatchObject({ bar: 1, beat: 2, sixteenth: 4, tick: 200, iteration: 1 });
    expect(positionOfTick(576 + 48 * 11, { bars: 2, timeSig: [3, 4] })).toMatchObject({
      bar: 2,
      beat: 3,
      sixteenth: 11,
    });
  });
});

describe('tempo anchors', () => {
  // Start at 2.0 s at 120 BPM; BPM → 90 at the bar-2 downbeat (tick 768, 4.0 s).
  const start: TempoAnchor = { audioTime: 2, absTick: 0, bpm: 120 };

  test('tick 960 maps to 4.667 s and back to 960', () => {
    const { anchors, anchor } = scheduleTempoChange([start], 90, 3.95);
    expect(anchor).toEqual({ audioTime: 4, absTick: 768, bpm: 90 });
    expect(audioTimeOfAbsTick(anchors, 768)).toBeCloseTo(4, 12);
    expect(audioTimeOfAbsTick(anchors, 960)).toBeCloseTo(4.6667, 4);
    expect(absTickOfAudioTime(anchors, audioTimeOfAbsTick(anchors, 960))).toBe(960);
    // Before the change the old tempo still holds.
    expect(audioTimeOfAbsTick(anchors, 384)).toBeCloseTo(3, 12);
    expect(absTickOfAudioTime(anchors, 3)).toBe(384);
  });

  test('a change lands on the first beat boundary strictly after the earliest time', () => {
    expect(scheduleTempoChange([start], 90, 3.5).anchor.absTick).toBe(768); // 3.5 s is tick 576 itself
    expect(scheduleTempoChange([start], 90, 3.4).anchor.absTick).toBe(576);
  });

  test('a newer change replaces a pending one at or after its tick', () => {
    const first = scheduleTempoChange([start], 90, 3.95).anchors;
    const second = scheduleTempoChange(first, 100, 3.95);
    expect(second.anchors).toEqual([start, { audioTime: 4, absTick: 768, bpm: 100 }]);
  });

  test('ticks round to the nearest integer', () => {
    expect(absTickOfAudioTime([start], 2 + 10.4 / 384)).toBe(10);
    expect(absTickOfAudioTime([start], 2 + 10.6 / 384)).toBe(11);
  });

  test('pruning keeps the anchor in effect at the given time', () => {
    const { anchors } = scheduleTempoChange([start], 90, 3.95);
    expect(pruneAnchors(anchors, 3.9)).toHaveLength(2);
    expect(pruneAnchors(anchors, 4.1)).toEqual([{ audioTime: 4, absTick: 768, bpm: 90 }]);
  });

  test('maps throw with no anchors', () => {
    expect(() => audioTimeOfAbsTick([], 0)).toThrow(/not running/);
  });
});

describe('validateTransportConfig', () => {
  test('accepts the edges', () => {
    expect(validateTransportConfig({ bpm: 30, swing: 0, bars: 1, timeSig: [4, 4] })).toEqual([]);
    expect(validateTransportConfig({ bpm: 300, swing: 1, bars: 8, timeSig: [7, 4] })).toEqual([]);
  });

  test.each<[string, Partial<TransportConfig>, RegExp]>([
    ['bpm low', { bpm: 29.9 }, /bpm/],
    ['bpm high', { bpm: 301 }, /bpm/],
    ['bpm NaN', { bpm: Number.NaN }, /bpm/],
    ['swing', { swing: 1.1 }, /swing/],
    ['swing negative', { swing: -0.1 }, /swing/],
    ['bars 0', { bars: 0 }, /bars/],
    ['bars fraction', { bars: 1.5 }, /bars/],
    ['6/8', { timeSig: [6, 8] }, /timeSig/],
    ['0/4', { timeSig: [0, 4] }, /timeSig/],
  ])('rejects %s', (_name, patch, msg) => {
    const cfg = { ...CFG, ...patch };
    expect(validateTransportConfig(cfg).join()).toMatch(msg);
    expect(() => assertTransportConfig(cfg)).toThrow(RangeError);
  });
});

/** A driver the test steps by hand: it reports pulses on the straight grid at the tempo it was told. */
class FakeDriver implements TransportDriver {
  readyFlag = true;
  time = 0;
  look = 0.1;
  onPulse: ((t: number) => void) | null = null;
  started: { at: number; bpm: number } | null = null;
  stoppedAt: number | null = null;
  bpmChanges: { bpm: number; at: number }[] = [];
  log: string[];

  constructor(log: string[] = []) {
    this.log = log;
  }

  ready() {
    return this.readyFlag;
  }
  now() {
    return this.time + this.look;
  }
  currentTime() {
    return this.time;
  }
  lookAhead() {
    return this.look;
  }
  start(at: number, bpm: number, onPulse: (t: number) => void) {
    this.log.push('driver.start');
    this.started = { at, bpm };
    this.onPulse = onPulse;
  }
  stop(at: number) {
    this.stoppedAt = at;
    this.onPulse = null;
  }
  setBpmAt(bpm: number, at: number) {
    this.bpmChanges.push({ bpm, at });
  }
  /** Emit the pulses for absolute ticks [from, to) at their times on the given anchors. */
  emit(anchors: TempoAnchor[], from: number, to: number) {
    for (let t = from; t < to; t += PULSE_TICKS) this.onPulse?.(audioTimeOfAbsTick(anchors, t));
  }
}

function record(core: TransportCore, log: string[]) {
  const pulses: { audioTime: number; absTick: number }[] = [];
  const beats: BeatEvent[] = [];
  const sixteenths: BeatEvent[] = [];
  const loops: number[] = [];
  core.onStateChange((e) => log.push(`state ${e.state}`));
  core.onLoop((i) => {
    loops.push(i);
    log.push(`loop ${i}`);
  });
  core.onBeat((e) => {
    beats.push(e);
    log.push(`beat ${e.absTick}`);
  });
  core.onSixteenth((e) => sixteenths.push(e));
  core.onMidiPulse((audioTime, absTick) => {
    pulses.push({ audioTime, absTick });
    log.push(`pulse ${absTick}`);
  });
  return { pulses, beats, sixteenths, loops };
}

describe('TransportCore', () => {
  test('at 120 BPM, 4 beats hold 96 pulses (0, 8, …, 760), the last at 1.979 s, none moved by swing', () => {
    const driver = new FakeDriver();
    const core = new TransportCore(driver);
    core.configure({ ...CFG, swing: 0.5 });
    const { pulses, sixteenths } = record(core, []);
    core.start(2);
    driver.emit(core.tempoAnchors(), 0, 4 * PPQ);
    expect(pulses.map((p) => p.absTick)).toEqual(Array.from({ length: 96 }, (_, i) => i * 8));
    const last = pulses[95];
    expect(last?.absTick).toBe(760);
    expect((last?.audioTime ?? 0) - 2).toBeCloseTo(1.979, 3);
    // Straight grid: 20.833 ms apart, whatever the swing.
    pulses.forEach((p, i) => expect(p.audioTime).toBeCloseTo(2 + (i * 8) / 384, 9));
    // Sixteenth events carry the straight time too; swing is the consumer's swingOffsetSec.
    sixteenths.forEach((e, i) => expect(e.audioTime).toBeCloseTo(2 + (i * 48) / 384, 9));
    expect(sixteenths.map((e) => e.sixteenth)).toEqual([...Array(16).keys()]);
  });

  test('`started` fires before the tick-0 loop, beat and pulse', () => {
    const log: string[] = [];
    const driver = new FakeDriver(log);
    const core = new TransportCore(driver);
    record(core, log);
    core.start(1);
    driver.emit(core.tempoAnchors(), 0, 16);
    expect(log).toEqual(['state started', 'driver.start', 'loop 0', 'beat 0', 'pulse 0', 'pulse 8']);
  });

  test('beats and loops across a loop boundary', () => {
    const driver = new FakeDriver();
    const core = new TransportCore(driver);
    core.configure({ ...CFG, bars: 1 });
    const { beats, loops } = record(core, []);
    core.start(0);
    driver.emit(core.tempoAnchors(), 0, 2 * 768 + 8);
    expect(loops).toEqual([0, 1, 2]);
    expect(beats.map((b) => [b.bar, b.beat, b.tick, b.absTick])).toEqual([
      [1, 1, 0, 0],
      [1, 2, 192, 192],
      [1, 3, 384, 384],
      [1, 4, 576, 576],
      [1, 1, 0, 768],
      [1, 2, 192, 960],
      [1, 3, 384, 1152],
      [1, 4, 576, 1344],
      [1, 1, 0, 1536],
    ]);
  });

  test('BPM change while running: first beat boundary after currentTime + lookAhead, anchored', () => {
    const driver = new FakeDriver();
    const core = new TransportCore(driver);
    core.configure(CFG);
    core.start(2);
    driver.time = 3.85; // + 0.1 lookahead = 3.95 s, tick 748.8 → next boundary 768 at 4.0 s
    core.configure({ ...CFG, bpm: 90 });
    expect(driver.bpmChanges).toEqual([{ bpm: 90, at: 4 }]);
    expect(core.bpm()).toBe(90);
    expect(core.audioTimeOfAbsTick(960)).toBeCloseTo(4.6667, 4);
    expect(core.absTickOfAudioTime(core.audioTimeOfAbsTick(960))).toBe(960);
    expect(core.tempoAnchors()).toEqual([
      { audioTime: 2, absTick: 0, bpm: 120 },
      { audioTime: 4, absTick: 768, bpm: 90 },
    ]);
  });

  test('swing alone while running schedules no tempo change; bars or timeSig throw', () => {
    const driver = new FakeDriver();
    const core = new TransportCore(driver);
    core.start(0);
    core.configure({ ...CFG, swing: 0.4 });
    expect(core.config().swing).toBe(0.4);
    expect(driver.bpmChanges).toEqual([]);
    expect(() => core.configure({ ...CFG, bars: 2 })).toThrow(/stopped/);
    expect(() => core.configure({ ...CFG, timeSig: [3, 4] })).toThrow(/stopped/);
    expect(() => core.configure({ ...CFG, bpm: 400 })).toThrow(RangeError);
  });

  test('tick ↔ time maps throw while stopped; position is bar 1 beat 1', () => {
    const core = new TransportCore(new FakeDriver());
    expect(() => core.audioTimeOfTick(0)).toThrow(/stopped/);
    expect(() => core.tickOfAudioTime(0)).toThrow(/stopped/);
    expect(() => core.audioTimeOfAbsTick(0)).toThrow(/stopped/);
    expect(() => core.absTickOfAudioTime(0)).toThrow(/stopped/);
    expect(core.position()).toEqual({ bar: 1, beat: 1, sixteenth: 0, ticks: 0 });
  });

  test('in-loop maps use the current iteration', () => {
    const driver = new FakeDriver();
    const core = new TransportCore(driver);
    core.configure({ ...CFG, bars: 1 }); // 2 s per loop at 120
    core.start(0);
    driver.time = 2.5; // iteration 1, tick 192
    expect(core.position()).toEqual({ bar: 1, beat: 2, sixteenth: 4, ticks: 192 });
    expect(core.audioTimeOfTick(0)).toBeCloseTo(2, 12);
    expect(core.tickOfAudioTime(2.5)).toBe(192);
  });

  test('start before audio is initialised throws; stop when stopped does nothing', () => {
    const driver = new FakeDriver();
    driver.readyFlag = false;
    const log: string[] = [];
    const core = new TransportCore(driver);
    core.onStateChange((e) => log.push(e.state));
    expect(() => core.start()).toThrow(/initAudio/);
    core.stop();
    expect(log).toEqual([]);
    expect(driver.stoppedAt).toBeNull();
  });

  test('stop emits `stopped` at the driver stop time and later pulses are ignored', () => {
    const driver = new FakeDriver();
    const core = new TransportCore(driver);
    const states: [string, number][] = [];
    core.onStateChange((e) => states.push([e.state, e.audioTime]));
    const { pulses } = record(core, []);
    core.start(); // defaults to now() = 0.1
    const onPulse = driver.onPulse;
    driver.time = 0.5;
    core.stop();
    onPulse?.(0.6);
    expect(states).toEqual([
      ['started', 0.1],
      ['stopped', 0.6],
    ]);
    expect(driver.stoppedAt).toBe(0.6);
    expect(pulses).toEqual([]);
    expect(core.state()).toBe('stopped');
  });

  test('a throwing subscriber does not stop the others', () => {
    const driver = new FakeDriver();
    const core = new TransportCore(driver);
    const seen: number[] = [];
    const original = console.error;
    console.error = () => {};
    try {
      core.onMidiPulse(() => {
        throw new Error('boom');
      });
      core.onMidiPulse((_, tick) => seen.push(tick));
      core.start(0);
      driver.emit(core.tempoAnchors(), 0, 16);
    } finally {
      console.error = original;
    }
    expect(seen).toEqual([0, 8]);
  });

  test('pulses keep their ticks across a tempo change', () => {
    const driver = new FakeDriver();
    const core = new TransportCore(driver);
    const { pulses } = record(core, []);
    core.start(2);
    driver.time = 3.85;
    core.configure({ ...CFG, bpm: 90 });
    driver.emit(core.tempoAnchors(), 0, 1152);
    expect(pulses.map((p) => p.absTick)).toEqual(Array.from({ length: 144 }, (_, i) => i * 8));
    expect(pulses.find((p) => p.absTick === 960)?.audioTime).toBeCloseTo(4.6667, 4);
  });
});
