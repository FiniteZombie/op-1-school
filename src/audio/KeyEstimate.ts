/**
 * Stub (decision 13). A small hand-rolled chromagram plus a
 * Krumhansl–Schmuckler key estimate for sample slices (SPEC §5.1). Modules 2
 * and 4 both consume it, so the Phase 4 plan's first row builds it in the
 * spine before they fan out. Both functions throw `NotImplementedError`.
 * Pure and Tone-free (decision 11).
 */
import { NotImplementedError } from '../types/errors';
import type { Key } from '../types/music';

const REPLACED_BY = 'Phase 4 plan, row 1';

export interface KeyEstimateResult {
  key: Key;
  /** 0..1: how far the best key's correlation stands above the runner-up. */
  confidence: number;
}

/** Twelve bins, C = 0, from mono samples. */
export function chromagram(_samples: Float32Array, _sampleRate: number): number[] {
  throw new NotImplementedError('chromagram', REPLACED_BY);
}

/** Krumhansl–Schmuckler over a 12-bin chroma vector. */
export function estimateKey(_chroma: readonly number[]): KeyEstimateResult {
  throw new NotImplementedError('estimateKey', REPLACED_BY);
}
