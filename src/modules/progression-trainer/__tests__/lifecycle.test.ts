import { describe, expect, it } from 'vitest';
import { C_MAJOR_POP } from '../../../theory/__tests__/fixtures';
import { canFinish, initialDrill, nextDrill, remainingSec, type DrillEvent } from '../lifecycle';
import { BAR, harness } from './harness';

function run(events: DrillEvent[], unit: 'loop' | 'answer' = 'loop', total = 60) {
  return events.reduce(nextDrill, initialDrill(total, unit));
}

describe('the drill lifecycle (pure)', () => {
  it('ready → running → finishing → done', () => {
    let s = initialDrill(60, 'loop');
    s = nextDrill(s, { type: 'start' });
    expect(s.phase).toBe('running');
    s = nextDrill(s, { type: 'loopEnd' });
    s = nextDrill(s, { type: 'time', usedSec: 60 });
    expect(s.phase).toBe('finishing');
    s = nextDrill(s, { type: 'loopEnd' });
    expect([s.phase, s.progress]).toEqual(['done', 2]);
    expect(nextDrill(s, { type: 'start' })).toBe(s);
  });

  it('an outside stop pauses; start resumes with the time left', () => {
    const s = run([{ type: 'start' }, { type: 'time', usedSec: 20 }, { type: 'outsideStop' }]);
    expect(s.phase).toBe('paused');
    expect(remainingSec(s)).toBe(40);
    expect(nextDrill(s, { type: 'start' }).phase).toBe('running');
  });

  it('stop before a full loop abandons; after one it finishes', () => {
    expect(run([{ type: 'start' }, { type: 'stop' }]).phase).toBe('abandoned');
    const after = run([{ type: 'start' }, { type: 'loopEnd' }]);
    expect(canFinish(after)).toBe(true);
    expect(nextDrill(after, { type: 'stop' }).phase).toBe('done');
    expect(run([{ type: 'start' }, { type: 'loopEnd' }, { type: 'leave' }]).phase).toBe('abandoned');
  });

  it('A4 finishes after one answered question, not after a loop', () => {
    expect(run([{ type: 'start' }, { type: 'loopEnd' }, { type: 'stop' }], 'answer').phase).toBe('abandoned');
    expect(run([{ type: 'start' }, { type: 'answered' }, { type: 'stop' }], 'answer').phase).toBe('done');
  });
});

describe('the drill lifecycle on the transport', () => {
  it('time up finishes at the next loop end, counting transport time', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A1', progression: C_MAJOR_POP, minutes: 0.25, startAt: t0 });
    const phases: string[] = [];
    h.ctl.subscribe(() => {
      const p = h.ctl.drill().phase;
      if (phases[phases.length - 1] !== p) phases.push(p);
    });
    h.ctl.start();
    h.stepTo(t0 + 15.1); // 15 s used, mid loop 2
    expect(h.ctl.drill().phase).toBe('finishing');
    expect(h.transport.state()).toBe('started');
    h.stepTo(t0 + 8 * BAR + 0.05); // loop 2's end
    expect(phases).toEqual(['running', 'finishing', 'done']);
    expect(h.transport.state()).toBe('stopped');
    expect(h.ctl.finished()?.data).toMatchObject({ slotsHeard: 8 });
  });

  it('a stop from outside pauses and drops the partial loop; start resumes at bar 1 with the time left', async () => {
    const t0 = 1;
    const h = await harness({ level: 'A1', progression: C_MAJOR_POP, minutes: 0.5, startAt: t0 });
    h.ctl.start();
    h.play(48, t0 + 0.3); // loop 1, slot 1: right
    h.stepTo(t0 + 4 * BAR + 0.05); // loop 1 complete
    h.play(48, t0 + 4 * BAR + 0.3); // loop 2, which the pause cuts short
    h.stepTo(t0 + 4 * BAR + 2);
    h.transport.stop(); // the page hidden (visibilityAction)
    const s = h.ctl.drill();
    expect(s.phase).toBe('paused');
    expect(s.usedSec).toBeCloseTo(4 * BAR + 2 + 0.1, 1); // the stop lands at now() = time + lookahead
    const left = 30 - s.usedSec; // about 17 s: time runs out in run 1's second loop

    h.stepTo(t0 + 30); // paused time doesn't count
    expect(h.ctl.drill().usedSec).toBe(s.usedSec);
    h.ctl.start();
    expect(h.ctl.drill().phase).toBe('running');
    const t1 = h.starts[1] ?? NaN;
    expect(t1).toBeCloseTo(t0 + 30 + 0.1, 6); // a new run from bar 1
    h.stepTo(t1 + left + 0.05);
    expect(h.ctl.drill().phase).toBe('finishing');
    h.stepTo(t1 + 8 * BAR + 0.05);
    expect(h.ctl.drill().phase).toBe('done');
    // Loop 1 of run 0 and loops 1–2 of run 1: the cut loop's answer is gone.
    expect(h.ctl.finished()?.data).toMatchObject({ slotsHeard: 12, right: 1 });
  });

  it('stop before a full loop abandons and leaves no result; leaving stops the transport', async () => {
    const h = await harness({ level: 'A1', progression: C_MAJOR_POP });
    h.ctl.start();
    h.stepTo(3);
    h.ctl.stop();
    expect(h.ctl.drill().phase).toBe('abandoned');
    expect(h.ctl.finished()).toBeNull();
    expect(h.transport.state()).toBe('stopped');

    const g = await harness({ level: 'A1', progression: C_MAJOR_POP });
    g.ctl.start();
    g.stepTo(20);
    g.ctl.dispose();
    expect(g.transport.state()).toBe('stopped');
    expect(g.ctl.drill().phase).toBe('abandoned');
    expect(g.ctl.finished()).toBeNull();
  });

  it('finish after one full loop writes the result', async () => {
    const h = await harness({ level: 'A1', progression: C_MAJOR_POP, startAt: 1 });
    h.ctl.start();
    h.stepTo(1 + 4 * BAR + 1);
    h.ctl.stop();
    expect(h.ctl.drill().phase).toBe('done');
    expect(h.ctl.finished()?.data).toMatchObject({ slotsHeard: 4 });
  });
});
