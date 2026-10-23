import { describe, expect, it } from 'vitest';
import type { InputSource, NoteEvent } from '../../types/music';
import { NoteVoiceLogic } from '../noteVoiceLogic';

const ev = (kind: 'on' | 'off', note: number, source: InputSource = 'touch'): Pick<NoteEvent, 'kind' | 'note' | 'velocity' | 'source'> => ({
  kind,
  note,
  velocity: kind === 'on' ? 1 : 0,
  source,
});

describe('NoteVoiceLogic (plan decision 8)', () => {
  it('voices touch on and off', () => {
    const v = new NoteVoiceLogic();
    expect(v.apply(ev('on', 60), true)).toEqual({ kind: 'attack', note: 60, velocity: 1 });
    expect(v.apply(ev('off', 60), true)).toEqual({ kind: 'release', note: 60 });
  });

  it("doesn't voice midi or mic", () => {
    const v = new NoteVoiceLogic();
    for (const source of ['midi', 'mic'] as const) {
      expect(v.apply(ev('on', 60, source), true)).toBeNull();
      expect(v.apply(ev('off', 60, source), true)).toBeNull();
    }
  });

  it('ignores an off with no on', () => {
    const v = new NoteVoiceLogic();
    expect(v.apply(ev('off', 62), true)).toBeNull();
    // A midi on doesn't let a touch off through either.
    v.apply(ev('on', 62, 'midi'), true);
    expect(v.apply(ev('off', 62), true)).toBeNull();
  });

  it('never sounds before the audio gate, and ignores that note’s off', () => {
    const v = new NoteVoiceLogic();
    expect(v.apply(ev('on', 64), false)).toBeNull();
    expect(v.apply(ev('off', 64), true)).toBeNull();
  });

  it('a repeated on is one attack; releaseAll clears what sounds', () => {
    const v = new NoteVoiceLogic();
    v.apply(ev('on', 60), true);
    expect(v.apply(ev('on', 60), true)).toBeNull();
    v.apply(ev('on', 67), true);
    expect(v.releaseAll().sort()).toEqual([60, 67]);
    expect(v.apply(ev('off', 60), true)).toBeNull();
  });
});
