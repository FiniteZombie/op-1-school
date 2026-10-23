import { describe, expect, it } from 'vitest';
import {
  CLOCK_WINDOW,
  clockRateBpm,
  emptyTally,
  formatProbeReport,
  hex,
  messageKind,
  tallyMessage,
  type ProbePort,
} from '../probeReport';

describe('messageKind', () => {
  it('sorts status bytes', () => {
    expect(messageKind(0xf8)).toBe('clock');
    expect([0xfa, 0xfb, 0xfc].map(messageKind)).toEqual(['transport', 'transport', 'transport']);
    expect(messageKind(0xfe)).toBe('activeSensing');
    expect([0x90, 0x8f, 0x9a].map(messageKind)).toEqual(['note', 'note', 'note']);
    expect([0xb0, 0xe0, 0xf2].map(messageKind)).toEqual(['other', 'other', 'other']);
  });
});

describe('tallyMessage', () => {
  it('counts by kind, keeps the last message and caps the clock window', () => {
    const t = emptyTally();
    expect(tallyMessage(t, [], 0)).toBeNull();
    tallyMessage(t, [0x90, 53, 127], 10);
    for (let i = 0; i < CLOCK_WINDOW + 10; i++) tallyMessage(t, [0xf8], 100 + i);
    expect(t.total).toBe(CLOCK_WINDOW + 11);
    expect(t.counts.note).toBe(1);
    expect(t.counts.clock).toBe(CLOCK_WINDOW + 10);
    expect(t.clockStamps).toHaveLength(CLOCK_WINDOW);
    expect(t.clockStamps[0]).toBe(110);
    expect(t.last).toEqual({ hex: 'f8', perfTs: 100 + CLOCK_WINDOW + 9 });
  });

  it('prints bytes as hex', () => {
    expect(hex([0x90, 5, 127])).toBe('90 05 7f');
  });
});

describe('clockRateBpm', () => {
  it('reads 90 BPM from pulses 27.78 ms apart, and nothing under one beat', () => {
    const period = 60_000 / (90 * 24);
    const stamps = Array.from({ length: 48 }, (_, i) => 1000 + i * period);
    expect(clockRateBpm(stamps)).toBeCloseTo(90, 9);
    expect(clockRateBpm(stamps.slice(0, 24))).toBeNull();
    expect(clockRateBpm([5, 5, ...stamps.slice(0, 23).map(() => 5)])).toBeNull();
  });
});

describe('formatProbeReport', () => {
  const tally = emptyTally();
  tallyMessage(tally, [0x90, 53, 127], 12.5);
  const ports: ProbePort[] = [
    { type: 'input', id: 'in-1', name: 'OP-1', manufacturer: 'Teenage Engineering', state: 'connected', connection: 'open', tally },
    { type: 'output', id: 'out-1', name: 'OP-1', manufacturer: '', state: 'connected', connection: 'closed' },
  ];

  it('prints sections, each port with its counts, and recent messages', () => {
    const text = formatProbeReport({
      at: '2026-10-23T00:00:00.000Z',
      userAgent: 'ua',
      sections: [['midi', [['access', 'granted']]]],
      ports,
      recent: [{ perfTs: 12.5, port: 'OP-1', hex: '90 35 7f' }],
    });
    expect(text.split('\n')).toEqual([
      'dev spine report · 2026-10-23T00:00:00.000Z',
      'ua',
      '',
      '[midi]',
      'access: granted',
      '',
      '[inputs]',
      'OP-1 · Teenage Engineering · connected/open · id in-1',
      '  messages 1: note 1, clock 0, start/stop 0, active sensing 0, other 0',
      '  clock rate – · last 90 35 7f at 12.5 ms',
      '',
      '[outputs]',
      'OP-1 · no manufacturer · connected/closed · id out-1',
      '',
      '[recent, without clock and active sensing]',
      '12.5 OP-1 90 35 7f',
    ]);
  });

  it('says why when there are no ports', () => {
    const text = formatProbeReport({ at: 'now', userAgent: 'ua', sections: [], ports: 'midi not granted', recent: [] });
    expect(text).toContain('[ports]\nmidi not granted');
    expect(text).toContain('[recent, without clock and active sensing]\nnone');
  });
});
