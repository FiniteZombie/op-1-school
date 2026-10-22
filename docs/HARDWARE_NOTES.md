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
| V3 | Whether the Field can decline charging from the phone, and drain per hour | §2.2.3, §8.3 | stubbed | `PowerWarning` in `src/ui/PowerWarning.tsx` (`raisesPowerWarning` in `src/ui/powerWarningLogic.ts`): every MIDI input connect shows `the field may charge from this phone`, dismissible, again on the next connect | |
| V4 | Whether Field velocity comes from the accelerometer | §8.4 | open | | |
| V5 | Web MIDI clock jitter on the target phone (p95 ≤ 3 ms, loopback) | §8.5 | open | | |
| V6 | Whether the Field needs clock pulses before `0xFA` to lock tempo on bar 1 | §8.6 | stubbed | `WebMidiBridge.clockOut` in `src/input/MidiBridge.ts`: as SPEC §3.4, no pulses before `FA` on a transport start | |
| V7 | The Field's MIDI input port name | §2.1 | stubbed | `WebMidiBridge` in `src/input/MidiBridge.ts`: no port is picked by name; the user picks, and the choice is remembered by id, then name | `OP-1`, manufacturer `Teenage Engineering`, for input and output (Chrome 155, Windows 11, 2026-10-22). The name doesn't say Field, so it can't tell a Field from an original OP-1. Android's name not seen yet |
| V8 | MIDI note number of the Field's lowest key at the default octave | §2.1 | resolved | `DEFAULT_SETTINGS.keyboardBaseNote` in `src/state/settings.ts`: 53 (F3) | 53 (F3): the leftmost F at the default octave, pressed alone (2026-10-22). Velocity off sends 127; release sends `80 nn 00` |

## Platform measurements

Read off `/dev/spine?dev`. The clock readout settles whether
`getOutputTimestamp().contextTime` already includes output latency; the MIDI
timing panel gives send headroom (intended send time − `performance.now()` at
the `send` call; negative is late) and, with a loopback, true jitter.

### Clock readout

| Device and browser | Active path | `currentTime` − `contextTime` gap (ms) | `outputLatency` (ms) | `baseLatency` (ms) | Date |
| --- | --- | --- | --- | --- | --- |
| Windows 11 laptop, Chrome 155, built-in speakers | `output-timestamp` | 49.8–52.6 | 40.0 | 10.0 | 2026-10-22 |

### MIDI clock out

| Device and browser | Headroom min / p5 / p50 (ms) | Late sends | Loopback \|error\| p50 / p95 (ms) | Date |
| --- | --- | --- | --- | --- |
| Windows 11 laptop, Chrome 155, Field in sync at 120 BPM (1000 sends) | 81.2 / 92.1 / 119.6 | 0 | 7.51 / 15.30 (the Field echoes clock; includes its echo and Windows MIDI-in delivery) | 2026-10-22 |

On that laptop the Field, in **sync**, echoes the app's clock back at
90.01 and 120.04 BPM (20 s and 15 s averages) and its play bpm reads the
app's tempo ±1. The echoed pulses arrive bunched: 12.9–42 ms apart at 90 BPM
(27.8 ms nominal), median 30.1 ms. Song bpm stays at the tape's 110; whether
tape speed follows is checklist item 2 below.

## Phase 3 hardware checklist

From SPEC §6.3. The owner runs it before Module 3 starts, with the Field
plugged into the phone, and writes each result in the blank.

1. Field in **sync** mode, app clock out on: the Field follows the app's tempo.
   Result: ______
2. Same setup, tape running: tape speed matches the app's tempo. Result: ______
3. Velocity off (Shift+Tempo): notes arrive at velocity 127. Result: ______
4. Velocity on (soft, then hard): velocity varies. Result: ______
5. The phone doesn't drain over a 30-minute session with the Field attached
   (battery % before and after). Result: ______
6. Audio routing behaves as "Android USB-C" above says: the backing loop
   reaches the Field's USB input, and the phone's own speaker is silent.
   Result: ______

## Exit gate checks (Phase 1, row 11)

The owner runs these from the Pages URL
(`https://finitezombie.github.io/op-1-school/`) after merging `phase-1-spine`
into `main`. The run that built the spine had no MIDI hardware and no phone,
so every blank is open. Page: `/op-1-school/dev/spine?dev`.

1. `npm run check` exits 0 on `main`. Result: ______
2. After pushing `main`, the Actions run is green and the Pages URL serves the
   shell. (Settings, Pages, Source must be "GitHub Actions" first.)
   Result: ______
3. Phone, Chrome: open the page from the Pages URL, tap `tap to start audio`,
   press `start`. Read the clock panel and copy gap, `outputLatency`,
   `baseLatency` and the active path into **Clock readout** below.
   Result: ______
4. Phone, by ear: the loop is swung (off-beat hats lag at swing 0.5, straight
   at 0) and has no clicks. Tap keys: they light, and the log shows touch `on`
   and `off` events. Result: ______
5. Phone: the app opens dark. Switch to light and back. Every panel, the
   keyboard's lit and classified keys and the encoders are readable in both,
   indoors at night and in daylight. Result: ______
6. Phone: lock and unlock the screen while the loop runs. Write down whether
   it keeps time and what it does. Result: ______
7. Field plugged in: the power warning shows. Request MIDI, grant it, pick the
   port. Record its name (V7) and the note number of the lowest key (V8)
   in the VERIFY log. Play keys: the same keys light as for touch.
   Result: ______
8. Field in **sync**, clock out on: the Field follows the app's tempo. Copy
   the headroom stats (and loopback numbers, if the Field echoes clock) into
   **MIDI clock out** below. Result: ______
9. Firefox desktop: the loop plays and keys light. Accept the MIDI add-on
   prompt, pick the Field's port, and see its notes light. Copy the clock
   readout into **Clock readout** next to the phone's. Result: ______
10. Firefox for Android: the loop plays, touch lights keys, and the MIDI panel
    shows `web midi isn't available in this browser`. Result: ______
11. Decision 7: compare the gap with `outputLatency + baseLatency` on the
    phone and write down whether `getOutputTimestamp` already includes output
    latency. If it does, the fix to `audibleAt` is a spine request for
    Phase 2 pre-work, not a guess. Result: ______
12. Every VERIFY item above that moved is updated in the VERIFY log.
    Result: ______
