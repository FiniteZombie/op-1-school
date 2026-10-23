// The drill's lifecycle (plan L2, pre-flight technical answer 19), pure:
// ready → running → finishing (time up) → done at the loop end. A stop the
// drill didn't make itself pauses it; `start` resumes with the time left.
// `stop` before the first full loop (A4: answered question) abandons it.

export type DrillPhase = 'ready' | 'running' | 'finishing' | 'paused' | 'done' | 'abandoned';

export interface DrillState {
  phase: DrillPhase;
  totalSec: number;
  /** Transport time used so far, across runs. */
  usedSec: number;
  /** Completed loops, or (A4) answered questions: what `finish` needs one of. */
  progress: number;
  unit: 'loop' | 'answer';
}

export type DrillEvent =
  | { type: 'start' }
  | { type: 'time'; usedSec: number }
  | { type: 'loopEnd' }
  | { type: 'answered' }
  | { type: 'outsideStop' }
  /** The `stop` / `finish` button. */
  | { type: 'stop' }
  /** Leaving the page. */
  | { type: 'leave' };

export function initialDrill(totalSec: number, unit: 'loop' | 'answer'): DrillState {
  return { phase: 'ready', totalSec, usedSec: 0, progress: 0, unit };
}

export function isLive(phase: DrillPhase): boolean {
  return phase === 'running' || phase === 'finishing';
}

export function isOver(phase: DrillPhase): boolean {
  return phase === 'done' || phase === 'abandoned';
}

/** True when the button reads `finish` (it writes the attempt) rather than `stop`. */
export function canFinish(s: DrillState): boolean {
  return s.progress >= 1;
}

export function remainingSec(s: DrillState): number {
  return Math.max(0, s.totalSec - s.usedSec);
}

export function nextDrill(s: DrillState, e: DrillEvent): DrillState {
  if (isOver(s.phase)) return s;
  switch (e.type) {
    case 'start':
      if (s.phase !== 'ready' && s.phase !== 'paused') return s;
      return { ...s, phase: s.usedSec >= s.totalSec ? 'finishing' : 'running' };
    case 'time': {
      const next = { ...s, usedSec: e.usedSec };
      if (s.phase === 'running' && e.usedSec >= s.totalSec) next.phase = 'finishing';
      return next;
    }
    case 'loopEnd': {
      if (!isLive(s.phase)) return s;
      const progress = s.unit === 'loop' ? s.progress + 1 : s.progress;
      return { ...s, progress, phase: s.phase === 'finishing' ? 'done' : s.phase };
    }
    case 'answered':
      return s.unit === 'answer' ? { ...s, progress: s.progress + 1 } : s;
    case 'outsideStop':
      return isLive(s.phase) ? { ...s, phase: 'paused' } : s;
    case 'stop':
      if (s.phase === 'ready') return s;
      return { ...s, phase: canFinish(s) ? 'done' : 'abandoned' };
    case 'leave':
      return { ...s, phase: 'abandoned' };
  }
}
