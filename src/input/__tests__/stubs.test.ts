import { describe, expect, test } from 'vitest';
import { chromagram, estimateKey } from '../../audio/KeyEstimate';
import { detectPitch, PitchWorklet } from '../../audio/PitchWorklet';
import { NotImplementedError } from '../../types/errors';
import { MicInput } from '../MicInput';

describe('stubs throw NotImplementedError', () => {
  const mic = new MicInput();
  const worklet = new PitchWorklet();
  const cases: Array<[string, () => unknown, RegExp]> = [
    ['MicInput.available', () => mic.available(), /Phase 3, Module 3 lane/],
    ['MicInput.start', () => mic.start(), /Phase 3, Module 3 lane/],
    ['MicInput.stop', () => mic.stop(), /Phase 3, Module 3 lane/],
    ['MicInput.onNote', () => mic.onNote(() => {}), /Phase 3, Module 3 lane/],
    ['detectPitch', () => detectPitch(new Float32Array(8), 48000), /Phase 3, Module 3 lane/],
    ['PitchWorklet.start', () => worklet.start({} as AudioNode), /Phase 3, Module 3 lane/],
    ['PitchWorklet.stop', () => worklet.stop(), /Phase 3, Module 3 lane/],
    ['PitchWorklet.onPitch', () => worklet.onPitch(() => {}), /Phase 3, Module 3 lane/],
    ['chromagram', () => chromagram(new Float32Array(8), 48000), /Phase 4 plan, row 1/],
    ['estimateKey', () => estimateKey(new Array<number>(12).fill(0)), /Phase 4 plan, row 1/],
  ];

  test.each(cases)('%s', (what, call, replacedBy) => {
    expect(call).toThrow(NotImplementedError);
    expect(call).toThrow(`${what} is not implemented yet`);
    expect(call).toThrow(replacedBy);
  });
});
