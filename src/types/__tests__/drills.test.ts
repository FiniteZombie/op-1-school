import { describe, expect, it } from 'vitest';
import { DRILL_MODES, PAD_NOTE, launchQuery, levelId, parseLaunch, type DrillLaunch } from '../drills';
import { DRILL_MODULE_IDS } from '../lessons';

const full: DrillLaunch = {
  module: 'progression-trainer',
  mode: 'A6',
  session: 's-1',
  lesson: 'a6',
  step: 2,
  progression: 'seed-fminor',
  minutes: 0.25,
  returnTo: '/runner',
  params: { form: 'call-response', n: [1, 2] },
};

function errorOf(query: Record<string, string>): string {
  const r = parseLaunch('progression-trainer', query);
  if (!('error' in r)) throw new Error(`expected an error for ${JSON.stringify(query)}`);
  return r.error;
}

describe('drills', () => {
  it('a launch round-trips through launchQuery and parseLaunch with every field', () => {
    const q = launchQuery(full);
    expect(Object.keys(q)).toEqual(['mode', 'session', 'lesson', 'step', 'progression', 'minutes', 'returnTo', 'params']);
    expect(parseLaunch('progression-trainer', q)).toEqual({ launch: full });
  });

  it('a launch with only a mode round-trips', () => {
    const q = launchQuery({ module: 'pocket-dojo', mode: 'B0' });
    expect(q).toEqual({ mode: 'B0' });
    expect(parseLaunch('pocket-dojo', q)).toEqual({ launch: { module: 'pocket-dojo', mode: 'B0' } });
  });

  it('a bad field is an error naming it', () => {
    expect(errorOf({ mode: 'A9' })).toMatch(/^mode: /);
    expect(errorOf({})).toMatch(/^mode: /);
    expect(errorOf({ mode: 'A1', minutes: '0' })).toMatch(/^minutes: /);
    expect(errorOf({ mode: 'A1', minutes: 'x' })).toMatch(/^minutes: /);
    expect(errorOf({ mode: 'A1', step: '-1' })).toMatch(/^step: /);
    expect(errorOf({ mode: 'A1', step: '1.5' })).toMatch(/^step: /);
    expect(errorOf({ mode: 'A1', params: '{' })).toMatch(/^params: /);
    expect(errorOf({ mode: 'A1', params: '[1]' })).toMatch(/^params: /);
    expect(errorOf({ mode: 'A6', params: '{"form":"x"}' })).toMatch(/^params\.form: /);
    expect(errorOf({ mode: 'A1', returnTo: 'https://example.com' })).toMatch(/^returnTo: /);
    expect(errorOf({ mode: 'A1', returnTo: '//example.com' })).toMatch(/^returnTo: /);
    expect(errorOf({ mode: 'A1', session: '' })).toMatch(/^session: /);
  });

  it("a mode is checked against the module's own list", () => {
    expect('error' in parseLaunch('pocket-dojo', { mode: 'A0' })).toBe(true);
    expect('error' in parseLaunch('kit-compiler', { mode: 'A0' })).toBe(true);
  });

  it('unknown parameters are ignored', () => {
    expect(parseLaunch('progression-trainer', { mode: 'A0', other: '1' })).toEqual({
      launch: { module: 'progression-trainer', mode: 'A0' },
    });
  });

  it("lists each drill module's modes", () => {
    expect(DRILL_MODES['progression-trainer']).toEqual(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
    expect(DRILL_MODES['pocket-dojo']).toEqual(['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6']);
    expect(DRILL_MODES['sample-flip']).toEqual(['C1', 'C2', 'C3']);
    expect(DRILL_MODES['kit-compiler']).toEqual([]);
    expect(Object.keys(DRILL_MODES).sort()).toEqual([...DRILL_MODULE_IDS].sort());
  });

  it('levelId and the pad sentinel', () => {
    expect(levelId('A', 0)).toBe('A0');
    expect(levelId('C', 3)).toBe('C3');
    expect(PAD_NOTE).toBe(-1);
  });
});
