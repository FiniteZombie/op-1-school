/**
 * SPEC §5.4's status line: BPM, clock mode (`internal` / `clock out` /
 * `follow`), the MIDI input or `no midi`, and calibration per active input
 * source (`touch ✓ · midi needs calibration`), which also names the active
 * sources. Polls the spine every 250 ms (the transport has no BPM event) and
 * re-reads calibration when the active sources or the MIDI input change.
 */
import { useEffect, useState } from 'react';
import { listCalibrations } from '../state/calibration';
import { COPY } from './copy';
import { useSpine } from './spine';
import { calibrationDevices, calibrationText, midiPortText, type CalibrationKey } from './statusBarText';

const POLL_MS = 250;

interface Snapshot {
  bpm: number;
  mode: string;
  input: string | null;
  devices: CalibrationKey[];
}

export function StatusBar() {
  const { transport, midi, bus } = useSpine();

  function read(): Snapshot {
    const input = midi.selected().input?.name ?? null;
    return { bpm: transport.bpm(), mode: midi.clockMode(), input, devices: calibrationDevices(bus.active(), input) };
  }

  const [snap, setSnap] = useState<Snapshot>(read);
  const [records, setRecords] = useState<CalibrationKey[]>([]);

  useEffect(() => {
    const tick = () =>
      setSnap((prev) => {
        const next = read();
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
      });
    const timer = setInterval(tick, POLL_MS);
    const offMode = midi.onClockModeChange(tick);
    const offConn = midi.onConnectionChange(tick);
    tick();
    return () => {
      clearInterval(timer);
      offMode();
      offConn();
    };
    // `read` closes over the spine objects only, which are the deps.
  }, [transport, midi, bus]);

  const devicesKey = JSON.stringify(snap.devices);
  useEffect(() => {
    let live = true;
    listCalibrations()
      .then((all) => {
        if (live) setRecords(all.map((r) => ({ source: r.source, device: r.device })));
      })
      .catch(() => {
        // No IndexedDB: nothing is calibrated.
        if (live) setRecords([]);
      });
    return () => {
      live = false;
    };
  }, [devicesKey]);

  const items = [COPY.bpm(snap.bpm), snap.mode, midiPortText(snap.input), calibrationText(snap.devices, records)].filter(Boolean);

  return (
    <div
      role="status"
      aria-live="off"
      data-status-bar
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-2 text-xs text-muted"
    >
      {items.map((text, i) => (
        <span key={i} className="whitespace-nowrap">
          {text}
        </span>
      ))}
    </div>
  );
}
