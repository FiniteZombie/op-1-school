import { describe, expect, it } from 'vitest';
import type { Lesson, ProgressionSpec, SequencerRecipe } from '../../types/lessons';
import { buildCurriculum } from '../build';

function prog(id: string, romans: string[], bars = romans.length): ProgressionSpec {
  return {
    id,
    key: { tonic: 0, mode: 'ionian' },
    bpm: 90,
    swing: 0.5,
    bars,
    slots: romans.map((roman) => ({ roman, beats: 4 })),
    style: 'chillhop-rhodes',
    family: 'test',
  };
}

function lesson(id: string, vector: Lesson['vector'], level: number): Lesson {
  return { id, vector, level, title: id, minutes: 4, scored: false, steps: [{ kind: 'card', title: 't', body: 'b' }] };
}

const recipe: SequencerRecipe = { id: 'r1', title: 'r', sequencer: 'finger', steps: ['s'] };

describe('buildCurriculum', () => {
  it('keeps valid records and loads progressions', () => {
    const c = buildCurriculum({
      progressions: [{ file: 'p.json', data: [prog('p1', ['I', 'V'])] }],
      sequencerRecipes: [{ file: 'r.json', data: [recipe] }],
      lessons: [{ file: 'lessons/a0.json', data: lesson('a0', 'A', 0) }],
    });
    expect(c.errors).toEqual([]);
    expect(c.progressionSpecs.map((p) => p.id)).toEqual(['p1']);
    expect(c.progressions.map((p) => [p.id, p.slots.length])).toEqual([['p1', 2]]);
    expect(c.sequencerRecipes).toEqual([recipe]);
    expect(c.lessons.map((l) => l.id)).toEqual(['a0']);
  });

  it('drops an invalid record, naming its file and field', () => {
    const bad = { ...lesson('a1', 'A', 1), minutes: 'four' };
    const c = buildCurriculum({
      progressions: [{ file: 'p.json', data: [prog('p1', ['I']), { ...prog('p2', ['I']), bpm: -1 }] }],
      sequencerRecipes: [{ file: 'r.json', data: [{ ...recipe, sequencer: 'nope' }] }],
      lessons: [
        { file: 'lessons/a0.json', data: lesson('a0', 'A', 0) },
        { file: 'lessons/a1.json', data: bad },
      ],
    });
    expect(c.progressions.map((p) => p.id)).toEqual(['p1']);
    expect(c.sequencerRecipes).toEqual([]);
    expect(c.lessons.map((l) => l.id)).toEqual(['a0']);
    expect(c.errors).toHaveLength(3);
    expect(c.errors).toContainEqual(expect.stringMatching(/^p\.json\[1\] \("p2"\): bpm: /));
    expect(c.errors).toContainEqual(expect.stringMatching(/^r\.json\[0\] \("r1"\): sequencer: /));
    expect(c.errors).toContainEqual(expect.stringMatching(/^lessons\/a1\.json \("a1"\): minutes: /));
  });

  it('drops a second record with an id already seen', () => {
    const c = buildCurriculum({
      progressions: [{ file: 'p.json', data: [prog('p1', ['I']), prog('p1', ['V'])] }],
      sequencerRecipes: [],
      lessons: [
        { file: 'lessons/a0.json', data: lesson('a0', 'A', 0) },
        { file: 'lessons/copy.json', data: lesson('a0', 'A', 1) },
      ],
    });
    expect(c.progressions.map((p) => p.slots[0]?.roman)).toEqual(['I']);
    expect(c.lessons.map((l) => l.level)).toEqual([0]);
    expect(c.errors).toEqual([
      'p.json[1] ("p1"): id: "p1" is already used',
      'lessons/copy.json ("a0"): id: "a0" is already used',
    ]);
  });

  it('drops a progression loadProgression rejects, from both lists', () => {
    const c = buildCurriculum({
      progressions: [{ file: 'p.json', data: [prog('bad-numeral', ['xii']), prog('bad-bars', ['I', 'V'], 3), prog('ok', ['I'])] }],
      sequencerRecipes: [],
      lessons: [],
    });
    expect(c.progressionSpecs.map((p) => p.id)).toEqual(['ok']);
    expect(c.progressions.map((p) => p.id)).toEqual(['ok']);
    expect(c.errors).toHaveLength(2);
    expect(c.errors[0]).toMatch(/^p\.json\[0\] \("bad-numeral"\): .*slots\[0\] "xii"/);
    expect(c.errors[1]).toMatch(/^p\.json\[1\] \("bad-bars"\): .*3 bars need 12/);
  });

  it("a rejected progression doesn't claim its id", () => {
    const c = buildCurriculum({
      progressions: [{ file: 'p.json', data: [prog('p', ['xii']), prog('p', ['I'])] }],
      sequencerRecipes: [],
      lessons: [],
    });
    expect(c.progressions.map((p) => p.id)).toEqual(['p']);
    expect(c.errors).toHaveLength(1);
  });

  it('a file that is not a list is an error', () => {
    const c = buildCurriculum({ progressions: [{ file: 'p.json', data: { id: 'x' } }], sequencerRecipes: [], lessons: [] });
    expect(c.errors).toEqual(['p.json: expected a list']);
  });

  it('sorts lessons by vector, then level', () => {
    const files = [lesson('d0', 'D', 0), lesson('a2', 'A', 2), lesson('b0', 'B', 0), lesson('a10', 'A', 10), lesson('a0', 'A', 0), lesson('c1', 'C', 1)].map(
      (data) => ({ file: `lessons/${data.id}.json`, data }),
    );
    const c = buildCurriculum({ progressions: [], sequencerRecipes: [], lessons: files });
    expect(c.lessons.map((l) => l.id)).toEqual(['a0', 'a2', 'a10', 'b0', 'c1', 'd0']);
  });
});
