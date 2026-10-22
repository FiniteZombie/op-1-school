// JSON shapes for `src/curriculum/` (SPEC §4), and validators for them. The
// validators check shape only and return error strings (empty = valid), each
// starting with the field's path. Roman numerals are checked by theory's
// `loadProgression`, not here.

import { MODES, STYLE_IDS, type Key, type StyleId } from './music';
import { MODULE_IDS, type ModuleId } from './modules';

export const VECTOR_IDS = ['A', 'B', 'C', 'D'] as const;
export type VectorId = (typeof VECTOR_IDS)[number];

/** Modules a lesson can send a drill to: the Runner runs lessons, and dev-spine isn't one. */
export const DRILL_MODULE_IDS = MODULE_IDS.filter(
  (id): id is DrillModuleId => id !== 'dev-spine' && id !== 'runner',
);
export type DrillModuleId = Exclude<ModuleId, 'dev-spine' | 'runner'>;

export interface CardStep {
  kind: 'card';
  title: string;
  /** Markdown. */
  body: string;
}

export interface DrillStep {
  kind: 'drill';
  module: DrillModuleId;
  /** The module's own mode id, e.g. a level like `A1`. */
  mode: string;
  minutes: number;
  progressionId?: string;
  params?: Record<string, unknown>;
}

export type LessonStep = CardStep | DrillStep;

export interface Lesson {
  id: string;
  vector: VectorId;
  /** Level within the vector; A0 is 0. */
  level: number;
  title: string;
  minutes: number;
  scored: boolean;
  steps: LessonStep[];
}

export interface ProgressionSlotSpec {
  roman: string;
  beats: number;
}

/** `Progression` as stored in JSON: numerals instead of chords. */
export interface ProgressionSpec {
  id: string;
  key: Key;
  bpm: number;
  swing: number;
  bars: number;
  slots: ProgressionSlotSpec[];
  style: StyleId;
  family: string;
}

export const SEQUENCERS = ['finger', 'endless', 'tombola'] as const;
export type Sequencer = (typeof SEQUENCERS)[number];

export interface SequencerRecipe {
  id: string;
  title: string;
  sequencer: Sequencer;
  steps: string[];
}

// --- validators -------------------------------------------------------------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function show(v: unknown): string {
  return v === undefined ? 'nothing' : JSON.stringify(v);
}

// Each `check` pushes at most one error for its field and reports whether the field passed.
class Checker {
  constructor(
    private readonly o: Obj,
    private readonly at: string,
    readonly errors: string[] = [],
  ) {}

  private path(field: string): string {
    return this.at ? `${this.at}.${field}` : field;
  }

  fail(field: string, msg: string): false {
    this.errors.push(`${this.path(field)}: ${msg}`);
    return false;
  }

  /** Unknown fields are errors, so a typo in curriculum JSON doesn't pass silently. */
  known(fields: readonly string[]): void {
    for (const k of Object.keys(this.o)) {
      if (!fields.includes(k)) this.fail(k, 'unknown field');
    }
  }

  string(field: string, opts: { optional?: boolean; allowEmpty?: boolean } = {}): boolean {
    const v = this.o[field];
    if (v === undefined && opts.optional) return true;
    if (v === undefined) return this.fail(field, 'missing');
    if (typeof v !== 'string') return this.fail(field, `expected a string, got ${show(v)}`);
    if (!opts.allowEmpty && v.trim() === '') return this.fail(field, 'must not be empty');
    return true;
  }

  number(field: string, opts: { min?: number; max?: number; positive?: boolean; integer?: boolean }): boolean {
    const v = this.o[field];
    if (v === undefined) return this.fail(field, 'missing');
    if (typeof v !== 'number' || !Number.isFinite(v)) return this.fail(field, `expected a number, got ${show(v)}`);
    if (opts.integer && !Number.isInteger(v)) return this.fail(field, `expected an integer, got ${v}`);
    if (opts.positive && v <= 0) return this.fail(field, `must be greater than 0, got ${v}`);
    if (opts.min !== undefined && v < opts.min) return this.fail(field, `must be at least ${opts.min}, got ${v}`);
    if (opts.max !== undefined && v > opts.max) return this.fail(field, `must be at most ${opts.max}, got ${v}`);
    return true;
  }

  boolean(field: string): boolean {
    const v = this.o[field];
    if (v === undefined) return this.fail(field, 'missing');
    if (typeof v !== 'boolean') return this.fail(field, `expected true or false, got ${show(v)}`);
    return true;
  }

