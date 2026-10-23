// placeholder: every string here is a stand-in until the owner sets Module 1's
// copy. Most come from the plan's Placeholders list (phase-2-fan-out.md); the
// ones marked "not in the plan's list" are this lane's own.
import type { DrillForm } from '../../types/drills';

export const LABELS = {
  title: 'progressions',
  icon: '1',
  level: 'level',
  progression: 'progression',
  start: 'start',
  stop: 'stop',
  finish: 'finish',
  tap: 'tap',
  submit: 'submit',
  on: 'on',
  early: 'early',
  late: 'late',
  missed: 'missed',
  extra: 'extra',
  right: 'right',
  wrong: 'wrong',
  score: 'score',
  notScored: 'not scored',
  timingNotScored: 'timing not scored yet',
  backToSession: 'back to session',
  backToLibrary: 'back to library',
  noProgression: 'no progression fits this level',
  cantSave: "can't save progress",
  paused: 'paused',
  voiceLeadingMap: 'voice-leading map',
  commonTones: 'common tones',
  movingTone: 'moving tone',
  none: 'none',
  forms: { phrase: 'phrase', 'call-response': 'call and response' } satisfies Record<DrillForm, string>,
  unknownProgression: 'unknown progression',
  reveal: 'reveal',
  cantOpen: "can't open this drill",
  /** Not in the plan's list: a launch's progression the level can't use. */
  doesntFit: "doesn't fit this level",
  /** Not in the plan's list: A2's counts. */
  notes: 'notes',
  clashes: 'clashes',
  /** Not in the plan's list: A6's call-and-response count. */
  restBreaks: 'rest breaks',
  /** Not in the plan's list: A4's played-notes readout. */
  played: 'played',
  /** Not in the plan's list: A4 between a pair's last answer and the next vamp. */
  nextPair: 'next pair at the loop end',
} as const;

/** `<m>:<ss> left`. */
export function timeLeft(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
}

/** A0's stage: `8 beats per chord`. */
export function stageLabel(beats: number): string {
  return `${beats} beats per chord`;
}

/** `score 67%`, or `not scored`. */
export function scoreText(score: number | undefined): string {
  return score === undefined ? LABELS.notScored : `${LABELS.score} ${Math.round(score * 100)}%`;
}
