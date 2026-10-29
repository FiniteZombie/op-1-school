/**
 * The owner's settled copy (plan "The owner's calls", 2026-10-22), all
 * lowercase, as written. Modules import it from here rather than retyping it.
 * Strings marked `placeholder` are not settled: neutral stand-ins until the
 * owner decides.
 */
import type { ModuleId } from '../types/modules';

export const COPY = {
  navTitle: 'op-1-school',
  home: 'modules arrive in phase 2',
  notFound: 'no page here',
  audioStart: 'tap to start audio',
  audioResume: 'audio paused, tap to resume',
  midiUnsupported: "web midi isn't available in this browser",
  midiDenied: 'midi permission denied',
  noMidi: 'no midi',
  calibrated: '✓',
  needsCalibration: 'needs calibration',
  powerWarning: 'the field may charge from this phone',
  /** Each module's nav name (its `module.ts` `title`), including modules not built yet. */
  moduleTitles: {
    runner: 'sesh',
    'progression-trainer': 'chords',
    'sample-flip': 'flip',
    'pocket-dojo': 'pocket',
    'kit-compiler': 'kits',
    'dev-spine': 'dev spine',
  } satisfies Record<ModuleId, string>,
  /** Each module's nav icon (its `module.ts` `icon`); on a phone the nav shows only these. */
  moduleIcons: {
    runner: '▶️',
    'progression-trainer': '🎹',
    'sample-flip': '🔀',
    'pocket-dojo': '🎯',
    'kit-compiler': '🥁',
    'dev-spine': '∿',
  } satisfies Record<ModuleId, string>,

  /** placeholder: the theme toggle names the theme it switches to. */
  themeToggle: { dark: 'light', light: 'dark' },
  /** placeholder: the power warning's dismiss button. */
  dismiss: 'dismiss',
  /** placeholder: the one-octave keyboard's toggle, naming the octave shown. */
  octave: (n: 1 | 2) => `octave ${n}`,
  /** placeholder: `ErrorBoundary`'s heading over the error text. */
  pageError: 'something broke on this page',
  /** placeholder: the StatusBar's BPM. */
  bpm: (bpm: number) => `${Math.round(bpm)} bpm`,
  /** placeholder: the bug button (in the nav) and its box. */
  bug: {
    button: 'bug',
    heading: 'report a bug',
    publicNote: 'reports on github are public: leave out anything personal',
    field: 'what went wrong?',
    copy: 'copy',
    github: 'open on github',
    close: 'close',
    copied: 'copied',
    copyFailed: 'copy failed: select the text below',
    cut: 'cut to fit github: copy has the full report',
    details: 'what gets sent',
  },
} as const;
