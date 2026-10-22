/**
 * Drum patterns per style, as data (SPEC §5.3). Tone-free (decision 11).
 *
 * A pattern is one bar of sixteenth steps. Each voice lists the steps it hits
 * and a velocity per step (0 = no hit). `VirtualPushSynth` plays step
 * `sixteenth % steps` on every sixteenth the transport reports.
 *
 * Only `chillhop-rhodes` has data; every other `StyleId` falls back to it
 * with one console warning per style (`drumPatternFor`). Adding another
 * style's pattern is a spine change.
 */
import type { StyleId } from '../types/music';

export const DRUM_VOICES = ['kick', 'snare', 'hat'] as const;
export type DrumVoice = (typeof DRUM_VOICES)[number];

export interface DrumPattern {
  /** Steps per bar (sixteenths). */
  steps: number;
  /** For each voice, one velocity (0..1) per step; 0 is no hit. */
  velocities: Readonly<Record<DrumVoice, readonly number[]>>;
}

/** Builds a voice's velocity row from the steps it hits. */
function row(steps: number, hits: readonly number[], velocity: (step: number) => number): number[] {
  return Array.from({ length: steps }, (_, i) => (hits.includes(i) ? velocity(i) : 0));
}

const ALL_16 = Array.from({ length: 16 }, (_, i) => i);

// placeholder: hit velocities (kick 1, snare 0.9, hat accent 0.7 / normal
// 0.35) are temporary until the owner sets the mix.
const HAT_ACCENT = 0.7;
const HAT_NORMAL = 0.35;

/**
 * placeholder: the `chillhop-rhodes` pattern from the plan's Placeholders.
 * Kick on 0, 7, 10; snare on 4, 12; closed hat on all 16 steps, even steps
 * accented (so swing moves the unaccented odd ones).
 */
export const CHILLHOP_RHODES: DrumPattern = {
  steps: 16,
  velocities: {
    kick: row(16, [0, 7, 10], () => 1),
    snare: row(16, [4, 12], () => 0.9),
    hat: row(16, ALL_16, (i) => (i % 2 === 0 ? HAT_ACCENT : HAT_NORMAL)),
  },
};

/** The styles that have their own pattern. */
export const DRUM_PATTERNS: Readonly<Partial<Record<StyleId, DrumPattern>>> = {
  'chillhop-rhodes': CHILLHOP_RHODES,
};

export const FALLBACK_STYLE: StyleId = 'chillhop-rhodes';

const warnedStyles = new Set<StyleId>();

/**
 * The pattern for `style`. A style without data gets `chillhop-rhodes`, and
 * `warn` is called once per such style for the life of the page.
 */
export function drumPatternFor(
  style: StyleId,
  warn: (message: string) => void = (m) => console.warn(m),
): DrumPattern {
  const own = DRUM_PATTERNS[style];
  if (own) return own;
  if (!warnedStyles.has(style)) {
    warnedStyles.add(style);
    warn(`No drum pattern for style "${style}" yet; using "${FALLBACK_STYLE}"`);
  }
  return CHILLHOP_RHODES;
}

/** The voices hit on a step, with their velocities. */
export function drumHitsAt(
  pattern: DrumPattern,
  sixteenth: number,
): { voice: DrumVoice; velocity: number }[] {
  const step = ((sixteenth % pattern.steps) + pattern.steps) % pattern.steps;
  const hits: { voice: DrumVoice; velocity: number }[] = [];
  for (const voice of DRUM_VOICES) {
    const velocity = pattern.velocities[voice][step] ?? 0;
    if (velocity > 0) hits.push({ voice, velocity });
  }
  return hits;
}
