import { describe, expect, it } from 'vitest';
import type { ClockSnapshot } from '../../../audio/Clock';
import type { ClockStats, PortInfo } from '../../../input/MidiBridge';
import { chordName, loadProgression } from '../../../theory/index';
import { validateProgressionSpec } from '../../../types/lessons';
import {
  DB_CHECK_ID,
  DEV_PROGRESSION,
  LOG_CAP,
  appendCapped,
  bpmFromEncoder,
  clockRows,
  encoderFromBpm,
  formatNoteEvent,
  midiPanelView,
  runDbCheck,
  timingRows,
  type DbCheckRecord,
  type DbCheckTarget,
  type MidiPanelState,
} from '../devSpine';

describe('DEV_PROGRESSION', () => {
  it('is a valid spec: F minor ii°–V7–i–VI at 90 BPM, swing 0.5', () => {
    expect(validateProgressionSpec(DEV_PROGRESSION)).toEqual([]);
    expect(DEV_PROGRESSION.id).toBe('dev-spine-fminor');
    const p = loadProgression(DEV_PROGRESSION);
    expect(p.bpm).toBe(90);
    expect(p.swing).toBe(0.5);
    expect(p.slots.map((s) => chordName(s.chord, p.key))).toEqual(['Gdim', 'C7', 'Fm', 'D♭']);
    expect(p.slots.map((s) => s.beats)).toEqual([4, 4, 4, 4]);
  });
});

describe('BPM encoder', () => {
  it('maps 0..1 to integers 60–160, clamped', () => {
    expect(bpmFromEncoder(0)).toBe(60);
    expect(bpmFromEncoder(1)).toBe(160);
    expect(bpmFromEncoder(0.3)).toBe(90);
    expect(bpmFromEncoder(0.304)).toBe(90);
    expect(bpmFromEncoder(-1)).toBe(60);
    expect(bpmFromEncoder(2)).toBe(160);
    expect(bpmFromEncoder(NaN)).toBe(60);
  });
  it('round-trips and clamps a BPM outside the range', () => {
    for (const bpm of [60, 90, 123, 160]) expect(bpmFromEncoder(encoderFromBpm(bpm))).toBe(bpm);
    expect(encoderFromBpm(30)).toBe(0);
    expect(encoderFromBpm(300)).toBe(1);
  });
});

const IN: PortInfo = { id: 'in-1', name: 'port in', manufacturer: '' };
const OUT: PortInfo = { id: 'out-1', name: 'port out', manufacturer: '' };
const base: MidiPanelState = {
  access: 'unrequested',
  inputs: [],
  outputs: [],
  selectedInput: null,
  selectedOutput: null,
  mode: 'internal',
};

describe('midiPanelView', () => {
  it('offers the request button before access, with both toggles disabled', () => {
    const v = midiPanelView(base);
    expect(v.canRequest).toBe(true);
    expect(v.status.tone).toBe('neutral');
    expect(v.clockOutDisabled && v.followDisabled).toBe(true);
  });
  it('shows the settled copy for denied, unsupported and no ports, toggles disabled', () => {
    const denied = midiPanelView({ ...base, access: 'denied' });
    expect(denied.status).toEqual({ tone: 'bad', text: 'midi permission denied' });
    expect(denied.canRequest).toBe(false);
    const unsupported = midiPanelView({ ...base, access: 'unsupported' });
    expect(unsupported.status.text).toBe("web midi isn't available in this browser");
    const none = midiPanelView({ ...base, access: 'granted' });
    expect(none.status).toEqual({ tone: 'warn', text: 'no midi' });
    expect(none.showPickers).toBe(false);
    for (const v of [denied, unsupported, none]) expect(v.clockOutDisabled && v.followDisabled).toBe(true);
  });
  it('enables clock out with an output and follow with an input', () => {
    const ports = { ...base, access: 'granted' as const, inputs: [IN], outputs: [OUT] };
    const nothing = midiPanelView(ports);
    expect(nothing.showPickers).toBe(true);
    expect(nothing.status.tone).toBe('ok');
    expect(nothing.clockOutDisabled && nothing.followDisabled).toBe(true);
    const outOnly = midiPanelView({ ...ports, selectedOutput: OUT });
    expect([outOnly.clockOutDisabled, outOnly.followDisabled]).toEqual([false, true]);
    const both = midiPanelView({ ...ports, selectedInput: IN, selectedOutput: OUT, mode: 'follow' });
    expect([both.clockOutDisabled, both.followDisabled, both.clockOutOn, both.followOn]).toEqual([false, false, false, true]);
  });
});

