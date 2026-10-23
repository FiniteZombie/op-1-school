import { describe, expect, it } from 'vitest';
import { streak } from '../streak';
import { at, session } from './fixtures';

const done = (id: string, y: number, m: number, d: number, kind: 'daily' | 'practice' = 'daily') =>
  session({ id, kind, startedAt: at(y, m, d, 9), finishedAt: at(y, m, d, 10) });
const now = at(2026, 10, 23, 15);

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streak([done('a', 2026, 10, 23), done('b', 2026, 10, 22), done('c', 2026, 10, 21)], now)).toBe(3);
  });

  it('stops at a gap', () => {
    expect(streak([done('a', 2026, 10, 23), done('b', 2026, 10, 22), done('c', 2026, 10, 20)], now)).toBe(2);
  });

  it('may end yesterday', () => {
    expect(streak([done('a', 2026, 10, 22), done('b', 2026, 10, 21)], now)).toBe(2);
  });

  it('is 0 when the last session was two days ago', () => {
    expect(streak([done('a', 2026, 10, 21)], now)).toBe(0);
  });

  it('does not count practice sessions or unfinished ones', () => {
    expect(streak([done('p', 2026, 10, 23, 'practice')], now)).toBe(0);
    expect(streak([done('a', 2026, 10, 22), done('p', 2026, 10, 23, 'practice')], now)).toBe(1);
    expect(streak([session({ id: 'o', kind: 'daily', startedAt: at(2026, 10, 23, 9) })], now)).toBe(0);
  });

  it('counts two sessions on one day once, and crosses month and year ends', () => {
    expect(streak([done('a', 2026, 1, 1), done('b', 2025, 12, 31), done('c', 2025, 12, 31)], at(2026, 1, 1, 8))).toBe(2);
    expect(streak([done('a', 2026, 3, 1), done('b', 2026, 2, 28)], at(2026, 3, 1, 8))).toBe(2);
  });

  it('is 0 with no sessions', () => {
    expect(streak([], now)).toBe(0);
  });
});
