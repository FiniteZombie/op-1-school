import { describe, expect, it } from 'vitest';
import { currentLesson, levelPassed, lessonLocked } from '../gates';
import { A_MODULES, attempt, card, lesson } from './fixtures';

describe('level gate', () => {
  it('opens after two attempts at 0.7 and 0.8, not after one, nor after 0.6 and 0.9', () => {
    expect(levelPassed([attempt({ mode: 'A0', score: 0.7 }), attempt({ mode: 'A0', score: 0.8 })], 'A0')).toBe(true);
    expect(levelPassed([attempt({ mode: 'A0', score: 0.9 })], 'A0')).toBe(false);
    expect(levelPassed([attempt({ mode: 'A0', score: 0.6 }), attempt({ mode: 'A0', score: 0.9 })], 'A0')).toBe(false);
  });

  it('counts unscored finishes, and practice attempts (any session)', () => {
    expect(levelPassed([attempt({ mode: 'A2' }), attempt({ mode: 'A2', sessionId: 'a practice session' })], 'A2')).toBe(true);
  });

  it('only counts the level asked for', () => {
    expect(levelPassed([attempt({ mode: 'A1' }), attempt({ mode: 'A1' })], 'A0')).toBe(false);
  });
});

describe('library lock', () => {
  const lessons = [lesson('A', 0), lesson('A', 1), lesson('A', 2), lesson('B', 0), lesson('B', 1), lesson('D', 0)];
  const two0 = [attempt({ mode: 'A0', score: 0.7 }), attempt({ mode: 'A0', score: 0.8 })];

  it('the lowest level is always open, the next only after the gate', () => {
    expect(lessonLocked(lessons[0]!, lessons, [], A_MODULES, false)).toBe(false);
    expect(lessonLocked(lessons[1]!, lessons, [], A_MODULES, false)).toBe(true);
    expect(lessonLocked(lessons[1]!, lessons, two0, A_MODULES, false)).toBe(false);
    expect(lessonLocked(lessons[2]!, lessons, two0, A_MODULES, false)).toBe(true);
  });

  it('every level is open under dev', () => {
    for (const l of lessons) expect(lessonLocked(l, lessons, [], A_MODULES, true)).toBe(false);
  });

  it('card-only lessons, and lessons whose drill module is not available, are always open', () => {
    expect(lessonLocked(lessons[5]!, lessons, [], A_MODULES, false)).toBe(false);
    expect(lessonLocked(lessons[4]!, lessons, [], A_MODULES, false)).toBe(false); // B1: pocket-dojo isn't available
    expect(lessonLocked(lessons[4]!, lessons, [], new Set([...A_MODULES, 'pocket-dojo']), false)).toBe(true);
  });

  it('a card-only level in between does not lock the levels above it forever', () => {
    const row = [lesson('A', 0), lesson('A', 1, [card()]), lesson('A', 2)];
    expect(lessonLocked(row[2]!, row, [], A_MODULES, false)).toBe(true);
    expect(lessonLocked(row[2]!, row, two0, A_MODULES, false)).toBe(false);
  });
});

describe('current lesson of a vector', () => {
  const lessons = [lesson('A', 0), lesson('A', 1), lesson('A', 2), lesson('B', 0), lesson('B', 1), lesson('C', 1)];

  it('is the highest level reached by walking up through passed levels', () => {
    expect(currentLesson(lessons, 'A', [])?.id).toBe('a0');
    const two0 = [attempt({ mode: 'A0' }), attempt({ mode: 'A0' })];
    expect(currentLesson(lessons, 'A', two0)?.id).toBe('a1');
    expect(currentLesson(lessons, 'A', [...two0, attempt({ mode: 'A1', score: 0.5 }), attempt({ mode: 'A1', score: 0.9 })])?.id).toBe('a1');
  });

  it('stays at the lowest B level while nothing writes B attempts', () => {
    expect(currentLesson(lessons, 'B', [attempt({ mode: 'A0' })])?.id).toBe('b0');
  });

  it('is undefined for a vector with no lessons', () => {
    expect(currentLesson([lesson('A', 0)], 'B', [])).toBeUndefined();
  });

  it('walks through a lesson with no drill', () => {
    const row = [lesson('A', 0, [card()]), lesson('A', 1)];
    expect(currentLesson(row, 'A', [])?.id).toBe('a1');
  });
});
