import { describe, expect, it } from 'vitest';
import { loadProgression } from '../../../theory';
import { C_MAJOR_POP, G_DORIAN_VAMP } from '../../../theory/__tests__/fixtures';
import type { Progression } from '../../../types/music';
import { pickerQuery, resolveLaunch } from '../launch';

const BY_ID = new Map<string, Progression>(
  [C_MAJOR_POP, G_DORIAN_VAMP].map((s) => [s.id, loadProgression(s)]),
);
const find = (id: string) => BY_ID.get(id);

describe('resolveLaunch', () => {
  it('no query: the pickers, nothing chosen', () => {
    expect(resolveLaunch({}, find)).toMatchObject({ kind: 'pickers', level: null, error: null });
  });

  it('a bad query shows the parse error naming the field', () => {
    const r = resolveLaunch({ mode: 'A9' }, find);
    expect(r.kind).toBe('pickers');
    expect(r.kind === 'pickers' && r.error).toMatch(/^can't open this drill: mode: /);
    const m = resolveLaunch({ mode: 'A1', minutes: '0' }, find);
    expect(m).toMatchObject({ kind: 'pickers', level: 'A1' });
    expect(m.kind === 'pickers' && m.error).toMatch(/minutes/);
  });

  it('no progression: the pickers with the level chosen', () => {
    expect(resolveLaunch({ mode: 'A3' }, find)).toMatchObject({ kind: 'pickers', level: 'A3', error: null });
  });

  it('an unknown progression, or one the level can’t use, is an error above the pickers', () => {
    const unknown = resolveLaunch({ mode: 'A1', progression: 'nope' }, find);
    expect(unknown).toMatchObject({ kind: 'pickers', level: 'A1', error: `can't open this drill: unknown progression "nope"` });
    const unfit = resolveLaunch({ mode: 'A3', progression: 'test-gdorian' }, find);
    expect(unfit).toMatchObject({ kind: 'pickers', error: "can't open this drill: test-gdorian doesn't fit this level" });
  });

  it('a good launch is the drill, with the level’s default minutes unless it gives some', () => {
    expect(resolveLaunch({ mode: 'A1', progression: 'test-cmajor' }, find)).toMatchObject({
      kind: 'drill',
      level: 'A1',
      minutes: 4,
      form: 'phrase',
    });
    expect(resolveLaunch({ mode: 'A2', progression: 'test-cmajor' }, find)).toMatchObject({ minutes: 2 });
    expect(resolveLaunch({ mode: 'A1', progression: 'test-cmajor', minutes: '0.25', step: '1', session: 's' }, find)).toMatchObject({
      minutes: 0.25,
      launch: { step: 1, session: 's' },
    });
  });

  it("A6's form comes from params; call and response needs 4 bars", () => {
    const params = JSON.stringify({ form: 'call-response' });
    expect(resolveLaunch({ mode: 'A6', progression: 'test-cmajor', params }, find)).toMatchObject({
      kind: 'drill',
      form: 'call-response',
    });
    expect(resolveLaunch({ mode: 'A6', progression: 'test-gdorian', params }, find)).toMatchObject({
      kind: 'pickers',
      form: 'call-response',
    });
  });
});

describe('pickerQuery', () => {
  it('writes a practice launch; A6 carries its form', () => {
    expect(pickerQuery('A1', 'test-cmajor', 'phrase')).toEqual({ mode: 'A1', progression: 'test-cmajor' });
    expect(pickerQuery('A6', undefined, 'call-response')).toEqual({ mode: 'A6', params: '{"form":"call-response"}' });
  });
});
