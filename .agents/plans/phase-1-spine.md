# Phase 1 — the spine

Builds SPEC §6.1: everything the Phase 2 lanes import, plus `/dev/spine`, the
smoke page the owner runs on the phone and the Field. Written 2026-10-22.

| Row | Name | Status | Commit |
| --- | --- | --- | --- |
| 1 | Scaffold (**attended**) | **Next** | |
| 2 | Types | | |
| 3 | Theory | | |
| 4 | Clock and transport | | |
| 5 | Backing synth | | |
| 6 | Input and MIDI | | |
| 7 | State | | |
| 8 | UI primitives and registry | | |
| 9 | `/dev/spine` | | |
| 10 | Fan-out docs | | |
| 11 | Exit gate (**attended**) | | |

### Carried forward

### Process notes

## How this plan runs

- **Row 1 is attended.** The owner runs it with `/step` on `main`: it's the
  first `npm install`, and `/run-steps` won't start until `npm run check`
  exists and passes.
- **Rows 2–10 are for `/run-steps`**, one fresh subagent per row, in order,
  on the `phase-1-spine` branch. SPEC §6.1 asks for one agent in one session;
  this plan replaces that with one row per subagent, and Carried forward and
  the handoffs carry the context between rows.
- **Row 11 is attended**, after `/retro` and after the owner merges the plan
  branch into `main`.
- Nothing in this plan starts a module other than `dev-spine` (SPEC §6.1).

## Decisions this plan makes

