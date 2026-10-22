/**
 * The owner's settled copy (plan "The owner's calls", 2026-10-22), all
 * lowercase, as written. Modules import it from here rather than retyping it.
 * Strings marked `placeholder` are not settled: neutral stand-ins until the
 * owner decides.
 */
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

  /** placeholder: the theme toggle names the theme it switches to. */
  themeToggle: { dark: 'light', light: 'dark' },
  /** placeholder: the power warning's dismiss button. */
  dismiss: 'dismiss',
  /** placeholder: the one-octave keyboard's toggle, naming the octave shown. */
  octave: (n: 1 | 2) => `octave ${n}`,
  /** placeholder: the StatusBar's BPM. */
  bpm: (bpm: number) => `${Math.round(bpm)} bpm`,
} as const;
