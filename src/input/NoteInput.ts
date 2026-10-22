/**
 * One event type for every physical input (SPEC §5.3): modules subscribe to
 * the `NoteBus` and never know whether a note came from the Field, the screen
 * or the mic.
 *
 * Conventions every source follows:
 * - `perfTs` is in the `performance.now()` domain (the MIDI event's or the
 *   pointer event's `timeStamp`).
 * - An `on` carries the source's velocity (0..1, 1 when it has none); an `off`
 *   carries velocity 0.
 * - A source emits only while started, and `stop()` emits an `off` for every
 *   note it still holds, so nothing sticks.
 */
import type { InputSource, NoteEvent, Unsubscribe } from '../types/music';

export interface NoteInputSource {
  readonly id: InputSource;
  available(): Promise<boolean>;
  start(): Promise<void>;
  stop(): void;
  onNote(cb: (e: NoteEvent) => void): Unsubscribe;
}

/** A set of subscribers where one that throws is logged and skipped. */
export class Listeners<A extends unknown[]> {
  private readonly cbs = new Set<(...args: A) => void>();

  constructor(private readonly label: string) {}

  add(cb: (...args: A) => void): Unsubscribe {
    // Wrapped, so the same function can subscribe twice and unsubscribe once each.
    const entry = (...args: A) => cb(...args);
    this.cbs.add(entry);
    return () => {
      this.cbs.delete(entry);
    };
  }

  emit(...args: A): void {
    for (const cb of [...this.cbs]) {
      try {
        cb(...args);
      } catch (err) {
        console.error(`${this.label} subscriber threw`, err);
      }
    }
  }

  get size(): number {
    return this.cbs.size;
  }
}

/**
 * Collects the registered sources. The bus owns starting and stopping them:
 * `start(id)` / `stop(id)`, and `active()` lists the started ones. Notes are
 * forwarded only from started sources; a subscriber that throws is logged and
 * doesn't stop the others.
 */
export class NoteBus {
  private readonly sources = new Map<InputSource, NoteInputSource>();
  private readonly started = new Set<InputSource>();
  private readonly listeners = new Listeners<[NoteEvent]>('NoteBus');

  /** Throws if a source with the same id is already registered. */
  register(src: NoteInputSource): void {
    if (this.sources.has(src.id)) throw new Error(`NoteBus.register: a '${src.id}' source is already registered`);
    this.sources.set(src.id, src);
    src.onNote((e) => {
      if (this.started.has(src.id)) this.listeners.emit(e);
    });
  }

  /** The registered source ids, in registration order. */
  registered(): InputSource[] {
    return [...this.sources.keys()];
  }

  /** Starts a registered source; it is active once its `start()` resolves. Throws for an unknown id. */
  async start(id: InputSource): Promise<void> {
    const src = this.require(id, 'start');
    if (this.started.has(id)) return;
    await src.start();
    this.started.add(id);
  }

  /** Stops a source; its closing `off`s still reach subscribers. Does nothing if it isn't started. */
  stop(id: InputSource): void {
    const src = this.require(id, 'stop');
    if (!this.started.has(id)) return;
    try {
      src.stop();
    } finally {
      this.started.delete(id);
    }
  }

  /** The started sources, in registration order. */
  active(): InputSource[] {
    return this.registered().filter((id) => this.started.has(id));
  }

  onNote(cb: (e: NoteEvent) => void): Unsubscribe {
    return this.listeners.add(cb);
  }

  private require(id: InputSource, what: string): NoteInputSource {
    const src = this.sources.get(id);
    if (!src) throw new Error(`NoteBus.${what}: no '${id}' source is registered`);
    return src;
  }
}