These override SPEC where they differ. Each one is technical; creative calls
are under [The owner's calls](#the-owners-calls).

1. **Tone's swing stays at 0; the spine applies swing itself.** Tone's
   `_processTick` moves *every* event on a swung tick, `scheduleRepeat`
   callbacks included, so Tone swing would swing the MIDI clock and break
   SPEC §3.2's "MIDI clock pulses are unswung". `swing` (0..1) delays each
   off-beat sixteenth by `swing / 3` of a sixteenth: 0 is straight (50 %),
   1 is triplet (66.7 %). At 90 BPM a sixteenth is 166.7 ms, so swing 0.5
   delays the off-beat 16ths by 27.8 ms and lands them at 58.3 %, inside the
   54–62 % that SPEC §4.2 B4 targets. `BeatEvent.audioTime` is the straight
   grid time; `swingOffsetSec()` gives the delay for whoever wants it.
2. **Tempo changes are anchored.** A BPM change while running is applied at
   the next beat boundary, and the transport records an anchor `{ audioTime,
   absTick, bpm }` there. Every tick ↔ audio-time conversion goes through the
   anchors. Ticks count up across loop iterations (`absTick`); in-loop ticks
   are `absTick % loopTicks`. PPQ is Tone's 192 (SPEC §3.2).
3. **Roman numerals are degrees of the key's mode**, so F minor's sixth chord
   is `VI` (D♭), as in the SPEC §5.3 fixture `ii°–V7–i–VI`. `b`/`#` move that
   degree a semitone. Case sets the triad: upper = major, lower = minor.
   Suffixes: `7` (dominant on upper case, m7 on lower), `maj7` (mMaj7 on lower
   case), `m7`, `ø7` (m7b5), `°` (dim triad), `°7` (dim7), `sus2`, `sus4`, `6`,
   `m6`. An explicit suffix wins over case. `/<degree>` sets a bass note from
   an arabic scale degree of the key (`iv/1` in A minor is D minor over A).
   The grammar is the curriculum lane's contract, so its doc comment carries
   the table.
4. **Degree names are relative to the tonic's major scale**: `1 b2 2 b3 3 4 #4
   5 b6 6 b7 7`, matching SPEC §4.1 A1 ("1, b3, 4, 5, b6, b7…"). So in F
   minor, D♭ is chord `VI` and degree `b6`. Different on purpose; say so in
   both doc comments.
5. **Types gain fields, never change meaning** (SPEC §5.3): `ChordQuality`
   gains `'dim'`; `Chord` gains `bass?: PitchClass`; `TransportEngine` gains
   `onStateChange`; `ModuleDefinition` gains `devOnly?: boolean`.
6. **Classification** (`classify`): chord tones from the quality; every other
   note of the key's scale is a *tension*, unless it is a half step above a
   chord tone, which makes it an *avoid* note. On dominant (`7`) chords, b9
   and b13 are tensions anyway. Notes outside the key's scale that aren't
   chord tones are *outside*. Worked: G7 in C major has tensions A (9) and
   E (13), avoid C (11); C7 in F minor has tensions D♭ (b9), E♭ (#9) and A♭
   (b13), avoid F (11), and B♮ is outside.
7. **Clock domains.** `ClockBridge` follows SPEC §3.1 to the letter
   (`audibleAt = audioToPerf(t + outputLatencySec())`), with one open
   question the exit gate answers: the Web Audio spec defines
   `getOutputTimestamp().contextTime` as the frame *now leaving the output
   device*, which would make `audioToPerf` audible time already and
   `audibleAt` double-count the latency, while the fallback fit
   (`currentTime`, `performance.now()`) is render time. Rows 4 and 9 build
   the readout that settles it; nothing guesses. Calibration absorbs any
   constant error per source in the meantime.
8. **MIDI clock jitter.** Web MIDI can't report when a message actually left.
   `/dev/spine` logs *headroom* (intended send time − `performance.now()` at
   the `send` call; negative means late) always, and true jitter only when a
   loopback is present (clock out comes back on the selected input). SPEC
   §8.5's 3 ms p95 applies to the loopback number.
9. **Routing is hand-rolled** on the History API, with paths relative to
   Vite's `base`. The build copies `dist/index.html` to `dist/404.html` so a
   deep link like `/op-1-school/dev/spine?dev` loads on GitHub Pages; the
   service worker's navigate fallback covers it offline. `?dev` survives
   in-app navigation.
10. **One dependency beyond SPEC §5.1**: `@types/node` (types only, no
    runtime code; the owner approved it on 2026-10-22). `vite.config.ts` and
    row 8's import-rule test use `node:fs`, and `tsc` fails without it. `idb`
    is named in SPEC §5.1. Nothing else. No jsdom or happy-dom: tests run in Vitest's node environment, so
    UI logic that needs a test lives in a pure `.ts` file next to its
    component. No `fake-indexeddb`: `db.ts`'s upgrade function is tested
    against a recording fake, and the IndexedDB round trip is a browser check
    on `/dev/spine`.
11. **Test files never import `tone`.** Pure maths lives in files that don't
    import it (`timing.ts`, `Clock.ts`, `voicing.ts`, `drumPatterns.ts`); the
    Tone wrappers stay thin and are checked on `/dev/spine`.
12. **Conventions go in `AGENTS.md`.** SPEC §6.1 asks the scaffold to write
    them into `CLAUDE.md`; here `CLAUDE.md` stays a one-line `@AGENTS.md`
    import, and the scaffold adds `npm run check` and the dev server to
    `AGENTS.md`'s **Repo conventions**.
13. **`KeyEstimate` is a stub here.** Modules 2 and 4 both consume it and fan
    out together in Phase 4, so the Phase 4 plan's first row builds it in the
    spine before they start. Row 6 leaves the interface and a stub.
14. **Firefox gets the same code path.** The owner uses Firefox where it
    works. Firefox desktop (108+) has Web MIDI behind a one-time
    site-permission add-on prompt; Firefox for Android has no Web MIDI, so
    the phone in Firefox gets the unplugged path and the "not available"
    copy. Nothing branches on the browser: no `requestMIDIAccess` means
    `unsupported`, a refused prompt means `denied`. Dev checks run in the
    Chromium browser pane; row 11 adds the owner's Firefox checks.

## The owner's calls

### Settled (2026-10-22)

- **Copy**, all lowercase, as written: nav title `op-1-school`; home `modules arrive in
  phase 2`; unknown route `no page here`; audio start button `tap to start
  audio`; suspended context `audio paused, tap to resume`; Firefox
  `web midi isn't available in this browser`; denied `midi permission
  denied`; no port `no midi`; calibration `✓` / `needs calibration`; power
  warning on MIDI connect (SPEC §2.2.3) `the field may charge from this
  phone`; dev module title `dev spine`; module icon a one-character string.
- **Dark mode is the default, with a toggle to light.** Every colour token
  has a dark and a light value; first load with nothing stored is dark,
  whatever the OS prefers. The choice persists in settings.
- **PWA icon**: `public/icon.svg` (already in the repo), an OP-1-style body
  with the four encoders and a one-octave keyboard from F. The manifest uses
  it with `sizes: "any"`, purpose `any` (not maskable: the keys reach the
  corners).

### Placeholders

Every row uses these as written, marked `placeholder` in a comment, until the
owner decides. The `/run-steps` pre-flight asks about them.

- **Palette** in `tokens.css`: the four TE encoder colours (blue, ochre, gray,
  orange) as plain mid-tone hexes, plus background and text, in a dark and a
  light set. The encoder and classification colours may differ between the
  two sets to keep their contrast.
- **Note classification on `Keyboard24`**, which must not differ by hue
  alone: chord tone = blue, solid fill; tension = cyan, outline; avoid =
  yellow, striped; outside = red, with a ×. Unclassified lit keys are gray.
- **Backing pattern** for `chillhop-rhodes`, one bar of 16 steps: kick on
  0, 7, 10; snare on 4, 12; closed hat on every even step. Bass plays
  `chord.bass ?? chord.root` at each slot start, held to one sixteenth before
  the next slot. Chords are held for the whole slot.
- **Theme toggle**: a button at the end of the nav labelled `light` in dark
  mode and `dark` in light mode (it names what you'd switch to). The dark
  palette is near-black background, light gray text; the light palette is
  the TE-style light gray body from the icon, dark text.
- **Theme colour** in the manifest: the dark placeholder background. The icon's
  encoder hexes match the placeholder encoder colours; if the owner changes
  those, the icon follows.

## Rows

Each row's **Owns** is the paths it creates or edits, beyond the plan's
status table, Carried forward and the docs `/step` says to update. All rows:
`npm run check` exits 0 and `git -c core.autocrlf=false diff --check` is
clean. Greps use `git grep -n --untracked <pattern> -- . ':!.agents'`.

### 1. Scaffold (attended)

Owns: `package.json`, `package-lock.json`, `tsconfig*.json`,
`vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.tsx`,
`src/App.tsx`, `src/index.css`, `.github/workflows/deploy-pages.yml`, `.claude/launch.json`,
`docs/HARDWARE_NOTES.md`, `AGENTS.md`.

- Install the SPEC §5.1 packages at their latest version the committed
  `.npmrc` allows: `vite`, `react`, `react-dom`, `typescript`,
  `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`,
  `vite-plugin-pwa`, `tone`, `idb`, `tailwindcss`, `@tailwindcss/vite`,
  `vitest`, and `@types/node` (decision 10). Nothing else. If one fails without its install script, stop and ask the
  owner.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
- Scripts: `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`, every
  project), `test` (`vitest run`), and `check` = typecheck, test, build, in
  that order.
- `vite.config.ts`: `base: '/op-1-school/'`; React, Tailwind and PWA plugins;
  a small inline plugin that copies `dist/index.html` to `dist/404.html` after
  the build (decision 9). PWA: manifest generated by the plugin (not
  `public/manifest.webmanifest`), name `op-1-school`, `display: standalone`,
  `public/icon.svg`; precache the app shell; `navigateFallback` to
  `index.html`. Dev server on port 5173, `strictPort`.
- `vitest.config.ts`: `environment: 'node'`, tests in
  `src/**/__tests__/**/*.test.ts`. One trivial test so `vitest run` has
  something to pass; row 2 replaces it.
- `src/App.tsx`: one placeholder line, `op-1-school`. Tailwind imported once
  from `src/index.css`.
- `deploy-pages.yml`: on pull requests and pushes to `main`, `npm ci` and
  `npm run check` on Node 24; on pushes to `main` only, upload `dist/` and
  deploy to Pages. Only first-party `actions/*` actions, each pinned to a full
  commit SHA with its version in a comment.
- `.claude/launch.json`: one configuration, `npm run dev`, port 5173. A
  localhost `url` must be the origin only, so the base path is navigated to
  after the server opens.
- `docs/HARDWARE_NOTES.md`, seeded from SPEC §2: **Verified** (§2.1, as a
  list), **Android USB-C** (§2.2), **VERIFY log** (a table: id, item, SPEC
  section, status `open` / `stubbed` / `resolved`, where it's stubbed,
  result), seeded with §8.1–8.6 plus *the Field's MIDI input port name*,
  *the MIDI note number of the Field's lowest key at the default octave*, and
  **Platform measurements** (the decision 7 and decision 8 readouts, empty).
- `AGENTS.md`: **Repo conventions** gains `npm run check`, the dev server and
  its URL, and the `404.html` copy; **Where we are** loses "nothing is
  scaffolded".

Done when:

- [ ] `npm ci` installs from the lockfile with `ignore-scripts` still on, and
      `git diff -- .npmrc` is empty.
- [ ] `npm run check` exits 0.
- [ ] `npm run build` leaves `dist/index.html`, `dist/404.html` (byte-equal),
      a manifest and a service worker in `dist/`.
- [ ] With the dev server from `.claude/launch.json` running,
      `http://localhost:5173/op-1-school/` shows `op-1-school` and the console
      has no errors.
- [ ] `package.json` lists exactly the 14 packages above.
- [ ] OWNER: GitHub repo **Settings → Pages → Source** is "GitHub Actions"
      (needed before row 11's push; optional now).

### 2. Types

Model: Opus 5.5. Owns: `src/types/`.

- `music.ts`: SPEC §5.3 as written, plus decision 5 (`'dim'`, `bass?`).
- `lessons.ts`: `VectorId` (`'A'|'B'|'C'|'D'`); `Lesson { id, vector, level,
  title, minutes, scored, steps }`; `LessonStep`, a union of `{ kind: 'card',
  title, body }` (markdown body) and `{ kind: 'drill', module: ModuleId,
  mode, minutes, progressionId?, params? }`; `ProgressionSpec`, the JSON form
  of `Progression` with `slots: { roman, beats }[]` instead of chords;
  `SequencerRecipe { id, title, sequencer, steps: string[] }`. Each type
  gets a validator returning a list of error strings (empty = valid):
  `validateLesson`, `validateProgressionSpec`, `validateSequencerRecipe`.
  They check shape only; row 3's `loadProgression` checks the numerals.
- `modules.ts`: `ModuleId` (`progression-trainer`, `sample-flip`,
  `pocket-dojo`, `kit-compiler`, `runner`, `dev-spine`) and
  `ModuleDefinition` (SPEC §5.5 plus `devOnly?`). Type-only React imports.
- `errors.ts`: `NotImplementedError`, naming the row or phase that replaces
  the stub.
- Replaces row 1's trivial test.

Done when:

- [ ] Vitest: each validator accepts one valid fixture and rejects, with a
      message naming the field, a missing `id`, a wrong `vector`, an empty
      `steps`, a drill step with an unknown `module`, and a slot with
      `beats: 0`.
- [ ] `git grep -n --untracked "from '\.\./" -- src/types` finds nothing:
      types import nothing from the rest of `src/`.

### 3. Theory

Model: Opus 5.5. Owns: `src/theory/`. Read SPEC §4.1 and §5.3.

- `pitch.ts`, `scales.ts` (seven modes as interval sets; `pentatonic(key)`
  is minor pentatonic `0 3 5 7 10` when the mode has a minor third, else
  major `0 2 4 7 9`), `chords.ts` (`chordTones`, `availableTensions`,
  `avoidNotes`, `classify` per decision 6, `guideTones`, `commonTones`,
  `voiceLead`), `progressions.ts` (`degreeName` per decision 4, `realize`
  per decision 3, `loadProgression(spec): Progression`).
- `guideTones`: third and seventh. Chords without a seventh use the sixth
  for `6`/`m6` and the fifth otherwise; `sus2`/`sus4` use the 2nd/4th as the
  third.
- `voiceLead(a, b)`: each chord tone of `a`, in order root-3rd-5th-7th, moves
  to the nearest chord tone of `b` (semitones in −6..+6); a tie goes down.
  Dm7 → G7 gives D→D 0, F→F 0, A→G −2, C→B −1.
- `loadProgression` throws, naming the slot, on a numeral it can't parse or
  when the slots' beats don't sum to `bars × 4`.

Done when:

- [ ] Vitest fixtures in `src/theory/__tests__` assert pitch-class sets (not
      names) for SPEC §5.3's four: F minor `ii°–V7–i–VI` = {7,10,1},
      {0,4,7,10}, {5,8,0}, {1,5,8}; G dorian `i–IV` = {7,10,2}, {0,4,7};
      C major `I–V–vi–IV` = {0,4,7}, {7,11,2}, {9,0,4}, {5,9,0}; A minor
      pedal `i–iv/1–VII/1–i` = {9,0,4}, {2,5,9} bass 9, {7,11,2} bass 9,
      {9,0,4}.
- [ ] Vitest: `classify` over all 12 pitch classes for G7 in C major and C7
      in F minor matches decision 6's worked lists, and Cmaj7 in C major
      gives F as avoid.
- [ ] Vitest: `degreeName` of D♭ in F minor is `b6`; F♯ in C major is `#4`.
- [ ] Vitest: `realize` covers every suffix in decision 3, both cases, and
      `bVII` in C major = B♭ major; `loadProgression` throws on `xii` and on
      beats summing to 15 for 4 bars.
- [ ] Vitest: the Dm7 → G7 `voiceLead` example, and `commonTones(Fm7, B♭m7)`
      = {5, 8} (SPEC §4.1 A4).

### 4. Clock and transport

Model: Opus 5.5. Owns: `src/audio/Clock.ts`, `src/audio/timing.ts`,
`src/audio/TransportEngine.ts`, `src/audio/__tests__/`. Read all of SPEC §3.

- `Clock.ts`: `ClockBridge` as SPEC §3.1, constructed from Tone's raw
  `AudioContext` (`Tone.getContext().rawContext`) but typed against a small
  interface so tests pass a fake. `getOutputTimestamp` missing, or returning
  zeros (it does before the context runs), uses the fallback linear fit over
  the last 20 `(currentTime, performance.now())` pairs. A refresh while the
  context is suspended keeps the last good correlation. `offsetMs(perfTs,
  tAudio, clock, calibrationMs?)` implements SPEC §3.3; it also reports
  whether calibration was applied, for `TimingOffset.calibrated`.
  `snapshot()` returns the decision 7 readout: `currentTime`,
  `outputTimestamp.contextTime`, their gap in ms, `outputLatency`,
  `baseLatency`, and which path is active.
- `timing.ts`, pure: seconds per tick, the anchor list (decision 2),
  `audioTimeOfAbsTick`, `absTickOfAudioTime`, bar/beat/sixteenth from a tick,
  MIDI pulse ticks (every 8), `swingOffsetSec(sixteenthIndex, swing, bpm)`
  (decision 1).
- `TransportEngine.ts`: SPEC §3.2 over `Tone.getTransport()`, Tone swing 0,
  loop of `bars` bars, `onStateChange(cb({ state, audioTime }))`. Wraps
  `navigator.wakeLock` while running (re-acquired on `visibilitychange`,
  failures ignored). Validation: BPM 30–300, swing 0–1, bars ≥ 1, `timeSig`
  `[n, 4]` only; anything else throws `RangeError`. `start()` before audio is
  initialised throws an error saying so; `stop()` when stopped does nothing.
  Context setup (in the same file): `latencyHint: 'interactive'`,
  `lookAhead: 0.1`, worker ticker.

Done when:

- [ ] Vitest, SPEC §3.3 worked number: fake correlation `audioToPerf(t) =
      5000 + 1000·t` ms, output latency 40 ms, no calibration; a snare
      scheduled at 10.000 s and played at perf 15062 (62 ms after its
      scheduled time) reads **+22 ms**; with touch calibration 15 ms it reads
      **+7 ms** and `calibrated` is true.
- [ ] Vitest: the fallback fit over 20 pairs with ±1 ms noise recovers a
      slope within 0.5 % of 1000 ms/s.
- [ ] Vitest: at 90 BPM a sixteenth is 166.7 ms; `swingOffsetSec` at swing
      0.5 is 27.8 ms (±0.1) on odd sixteenths and 0 on even ones.
- [ ] Vitest: start at 2.0 s, 120 BPM, BPM → 90 at the bar-2 downbeat (tick
      768, 4.0 s): tick 960 maps to 4.667 s and back to 960.
- [ ] Vitest: at 120 BPM, 4 beats hold 96 pulse ticks (0, 8, …, 760), the
      last at 1.979 s after start, none moved by swing.
- [ ] `git grep -n --untracked "from 'tone'" -- src/audio/Clock.ts
      src/audio/timing.ts src/audio/__tests__` finds nothing (decision 11).

Nothing here makes sound yet; the audible checks are row 9's.

### 5. Backing synth

Model: Opus 5.5. Owns: `src/audio/VirtualPushSynth.ts`,
`src/audio/voicing.ts`, `src/audio/drumPatterns.ts`, their tests.

- SPEC §5.3's interface and sound sources. `chillhop-rhodes` is the only
  pattern (see Placeholders); other `StyleId`s fall back to it with one
  console warning per style. Adding their data later is a spine change.
- `voicing.ts`, pure: bass note = `chord.bass ?? chord.root` in MIDI 40–51
  (E2–D♯3; phone speakers can't carry lower); chord voicing = chord tones in
  close position upward from MIDI 52 (E3), so the lowest note heard is always
  the bass. Swing per decision 1 on off-beat sixteenths.
- `load(p)` throws when `p.bars` doesn't match the transport's configured
  bars, naming both. The caller configures the transport from the
  progression (`transportConfigFor(p)`, exported here).
- `setMask` takes effect from the next scheduled sixteenth. All parts masked
  is silence with the transport still running. `dispose` twice is safe.
- `currentSlot` and `chordChangeTimes` use the transport's tick ↔ audio-time
  maps, so they stay right across BPM changes.

Done when:

- [ ] Vitest: for the four row-3 fixtures, every voiced note is ≥ 52 and
      every bass note is in 40–51 and below the voicing; the voicing's pitch
      classes equal `chordTones`.
- [ ] Vitest: slot lookup on F minor `ii°–V7–i–VI`, one bar per chord at 90
      BPM: tick 0 → slot 0, tick 767 → slot 0, tick 768 → slot 1; the slot
      start ticks are 0, 768, 1536, 2304.
- [ ] Vitest: the drum pattern data has 16 steps and the placeholder hits
      above.

The `[ear]` checks for the synth are row 9's.

### 6. Input and MIDI

Model: Opus 5.5. Owns: `src/input/`, `src/audio/PitchWorklet.ts`,
`src/audio/KeyEstimate.ts`. Read SPEC §2.2, §3.4, §3.5, §5.3.

- `NoteInput.ts`: `NoteBus` per SPEC §5.3. `active()` lists started sources.
  A throwing subscriber doesn't stop the others.
- `TouchInput.ts`: a `NoteInputSource` with `press(note, perfTs)` and
  `release(note, perfTs)`, called by `Keyboard24` (row 8) with the pointer
  event's `timeStamp`. Velocity 1.
- `MidiBridge.ts`: SPEC §5.3. `requestAccess` returns `unsupported` without
  `navigator.requestMIDIAccess` (Firefox) and `denied` when it rejects; no
  sysex. Notes from any channel; note-on velocity 0 is an `off`; velocity is
  `v / 127`; `perfTs` is the event's `timeStamp`. Port selection persists by
  id and name through an injected `PortMemory` (`load()`, `save()`); row 8
  wires it to settings. On access, the remembered port is reselected by id,
  then by name; no port is picked by guessing its name (the Field's port name is a VERIFY
  item). On disconnect of the selected input: an `off` for every held note at
  `performance.now()`, selection cleared, `onConnectionChange` fires.
- Clock out, SPEC §3.4: on transport start, `0xF2 0x00 0x00` then `0xFA`,
  both stamped `audioToPerf` of tick 0, then the tick-0 pulse; each pulse
  `0xF8` at `audioToPerf(audioTime)`; on stop, `0xFC` with no timestamp.
  Pulses only while running. If the output disconnects, clock out turns off
  quietly. Pulses already handed to Web MIDI can't be recalled: up to one
  lookahead (≈100 ms) of `0xF8` may follow `0xFC`. Record that in the
  handoff. Each send records its headroom (decision 8) for row 9.
- `ExternalClockFollower`, SPEC §3.5: BPM from the median of the last 48
  inter-pulse intervals, smoothed with α = 0.2; confidence = share of those
  intervals within ±5 % of the median, 0 until 24 intervals exist;
  `phasePerfMs` = the last pulse whose count since `0xFA` is a multiple of 24.
- `__fakes__/FakeMidiPort.ts` (records `[data, timestamp]`, can emit input)
  and a fake transport and fake `ClockBridge` for the tests.
- Stubs that compile and throw `NotImplementedError`: `MicInput.ts` and
  `PitchWorklet.ts` (Phase 3's Module 3 lane owns both by name),
  `KeyEstimate.ts` with `estimateKey(chroma)` and `chromagram(samples,
  sampleRate)` signatures (the Phase 4 plan's first row, decision 13).

Done when:

- [ ] Vitest: with `FakeMidiPort` and a fake transport at 120 BPM, 4 beats
      schedule 96 `0xF8`, each within 0.5 ms of `audioToPerf` of its tick and
      20.833 ms apart; the first three messages are `F2 00 00`, `FA`, `F8`
      with equal timestamps; `FC` follows stop and no `F8` is sent after it.
- [ ] Vitest: swing 0.5 on the fake transport leaves every pulse timestamp
      unchanged.
- [ ] Vitest: note-on velocity 0 on channel 10 arrives as an `off`; velocity
      64 arrives as 0.504; unplugging the selected input with two held notes
      emits two `off`s.
- [ ] Vitest: `requestAccess` returns `unsupported` with no
      `requestMIDIAccess` and `denied` when it rejects.
- [ ] Vitest: the follower, fed pulses 25 ms apart (100 BPM), reports 100.0
      ±0.1 BPM with confidence ≥ 0.95; one doubled interval (a dropped pulse)
      moves it less than 0.1 BPM; with 10 pulses its confidence is 0.
- [ ] Vitest: calling each stub throws `NotImplementedError`.

The `[field]` checks for MIDI are row 11's.

### 7. State

Model: Sonnet 5.5. Owns: `src/state/`. Read SPEC §5.3 `db.ts`.

- `db.ts` with `idb`: `DB_VERSION = 1`; stores `sessions` (key `id`, index on
  `lessonId`), `attempts` (key `id`, index on `sessionId`), `samples` (key
  `id`), `kits` (key `id`), `calibration` (key `[source, device]`). Record
  types live here. The upgrade function is a switch on `oldVersion` that
  falls through, exported so tests can run it on a recording fake. Opening
  rejects with a readable error when IndexedDB is unavailable.
- Export/import: one JSON envelope `{ app: 'op-1-school', dbVersion,
  exportedAt, stores }` without `samples` (blobs come later, SPEC §5.3).
  Import rejects a newer `dbVersion` or a wrong `app`, naming which.
- `settings.ts`: typed, versioned, in `localStorage` under one key,
  `op-1-school.settings` (row 8's theme script in `index.html` reads it too). Fields:
  MIDI input and output (`{ id, name }`), `clockOut` (false),
  `keyboardBaseNote` (53, F3; VERIFY: the Field's lowest key), `keyboardOctave`
  (0), `theme` (`'dark'`). Missing or corrupt JSON gives defaults; unknown
  keys are dropped;
  a throwing `localStorage` falls back to memory for the session.
- `calibration.ts`: `CalibrationRecord { source, device, offsetMs, hits,
  measuredAt, outputLatencyMs }`; device is the MIDI input name, `screen` for
  touch, `default` for mic (placeholder). `computeCalibration(offsets)` = the
  median, and refuses fewer than 16 hits (SPEC §3.3). Get, put, list. The
  calibration *routine* is Module 3's (SPEC §5.5).

Done when:

- [ ] Vitest: the upgrade function from version 0 creates all five stores
      with the key paths and indexes above.
- [ ] Vitest: an export envelope round-trips through import validation;
      `dbVersion: 2` and `app: 'other'` are rejected with messages naming the
      field.
- [ ] Vitest: settings with no stored value, with `{not json`, and with a
      throwing storage all return the defaults (`theme` is `'dark'`); an
      unknown key is dropped on save.
- [ ] Vitest: `computeCalibration` of 16 offsets with two outliers returns
      their median; 15 offsets throws.

### 8. UI primitives and registry

Model: Sonnet 5.5. Owns: `src/ui/`, `src/modules/registry.ts`,
`src/modules/__tests__/`, `src/App.tsx`, `src/main.tsx`, `src/index.css`,
`index.html`. Read SPEC §5.4 and §5.5.

- `tokens.css`: the placeholder palette as Tailwind v4 theme variables,
  including the four encoder colours and the classification colours, with a
  dark and a light set. The theme is a `dark` class on `<html>`, wired to
  Tailwind's `dark:` variant with `@custom-variant`; components use the
  tokens, so few need `dark:` at all.
- Theme: a small inline script in `index.html`, before the module script,
  reads `settings.theme` from `localStorage` and sets the class, so a light
  user never sees a dark flash and vice versa. Missing or unreadable
  settings mean dark. `<meta name="color-scheme">` follows the class so
  native controls and scrollbars match. The toggle (see Placeholders) sits
  at the end of the nav and saves through `settings.ts`.
- `registry.ts`: `import.meta.glob('./*/module.ts', { eager: true })` →
  `ModuleDefinition[]`, sorted by `phase` then `id`.
- `spine.tsx`: `SpineProvider` and `useSpine()`, holding one each of
  `ClockBridge`, `TransportEngine`, `NoteBus`, `MidiBridge`, `TouchInput`,
  settings, with `MidiBridge`'s `PortMemory` wired to settings. Audio
  initialises only from a tap (`Tone.start()`), then refreshes the clock
  every 250 ms. A suspended or interrupted context shows the
  placeholder resume button.
- `AppShell.tsx` with the decision 9 router: bottom nav under 700 px wide,
  side nav from 700 px; routes from the registry; `devOnly` modules hidden
  unless `?dev`; unknown routes show the placeholder.
- `Keyboard24.tsx` with its layout in `keyboardLayout.ts` (pure): 24 keys from
  `keyboardBaseNote`; under 700 px wide, one octave with an octave toggle so
  keys stay ≥ 40 px; notes outside the range light their octave-equivalent
  key and are counted for the log. Lights from `NoteBus`; pointer events go
  to `TouchInput` (one pointer per key, released on `pointerup` or
  `pointercancel`). With a `chord` and `key` prop, lit keys use the
  placeholder classification marks.
- `StatusBar.tsx`: BPM, clock mode (`internal` / `clock out` / `follow`), MIDI
  port or `no midi`, active input sources, calibration state.
- `Encoder.tsx` with `encoderMath.ts` (pure): vertical drag sets a 0..1 value,
  clamped; one of the four colours.
- A test that reads every file under `src/` and fails when a module imports
  another module's directory, or a spine directory imports from
  `src/modules` (only `src/ui/AppShell.tsx` may import `registry.ts`). This
  enforces the import rule from here on.

Done when:

- [ ] Vitest: `keyboardLayout` at 360 px wide shows 12 keys ≥ 40 px and the
      toggle; at 800 px, 24 keys; note 53 maps to key 0, note 76 to key 23,
      note 41 lights key 0 and counts as out of range.
- [ ] Vitest: `encoderMath` clamps at 0 and 1.
- [ ] Vitest: the import-rule test passes, and fails on a scratch file the
      test writes to a temp tree (so it can fail at all).
- [ ] Browser, dev server: `/op-1-school/` shows the nav and the home
      placeholder; `/op-1-school/nope` shows `no page here`; no console
      errors. (No module is registered yet, so the dev route arrives in
      row 9.)
- [ ] Browser, with `localStorage` cleared: `<html>` has the `dark` class on
      first load. Clicking `light` removes it, the page background changes,
      and a reload keeps light. Clicking `dark` restores it.
- [ ] Browser: `index.html`'s theme script appears before the module script,
      and with the setting stored as light, `document.documentElement`
      lacks `dark` when the first module script runs (log it from
      `main.tsx` once, then remove the log).

### 9. `/dev/spine`

Model: Opus 5.5. Owns: `src/modules/dev-spine/`. Read SPEC §3, §6.1 item 8.

- `module.ts`: `id: 'dev-spine'`, `route: '/dev/spine'`, `devOnly: true`,
  phase 1, the placeholder title.
- The page, top to bottom: start-audio button; transport (start/stop, BPM and
  swing on `Encoder`s, mask toggles for drums/bass/chords) playing F minor
  `ii°–V7–i–VI` at 90 BPM, swing 0.5, as a `ProgressionSpec` in this module;
  current chord and roman numeral; `Keyboard24` lit from touch and MIDI and
  classified against the current chord; MIDI panel (access state, port
  pickers, clock-out toggle, follow toggle showing the follower's BPM and
  confidence; follow sets the transport BPM when confidence ≥ 0.8, at most
  once a beat; clock out and follow are mutually exclusive); clock readout
  (decision 7's `snapshot()`, refreshed every 250 ms); MIDI timing (decision
  8: headroom min / p5 / p50 and late count over the last 1000 pulses;
  loopback |error| p50 / p95 when `0xF8` comes back on the input, else
  `no loopback`); a database panel (DB version, store names, a write-then-read
  button on `attempts`, or the open error); a scrolling log of raw
  `NoteEvent`s (source, note, velocity, `perfTs`) capped at 200 lines.
- The SPEC §2.2.3 power warning shows when a MIDI input connects.

Done when:

- [ ] Browser, dev server: `/op-1-school/dev/spine` without `?dev` shows
      `no page here` and no nav entry; with `?dev` it shows every panel above.
- [ ] Browser: after clicking the start-audio button and start, the clock
      readout shows a non-zero `currentTime` that advances, the current chord
      steps through Gdim, C7, Fm, D♭ (one per bar), and the console has no
      errors.
- [ ] Browser: a scripted `pointerdown`/`pointerup` on the lowest key logs a
      touch `on` and `off` for note 53, and the key lights while down.
- [ ] Browser: with no MIDI ports, or MIDI permission refused, the MIDI panel
      shows `no midi` or `midi permission denied` and the follow and
      clock-out toggles are disabled.
- [ ] Browser: the database write-then-read button reports success.
- [ ] `[ear]` desktop: the loop plays without clicks; off-beat hats audibly
      lag at swing 0.5 and sit straight at 0; masking bass leaves drums and
      chords.

The `[phone]` checks are row 11's.

### 10. Fan-out docs

Model: Sonnet 5.5. Owns: `docs/MODULE_CONTRACT.md`, `docs/HARDWARE_NOTES.md`,
`AGENTS.md`.

- `MODULE_CONTRACT.md`, one page: SPEC §5.5's last paragraph; the
  `module.ts` shape; `useSpine()` and what it holds; the import rule and the
  test that enforces it; spine changes go in the report as a request
  (SPEC §6.5); the no-red-vs-green rule; colours come from the theme tokens,
  never raw hexes, so both themes work; placeholders and `Questions for the
  owner`; the roman-numeral grammar and degree names (decisions 3 and 4)
  pointed at by doc comment, not copied.
- `HARDWARE_NOTES.md`: the Phase 3 hardware checklist from SPEC §6.3, and the
  row 11 checks below as numbered steps with blanks for results.
- `AGENTS.md`: the table's `once it exists` qualifiers go; anything rows 2–9
  left in Carried forward that every future agent needs.

Done when:

- [ ] `git grep -n --untracked "once it exists" -- AGENTS.md` finds nothing.
- [ ] Every VERIFY item in Carried forward is a row in the VERIFY log.
- [ ] `MODULE_CONTRACT.md` names every path a module may import from and
      nothing that doesn't exist (each path checked with `git ls-files`).

### 11. Exit gate (attended)

After `/retro` and the owner's merge of `phase-1-spine` into `main`. SPEC
§6.1's exit criteria, run by the owner with `/step`.

Done when:

- [ ] `npm run check` exits 0 on `main`.
- [ ] OWNER: after pushing `main`, the Actions run is green and
      `https://finitezombie.github.io/op-1-school/` serves the shell.
- [ ] `[phone]` `/op-1-school/dev/spine?dev` on the Android phone, opened
      from the Pages URL: tap to start audio, start the loop. Record the clock
      readout (gap, `outputLatency`, `baseLatency`, active path) in
      **Platform measurements**.
- [ ] `[phone]` `[ear]` the loop is swung and click-free; tap keys and see
      them light, with touch events in the log.
- [ ] `[phone]` the app opens dark; switch to light and back. Every panel,
      the keyboard's lit and classified keys, and the encoders are readable
      in both, indoors at night and in daylight.
- [ ] `[phone]` lock and unlock the screen while running: the loop keeps
      time, or what it does is written down.
- [ ] `[field]` plug in the Field: the power warning shows; grant MIDI; pick
      the port; record its name and the note number of the lowest key in the
      VERIFY log; play keys and see the same keys light as touch.
- [ ] `[field]` Field in **sync**, clock out on: the Field follows the app's
      tempo. Record headroom stats (and loopback numbers, if the Field echoes
      clock) in **Platform measurements**.
- [ ] OWNER, Firefox desktop: `/dev/spine?dev` from the Pages URL; the loop
      plays and keys light. Accept the MIDI add-on prompt, pick the Field's
      port, and see its notes light. Record the clock readout in **Platform
      measurements** next to the phone's.
- [ ] `[phone]` Firefox for Android: the loop plays, touch lights keys, and the
      MIDI panel shows `web midi isn't available in this browser`.
- [ ] Decision 7 settled: from the gap vs `outputLatency + baseLatency`,
      write down whether `getOutputTimestamp` already includes output latency
      on this phone. If it does, the fix to `audibleAt` is a spine request
      for Phase 2 pre-work, not a guess.
- [ ] Every VERIFY item the rows hit is in the log with its status, and the
      retro lists them.
