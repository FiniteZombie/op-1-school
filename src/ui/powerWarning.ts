/**
 * SPEC §2.2.3's power warning, pure. App-wide (pre-flight "Power warning"):
 * shown whenever a MIDI input connects, on any device; dismissible; shown
 * again on the next connect. `WebMidiBridge` also reports every port present
 * when access is granted as connected, so a Field plugged in before the app
 * opened raises it too.
 *
 * VERIFY V3 (stubbed here): whether the Field can decline charging from the
 * phone. Until that is known, every MIDI input connect warns.
 */
import type { MidiConnectionChange } from '../input/MidiBridge';

/** True when this connection event should show the warning. */
export function raisesPowerWarning(e: MidiConnectionChange): boolean {
  return e.type === 'port' && e.kind === 'input' && e.state === 'connected';
}
