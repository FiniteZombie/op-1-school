/** Typed, versioned settings in `localStorage` under one key. `index.html`'s theme script reads the same key. */
export const SETTINGS_KEY = 'op-1-school.settings';
export const SETTINGS_VERSION = 1;

export interface StoredPort {
  id: string;
  name: string;
}

export type Theme = 'dark' | 'light';

export interface Settings {
  midiInput: StoredPort | null;
  midiOutput: StoredPort | null;
  clockOut: boolean;
  /** MIDI note of the keyboard's lowest key. 53 (F3) is a VERIFY default: the Field's lowest key (V8). */
  keyboardBaseNote: number;
  /** Octaves of transposition applied to `keyboardBaseNote` (× 12). */
  keyboardOctave: number;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  midiInput: null,
  midiOutput: null,
  clockOut: false,
  keyboardBaseNote: 53,
  keyboardOctave: 0,
  theme: 'dark',
});

/** The slice of `Storage` used (so tests pass a fake). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function port(v: unknown): StoredPort | null | undefined {
  if (v === null) return null;
  if (isObject(v) && typeof v.id === 'string' && typeof v.name === 'string') {
    return { id: v.id, name: v.name };
  }
  return undefined;
}

const FIELDS: { [K in keyof Settings]: (v: unknown) => Settings[K] | undefined } = {
  midiInput: port,
  midiOutput: port,
  clockOut: (v) => (typeof v === 'boolean' ? v : undefined),
  keyboardBaseNote: (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 127 ? v : undefined),
  keyboardOctave: (v) => (typeof v === 'number' && Number.isInteger(v) ? v : undefined),
  theme: (v) => (v === 'dark' || v === 'light' ? v : undefined),
};

/**
 * Builds a full `Settings` from anything: each field that is missing or the
 * wrong type falls back to its own default, and unknown keys are dropped.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const src = isObject(raw) ? raw : {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(FIELDS) as (keyof Settings)[]) {
    const ok = FIELDS[key](src[key]);
    out[key] = ok === undefined ? DEFAULT_SETTINGS[key] : ok;
  }
  return out as unknown as Settings;
}

export interface SettingsStore {
  get(): Settings;
  /** Merges `patch` into the current settings, persists, and notifies subscribers if anything changed. */
  save(patch: Partial<Settings>): Settings;
  subscribe(cb: (settings: Settings) => void): () => void;
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** A settings store over `storage`; a throwing or missing storage falls back to memory for the session. */
export function createSettings(storage: StorageLike | null = browserStorage()): SettingsStore {
  let current: Settings | null = null;
  const listeners = new Set<(s: Settings) => void>();

  function read(): Settings {
    try {
      const text = storage?.getItem(SETTINGS_KEY);
      if (text) return sanitizeSettings(JSON.parse(text));
    } catch {
      // corrupt JSON or a throwing storage: defaults
    }
    return sanitizeSettings(null);
  }

  function get(): Settings {
    current ??= read();
    return { ...current };
  }

  function save(patch: Partial<Settings>): Settings {
    const before = get();
    const next = sanitizeSettings({ ...before, ...patch });
    current = next;
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, ...next }));
    } catch {
      // memory only for this session
    }
    if (JSON.stringify(before) !== JSON.stringify(next)) {
      for (const cb of [...listeners]) {
        try {
          cb({ ...next });
        } catch (e) {
          console.error('settings subscriber threw', e);
        }
      }
    }
    return { ...next };
  }

  function subscribe(cb: (s: Settings) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  return { get, save, subscribe };
}

/** The app's settings. */
export const settings: SettingsStore = createSettings();

/** Fits `PortMemory` (`src/input/MidiBridge.ts`): the port selection persists in these settings. */
export function portMemory(store: SettingsStore = settings): {
  load(): { input: StoredPort | null; output: StoredPort | null };
  save(ports: { input: StoredPort | null; output: StoredPort | null }): void;
} {
  return {
    load() {
      const s = store.get();
      return { input: s.midiInput, output: s.midiOutput };
    },
    save({ input, output }) {
      store.save({ midiInput: input, midiOutput: output });
    },
  };
}
