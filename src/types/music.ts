// SPEC §5.3, plus the fields plan decision 5 adds. Shapes may gain fields; they
// may not change meaning. The `as const` lists exist so validators can check
// JSON at runtime; the types are derived from them.

export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11; // C=0
export type MidiNote = number; // 0..127

export const CHORD_QUALITIES = [
  'maj7',
  '7',
  'm7',
  'm7b5',
  'dim7',
  'sus4',
  'sus2',
  'maj',
  'min',
  'mMaj7',
  '6',
  'm6',
  'dim',
] as const;
export type ChordQuality = (typeof CHORD_QUALITIES)[number];

export const MODES = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
] as const;
export type Mode = (typeof MODES)[number];

export interface Key {
  tonic: PitchClass;
  mode: Mode;
}

export interface Chord {
  root: PitchClass;
  quality: ChordQuality;
  extensions?: Array<9 | 11 | 13 | 'b9' | '#9' | '#11' | 'b13'>;
  /** Slash-chord bass; absent means the root is the bass. */
  bass?: PitchClass;
}

export interface ChordSlot {
  chord: Chord;
  roman: string;
  beats: number; // beats within the loop
}

export const STYLE_IDS = ['chillhop-rhodes', 'boombap-soul', 'lofi-house', 'dorian-synth'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export interface Progression {
  id: string;
  key: Key;
  bpm: number;
  swing: number;
  bars: number;
  slots: ChordSlot[];
  style: StyleId;
  family: string;
}

export type NoteClassification = 'chord-tone' | 'tension' | 'avoid' | 'outside';

export type InputSource = 'midi' | 'touch' | 'mic';

export interface NoteEvent {
  kind: 'on' | 'off';
  note: MidiNote;
  velocity: number; // 0..1; 1.0 when the source has no velocity
  perfTs: number; // performance.now() domain
  source: InputSource;
  confidence?: number; // mic only
}

export interface TimingOffset {
  note: MidiNote;
  targetTick: number;
  offsetMs: number;
  source: InputSource;
  calibrated: boolean;
}

/** Returned by every `on…` subscription in the spine (SPEC §3.2, §5.3); call it to unsubscribe. */
export type Unsubscribe = () => void;
