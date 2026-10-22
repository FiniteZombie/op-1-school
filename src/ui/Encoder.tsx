/**
 * A touch dial in one of the four TE encoder colours (SPEC §5.4). Holds a
 * 0..1 value: drag vertically (`rangePx` for the full range, up increases),
 * or use the arrow keys. The caller maps 0..1 to its own units and passes
 * `valueText` to show them.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { DEFAULT_RANGE_PX, angleOf, clamp01, dragValue, stepValue } from './encoderMath';

export type EncoderColor = 'blue' | 'ochre' | 'gray' | 'orange';

const STROKE: Record<EncoderColor, string> = {
  blue: 'var(--op-encoder-blue)',
  ochre: 'var(--op-encoder-ochre)',
  gray: 'var(--op-encoder-gray)',
  orange: 'var(--op-encoder-orange)',
};

export interface EncoderProps {
  /** 0..1. */
  value: number;
  onChange(value: number): void;
  color: EncoderColor;
  label: string;
  /** What the value means in the caller's units, e.g. `90`. Defaults to a percentage. */
  valueText?: string;
  /** Drag distance for the full range. */
  rangePx?: number;
  /** Arrow-key step. */
  step?: number;
  disabled?: boolean;
}

const SIZE = 56;
const R = 22;

/** An SVG arc from angle a0 to a1 (degrees, 0 = up), clockwise. */
function arc(a0: number, a1: number): string {
  const c = SIZE / 2;
  const pt = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${c + R * Math.cos(rad)} ${c + R * Math.sin(rad)}`;
  };
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${pt(a0)} A ${R} ${R} 0 ${large} 1 ${pt(a1)}`;
}

export function Encoder({ value, onChange, color, label, valueText, rangePx = DEFAULT_RANGE_PX, step = 0.01, disabled }: EncoderProps) {
  const drag = useRef<{ pointerId: number; startY: number; startValue: number } | null>(null);
  const v = clamp01(value);
  const angle = angleOf(v);
  const text = valueText ?? `${Math.round(v * 100)}%`;

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (disabled || drag.current) return;
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startValue: v };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // a scripted event has no active pointer to capture
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const next = dragValue(d.startValue, d.startY, e.clientY, rangePx);
    if (next !== v) onChange(next);
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>): void {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    const delta = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? step : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -step : 0;
    if (delta === 0) return;
    e.preventDefault();
    onChange(stepValue(v, delta));
  }

  return (
    <div className={`inline-flex flex-col items-center gap-1 select-none ${disabled ? 'opacity-50' : ''}`}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={v}
        aria-valuetext={text}
        aria-disabled={disabled || undefined}
        data-encoder={color}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onKeyDown={onKeyDown}
        className="cursor-ns-resize rounded-full touch-none outline-offset-2"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <path d={arc(-135, 135)} fill="none" stroke="var(--op-line)" strokeWidth={4} strokeLinecap="round" />
          {v > 0 && <path d={arc(-135, angle)} fill="none" stroke={STROKE[color]} strokeWidth={4} strokeLinecap="round" />}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R - 7} fill={STROKE[color]} />
          <line
            x1={SIZE / 2}
            y1={SIZE / 2}
            x2={SIZE / 2}
            y2={SIZE / 2 - (R - 9)}
            stroke="var(--op-encoder-mark)"
            strokeWidth={3}
            strokeLinecap="round"
            transform={`rotate(${angle} ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
      </div>
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm tabular-nums text-text">{text}</span>
    </div>
  );
}
