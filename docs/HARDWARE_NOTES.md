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
   Tone runs a worker ticker, and the transport holds a wake lock while running
   and stops when the page is hidden (a locked screen crackles and slows).
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
| V5 | Web MIDI clock jitter on the target phone (p95 ≤ 3 ms, loopback) | §8.5 | resolved | | Loopback jitter p95 1.92 ms over 876 pulses, through the Field's clock echo (Android 10, Chrome 155, 90 BPM, 2026-10-23). The echo adds its own jitter, so the send path is at most that |
| V6 | Whether the Field needs clock pulses before `0xFA` to lock tempo on bar 1 | §8.6 | stubbed | `WebMidiBridge.clockOut` in `src/input/MidiBridge.ts`: as SPEC §3.4, no pulses before `FA` on a transport start. Module 1's A0 stage changes and A4 pair changes stop and restart the transport mid-drill (`src/modules/progression-trainer/drill.ts`), so with clock out on each one sends `FC`, then `F2`/`FA` with no pre-pulses | |
| V7 | The Field's MIDI input port name | §2.1 | stubbed | `WebMidiBridge` in `src/input/MidiBridge.ts`: no port is picked by name; the user picks, and the choice is remembered by id, then name | `OP-1`, manufacturer `Teenage Engineering`, for input and output (Chrome 155, Windows 11, 2026-10-22). The name doesn't say Field, so it can't tell a Field from an original OP-1. On Android 10, Chrome 155: `USB Peripheral Port`, manufacturer `Android`, ids `native:port-in-1` / `native:port-out-1`, listed after other apps' ports (`FlipSampler`, `zerodebug`) (2026-10-23). On Android 10, Chrome 156: `USB device` (2026-10-28). Nothing in either names the Field, so the picker can't label it |
| V8 | MIDI note number of the Field's lowest key at the default octave | §2.1 | resolved | `DEFAULT_SETTINGS.keyboardBaseNote` in `src/state/settings.ts`: 53 (F3) | 53 (F3): the leftmost F at the default octave, pressed alone (2026-10-22). Velocity off sends 127; release sends `80 nn 00` |
| V9 | Tap bias and tolerance per input source (the "on the beat" window) | §3.3 | resolved | `TAP_OFFSETS` and `tapVerdict` in `src/audio/tapWindow.ts` | From **Tap offsets** (Android 10, Chrome 155, 90 BPM, 2026-10-23). The window is centred on the source's median, half-width max(IQR, 20 ms); a calibrated offset centres on 0. Field keys (`midi`): median −5.7, IQR 46.7, `on` from −52.4 to +41.0 ms. Touch: median −29.4, IQR 36.0, `on` from −65.4 to +6.6 ms, measured with the touch voice on (Chrome 156, 2026-10-28); the earlier silent-keys row read −43.2. The pad (silent) shares the `touch` entry: the owner skipped the pad-vs-keys comparison. Mic is unscored |
| V10 | Field operations in the lesson cards: playing the kit's kick key (b1, also V2); loading a kit onto the Field and sampling 10 s of the Push's output (c3); changing tape speed (d0); a brake on M1/M2 (d1); the Element LFO with the G source on Nitro or the filter (d2); per-track panning and master drive (d3); line-in mono/stereo (d5) | §2, §4.2–4.4 | stubbed | `src/curriculum/lessons/{b1,c3,d0,d1,d2,d3,d5}.json` and `docs/CURRICULUM.md`: each card gives the musical idea plus `(field steps: VERIFY)`, no button combo or menu path | |
| V11 | Field operations in the sequencer recipes: opening and entering the finger, endless and tombola sequencers; white-key variations switched with Hold; whether an endless step is a 16th; recording to tape unquantized; muting tombola on a section change | §4.2 | stubbed | `src/curriculum/sequencerRecipes.json` (B6's cards): each step gives the musical idea plus `(field steps: VERIFY)` | |

## Platform measurements

Read off `/dev/spine?dev`. The clock readout settles whether
`getOutputTimestamp().contextTime` already includes output latency; the MIDI
timing panel gives send headroom (intended send time − `performance.now()` at
the `send` call; negative is late) and, with a loopback, true jitter.

### Clock readout

| Device and browser | Active path | `currentTime` − `contextTime` gap (ms) | `outputLatency` (ms) | `baseLatency` (ms) | Date |
| --- | --- | --- | --- | --- | --- |
| Windows 11 laptop, Chrome 155, built-in speakers | `output-timestamp` | 49.8–52.6 | 40.0 | 10.0 | 2026-10-22 |
| Android phone, Chrome, Pages URL, phone speaker | `output-timestamp` | 28.8 | 24.0 | 5.0 | 2026-10-23 |

### Tap offsets

From `/dev/spine`'s **taps** panel: 16 key-downs on the beat with the loop
running, uncalibrated, through the same `offsetMs` the drills use. Positive
is late. The median is the bias levels A0 and A6 must absorb until
calibration (Phase 3); the spread is how wide their "on the beat" window has
to be for a player who is on it. People tap a little ahead of a beat they
hear, so a median can't settle `audibleAt` on its own; the clock readout's
gap does that.

| Device and browser | Input | Median (ms) | Spread, IQR (ms) | Date |
| --- | --- | --- | --- | --- |
| Android 10, Chrome 155, Pages URL, Field attached, 90 BPM swing 0.5 | Field keys (note 53), output-timestamp path | −5.7 | 46.7 (range −41.8 to +39.1) | 2026-10-23 |
| Android 10, Chrome 155, Pages URL, no MIDI, 90 BPM swing 0.5 | touch on `Keyboard24` (silent: no touch synth), output-timestamp path | −43.2 | 46.5 (range −154.2 to +3.8; −154.2 looks like a miss) | 2026-10-23 |
| Android 10, Chrome 156, Pages URL, no MIDI, 90 BPM swing 0.5 | touch on `Keyboard24` with the touch voice on, output-timestamp path | −29.4 | 36.0 (range −86.1 to −0.6) | 2026-10-28 |

### MIDI clock out

| Device and browser | Headroom min / p5 / p50 (ms) | Late sends | Loopback \|error\| p50 / p95 (ms) | Date |
| --- | --- | --- | --- | --- |
| Windows 11 laptop, Chrome 155, Field in sync at 120 BPM (1000 sends) | 81.2 / 92.1 / 119.6 | 0 | 7.51 / 15.30 (the Field echoes clock; includes its echo and Windows MIDI-in delivery) | 2026-10-22 |
| Android 10, Chrome 155, Pages URL, Field in midi sync at 90 BPM (879 sends) | −15.74 / 75.92 / 98.53 | 2 | 3.15 / 5.07, jitter p95 1.92 (876 echoed pulses; includes the Field's echo) | 2026-10-23 |

On that laptop the Field, in **sync**, echoes the app's clock back at
90.01 and 120.04 BPM (20 s and 15 s averages) and its play bpm reads the
app's tempo ±1. The echoed pulses arrive bunched: 12.9–42 ms apart at 90 BPM
(27.8 ms nominal), median 30.1 ms. Song bpm stays at the tape's 110; whether
tape speed follows is checklist item 2 below.

## Phase 3 hardware checklist

From SPEC §6.3. The owner runs it before Module 3 starts, with the Field
plugged into the phone, and writes each result in the blank.

1. Field in **sync** mode, app clock out on: the Field follows the app's tempo.
   Result: yes; `start` starts the Field's tape at the app's tempo (exit
   gate check 8, 2026-10-23).
2. Same setup, tape running: tape speed matches the app's tempo. Result: ______
3. Velocity off (Shift+Tempo): notes arrive at velocity 127. Result: ______
4. Velocity on (soft, then hard): velocity varies. Result: ______
5. The phone doesn't drain over a 30-minute session with the Field attached
   (battery % before and after). Result: ______
6. Audio routing behaves as "Android USB-C" above says: the backing loop
   reaches the Field's USB input, and the phone's own speaker is silent.
   Result: ______

## Exit gate checks (Phase 1, row 12)

The owner runs these from the Pages URL
(`https://finitezombie.github.io/op-1-school/`) after merging `phase-1-spine`
into `main`. The run that built the spine had no MIDI hardware and no phone,
so every blank is open. Page: `/op-1-school/dev/spine?dev`. The `probe`
panel's `copy report` button copies the page's state as text, for pasting
into a chat when a check fails.

1. `npm run check` exits 0 on `main`. Result: exit 0 at `f34df89`, 290 tests
   (2026-10-23).
2. After pushing `main`, the Actions run is green and the Pages URL serves the
   shell. (Settings, Pages, Source must be "GitHub Actions" first.)
   Result: run 39921987353 green, `check` and `deploy`. `/op-1-school/` and
   `/op-1-school/dev/spine` both return the shell (the deep link through
   `404.html`, HTTP status 404). Seen with curl, not yet in a browser
   (2026-10-23).
3. Phone, Chrome: open the page from the Pages URL, tap `tap to start audio`,
   press `start`. Read the clock panel and copy gap, `outputLatency`,
   `baseLatency` and the active path into **Clock readout** below.
   Result: in **Clock readout**: gap 28.8 ms, `output-timestamp` (2026-10-23).
4. Phone, by ear: the loop is swung (off-beat hats lag at swing 0.5, straight
   at 0) and has no clicks. Tap keys: they light, and the log shows touch `on`
   and `off` events. Result: swing audible, no clicks with the screen on;
   tapped keys light and log events (they make no sound: Phase 1 has no
   touch synth). After a fresh load, with the Field plugged in, the first
   `start` was sometimes silent while the chord readout stepped; later
   tries didn't reproduce it (2026-10-23).
5. Phone: the app opens dark. Switch to light and back. Every panel, the
   keyboard's lit and classified keys and the encoders are readable in both,
   indoors at night and in daylight. Result: the toggle works both ways
   (2026-10-23).
6. Phone: lock and unlock the screen while the loop runs. Write down whether
   it keeps time and what it does. Result: it doesn't keep time: with the
   screen locked the loop crackles a lot and slows down (2026-10-23).
7. Field plugged in: the power warning shows. Request MIDI, grant it, pick the
   port. Record its name (V7) and the note number of the lowest key (V8)
   in the VERIFY log. Play keys: the same keys light as for touch.
   Result: the power warning shows; the port is `USB Peripheral Port` (V7);
   Field keys light the same keys as touch (2026-10-23). The phone also lists
   other apps' MIDI ports, and the first try failed with one of those picked.
8. Field in **sync**, clock out on: the Field follows the app's tempo. Copy
   the headroom stats (and loopback numbers, if the Field echoes clock) into
   **MIDI clock out** below. Result: `start` starts the Field's tape at the
   app's tempo, and the Field echoes the clock (in **MIDI clock out**). The
   Field also sends `FB` (continue) and `FC` with the same timestamp, which
   the app never sends (2026-10-23).
9. Firefox desktop: the loop plays and keys light. Accept the MIDI add-on
   prompt, pick the Field's port, and see its notes light. Copy the clock
   readout into **Clock readout** next to the phone's. Result: the app shows
   for a moment, then the page goes blank. Not diagnosed: the owner sticks to
   Chrome for this app (2026-10-23).
10. Firefox for Android: the loop plays, touch lights keys, and the MIDI panel
    shows `web midi isn't available in this browser`. Result: blank page,
    as on desktop (2026-10-23).
11. Decision 7: compare the gap with `outputLatency + baseLatency` on the
    phone and write down whether `getOutputTimestamp` already includes output
    latency. If it does, the fix to `audibleAt` is a spine request for
    Phase 2 pre-work, not a guess. Result: it does. The gap is
    `outputLatency + baseLatency` within 0.2 ms on the phone (28.8 vs 29.0)
    and within 2.6 ms on the laptop (49.8–52.6 vs 50), so `contextTime` is
    the frame leaving the device and `audioToPerf` is already audible time on
    the `output-timestamp` path. `audibleAt` adds `outputLatency` again: 24 ms
    too late on this phone, 40 ms on the laptop. Spine request for Phase 2
    pre-work (2026-10-23), landed: `audibleAt` adds latency on the fit path only.
12. The Field sending clock, the app's clock out off, `follow` on: the
    follower reads the Field's tempo within 0.5 BPM with confidence ≥ 0.8,
    and the transport BPM follows it (the `bpm` encoder is greyed out).
    Result: the follower reads the Field's tempo and tracks changes to it,
    with the Field's tempo on **beat match** and the tape stopped: the Field
    sends clock from the tempo screen alone. In **midi sync** it sends no
    clock of its own, only an echo of what it receives. Report: follower
    75.0 BPM at confidence 0.99, transport BPM 74.99, probe clock rate 75.01
    over 2531 pulses (2026-10-23).
13. Every VERIFY item above that moved is updated in the VERIFY log.
    Result: V5 resolved and V7 has the Android name (2026-10-23). V3 and V6
    stay stubbed: no drain measurement yet, and bar-1 lock wasn't watched.
