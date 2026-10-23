import { describe, expect, it } from 'vitest';
import { loadProgression } from '../../../theory';
import { answers, movingTone, questionsFor, type A4Scorer } from '../a4';
import { a4Pairs, a4Vamp } from '../arrange';
import { usableFor } from '../levels';
import { BAR, harness, spec } from './harness';

const F_MINOR_I_IV = spec('test-fm-bbm', { tonic: 5, mode: 'aeolian' }, ['i7', 'iv7']); // Fm7, B♭m7

describe('A4 questions', () => {
  it("SPEC's worked case, Fm7 → B♭m7: common F and A♭; the 7th E♭ moves to D♭ (the tie with F goes down)", () => {
    const p = loadProgression(F_MINOR_I_IV);
    const [a, b] = p.slots.map((s) => s.chord);
    expect(questionsFor(a!, b!)).toEqual([
      { kind: 'common', tones: [5, 8] },
      { kind: 'moving', from: 3, to: 1 },
    ]);
  });

  it("a 7th that holds falls back to the first voice that moves; a pair where nothing moves has no moving tone", () => {
    const p = loadProgression(F_MINOR_I_IV);
    const [fm7, bbm7] = p.slots.map((s) => s.chord);
    // B♭m7 → Fm7: the 7th A♭ is common, so the root B♭ (first in voiceLead's order) moves, to A♭.
    expect(movingTone(bbm7!, fm7!)).toEqual({ from: 10, to: 8 });
    // C6 and Am7 share all four notes.
    const c6 = { root: 0, quality: '6' } as const;
    const am7 = { root: 9, quality: 'm7' } as const;
    expect(questionsFor(c6, am7)).toEqual([{ kind: 'common', tones: [0, 4, 7, 9] }]);
  });

  it('matches answers: the common set as a set, the moving tone as the last two notes in order', () => {
    expect(answers({ kind: 'common', tones: [5, 8] }, [8, 5, 8])).toBe(true);
    expect(answers({ kind: 'common', tones: [5, 8] }, [5])).toBe(false);
    expect(answers({ kind: 'common', tones: [] }, [])).toBe(true);
    expect(answers({ kind: 'moving', from: 3, to: 1 }, [0, 3, 1])).toBe(true);
    expect(answers({ kind: 'moving', from: 3, to: 1 }, [1, 3])).toBe(false);
  });

  it('pairs skip identical chords and repeat to whole bars', () => {
    const base = spec('test-i-i-v', { tonic: 0, mode: 'ionian' }, ['I', 'I', 'V'], 2);
    base.slots[2]!.beats = 4; // C 2, C 2, G 4: 2 bars
    base.bars = 2;
    const p = loadProgression(base);
    const pairs = a4Pairs(p); // C→C skipped; C→G, G→C
    expect(pairs.map(([x, y]) => `${x.roman}-${y.roman}`)).toEqual(['I-V', 'V-I']);
    const vamp = a4Vamp(p, pairs[0]!, 0); // 2 + 4 beats → repeated to 12 beats, 3 bars
    expect(vamp.slots.map((s) => s.beats)).toEqual([2, 4, 2, 4]);
    expect(vamp.bars).toBe(3);
  });

  it('a progression of one repeated chord has no pair', () => {
    expect(usableFor('A4', loadProgression(spec('test-i-i', { tonic: 0, mode: 'ionian' }, ['I', 'I'])))).toBe(false);
  });
});

describe('A4 drill', () => {
  it('loops a pair until both questions are in, then restarts on the next pair', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A4', progression: F_MINOR_I_IV, startAt: t0 });
    h.ctl.start();
    expect(h.loaded[0]?.id).toBe('test-fm-bbm/a4-0');
    expect(h.ctl.scorer.live(null).prompt).toMatchObject({ label: 'common tones', open: true });

    h.play(65, t0 + 0.3); // F
    h.play(68, t0 + 0.6); // A♭
    h.choose('submit', t0 + 0.9);
    expect(h.ctl.scorer.live(null).prompt).toMatchObject({ label: 'moving tone', played: 'none' });
    h.play(63, t0 + 1.2); // E♭
    h.play(61, t0 + 1.5); // D♭
    h.choose('submit', t0 + 1.8);
    expect(h.ctl.scorer.live(null).prompt?.open).toBe(false);

    h.stepTo(t0 + 2 * BAR + 0.05); // the vamp's loop end: next pair
    expect(h.loaded.map((p) => p.id)).toEqual(['test-fm-bbm/a4-0', 'test-fm-bbm/a4-1']);
    const t1 = h.starts[1] ?? NaN;
    h.play(65, t1 + 0.3); // only F: B♭m7 → Fm7 shares F and A♭
    h.choose('submit', t1 + 0.6);
    h.ctl.stop();

    const scorer = h.ctl.scorer as A4Scorer;
    expect(scorer.answered.map((a) => [a.pair, a.kind, a.right])).toEqual([
      [0, 'common', true],
      [0, 'moving', true],
      [1, 'common', false],
    ]);
    const r = h.ctl.finished();
    expect(r?.score).toBeCloseTo(2 / 3, 9);
    expect(r?.reveal).toEqual([
      'Fm7 → B♭m7: common tones F A♭; moving tone E♭ → D♭',
      'B♭m7 → Fm7: common tones F A♭; moving tone B♭ → A♭',
    ]);
  });

  it('an empty submit answers an empty common set', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A4', progression: spec('test-c-dm', { tonic: 0, mode: 'ionian' }, ['I', 'ii']), startAt: t0 });
    h.ctl.start();
    h.choose('submit', t0 + 0.5);
    h.ctl.stop();
    expect((h.ctl.scorer as A4Scorer).answered[0]).toEqual({ pair: 0, kind: 'common', right: true });
  });
});
