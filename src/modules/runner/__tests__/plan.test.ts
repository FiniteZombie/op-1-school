import { describe, expect, it } from 'vitest';
import { rotationLesson, todaysPlan } from '../plan';
import { attempt, lesson, session } from './fixtures';

const lessons = [lesson('A', 0), lesson('A', 1), lesson('B', 0), lesson('C', 1), lesson('D', 0), lesson('D', 1)];

function finished(id: string, lessonIds: string[], t: number) {
  return session({
    id,
    kind: 'daily',
    startedAt: t,
    finishedAt: t + 1,
    segments: lessonIds.map((lessonId, i) => ({ lessonId, startedAt: t, finishedAt: t + 1 + i, steps: [] })),
  });
}

describe("today's plan", () => {
  it('is the current A, the current B, and a rotation lesson', () => {
    expect(todaysPlan(lessons, [], []).map((l) => l.id)).toEqual(['a0', 'b0', 'c1']);
    const two = [attempt({ mode: 'A0' }), attempt({ mode: 'A0' })];
    expect(todaysPlan(lessons, [], two).map((l) => l.id)).toEqual(['a1', 'b0', 'c1']);
  });

  it('rotates C/D over three finished sessions: never-shown first, then least recent, ties by vector then level', () => {
    const s1 = finished('s1', ['a0', 'b0', 'c1'], 1000);
    expect(rotationLesson(lessons, [s1])?.id).toBe('d0');
    const s2 = finished('s2', ['a0', 'b0', 'd0'], 2000);
    expect(rotationLesson(lessons, [s1, s2])?.id).toBe('d1');
    const s3 = finished('s3', ['a0', 'b0', 'd1'], 3000);
    expect(rotationLesson(lessons, [s1, s2, s3])?.id).toBe('c1'); // c1 was shown longest ago
  });

  it('ignores practice sessions and unfinished segments for the rotation', () => {
    const practice = { ...finished('p', ['c1'], 1000), kind: 'practice' as const };
    const open = session({ id: 'o', kind: 'daily', segments: [{ lessonId: 'c1', startedAt: 1, steps: [] }] });
    expect(rotationLesson(lessons, [practice, open])?.id).toBe('c1');
  });

  it('drops the segment of a vector with no lessons', () => {
    expect(todaysPlan([lesson('A', 0), lesson('D', 0)], [], []).map((l) => l.id)).toEqual(['a0', 'd0']);
    expect(todaysPlan([lesson('A', 0), lesson('B', 0)], [], []).map((l) => l.id)).toEqual(['a0', 'b0']);
    expect(todaysPlan([], [], [])).toEqual([]);
  });
});