  oneOf(field: string, allowed: readonly string[]): boolean {
    const v = this.o[field];
    if (v === undefined) return this.fail(field, 'missing');
    if (typeof v !== 'string' || !allowed.includes(v)) {
      return this.fail(field, `expected one of ${allowed.join(', ')}, got ${show(v)}`);
    }
    return true;
  }

  /** A non-empty array; returns it (or undefined after recording the error). */
  list(field: string): unknown[] | undefined {
    const v = this.o[field];
    if (v === undefined) return void this.fail(field, 'missing');
    if (!Array.isArray(v)) return void this.fail(field, `expected a list, got ${show(v)}`);
    if (v.length === 0) return void this.fail(field, 'must not be empty');
    return v;
  }

  child(field: string): Obj | undefined {
    const v = this.o[field];
    if (v === undefined) return void this.fail(field, 'missing');
    if (!isObj(v)) return void this.fail(field, `expected an object, got ${show(v)}`);
    return v;
  }

  sub(o: Obj, field: string): Checker {
    return new Checker(o, this.path(field), this.errors);
  }
}

function root(value: unknown, what: string): Checker | string[] {
  return isObj(value) ? new Checker(value, '') : [`${what}: expected an object, got ${show(value)}`];
}

function checkStep(parent: Checker, step: unknown, at: string): void {
  if (!isObj(step)) {
    parent.fail(at, `expected an object, got ${show(step)}`);
    return;
  }
  const c = parent.sub(step, at);
  if (!c.oneOf('kind', ['card', 'drill'])) return;
  if (step.kind === 'card') {
    c.known(['kind', 'title', 'body']);
    c.string('title');
    c.string('body', { allowEmpty: true });
    return;
  }
  c.known(['kind', 'module', 'mode', 'minutes', 'progressionId', 'params']);
  c.oneOf('module', DRILL_MODULE_IDS);
  c.string('mode');
  c.number('minutes', { positive: true });
  c.string('progressionId', { optional: true });
  if (step.params !== undefined && !isObj(step.params)) c.fail('params', `expected an object, got ${show(step.params)}`);
}

export function validateLesson(value: unknown): string[] {
  const c = root(value, 'lesson');
  if (Array.isArray(c)) return c;
  c.known(['id', 'vector', 'level', 'title', 'minutes', 'scored', 'steps']);
  c.string('id');
  c.oneOf('vector', VECTOR_IDS);
  c.number('level', { min: 0, integer: true });
  c.string('title');
  c.number('minutes', { positive: true });
  c.boolean('scored');
  c.list('steps')?.forEach((s, i) => checkStep(c, s, `steps[${i}]`));
  return c.errors;
}

export function validateProgressionSpec(value: unknown): string[] {
  const c = root(value, 'progression');
  if (Array.isArray(c)) return c;
  c.known(['id', 'key', 'bpm', 'swing', 'bars', 'slots', 'style', 'family']);
  c.string('id');
  const key = c.child('key');
  if (key) {
    const k = c.sub(key, 'key');
    k.known(['tonic', 'mode']);
    k.number('tonic', { min: 0, max: 11, integer: true });
    k.oneOf('mode', MODES);
  }
  c.number('bpm', { positive: true });
  c.number('swing', { min: 0, max: 1 });
  c.number('bars', { positive: true, integer: true });
  c.list('slots')?.forEach((slot, i) => {
    const at = `slots[${i}]`;
    if (!isObj(slot)) {
      c.fail(at, `expected an object, got ${show(slot)}`);
      return;
    }
    const s = c.sub(slot, at);
    s.known(['roman', 'beats']);
    s.string('roman');
    s.number('beats', { positive: true });
  });
  c.oneOf('style', STYLE_IDS);
  c.string('family');
  return c.errors;
}

export function validateSequencerRecipe(value: unknown): string[] {
  const c = root(value, 'recipe');
  if (Array.isArray(c)) return c;
  c.known(['id', 'title', 'sequencer', 'steps']);
  c.string('id');
  c.string('title');
  c.oneOf('sequencer', SEQUENCERS);
  c.list('steps')?.forEach((s, i) => {
    if (typeof s !== 'string' || s.trim() === '') c.fail(`steps[${i}]`, `expected a non-empty string, got ${show(s)}`);
  });
  return c.errors;
}
