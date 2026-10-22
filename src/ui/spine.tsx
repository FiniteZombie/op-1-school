/**
 * The spine's shared objects, one each per page, for every module:
 * `useSpine()` gives the `ClockBridge`, `TransportEngine`, `NoteBus`,
 * `MidiBridge`, `TouchInput`, settings and the audio gate.
 *
 * - Audio starts only from a tap: `audio.start()` (the `AudioGate` button)
 *   runs `initAudio()` (`Tone.start()`), then refreshes the clock every
 *   250 ms. A context that is later suspended or interrupted reads `paused`
 *   and the gate shows its resume button.
 * - `touch` is registered and started on the bus, so on-screen keys light at
 *   once. `midi` is registered and started on the bus while an input is
 *   selected, so `bus.active()` lists the sources that can actually play.
 * - The MIDI port selection persists in settings (`portMemory(settings)`).
 * - The theme follows `settings.theme`.
 *
 * Nothing here is disposed: the spine lives as long as the page.
 */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { WebAudioClockBridge, type ClockBridge } from '../audio/Clock';
import { ToneTransport, getAudioContext, initAudio, isAudioInitialised, type TransportEngine } from '../audio/TransportEngine';
import { WebMidiBridge, type MidiBridge } from '../input/MidiBridge';
import { NoteBus } from '../input/NoteInput';
import { TouchInput } from '../input/TouchInput';
import { portMemory, settings as appSettings, type SettingsStore } from '../state/settings';
import type { Unsubscribe } from '../types/music';
import { audioStateOf, type AudioState } from './audioGate';
import { clockContextOf } from './clockContext';
import { applyTheme } from './theme';

/** How often the clock re-samples its correlation once audio runs (SPEC §3.1). */
export const CLOCK_REFRESH_MS = 250;

export interface AudioGateController {
  state(): AudioState;
  /** Call from a tap: starts audio the first time, resumes a suspended context after. */
  start(): Promise<void>;
  subscribe(cb: () => void): Unsubscribe;
}

export interface Spine {
  clock: ClockBridge;
  transport: TransportEngine;
  bus: NoteBus;
  midi: MidiBridge;
  touch: TouchInput;
  settings: SettingsStore;
  audio: AudioGateController;
}

export function createSpine(): Spine {
  const settings = appSettings;
  const toneContext = getAudioContext();
  const clock = new WebAudioClockBridge(clockContextOf(toneContext.rawContext));
  const transport = new ToneTransport();
  const bus = new NoteBus();
  const touch = new TouchInput();
  const midi = new WebMidiBridge({ memory: portMemory(settings) });

  bus.register(touch);
  bus.register(midi);
  void bus.start('touch');
  midi.onConnectionChange((e) => {
    if (e.type !== 'selection') return;
    if (e.input) void bus.start('midi');
    else bus.stop('midi');
  });

  applyTheme(settings.get().theme);
  let theme = settings.get().theme;
  settings.subscribe((s) => {
    if (s.theme !== theme) {
      theme = s.theme;
      applyTheme(theme);
    }
  });

  const audioListeners = new Set<() => void>();
  let audioState: AudioState = audioStateOf(isAudioInitialised(), toneContext.state);
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  function updateAudioState(): void {
    const next = audioStateOf(isAudioInitialised(), toneContext.state);
    if (next === audioState) return;
    audioState = next;
    for (const cb of [...audioListeners]) {
      try {
        cb();
      } catch (err) {
        console.error('audio gate subscriber threw', err);
      }
    }
  }

  toneContext.on('statechange', updateAudioState);

  const audio: AudioGateController = {
    state: () => audioState,
    async start() {
      await initAudio();
      clock.refresh();
      refreshTimer ??= setInterval(() => clock.refresh(), CLOCK_REFRESH_MS);
      updateAudioState();
    },
    subscribe(cb) {
      audioListeners.add(cb);
      return () => {
        audioListeners.delete(cb);
      };
    },
  };

  return { clock, transport, bus, midi, touch, settings, audio };
}

let shared: Spine | null = null;

/** The page's spine, made on first call. */
export function getSpine(): Spine {
  shared ??= createSpine();
  return shared;
}

const SpineContext = createContext<Spine | null>(null);

/** Provides `spine` (default: `getSpine()`) to `useSpine()`. */
export function SpineProvider({ spine, children }: { spine?: Spine; children: ReactNode }) {
  return <SpineContext.Provider value={spine ?? getSpine()}>{children}</SpineContext.Provider>;
}

export function useSpine(): Spine {
  const spine = useContext(SpineContext);
  if (!spine) throw new Error('useSpine() needs a <SpineProvider> above it');
  return spine;
}

/** The audio gate's state, re-rendering on change. */
export function useAudioState(): AudioState {
  const { audio } = useSpine();
  return useSyncExternalStore(audio.subscribe, audio.state);
}

/** One settings field, re-rendering when it changes (a primitive, so the snapshot is stable). */
export function useSetting<K extends 'theme' | 'keyboardBaseNote' | 'keyboardOctave' | 'clockOut'>(
  key: K,
): ReturnType<SettingsStore['get']>[K] {
  const { settings } = useSpine();
  return useSyncExternalStore(settings.subscribe, () => settings.get()[key]);
}
