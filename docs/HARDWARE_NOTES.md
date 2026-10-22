# Hardware notes

What's known about the OP-1 Field and the phone, what isn't, and what's been
measured. SPEC §2 and §8 are the source; results land here.

## Verified

From SPEC §2.1.

- The Field is a class-compliant USB MIDI device. It sends and receives note
  on/off, MIDI clock, transport and song position pointer. Sync modes (Tempo +
  the green encoder): **free** ignores clock, **beat match** makes the Field
  master, **sync** makes it follow external clock. App-as-master means the
  Field in **sync**.
- In sync mode with clock-in enabled, the Field's tape speed follows external
  clock.
- Key velocity is a firmware setting (Shift+Tempo: off / soft / hard) and is
  sent over MIDI. It's widely believed to come from the accelerometer, so it's
  coarse: drills assume off (fixed 127) and score timing.
- Drum kits are AIFF with an `APPL` chunk: `op-1` then JSON (`"type":"drum"`,
  per-key `start`/`end` arrays, `pitch`, `playmode`, `reverse`, `volume`,
  `dyna_env`, …). Stereo kits hold 20 s; mono is capped at 12 s.
- The keyboard has 24 keys over two octaves, lowest key F, with octave shift.
- Web MIDI and `getUserMedia` need a secure context and a user gesture. GitHub
  Pages is HTTPS.
- Chrome on Android supports Web MIDI (with a permission prompt) and
  class-compliant USB audio devices.

## Android USB-C

From SPEC §2.2.

1. **Audio routing is global.** With the Field attached as a USB audio
   device, Android sends all of the phone's audio to it, so the backing loop
   arrives at the Field's USB input. Drills are monitored through the Field;
   recording tape with input = USB records the backing; streaming a sample to
   the Field is the same path with the transport stopped. Android can't pick an
   output device (`setSinkId` is desktop-only).
2. **Mic mode needs headphones** (or the Field as output), and turns off
   `echoCancellation`, `noiseSuppression` and `autoGainControl`.
3. **Power.** With the phone as host, the Field may charge from the phone. The
   app shows a one-line warning on connect until V3 is answered.
4. **Background throttling.** Screen-off and background tabs throttle timers.
   Tone runs a worker ticker, and the transport holds a wake lock while running.
5. **Audio latency** is 20–100 ms depending on the phone. The context uses
   `latencyHint: 'interactive'` and reads `outputLatency` / `baseLatency` for
   correction (SPEC §3.3).

## VERIFY log

Never resolved by guessing. Status is `open`, `stubbed` (built behind an
interface, waiting on a result) or `resolved`.

| Id | Item | SPEC | Status | Stubbed in | Result |
| --- | --- | --- | --- | --- | --- |
| V1 | Field drum-kit AIFF format: `start`/`end` units, AIFF vs AIFF-C `sowt`, key → index order, required fields | §8.1 | open | | |
| V2 | Factory drum key layout (which key is kick, snare, hat) | §8.2 | open | | |
| V3 | Whether the Field can decline charging from the phone, and drain per hour | §2.2.3, §8.3 | stubbed | `PowerWarning` in `src/ui/PowerWarning.tsx` (`raisesPowerWarning` in `src/ui/powerWarning.ts`): every MIDI input connect shows `the field may charge from this phone`, dismissible, again on the next connect | |
| V4 | Whether Field velocity comes from the accelerometer | §8.4 | open | | |
| V5 | Web MIDI clock jitter on the target phone (p95 ≤ 3 ms, loopback) | §8.5 | open | | |
| V6 | Whether the Field needs clock pulses before `0xFA` to lock tempo on bar 1 | §8.6 | stubbed | `WebMidiBridge.clockOut` in `src/input/MidiBridge.ts`: as SPEC §3.4, no pulses before `FA` on a transport start | |
| V7 | The Field's MIDI input port name | §2.1 | stubbed | `WebMidiBridge` in `src/input/MidiBridge.ts`: no port is picked by name; the user picks, and the choice is remembered by id, then name | |
| V8 | MIDI note number of the Field's lowest key at the default octave | §2.1 | stubbed | `DEFAULT_SETTINGS.keyboardBaseNote` in `src/state/settings.ts`: 53 (F3) | |

## Platform measurements

Read off `/dev/spine?dev`. The clock readout settles whether
`getOutputTimestamp().contextTime` already includes output latency; the MIDI
timing panel gives send headroom (intended send time − `performance.now()` at
the `send` call; negative is late) and, with a loopback, true jitter.

### Clock readout

| Device and browser | Active path | `currentTime` − `contextTime` gap (ms) | `outputLatency` (ms) | `baseLatency` (ms) | Date |
| --- | --- | --- | --- | --- | --- |

### MIDI clock out

| Device and browser | Headroom min / p5 / p50 (ms) | Late sends | Loopback \|error\| p50 / p95 (ms) | Date |
| --- | --- | --- | --- | --- |
