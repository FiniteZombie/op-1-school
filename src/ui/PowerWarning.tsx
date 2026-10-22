/**
 * SPEC §2.2.3's one-line warning, app-wide: shown whenever a MIDI input
 * connects, dismissible, shown again on the next connect. VERIFY V3 stub (see
 * `powerWarningLogic.ts`). Yellow = warning, with a `!` mark so it never relies on
 * hue alone.
 */
import { useEffect, useState } from 'react';
import { COPY } from './copy';
import { raisesPowerWarning } from './powerWarningLogic';
import { useSpine } from './spine';

export function PowerWarning() {
  const { midi } = useSpine();
  const [shown, setShown] = useState(false);

  useEffect(
    () =>
      midi.onConnectionChange((e) => {
        if (raisesPowerWarning(e)) setShown(true);
      }),
    [midi],
  );

  if (!shown) return null;
  return (
    <div
      role="alert"
      data-power-warning
      className="flex items-center gap-3 border-b-2 border-warn bg-surface px-3 py-2 text-sm text-text"
    >
      <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warn font-bold text-on-fill">
        !
      </span>
      <span className="flex-1">{COPY.powerWarning}</span>
      <button type="button" onClick={() => setShown(false)} className="rounded-md border border-line px-2 py-1 text-xs text-text">
        {COPY.dismiss}
      </button>
    </div>
  );
}
