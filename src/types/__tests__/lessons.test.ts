import { describe, expect, test } from 'vitest';
import {
  validateLesson,
  validateProgressionSpec,
  validateSequencerRecipe,
  type Lesson,
  type ProgressionSpec,
  type SequencerRecipe,
} from '../lessons';

const lesson: Lesson = {
  id: 'a1-bass-degrees',
  vector: 'A',
  level: 1,
  title: 'bass root as scale degree',
  minutes: 15,
  scored: true,
  steps: [
    { kind: 'card', title: 'listen low', body: 'Name the **lowest** note.' },
    {
      kind: 'drill',
      module: 'progression-trainer',
      mode: 'A1',
      minutes: 4,
      progressionId: 'fminor-turnaround',
      params: { mask: 'bass' },
    },
  ],
};

const progression: ProgressionSpec = {
  id: 'fminor-turnaround',
  key: { tonic: 5, mode: 'aeolian' },
  bpm: 90,
  swing: 0.5,
  bars: 4,
  slots: [
    { roman: 'ii°', beats: 4 },
    { roman: 'V7', beats: 4 },
    { roman: 'i', beats: 4 },
    { roman: 'VI', beats: 4 },
  ],
  style: 'chillhop-rhodes',
  family: 'jazz-hop turnaround',
};

const recipe: SequencerRecipe = {
  id: 'finger-hold',
  title: 'finger sequencer variations',
  sequencer: 'finger',
  steps: ['pick the finger sequencer', 'hold a white key'],
};

const clone = <T>(v: T): T => structuredClone(v);

function expectError(errors: string[], field: string): void {
  expect(errors.length, `expected an error naming ${field}`).toBeGreaterThan(0);
  expect(errors.some((e) => e.startsWith(`${field}:`)), errors.join('\n')).toBe(true);
}

describe('validateLesson', () => {
  test('accepts a valid lesson', () => {
    expect(validateLesson(lesson)).toEqual([]);
  });

  test('rejects a missing id', () => {
    const { id: _id, ...rest } = lesson;
    expectError(validateLesson(rest), 'id');
  });

  test('rejects a wrong vector', () => {
    expectError(validateLesson({ ...lesson, vector: 'E' }), 'vector');
  });

  test('rejects empty steps', () => {
    expectError(validateLesson({ ...lesson, steps: [] }), 'steps');
  });

  test('rejects a drill step with an unknown module', () => {
    const bad = clone(lesson);
    (bad.steps[1] as { module: string }).module = 'metronome';
    expectError(validateLesson(bad), 'steps[1].module');
  });

  test('rejects drills sent to dev-spine or the runner', () => {
    for (const module of ['dev-spine', 'runner']) {
      const bad = clone(lesson);
      (bad.steps[1] as { module: string }).module = module;
      expectError(validateLesson(bad), 'steps[1].module');
    }
  });

  test('rejects a fractional level, an unknown step kind, unknown fields and array params', () => {
    expectError(validateLesson({ ...lesson, level: 1.5 }), 'level');
    expectError(validateLesson({ ...lesson, steps: [{ kind: 'quiz' }] }), 'steps[0].kind');
    expectError(validateLesson({ ...lesson, levle: 2 }), 'levle');
    const bad = clone(lesson);
    (bad.steps[1] as { params: unknown }).params = [];
    expectError(validateLesson(bad), 'steps[1].params');
  });

  test('rejects a non-object', () => {
    expectError(validateLesson(null), 'lesson');
  });
});

describe('validateProgressionSpec', () => {
  test('accepts a valid progression', () => {
    expect(validateProgressionSpec(progression)).toEqual([]);
  });

  test('rejects a missing id', () => {
    const { id: _id, ...rest } = progression;
    expectError(validateProgressionSpec(rest), 'id');
  });

  test('rejects empty slots', () => {
    expectError(validateProgressionSpec({ ...progression, slots: [] }), 'slots');
  });

  test('rejects a slot with beats: 0', () => {
    const bad = clone(progression);
    bad.slots[2]!.beats = 0;
    expectError(validateProgressionSpec(bad), 'slots[2].beats');
  });

  test('rejects a bad key, style and swing', () => {
    expectError(validateProgressionSpec({ ...progression, key: { tonic: 12, mode: 'aeolian' } }), 'key.tonic');
    expectError(validateProgressionSpec({ ...progression, key: { tonic: 5, mode: 'minor' } }), 'key.mode');
    expectError(validateProgressionSpec({ ...progression, style: 'trap' }), 'style');
    expectError(validateProgressionSpec({ ...progression, swing: 1.2 }), 'swing');
  });
});

describe('validateSequencerRecipe', () => {
  test('accepts a valid recipe', () => {
    expect(validateSequencerRecipe(recipe)).toEqual([]);
  });

  test('rejects a missing id', () => {
    const { id: _id, ...rest } = recipe;
    expectError(validateSequencerRecipe(rest), 'id');
  });

  test('rejects an unknown sequencer', () => {
    expectError(validateSequencerRecipe({ ...recipe, sequencer: 'arpeggio' }), 'sequencer');
  });

  test('rejects empty steps and blank step text', () => {
    expectError(validateSequencerRecipe({ ...recipe, steps: [] }), 'steps');
    expectError(validateSequencerRecipe({ ...recipe, steps: ['ok', ' '] }), 'steps[1]');
  });
});
