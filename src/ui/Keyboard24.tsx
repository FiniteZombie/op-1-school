/**
 * The on-screen keyboard (SPEC §5.4): 24 keys up from `keyboardBaseNote +
 * 12 × keyboardOctave` (F by default), laid out by `keyboardLayout.ts`. Keys
 * light from the `NoteBus` (every source), and pointer events play through
 * `TouchInput`, one pointer per key, released on `pointerup` or
 * `pointercancel`.
 *
 * With `chord` and `musicKey`, lit keys show their classification
 * (placeholder marks, never hue alone): chord tone = blue, solid fill;
 * tension = cyan, outline; avoid = yellow, striped; outside = red, with a ×.
 * Lit keys without a chord are gray, filled.
 *
 * A note outside the 24 keys lights its octave-equivalent and calls
 * `onOutOfRange(note)` on its `on`; one in the hidden octave of one-octave
 * mode lights its equivalent and is not counted.
 *
 * Each key carries `data-note`, `data-lit` and `data-class` for scripted
 * checks.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { classify, noteName, pitchClass } from '../theory';
import type { Chord, Key, MidiNote, NoteClassification } from '../types/music';
import { COPY } from './copy';
import { HeldNotes, PointerTracker, keyboardLayout, litKeys, locateNote, type KeyRect } from './keyboardLayout';
import { useSetting, useSpine } from './spine';

export interface Keyboard24Props {
  /** With `musicKey`, lit keys show their classification against this chord. */
  chord?: Chord;
  /** The key to classify in (`key` is React's own prop name, so this is `musicKey`). */
  musicKey?: Key;
  /** Called on each `on` for a note outside the 24 keys. */
  onOutOfRange?(note: MidiNote): void;
  className?: string;
}

const GAP_PX = 4;

type Mark = NoteClassification | 'lit' | 'off';

const MARK_LABEL: Record<Mark, string> = {
  'chord-tone': 'chord tone',
  tension: 'tension',
  avoid: 'avoid',
  outside: 'outside',
  lit: 'lit',
  off: '',
};

function markStyle(mark: Mark): CSSProperties {
  switch (mark) {
    case 'chord-tone':
      return { background: 'var(--op-chord-tone)', borderColor: 'var(--op-chord-tone)' };
    case 'tension':
      return { background: 'var(--op-key)', borderColor: 'var(--op-tension)', borderWidth: 4 };
    case 'avoid':
      return {
        background: 'repeating-linear-gradient(45deg, var(--op-avoid) 0 6px, var(--op-key) 6px 12px)',
        borderColor: 'var(--op-avoid)',
        borderWidth: 2,
      };
    case 'outside':
      return { background: 'var(--op-outside)', borderColor: 'var(--op-outside)' };
    case 'lit':
      return { background: 'var(--op-key-lit)', borderColor: 'var(--op-key-lit)' };
    case 'off':
      return { background: 'var(--op-key)', borderColor: 'var(--op-key-line)' };
  }
}

export function Keyboard24({ chord, musicKey, onOutOfRange, className = '' }: Keyboard24Props) {
  const { bus, touch } = useSpine();
  const baseSetting = useSetting('keyboardBaseNote');
  const octaveSetting = useSetting('keyboardOctave');
  const baseNote = baseSetting + 12 * octaveSetting;

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [half, setHalf] = useState<0 | 1>(0);
  const layout = useMemo(() => keyboardLayout({ width, baseNote, half }), [width, baseNote, half]);

  const [held, setHeld] = useState<MidiNote[]>([]);
  const outOfRangeRef = useRef(onOutOfRange);
  outOfRangeRef.current = onOutOfRange;
  const baseRef = useRef(baseNote);
  baseRef.current = baseNote;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const notes = new HeldNotes();
    return bus.onNote((e) => {
      const base = baseRef.current;
      if (e.kind === 'on' && (e.note < base || e.note > base + 23)) outOfRangeRef.current?.(e.note);
      if (notes.apply(e)) setHeld(notes.notes());
    });
  }, [bus]);

  const tracker = useRef(new PointerTracker());
  useEffect(() => {
    const t = tracker.current;
    return () => {
      const now = performance.now();
      for (const note of t.releaseAll()) touch.release(note, now);
    };
  }, [touch]);

  const lit = useMemo(() => litKeys(held, layout), [held, layout]);
  const classifying = chord !== undefined && musicKey !== undefined;

  function markOf(k: KeyRect): Mark {
    const notes = lit.get(k.index);
    if (!notes || notes.length === 0) return 'off';
    if (!classifying) return 'lit';
    // A key lit by several octaves of a note shares one pitch class, so one classification.
    return classify(notes[0] as MidiNote, chord, musicKey);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>, note: MidiNote): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const pressed = tracker.current.down(e.pointerId, note);
    if (pressed === null) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // a scripted event has no active pointer to capture
    }
    touch.press(pressed, e.timeStamp);
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>): void {
    const note = tracker.current.up(e.pointerId);
    if (note !== null) touch.release(note, e.timeStamp);
  }

  const rowHeight = Math.round(layout.keyWidth * 1.1);
  const height = rowHeight * 2 + GAP_PX;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {layout.showToggle && (
        <button
          type="button"
          data-octave-toggle={layout.half}
          onClick={() => setHalf(half === 0 ? 1 : 0)}
          className="self-start rounded-md border border-line bg-surface px-3 py-1 text-sm text-text"
        >
          {COPY.octave(half === 0 ? 1 : 2)}
        </button>
      )}
      <div ref={containerRef} className="w-full">
        <div
          role="group"
          aria-label="keyboard"
          className="relative touch-none select-none"
          style={{ width: layout.width, height }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {layout.keys.map((k) => {
            const mark = markOf(k);
            const name = noteName(pitchClass(k.note), musicKey);
            return (
              <div
                key={k.index}
                role="button"
                aria-label={`${name}${MARK_LABEL[mark] ? `, ${MARK_LABEL[mark]}` : ''}`}
                aria-pressed={mark !== 'off'}
                data-note={k.note}
                data-key-index={k.index}
                data-lit={mark !== 'off'}
                data-class={mark}
                onPointerDown={(e) => onPointerDown(e, k.note)}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onLostPointerCapture={onPointerEnd}
                className="absolute flex items-center justify-center rounded-md border text-on-fill"
                style={{
                  left: k.x + GAP_PX / 2,
                  top: k.row === 'upper' ? 0 : rowHeight + GAP_PX,
                  width: k.width - GAP_PX,
                  height: rowHeight,
                  ...markStyle(mark),
                }}
              >
                {mark === 'outside' && (
                  <span aria-hidden="true" className="text-2xl font-bold leading-none">
                    ×
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
