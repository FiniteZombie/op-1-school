/** `StatusBar`'s text, pure. */
import { defaultDevice } from '../state/calibration';
import type { InputSource } from '../types/music';
import { COPY } from './copy';

export interface CalibrationKey {
  source: InputSource;
  device: string;
}

/** The calibration device for each active source: the MIDI input's name, `screen` for touch, `default` for mic. */
export function calibrationDevices(active: readonly InputSource[], midiInputName: string | null): CalibrationKey[] {
  return active.map((source) => ({
    source,
    device: source === 'midi' ? (midiInputName ?? '') : defaultDevice(source),
  }));
}

/** Per active source: `touch ✓ · midi needs calibration`. Empty with no active source. */
export function calibrationText(devices: readonly CalibrationKey[], records: readonly CalibrationKey[]): string {
  return devices
    .map(({ source, device }) => {
      const ok = records.some((r) => r.source === source && r.device === device);
      return `${source} ${ok ? COPY.calibrated : COPY.needsCalibration}`;
    })
    .join(' · ');
}

/** The MIDI port shown: the selected input's name, else `no midi`. */
export function midiPortText(inputName: string | null): string {
  return inputName ?? COPY.noMidi;
}
