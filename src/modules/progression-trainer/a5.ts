// A5, guide tones (plan decision 13): a heard slot is right when its `on`s
// include both of `guideTones(chord)`. Every `on` is also classified into
// `data`. After the drill, the voice-leading map: each consecutive pair (the
// last to the first included, identical pairs skipped), each guide tone of
// the first chord with where `voiceLead` moves it. Score = right ÷ slots heard.
import { chordName, classify, guideTones, noteName, pitchClass, voiceLead } from '../../theory';
import type { Chord, Key, NoteClassification, PitchClass, Progression } from '../../types/music';
import { sameChord } from './arrange';
import { LABELS } from './labels';
import {
  LoopLedger,
  SlotAnswers,
  loopKey,
  previousSlot,
  type HeardNote,
  type HeardRef,
  type LevelResult,
  type LevelScorer,
  type LiveView,
} from './scoring';

export interface GuideMove {
  from: PitchClass;
  to: PitchClass;
  semitones: number;
}

export interface MapRow {
  from: Chord;
  to: Chord;
  third: GuideMove;
  seventh: GuideMove;
}

export function voiceLeadingMap(p: Progression): MapRow[] {
  const rows: MapRow[] = [];
  p.slots.forEach((s, i) => {
    const next = p.slots[(i + 1) % p.slots.length];
    if (!next || sameChord(s.chord, next.chord)) return;
    const g = guideTones(s.chord);
    const moves = voiceLead(s.chord, next.chord);
    const moveOf = (pc: PitchClass): GuideMove => moves.find((m) => m.from === pc) ?? { from: pc, to: pc, semitones: 0 };
    rows.push({ from: s.chord, to: next.chord, third: moveOf(g.third), seventh: moveOf(g.seventh) });
  });
  return rows;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

/** `Dm7 → G7: F → F (0), C → B (−1)`. placeholder layout: a text list. */
export function mapLine(row: MapRow, key: Key): string {
  const move = (m: GuideMove) => `${noteName(m.from, key)} → ${noteName(m.to, key)} (${signed(m.semitones)})`;
  return `${chordName(row.from, key)} → ${chordName(row.to, key)}: ${move(row.third)}, ${move(row.seventh)}`;
}

const NO_CLASSES: Record<NoteClassification, number> = { 'chord-tone': 0, tension: 0, avoid: 0, outside: 0 };

export class A5Scorer implements LevelScorer {
  readonly level = 'A5' as const;
  private readonly played = new SlotAnswers<Set<PitchClass>>();
  private readonly classes = new Map<string, Record<NoteClassification, number>>();
  private readonly ledger = new LoopLedger();

  constructor(private readonly p: Progression) {}

  current(): Progression {
    return this.p;
  }

  loopStart(): void {}

  note(n: HeardNote): void {
    const slot = this.p.slots[n.slot];
    if (n.iteration < 0 || !slot) return;
    const set = this.played.get(n) ?? new Set<PitchClass>();
    set.add(pitchClass(n.note));
    this.played.set(n, set);
    const k = loopKey(n.run, n.iteration);
    const c = this.classes.get(k) ?? { ...NO_CLASSES };
    c[classify(n.note, slot.chord, this.p.key)] += 1;
    this.classes.set(k, c);
  }

  /** Right, wrong, or missed (no notes) for a heard slot. */
  verdict(ref: Pick<HeardRef, 'run' | 'iteration' | 'slot'>): 'right' | 'wrong' | 'missed' {
    const slot = this.p.slots[ref.slot];
    const set = this.played.get(ref);
    if (!slot || !set || set.size === 0) return 'missed';
    const g = guideTones(slot.chord);
    return set.has(g.third) && set.has(g.seventh) ? 'right' : 'wrong';
  }

  loopEnd(run: number, iteration: number): Progression | null {
    this.ledger.complete(run, iteration);
    return null;
  }

  live(at: HeardRef | null): LiveView {
    const prev = at && previousSlot(at, this.p.slots.length);
    if (!prev) return {};
    const v = this.verdict(prev);
    return { reveal: { text: LABELS[v], state: v === 'right' ? 'ok' : 'bad' } };
  }

  result(): LevelResult {
    const t = { right: 0, wrong: 0, missed: 0 };
    const classes = { ...NO_CLASSES };
    for (const { run, iteration } of this.ledger.loops) {
      this.p.slots.forEach((_, slot) => {
        t[this.verdict({ run, iteration, slot })] += 1;
      });
      const c = this.classes.get(loopKey(run, iteration));
      if (c) for (const k of Object.keys(classes) as NoteClassification[]) classes[k] += c[k];
    }
    const heard = t.right + t.wrong + t.missed;
    const map = voiceLeadingMap(this.p).map((row) => mapLine(row, this.p.key));
    return {
      score: heard === 0 ? 0 : t.right / heard,
      data: { slotsHeard: heard, ...t, classes },
      counts: [
        { label: LABELS.right, n: t.right, state: 'ok' },
        { label: LABELS.wrong, n: t.wrong, state: 'bad' },
        { label: LABELS.missed, n: t.missed, state: 'bad' },
      ],
      reveal: [],
      map,
    };
  }
}
