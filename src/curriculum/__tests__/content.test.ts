// The curriculum's own content (plan phase-2 L1), read through `index.ts` as
// the app reads it. `loader.test.ts` covers the loader on inline data.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chordTones, loadProgression, qualityFamily } from '../../theory';
import { DRILL_MODES, levelId } from '../../types/drills';
import type { DrillStep, Lesson, VectorId } from '../../types/lessons';
import type { Chord, Mode, Progression } from '../../types/music';
import { STYLE_IDS } from '../../types/music';
import {
  curriculumErrors,
  lessons,
  progressionById,
  progressions,
  progressionSpecs,
  sequencerRecipes,
} from '../index';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
const lessonFiles = readdirSync(join(root, 'lessons')).filter((f) => f.endsWith('.json'));

const FAMILIES = ['modal-pendulum', 'jazz-hop-turnaround', 'cinematic-walkdown', 'pedal-point', 'i-v-iv', 'I-V-vi-IV'];
const MAJOR_MODES: readonly Mode[] = ['ionian', 'lydian', 'mixolydian'];
const MINOR_MODES: readonly Mode[] = ['dorian', 'aeolian', 'phrygian'];

const EXPECTED_LESSONS = [
  ...['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
  ...['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
  ...['c1', 'c2', 'c3'],
  ...['d0', 'd1', 'd2', 'd3', 'd4', 'd5'],
];
const MINUTES: Record<VectorId, number> = { A: 4, B: 5, C: 6, D: 6 };
/** SPEC §4's "Scored?" column: A2 counts clashes only; B1–B5 score; every other B, C and D lesson doesn't. */
const SCORED = new Set(['a0', 'a1', 'a3', 'a4', 'a5', 'a6', 'b1', 'b2', 'b3', 'b4', 'b5']);

const drillSteps = (l: Lesson): DrillStep[] => l.steps.filter((s): s is DrillStep => s.kind === 'drill');
const sameChord = (a: Chord, b: Chord) => a.root === b.root && a.quality === b.quality && a.bass === b.bass;
const chords = (p: Progression) => p.slots.map((s) => s.chord);

/** Each A level's progression rule, as Module 1's `usableFor` defines it (plan L2, technical answer 15). */
function usableFor(mode: string, p: Progression, form: unknown): boolean {
  const cs = chords(p);
  switch (mode) {
    case 'A0':
      return cs.some((c) => !sameChord(c, cs[0] as Chord));
    case 'A3':
      return cs.every((c) => qualityFamily(c.quality) !== null);
    case 'A4':
      return cs.some((c, i) => i > 0 && !sameChord(c, cs[i - 1] as Chord));
    case 'A5':
      return cs.every((c) => chordTones(c).length === 4);
    case 'A6':
      return p.bars % 2 === 0 && (form !== 'call-response' || p.bars === 4);
    default:
      return true;
  }
}

describe('curriculum content', () => {
  it('loads with no errors and drops nothing', () => {
    expect(curriculumErrors()).toEqual([]);
    expect(progressionSpecs()).toHaveLength((readJson('progressions.json') as unknown[]).length);
    expect(sequencerRecipes()).toHaveLength((readJson('sequencerRecipes.json') as unknown[]).length);
    expect(lessons()).toHaveLength(lessonFiles.length);
  });

  it('has unique ids per kind', () => {
    for (const ids of [progressionSpecs().map((p) => p.id), sequencerRecipes().map((r) => r.id), lessons().map((l) => l.id)]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('loads every progression with loadProgression', () => {
    for (const spec of progressionSpecs()) expect(() => loadProgression(spec)).not.toThrow();
    expect(progressions()).toHaveLength(progressionSpecs().length);
  });

  it('covers the six families, both mode sides and every style', () => {
    const ps = progressions();
    expect(ps.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ps.map((p) => p.family))).toEqual(new Set(FAMILIES));
    expect(ps.filter((p) => MAJOR_MODES.includes(p.key.mode)).length).toBeGreaterThanOrEqual(4);
    expect(ps.filter((p) => MINOR_MODES.includes(p.key.mode)).length).toBeGreaterThanOrEqual(4);
    expect(new Set(ps.map((p) => p.style))).toEqual(new Set(STYLE_IDS));
    expect(ps.filter((p) => usableFor('A3', p, undefined)).length).toBeGreaterThanOrEqual(2);
    expect(ps.filter((p) => p.bars === 4).length).toBeGreaterThanOrEqual(2);
  });

  it('has every lesson, named after its file, with its minutes and scored flag', () => {
    expect(lessons().map((l) => l.id).sort()).toEqual([...EXPECTED_LESSONS].sort());
    expect(lessonFiles.map((f) => f.replace(/\.json$/, '')).sort()).toEqual([...EXPECTED_LESSONS].sort());
    for (const file of lessonFiles) {
      const raw = readJson(`lessons/${file}`) as Lesson;
      expect(raw.id, file).toBe(file.replace(/\.json$/, ''));
      expect(raw.id, file).toBe(levelId(raw.vector, raw.level).toLowerCase());
    }
    for (const l of lessons()) {
      expect(l.minutes, l.id).toBe(MINUTES[l.vector]);
      expect(l.scored, l.id).toBe(SCORED.has(l.id));
    }
  });

  it('gives drill steps their lesson\'s mode, a known module mode and minutes that fit', () => {
    for (const l of lessons()) {
      const drills = drillSteps(l);
      if (l.vector !== 'D') expect(drills.length, l.id).toBeGreaterThan(0);
      for (const d of drills) {
        expect(DRILL_MODES[d.module] as readonly string[], l.id).toContain(d.mode);
        expect(d.mode, l.id).toBe(levelId(l.vector, l.level));
      }
      const total = drills.reduce((sum, d) => sum + d.minutes, 0);
      expect(total, l.id).toBeLessThanOrEqual(l.minutes);
    }
  });

  it('drills each vector on its module', () => {
    const moduleOf: Partial<Record<VectorId, string>> = { A: 'progression-trainer', B: 'pocket-dojo', C: 'sample-flip' };
    for (const l of lessons()) {
      for (const d of drillSteps(l)) expect(d.module, l.id).toBe(moduleOf[l.vector]);
    }
  });

  it('points every progressionId at a progression its level can use', () => {
    for (const l of lessons()) {
      for (const d of drillSteps(l)) {
        if (d.module === 'progression-trainer') expect(d.progressionId, l.id).toBeDefined();
        if (d.progressionId === undefined) continue;
        const p = progressionById(d.progressionId);
        expect(p, `${l.id}: ${d.progressionId}`).toBeDefined();
        expect(usableFor(d.mode, p as Progression, d.params?.form), `${l.id}: ${d.progressionId}`).toBe(true);
      }
    }
  });

  it('gives A6 a phrase step, then a call-response step on a 4-bar progression', () => {
    const a6 = lessons().find((l) => l.id === 'a6') as Lesson;
    const forms = drillSteps(a6).map((d) => d.params?.form);
    expect(forms).toEqual(['phrase', 'call-response']);
    const cr = drillSteps(a6)[1] as DrillStep;
    expect(progressionById(cr.progressionId as string)?.bars).toBe(4);
  });

  it('names only real recipes in B6, and every recipe at least once', () => {
    const b6 = lessons().find((l) => l.id === 'b6') as Lesson;
    const ids = drillSteps(b6).flatMap((d) => (d.params?.recipeIds ?? []) as unknown[]);
    expect(ids.length).toBeGreaterThan(0);
    const known = new Set(sequencerRecipes().map((r) => r.id));
    for (const id of ids) expect(known.has(id as string), String(id)).toBe(true);
    expect(new Set(ids)).toEqual(known);
  });
});
