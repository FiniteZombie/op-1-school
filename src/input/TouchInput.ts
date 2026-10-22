/**
 * The on-screen keyboard as a note source. `Keyboard24` (row 8) calls
 * `press` / `release` with the pointer event's `timeStamp`, which is already
 * in the `performance.now()` domain. Touch has no velocity, so an `on` is 1.
 */
import type { MidiNote, NoteEvent, Unsubscribe } from '../types/music';
import { Listeners, type NoteInputSource } from './NoteInput';

export class TouchInput implements NoteInputSource {
  readonly id = 'touch' as const;
  private running = false;
  private readonly held = new Set<MidiNote>();
  private readonly listeners = new Listeners<[NoteEvent]>('TouchInput');

  constructor(private readonly perfNow: () => number = () => performance.now()) {}

  available(): Promise<boolean> {
    return Promise.resolve(true);
  }

  start(): Promise<void> {
    this.running = true;
    return Promise.resolve();
  }

  /** Releases every held note at `performance.now()`. */
  stop(): void {
    if (!this.running) return;
    const now = this.perfNow();
    for (const note of [...this.held]) this.release(note, now);
    this.running = false;
  }

  /** A key went down. Ignored while stopped, or if the note is already down. */
  press(note: MidiNote, perfTs: number): void {
    if (!this.running || this.held.has(note)) return;
    this.held.add(note);
    this.listeners.emit({ kind: 'on', note, velocity: 1, perfTs, source: 'touch' });
  }

  /** A key came up. Ignored while stopped, or if the note isn't down. */
  release(note: MidiNote, perfTs: number): void {
    if (!this.running || !this.held.delete(note)) return;
    this.listeners.emit({ kind: 'off', note, velocity: 0, perfTs, source: 'touch' });
  }

  onNote(cb: (e: NoteEvent) => void): Unsubscribe {
    return this.listeners.add(cb);
  }
}