describe('readouts', () => {
  it('prints the clock snapshot, with dashes for nulls', () => {
    const s: ClockSnapshot = {
      currentTime: 1.23456,
      outputContextTime: null,
      gapMs: null,
      outputLatencyMs: 32,
      baseLatencyMs: null,
      path: 'fit',
      hasGetOutputTimestamp: false,
      hasOutputLatency: true,
      fitPairs: 3,
    };
    const rows = Object.fromEntries(clockRows(s));
    expect(rows.currentTime).toBe('1.235 s');
    expect(rows.contextTime).toBe('–');
    expect(rows.outputLatency).toBe('32.0 ms');
    expect(rows.path).toBe('fit');
    expect(rows.getOutputTimestamp).toBe('no');
  });
  it('says no loopback until one exists', () => {
    const s: ClockStats = { sends: 0, headroomMinMs: null, headroomP5Ms: null, headroomP50Ms: null, late: 0, loopback: null };
    expect(Object.fromEntries(timingRows(s)).loopback).toBe('no loopback');
    const withLoop = timingRows({
      ...s,
      sends: 10,
      headroomMinMs: -1,
      headroomP5Ms: 2,
      headroomP50Ms: 50,
      late: 1,
      loopback: { count: 4, absErrorP50Ms: 1, absErrorP95Ms: 2.5, jitterP95Ms: 0.5 },
    });
    const rows = Object.fromEntries(withLoop);
    expect(rows['headroom min / p5 / p50']).toBe('-1.00 ms / 2.00 ms / 50.00 ms');
    expect(rows['loopback |error| p50 / p95']).toBe('1.00 ms / 2.50 ms');
    expect(rows.loopback).toBeUndefined();
  });
});

describe('log', () => {
  it('formats source, kind, note, velocity and perfTs', () => {
    expect(formatNoteEvent({ kind: 'on', note: 53, velocity: 1, perfTs: 1234.56, source: 'touch' })).toBe(
      'touch on 53 v1.00 1234.6',
    );
  });
  it('keeps the newest 200 lines', () => {
    let lines: number[] = [];
    for (let i = 0; i < 250; i++) lines = appendCapped(lines, i);
    expect(lines).toHaveLength(LOG_CAP);
    expect(lines[0]).toBe(50);
    expect(lines.at(-1)).toBe(249);
  });
});

class FakeDb implements DbCheckTarget {
  readonly store = new Map<string, DbCheckRecord>();
  readonly calls: string[] = [];
  constructor(private readonly fail?: 'put' | 'keep') {}
  async put(_s: 'attempts', value: DbCheckRecord) {
    this.calls.push('put');
    if (this.fail === 'put') throw new Error('quota exceeded');
    this.store.set(value.id, value);
  }
  async get(_s: 'attempts', key: string) {
    this.calls.push('get');
    return this.store.get(key);
  }
  async delete(_s: 'attempts', key: string) {
    this.calls.push('delete');
    if (this.fail !== 'keep') this.store.delete(key);
  }
}

describe('runDbCheck', () => {
  it('writes dev-spine-check to attempts, reads it, deletes it: db ok', async () => {
    const db = new FakeDb();
    expect(await runDbCheck(db, 42)).toEqual({ tone: 'ok', text: 'db ok' });
    expect(db.calls).toEqual(['put', 'get', 'delete', 'get']);
    expect(db.store.has(DB_CHECK_ID)).toBe(false);
  });
  it('reports the error', async () => {
    expect(await runDbCheck(new FakeDb('put'), 1)).toEqual({ tone: 'bad', text: 'db failed: quota exceeded' });
    expect((await runDbCheck(new FakeDb('keep'), 1)).text).toBe('db failed: the record was not deleted');
  });
});
