// Each level's scorer, by level id.
import type { DrillForm } from '../../types/drills';
import type { Progression } from '../../types/music';
import { A0Scorer } from './a0';
import { A1Scorer } from './a1';
import { A2Scorer } from './a2';
import { A3Scorer } from './a3';
import { A4Scorer } from './a4';
import { A5Scorer } from './a5';
import { A6Scorer } from './a6';
import type { LevelId } from './levels';
import type { LevelScorer, ScoreContext } from './scoring';

export function createScorer(level: LevelId, p: Progression, form: DrillForm, ctx: ScoreContext): LevelScorer {
  switch (level) {
    case 'A0':
      return new A0Scorer(p, ctx);
    case 'A1':
      return new A1Scorer(p);
    case 'A2':
      return new A2Scorer(p);
    case 'A3':
      return new A3Scorer(p);
    case 'A4':
      return new A4Scorer(p);
    case 'A5':
      return new A5Scorer(p);
    case 'A6':
      return new A6Scorer(p, form, ctx);
  }
}
