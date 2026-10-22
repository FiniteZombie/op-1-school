# Phase 1 — the spine

Builds SPEC §6.1: everything the Phase 2 lanes import, plus `/dev/spine`, the
smoke page the owner runs on the phone and the Field. Written 2026-10-22.

| Row | Name | Status | Commit |
| --- | --- | --- | --- |
| 1 | Scaffold (**attended**) | done 2026-10-22 | 92ea236 |
| 2 | Types | done 2026-10-22 | e9ff2eb |
| 3 | Theory | done 2026-10-22 | 88aa382 |
| 4 | Clock and transport | done 2026-10-22 | da45254 |
| 5 | Backing synth | done 2026-10-22 | b82c7ca |
| 6 | Input and MIDI | done 2026-10-22 | 4a067d9 |
| 7 | State | done 2026-10-22 | 47e6252 |
| 8 | UI primitives and registry | done 2026-10-22 | 39b01e5 |
| 9 | `/dev/spine` | done 2026-10-22 | |
| 10 | Fan-out docs | **Next** | |
| 11 | Exit gate (**attended**) | | |

### Carried forward

- (2) `Unsubscribe` (`() => void`) lives in `src/types/music.ts`. SPEC uses it
  in §3.2 and §5.3 without defining it; rows 4, 5 and 6 import it from there
  rather than declaring their own.
- (2) Enum-like types are derived from `as const` lists exported next to them
  (`CHORD_QUALITIES`, `MODES`, `STYLE_IDS`, `MODULE_IDS`, `VECTOR_IDS`,
  `SEQUENCERS`, `DRILL_MODULE_IDS`). Adding a member means adding it to the
  list; theory and validators can iterate them.
- (2) The lesson validators reject unknown fields (so curriculum typos fail
  the schema test). Whoever adds a field to `Lesson`, `LessonStep`,
  `ProgressionSpec` or `SequencerRecipe` adds it to that validator's
  `known([...])` list in the same change.
- (2) `ProgressionSpec` checks: `bpm` > 0, `swing` 0–1, `bars` a positive
  integer, `beats` > 0 (fractions allowed), `key.tonic` an integer 0–11.
  Ranges the transport enforces (BPM 30–300) are row 4's
  `validateTransportConfig`; numerals and the beats-sum are row 3's
  `loadProgression`.
- (2) `Lesson.level` is an integer ≥ 0 (A0 is 0). A card's `body` may be
  empty; every other string field must be non-blank.
- (2) `ModuleDefinition.component` is `LazyExoticComponent<ComponentType>`
  (SPEC §5.5's `lazy(() => import('./View'))`); a view takes no props.
- (2) `NotImplementedError(what, replacedBy)`: message `<what> is not
  implemented yet (<replacedBy>)`; row 6's stubs pass e.g. `'MicInput.start',
  'Phase 3, Module 3 lane'`.
- (3) Import theory from `src/theory` (the `index.ts` barrel re-exports
  `pitch`, `scales`, `chords`, `progressions`). Beyond SPEC §5.3's list it
  exports `pitchClass`, `transpose`, `intervalUp`, `noteName`, `usesFlats`,
  `scale`, `inScale`, `degreeInterval`, `parentMajorTonic`, `hasMinorThird`,
  `MODE_INTERVALS`, `QUALITY_INTERVALS`, `chordName`, `loadProgression`,
  `RomanNumeralError` and `ProgressionError`.
- (3) `chordTones` comes from the quality only: `extensions` and a slash
  `bass` are not chord tones, so `classify` treats a slash bass like any other
  note (A under G/A in A minor is a tension). Row 8's keyboard marks follow.
- (3) `loadProgression` runs `validateProgressionSpec` first, assumes 4/4
  (`bars × 4` beats), and throws `ProgressionError` naming `slots[i] "<roman>"`
  or the beats sum. `realize` throws `RomanNumeralError`; it accepts `♭`/`♯`
  as well as `b`/`#`, allows no spaces, and drops a `/<degree>` bass equal to
  the root.
- (3) `chordName(chord, key?)` takes an optional key: with one it spells as
  `noteName(pc, key)`, without one black keys are flats (`D♭`, `G♭`). Row 9
  passes the progression's key. mMaj7 prints `mMaj7` (placeholder; the plan's
  list has none). Parent-major G♭/F♯ keys spell with flats.
- (3) Per the pre-flight suffix table, `maj7` ignores case (`imaj7` is maj7,
  not decision 3's mMaj7), so no numeral spells mMaj7. Owner question.
- (3) SPEC §5.3's four progressions are `ProgressionSpec`s in
  `src/theory/__tests__/fixtures.ts` (`SPEC_FIXTURES`); later tests import
  them from there, as `src/audio/__tests__/voicing.test.ts` does.
- (4) Tone is reached only through `getAudioContext()` / `initAudio()` /
  `isAudioInitialised()` in `src/audio/TransportEngine.ts`. Importing `tone`
  already makes a default context (Tone's index calls `getContext()` at
  load), so `getAudioContext()` replaces it with `Tone.setContext(ctx, true)`.
  Row 5 makes its synths after that (any Tone node made earlier binds to the
  disposed context). The spine's clock is built over the native context
  under Tone's, not `rawContext` itself (see row 8's `clockContextOf`).
- (4) Names: interface `ClockBridge`, class `WebAudioClockBridge` (the
  pre-flight names no class; a same-named class would block structural
  fakes). `ToneTransport` is `TransportCore` (Tone-free, in `timing.ts`, the
  tested logic) plus a Tone driver and the wake lock. Fakes for rows 5 and 6:
  `new TransportCore(fakeDriver)` gives a real engine over a hand-stepped
  `TransportDriver` (see `src/audio/__tests__/timing.test.ts`'s `FakeDriver`).
- (4) Tone's transport runs **unlooped** with swing 0: Tone ticks are
  `absTick`, and the `bars` loop is `absTick % loopTicks`. Nothing uses a
  looping `Tone.Part`/`Sequence`; the backing synth schedules from
  `onSixteenth`.
- (4) Interface additions beyond SPEC §3.2 (fields gained, none changed):
  `config()`, `state()`, `audioTimeOfAbsTick`, `absTickOfAudioTime`,
  `onStateChange`, `BeatEvent.absTick`; `onMidiPulse(cb(audioTime,
  absTick))`, `onLoop(cb(iteration, audioTime))`. `onLoop` fires at the start
  of every iteration, 0 included. Per-tick order: `onLoop`, `onBeat`,
  `onSixteenth`, `onMidiPulse`; `started` comes before all of them, `stopped`
  carries Tone's stop time (`now()`, after every pulse already dispatched).
  `bpm()` is the configured BPM, ahead of the audible one for up to a beat
  after a change. `position()` is at `currentTime`; bar 1 beat 1 while
  stopped. A subscriber that throws is logged and skipped.
- (4) `configure` with an unchanged BPM while running schedules nothing;
  `start()` while running restarts (emits `stopped` then `started`). Default
  config before `configure`: 120 BPM, swing 0, 4 bars, 4/4.
- (4) Anchor pruning keeps the anchor in effect at `currentTime − 2 s`
  (`ANCHOR_PRUNE_MARGIN_SEC`), not at `currentTime`: an input event or target
  tick just behind a tempo change would otherwise map through the new tempo
  (≈40 ms off for a sixteenth at 120 → 90).
- (4) `validateTransportConfig` returns a list of strings like the lesson
  validators; `assertTransportConfig` throws the `RangeError`. Row 5's
  `transportConfigFor` can use either.
- (4) `ClockBridge` gained `snapshot()` (decision 7's readout: `currentTime`,
  `outputContextTime`, `gapMs`, `outputLatencyMs`, `baseLatencyMs`, `path`
  `'output-timestamp' | 'fit'`, `hasGetOutputTimestamp`, `hasOutputLatency`,
  `fitPairs`). Once `getOutputTimestamp` gives non-zero values, that path
  wins for good; fit pairs taken while the context wasn't running are dropped
  when it runs again. `offsetMs(perfTs, tAudio, clock, calibrationMs?)`
  returns `{ offsetMs, calibrated }`.
- (5) The backing synth is `new ToneBackingSynth(transport)` from
  `src/audio/VirtualPushSynth.ts`, which also re-exports `transportConfigFor`
  and the `PartMask` type. Its constructor calls `getAudioContext()` before
  making any Tone node, so it can be built before the audio gate is tapped.
  Whoever builds one disposes it (row 9: one per page, disposed on unmount).
  The caller runs `transport.configure(transportConfigFor(p))` before
  `synth.load(p)`; `load` while running takes effect from the next sixteenth.
- (5) The maths is Tone-free in `src/audio/voicing.ts`: `bassNote`,
  `voiceChord`, `midiToHz`, `slotStartTicks`, `slotIndexAtTick(slots, tick)`,
  `prepareProgression`, `planSixteenth` (what to play on one sixteenth),
  `swungTimeOfAbsTick`, `slotAtAudioTime`, `chordChangeTimesFor`,
  `assertProgressionFits`. Drum data is `src/audio/drumPatterns.ts`
  (`drumPatternFor(style)` warns once per style that falls back).
- (5) Swing is measured from the transport's maps: an onset on an odd
  sixteenth is delayed `swing / 3` of *that* sixteenth's length
  (`audioTimeOfAbsTick(t + 48) − audioTimeOfAbsTick(t)`), which equals
  `swingOffsetSec` at a steady tempo. `config().swing` is read on every
  sixteenth, so the swing encoder applies live. Note ends are swung too: the
  bass's release on the slot's last sixteenth (odd) lands at its swung time.
- (5) `chordChangeTimes()` gives when each chord is *heard* in the current
  loop iteration (swing included for a slot starting on an odd sixteenth;
  one-bar slots are on the downbeat, so straight). It returns `[]` before
  `load` as well as while stopped. `currentSlot` maps through the transport's
  rounded `absTickOfAudioTime`, so within half a tick (≈1.7 ms at 90 BPM)
  before a change it already reports the new slot.
- (5) Masking: masked parts aren't triggered, and each part's gain fades
  (10 ms) to its new level from the next sixteenth's grid time, so a held
  chord or bass stops there. Unmasking bass or chords mid-slot brings them
  back at the next slot start. A master gain is 0 while stopped (10 ms fade
  from the `stopped` time) and is set at `started`, which also applies a mask
  set while stopped.
- (5) Known edge, unverified: `start()` while running restarts at Tone's
  `now()`, and a note queued just after that time (a swung hat) from before
  the restart may still sound. Row 9's `[ear]` check would hear it as a
  stray hat on restart.
- (5) A bass in a slot of two sixteenths or less holds half the slot (no rule
  in the plan; owner question). Every sound parameter (envelopes, filters,
  levels, kick pitch, note velocities, hat accent 0.7 / normal 0.35) is a
  placeholder; `ToneBackingSynth` has never made a sound (no browser here):
  row 9 is its first run.
- (6) Input lives in `src/input/`: `NoteInput.ts` (`NoteInputSource`,
  `NoteBus`, and `Listeners`, the throw-safe subscriber set),
  `TouchInput.ts`, `MidiBridge.ts` (interface `MidiBridge`, class
  `WebMidiBridge`), `ClockFollower.ts` (`ExternalClockFollower`,
  `PulseClockFollower`, re-exported from `MidiBridge.ts`), `MicInput.ts`
  (stub). Every `off`, from any source, carries velocity 0; touch `on` is 1.
  A source emits only while started and `stop()` releases its held notes;
  `NoteBus` forwards only from started sources, so a source is started
  through `bus.start(id)` or no key lights (row 8's spine does it).
- (6) `MidiBridge` beyond SPEC §5.3: `accessState()` (`unrequested` /
  `pending` / `granted` / `denied` / `unsupported`), `selected()`,
  `follow(enabled, transport)`, `clockMode()` (`'internal' | 'clock out' |
  'follow'`, the StatusBar copy as is), `onClockModeChange`, `clockStats()`,
  `onClockIn(perfTs)`, `dispose()`. Construct it as `new WebMidiBridge({
  memory })`; `PortMemory` is `load(): { input?, output? }` and
  `save({ input, output })` with `{ id, name } | null` per side (row 7's
  settings shape). `select(input?, output?)` takes port ids and sets both
  sides: `undefined` clears one, so row 9's pickers pass the other side's
  current id.
- (6) `onConnectionChange` events are `{ type: 'port', kind, port, state }`
  or `{ type: 'selection', input, output }`. Every port present when access
  is granted also fires a `port`/`connected` event, so a Field plugged in
  before the app opened still raises the power warning (`raisesPowerWarning`
  in `src/ui/powerWarning.ts`). Chrome's
  open/closed `statechange`s are dropped.
- (6) Selecting a different output (or none) while clock out is on turns it
  off, with `FC` to the old output if the transport is running; the output
  disconnecting turns it off with no `FC`. Selecting a different input, or
  the input disconnecting, turns follow off (with `off`s for held notes).
  Clock out and follow switch each other off; the mode event fires once, with
  the new mode.
- (6) Clock out records every send's headroom (`F2`, `FA`, `F8`, `FC`),
  not only `F8`; `clockStats()` covers the last 1000 sends. Loopback pairs
  each incoming `F8` with the oldest sent one (lost after 250 ms, an echo
  more than 5 ms early isn't ours) and gives `absErrorP50Ms`,
  `absErrorP95Ms` and `jitterP95Ms` (|error − median error|); SPEC §8.5's
  3 ms p95 reads best against the jitter number. Percentiles are nearest-rank.
- (6) Follow applies the estimate unrounded (any change above 1e-6 BPM), so
  every beat with a drifting estimate adds a tempo anchor. `0xFB` (continue)
  restarts the follower's beat count like `0xFA` (SPEC §3.5's interface
  lumps them); SPP is ignored on input.
- (6) Fakes for later rows and Module 3: `src/input/__fakes__/FakeMidiPort.ts`
  (`FakeMidiOutput` records `[data, timestamp]`, `FakeMidiInput.emit`,
  `FakeMidiAccess` with `plug`/`unplug`, `fakeMidiNavigator(access |
  null)`) and `FakeTransport.ts` (`createFakeTransport()`: a real
  `TransportCore` over `FakeTransportDriver.advanceTo(t)`, which hands out
  every pulse due by `t + lookAhead` like Tone; `FakeClockBridge(originMs,
  latencySec)`). They live under `src/` outside `__tests__`, so they're
  app-typed (no Node types) and must stay Tone-free.
- (6) `PitchWorklet.ts` (`detectPitch`, class `PitchWorklet` with
  `start(input)`, `stop`, `onPitch`) and `KeyEstimate.ts`
  (`chromagram(samples, sampleRate)`, `estimateKey(chroma)` →
  `{ key, confidence }`) are stubs whose signatures are provisional: the
  Module 3 lane and the Phase 4 plan's first row own them by name.
- (6) Nothing in `src/input` has touched a real Web MIDI port: row 9's
  headless run only reached the refused-permission path (`denied`). Row 11's
  `[field]` checks are the first run with ports.
- (7) `src/state/` API. `db.ts`: `openAppDb()` (rejects `IndexedDB is not
  available…` with no global), `upgradeDb(target, oldVersion)` over the
  `UpgradeTarget` slice, `newId()`, the record types (`Session`, `Attempt`,
  `Sample`, `Kit`, `CalibrationRecord`), `exportData(db)`, `importData(db,
  json)`, `parseExport`. Exports leave out `samples`; import replaces only the
  stores the envelope names among `sessions`, `attempts`, `kits`,
  `calibration` and ignores the rest. Add a DB version as a new `case` after
  case 0's block (the tsconfig forbids a fallthrough into `default`).
- (7) `settings.ts`: `settings` (the app's store: `get`, `save(patch)`,
  `subscribe`), `createSettings(storage)`, `SETTINGS_KEY`, `DEFAULT_SETTINGS`.
  The theme script in `index.html` reads the same key. `save` notifies only
  when a value changed; there is no cross-tab `storage` listener.
- (7) `keyboardBaseNote` 53 is VERIFY V8's stub; `keyboardOctave` accepts any
  integer, and `Keyboard24` applies it unclamped (nothing sets it yet). Add-ons to the plan: calibration
  `computeCalibration(offsets, { source, device, outputLatencyMs,
  measuredAt? })` returns the record; `getCalibration`, `putCalibration` and
  `listCalibrations` take an optional `AppDB` and open their own otherwise.
- (7) `importData`, `exportData` and calibration get/put have still only run
  against fakes; row 9's `db ok` check ran `openAppDb` and a put/get/delete
  on `attempts` in headless Chromium.
- (1) The service worker registers through the plugin's injected
  `registerSW.js` with `registerType: 'autoUpdate'`: a new deploy takes over
  on the next load, with no update prompt. Fine while everything is in one
  bundle.
- (1) OWNER: GitHub **Settings → Pages → Source** = "GitHub Actions" before
  row 11's push.

- (8) `useSpine()` (`src/ui/spine.tsx`, inside `<SpineProvider>`, which
  `App.tsx` puts around the shell) gives `{ clock, transport, bus, midi, touch,
  settings, audio }`, one each per page (`getSpine()`, never disposed). The
  transport is a `ToneTransport`, the bridge a `WebMidiBridge` with
  `portMemory(settings)`. `touch` is started on the bus at once; `midi` is
  started while an input is selected and stopped when none is, so
  `bus.active()` is what can play. Row 9 builds its synth as
  `new ToneBackingSynth(spine.transport)` and disposes it on unmount.
- (8) Audio: `<AudioGate />` (`src/ui/AudioGate.tsx`) is the start / resume
  button (`tap to start audio` / `audio paused, tap to resume`) and renders
  nothing while audio runs; the shell doesn't show it, so every page that
  plays sound puts it at the top. `audio.state()` is `off` / `running` /
  `paused`; `audio.start()` runs `initAudio()`, then refreshes the clock
  every 250 ms. `useAudioState()` and `useSetting(key)` are the hooks.
- (8) The clock is `new WebAudioClockBridge(clockContextOf(rawContext))`:
  Tone's `rawContext` is a standardized-audio-context wrapper with no
  `outputLatency` and no `getOutputTimestamp()`, so `clockContextOf`
  (`src/ui/clockContext.ts`) unwraps its private `_nativeAudioContext`.
  It reaches into a library internal; the clean fix is a spine change in
  `getAudioContext()` (make a native `AudioContext` and pass it to
  `new Tone.Context({ context, … })`), not made here (row 4's file). Headless
  Chromium read path `output-timestamp`, `outputLatency` 32 ms,
  `baseLatency` 10 ms, gap 42.4 ms: not a device measurement, not recorded.
- (8) Copy lives in `src/ui/copy.ts` (`COPY`): every settled string, plus
  placeholders `dismiss` (power warning), `octave 1` / `octave 2` (keyboard
  toggle, naming the octave shown), `<n> bpm` (StatusBar) and the theme
  toggle's `light` / `dark`. Row 9 imports its MIDI-state copy from there.
- (8) Theme: a `dark` class on `<html>` (static in `index.html`, so dark
  even without script), the inline script before the module script, and
  `applyTheme` in `src/ui/theme.ts` on every settings change.
  `THEME_COLORS`, `--op-bg` in `tokens.css`, the inline script and
  `themeColor` in `vite.config.ts` must agree; `theme.test.ts` checks it.
  Colours are the `--op-*` tokens (Tailwind `bg-surface`, `text-muted`,
  `border-warn`, … or `var(--op-…)` in inline styles); state tokens are
  `ok` / `bad` / `warn` / `neutral`; the nav breakpoint is the `nav:`
  variant (700 px).
- (8) Router: `Link`, `navigate(path)` and `useLocation()` in
  `src/ui/navigation.tsx` take app paths (`/dev/spine`) and keep `?dev`;
  the pure part is `src/ui/router.ts`. The nav's `op-1-school` title is the
  home link (no `home` entry, so no new copy). A route matches a module's
  `route` exactly, after trailing slashes are dropped.
- (8) `Keyboard24` props: `chord`, `musicKey` (`key` is React's), and
  `onOutOfRange(note)`. Keys carry `data-note`, `data-key-index`,
  `data-lit` (`true`/`false`) and `data-class` (`off`, `lit`,
  `chord-tone`, `tension`, `avoid`, `outside`), and the toggle
  `data-octave-toggle`, for row 9's scripted checks. One or two octaves is
  decided by the container (14 natural columns at ≥ 40 px, so 560 px for an F
  base); keys stop growing at 72 px (placeholder). The octave toggle is
  component state, not a setting.
- (8) `Encoder` props: `value` (0..1), `onChange`, `color` (`blue` /
  `ochre` / `gray` / `orange`), `label`, `valueText`, `rangePx`
  (default 200, up increases), `step` (arrow keys, 0.01), `disabled`. The
  caller maps 0..1 to its units; it is `role="slider"` with `data-encoder`.
- (8) The StatusBar polls the spine every 250 ms (no BPM event) and shows
  `<n> bpm`, the clock mode, the selected input's name or `no midi`, and
  calibration per active source; the calibration item is also the "active
  input source" readout. Unsupported or denied MIDI shows `no midi` there;
  the long copy is row 9's MIDI panel.
- (8) The import rule is `src/modules/__tests__/importRule.test.ts` (checker
  in `importRule.ts` next to it). Packages aren't its business; it skips its
  own file, whose fixtures look like broken imports.
- (8) `settings.clockOut` isn't applied by anything: clock out starts off
  every load. Row 9's toggle doesn't save it either (sending clock to a
  device on load, unasked, seemed wrong; owner question), so the setting is
  unused.
- (9) `/dev/spine` is `src/modules/dev-spine/`: `module.ts`, `View.tsx`, and
  the pure `devSpine.ts` (`DEV_PROGRESSION`, `LABELS`, `bpmFromEncoder`,
  `midiPanelView`, `clockRows`, `timingRows`, `appendCapped`, `runDbCheck`)
  with its test. Every label is in `LABELS`, marked `placeholder`; settled
  MIDI copy comes from `COPY`. Panels carry `data-panel` and readouts
  `data-*` hooks (`data-current-chord`, `data-readout="clock"`,
  `data-midi-status`, `data-db-result`, `data-log`, `data-toggle=…`,
  `data-transport`) for scripted checks.
- (9) The page builds one `ToneBackingSynth` per mount, configures the
  transport from `DEV_PROGRESSION` only if it is stopped, and stops the
  transport on unmount. The BPM encoder stays enabled in follow mode, where
  follow can move the BPM under it (the encoder shows the configured BPM,
  clamped to 60–160; a turn is overwritten by the next estimate). The current chord is `currentSlot(currentTime)` polled every
  250 ms, so it can lag a change by up to 250 ms.
- (9) The import-rule checker (`src/modules/__tests__/importRule.ts`, row 8)
  rejects a bare barrel import like `'../../theory'` from a module (a
  one-segment target isn't classed as spine), so `dev-spine` imports
  `'../../theory/index'`. Phase 2 modules must do the same until the checker
  is fixed (spine request in row 9's report).
- (9) Headless Chromium refused `requestMIDIAccess` (the page shows `midi
  permission denied`); the no-ports `no midi` path and the pickers, clock out
  and follow with real ports have only run in Vitest (`midiPanelView`) and
  are row 11's `[field]` checks.

### Process notes

- (1) The row says typecheck is `tsc --noEmit` over every project. With a
  solution `tsconfig.json` (`files: []` plus references) that checks nothing;
  the script is `tsc -b --noEmit`, which builds each referenced project.
- (1) Latest-allowed versions are TypeScript 7.0 (the native compiler) and
  Vite 8 (Rolldown). Both work with this setup; nothing needed an install
  script (only `fsevents`, macOS-only, declares one).
- (1) `gh` isn't on Git Bash's `PATH` here. Action SHAs came from
  `git ls-remote --tags https://github.com/actions/<name>.git`.
- (1) `AGENTS.md` says to ask which plan when the owner doesn't name one;
  with exactly one open plan, this step went ahead with it. Worth saying so
  in that line.
- (2) Row 2's Done-when grep (`"from '\.\./" -- src/types`) matches its own
  tests, which import `../lessons`; the pre-flight's version with
  `':!src/types/__tests__'` is the one that can pass. SPEC §5.2 lists only
  `music.ts` and `lessons.ts` under `src/types/`; `modules.ts` and
  `errors.ts` come from this plan.
- (3) Decision 3 says `maj7` gives mMaj7 on lower case; the pre-flight's
  suffix table says only bare, `7` and `6` follow case. The pre-flight won;
  it leaves mMaj7 without a numeral. The pre-flight's `chordName(chord)` has
  no key to spell with, so it gained an optional `key`.
- (3) SPEC §5.2 puts degree naming in `scales.ts`; the row puts `degreeName`
  in `progressions.ts`. The row won.
- (3) This row ran in a Linux cloud container, not the owner's Windows PC:
  `.agents/windows-tool-pitfalls.md`'s Git Bash path, PowerShell and CRLF
  advice didn't apply. The one scripted edit (the status table) was still a
  file, and the new files are LF.

- (4) SPEC §3.1 declares `ClockBridge` as a class and the pre-flight says
  "an interface plus the class" without naming the class; it is
  `WebAudioClockBridge`. SPEC §3.2's "Swing is applied by Tone" is overridden
  by decision 1. The pre-flight's "anchors before the current one are pruned"
  would mis-map events just behind a tempo change, so pruning keeps a 2 s
  margin (Carried forward).
- (4) The row's Owns has no room for a Tone-free engine file, so
  `TransportCore` (the testable part of the transport) lives in `timing.ts`
  next to the maths.
- (4) "Nothing else touches `Tone.getContext()` first" can't hold literally:
  `import 'tone'` calls it at module load. `getAudioContext()` replaces and
  disposes that context.
- (4) Linux cloud container again; no browser here, so the Tone wrapper is
  only type-checked. Scripted edits ran from scratchpad files.
- (5) The row says "close position upward from MIDI 52"; the pre-flight says
  root position from the lowest root ≥ 52. The pre-flight won. SPEC §5.3's
  "Swing from Transport" is overridden by decision 1. The row's Done-when
  slot test names 90 BPM, which ticks don't depend on; the test also runs
  the lookups through a real `TransportCore` at 90 BPM and across a 90 → 120
  change. The plan doesn't say what `chordChangeTimes` returns before `load`
  (it returns `[]`) or whether its times are swung (they are, see Carried
  forward).
- (5) `timing.test.ts`'s `FakeDriver` isn't exported (test files aren't
  shared), so `voicing.test.ts` has its own small copy. A shared fake under
  `src/audio/__fakes__/` would stop the copies multiplying; row 6 plans fakes
  under `src/input/__fakes__/`.
- (5) Linux cloud container, no browser: `ToneBackingSynth` is only
  type-checked and built; all its sound is row 9's to hear. Scripted edits
  ran from scratchpad files.
- (6) The row's "`0xFC` with no timestamp" and its ≈100 ms caveat are
  overridden by the pre-flight (`FC` at `audioToPerf(stopped.audioTime)`,
  never earlier than the last `F8`'s stamp). The plan doesn't say how
  `select(input?, output?)` treats an omitted side, what happens to clock
  out when the output changes, whether ports present at grant raise the power
  warning, or what velocity an `off` carries; see Carried forward. SPEC
  §3.5's `ExternalClockFollower` went in its own `ClockFollower.ts` (still
  in `src/input`), re-exported from `MidiBridge.ts`.
- (6) Linux cloud container, no browser or MIDI: everything Web MIDI is
  tested through fakes only. A compile-time check in `MidiBridge.ts`
  (`RealMidiFits`) proves the DOM's `MIDIAccess`, `MIDIInput` and
  `MIDIOutput` fit the structural types. Scripted edits ran from scratchpad
  files.
- (7) Linux cloud container again. `noFallthroughCasesInSwitch` rejects the
  plan's "switch that falls through" ending in `default`; case 0 stands alone
  until version 2. The row says calibration has "get, put, list" without a
  signature, and `computeCalibration(offsets)` needs source, device and output
  latency to make a record, so it takes a `meta` argument. Scripted edits ran
  from scratchpad files.

- (8) Linux cloud container. Browser checks ran in headless Chromium via
  Playwright from scratchpad scripts against the dev server; ESM ignores
  `NODE_PATH`, so the script imports Playwright by absolute path. Keyboard24,
  Encoder and AudioGate aren't on any page until row 9, so the probe mounted
  them into the live page with the app's own React (the optimized-deps URLs
  read from the served `main.tsx` / `App.tsx`). Chromium logs "The
  AudioContext was not allowed to start" as a warning on load (Tone's import
  and `getAudioContext()` each make a context before any gesture); no errors.
- (8) The row's "under 700 px wide, one octave" is overridden by the
  pre-flight (container width, ≥ 40 px keys). The row names a `key` prop,
  which React reserves; it is `musicKey`. "Lit unclassified keys are gray
  and brighter than unlit keys" can't hold literally in light mode (unlit
  keys are near-white): lit gray is a solid mid-gray fill, unlit keys a pale
  outline. The plan doesn't say whether the shell shows the audio gate, what
  the power warning's dismiss button says, or how the StatusBar shows the
  active sources (see Carried forward).
- (8) Tone's `rawContext` hides `outputLatency` and `getOutputTimestamp`
  (standardized-audio-context): row 4's Carried forward told row 8 to build
  the clock over it, which would have pinned decision 7's readout to the fit
  path and SPEC §3.3's latency to `baseLatency`. Worked around in row 8's
  files; the spine fix is in Carried forward.
- (9) Linux cloud container. Browser checks ran in headless Chromium via a
  Playwright script in the scratchpad against the dev server; Chromium
  refused MIDI permission without a prompt, which gave the `denied` path.
  Headless clock readings (path `output-timestamp`, gap 39.4 ms,
  `outputLatency` 32 ms, `baseLatency` 10 ms) are not device measurements
  and aren't recorded.
- (9) Carried forward (3) says to import theory from the `src/theory` barrel,
  but row 8's import-rule checker rejects `'../../theory'` from a module;
  `'../../theory/index'` passes. The plan's R9 labels don't cover the
  database button, the MIDI states without settled copy (`unrequested`,
  `pending`, `granted`), the follower readout, the out-of-range count, the
  readout row labels or the empty log; all are placeholders in `LABELS`.
  The row's "no loopback" is used as written.

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
  0, 7, 10; snare on 4, 12; closed hat on all 16 steps, even steps
  accented (so swing moves the odd ones). Bass plays
  `chord.bass ?? chord.root` at each slot start, held to one sixteenth before
  the next slot. Chords are held for the whole slot.
- **Theme toggle**: a button at the end of the nav labelled `light` in dark
  mode and `dark` in light mode (it names what you'd switch to). The dark
  palette is near-black background, light gray text; the light palette is
  the TE-style light gray body from the icon, dark text.
- **Theme colour** in the manifest: the dark placeholder background. The icon's
  encoder hexes match the placeholder encoder colours; if the owner changes
  those, the icon follows.

## Pre-flight answers (2026-10-22)

From the `/run-steps` pre-flight for rows 2–10. **This section wins over
anything else in the plan, or in SPEC, that reads differently.** "Rn" is row n.

### The owner's calls

- **Hats**: closed hat on all 16 steps, even steps accented (placeholder).
  Decision 1 swings odd sixteenths only, so eighth-note hats never moved.
- **Keyboard look**: OP-1 style, two offset rows (naturals below, sharps above,
  offset by half a key), every key one full key width, so all keys are ≥ 40 px.
  `keyboardLayout` takes the *container* width; only the 700 px nav
  breakpoint reads the viewport. At 360 px, one octave = 7 natural-key columns
  of ≥ 40 px with the five sharps above them; "12 keys ≥ 40 px" in R8's
  Done-when means every one of the 12 is ≥ 40 px wide.
- **Power warning**: app-wide, in R8's shell (not R9), shown whenever a MIDI
  input connects, on any device, driven by `onConnectionChange`. Copy as
  settled. Dismissible; it shows again on the next connect. It is VERIFY V3's
  stub (log it `stubbed`, R8).
- **R9 labels**, all lowercase, all marked `placeholder` in a comment:
  transport button `start` / `stop`; encoders `bpm` and `swing`; mask toggles
  `drums`, `bass`, `chords`; MIDI request button `request midi`; port
  pickers `input` / `output` with empty option `none`; toggles `clock out`,
  `follow`; database results `db ok` / `db failed: <error>`; log heading
  `log`; each panel heading is its topic in one or two words (`transport`,
  `chord`, `keyboard`, `midi`, `clock`, `midi timing`, `database`).
  Encoders: `bpm` blue, `swing` ochre.
- Anything else a row needs that isn't written here: override (b), a neutral
  placeholder listed under "Questions for the owner".

### Models

R2–R7 and R9 as the rows say. **R8 runs on Opus 5.5**, not Sonnet: it
carries the audio init, provider, router, theme and keyboard, and the grill
found it the most underspecified row. R7 and R10 stay on Sonnet 5.5.

### Ownership fixes

- R2 deletes `src/__tests__/scaffold.test.ts` (now in its Owns).
- R6 also owns `src/input/__tests__/` and puts the stub tests for
  `PitchWorklet` and `KeyEstimate` there.
- R8 owns `themeColor` in `vite.config.ts` (now in its Owns).
- R10 also owns `.claude/skills/step/SKILL.md`, to drop its stale "once it
  exists" and "the spine adds it" qualifiers.

### Technical answers

**Types (R2)**
- `Lesson.level` is a number. `SequencerRecipe.sequencer` is
  `'finger' | 'endless' | 'tombola'`. Drill `params` is
  `Record<string, unknown>`. A drill step's `module` is any `ModuleId` except
  `dev-spine` and `runner`.
- R2's grep excludes its own tests: `git grep -n --untracked "from '\.\./" --
  src/types ':!src/types/__tests__'`.

**Theory (R3)**
- `classify`: "b9 and b13 are tensions anyway" overrides the avoid rule for
  scale notes only; notes outside the scale stay outside. The Done-when lists
  are complete over 12 pitch classes:
  - G7 in C major: chord 2 5 7 11; tension 4 9; avoid 0; outside 1 3 6 8 10.
  - C7 in F minor: chord 0 4 7 10; tension 1 3 8; avoid 5; outside 2 6 9 11.
- Suffix case: `7` and `6` follow case (lower case gives m7 / m6), as do bare
  triads. Every other suffix ignores case. R3's tests carry that table.
- `/<degree>` is a degree of the key's *mode* (1–7, `b`/`#` allowed), unlike
  decision 4's major-relative degree names. Both doc comments say so.
- `pentatonic` on locrian uses minor pentatonic as written (its 5 is outside
  the mode; accepted).
- R3 exports `noteName(pc, key)` (flats in flat keys and minor keys with flat
  signatures, sharps otherwise, Unicode ♭/♯) and `chordName(chord)` (`dim`,
  `m`, `7`, `maj7`, `m7`, `m7♭5`, `dim7`, `sus2`, `sus4`, `6`, `m6`,
  `/<bass>`), with tests. R9's check reads `Gdim`, `C7`, `Fm`, `D♭`.

**Clock and transport (R4)**
- Class names: the SPEC interface keeps its name; implementations are
  `ToneTransport`, `WebMidiBridge` (R6), `PulseClockFollower` (R6),
  `ToneBackingSynth` (R5). Internal names, not owner copy.
- `ClockBridge` is exported as an interface plus the class, so fakes are
  structural. It seeds one `(currentTime, performance.now())` pair at
  construction. R9's readout shows whether `getOutputTimestamp` and
  `outputLatency` exist on the raw context (record it, don't guess).
- R4 exports `getAudioContext()` (idempotent: `latencyHint: 'interactive'`,
  `lookAhead: 0.1`, worker ticker, `Tone.setContext`) and `initAudio()`
  (`Tone.start()` on that context). Nothing else touches `Tone.getContext()`
  first.
- `BeatEvent` carries `tick` (in-loop, per SPEC) and `absTick`. The engine
  exposes `audioTimeOfAbsTick`, `absTickOfAudioTime` and `config()`. Tick ↔
  time maps throw while stopped. Bar and beat count from 1; `sixteenth` is
  0–15 within the bar, odd = off-beat.
- Ticks round to the nearest integer. The fallback-fit test spaces its 20
  pairs 250 ms apart.
- A BPM change while running applies at the first beat boundary after
  `currentTime + lookAhead` (`bpm.setValueAtTime`), anchored there; anchors
  before the current one are pruned. `configure()` while running applies
  `bpm` and `swing` only; changing `bars` or `timeSig` while running throws.
- Validation lives in `validateTransportConfig` in `timing.ts`, with tests
  (BPM 30–300, swing 0–1, bars ≥ 1, `[n, 4]`).
- `onStateChange` states are `'started' | 'stopped'`; `started` fires before
  the tick-0 `onBeat` and `onMidiPulse`.
- Wake lock has no unattended check: it is R11's `[phone]` lock-screen item.
- The Tone-free grep, used in R4 and again in R5 and R6:
  `git grep -n --untracked -e "from 'tone'" -e 'from "tone"' -e "import 'tone'"
  -- 'src/*/__tests__' src/audio/Clock.ts src/audio/timing.ts
  src/audio/voicing.ts src/audio/drumPatterns.ts src/input` finds nothing
  (paths a row hasn't created yet are dropped from its run). Tests import
  `TransportEngine.ts` and `VirtualPushSynth.ts` as types only.

**Backing synth (R5)**
- Voicing is root position: the root at the lowest MIDI note ≥ 52 with that
  pitch class, chord tones stacked upward.
- `slotIndexAtTick` lives in `voicing.ts` (pure) and carries the slot test.
- `currentSlot` throws before `load`, is 0 while stopped; `chordChangeTimes`
  covers the current loop iteration and is empty when stopped.
- Synth instances belong to the module that creates them; it disposes them.

**Input and MIDI (R6)**
- `NoteBus` owns `start(id)` / `stop(id)`; `active()` lists the started ones.
- No default port: with nothing remembered, nothing is selected. A remembered
  port that reappears is reselected (id, then name).
- `0xFC` is stamped `audioToPerf(stopped.audioTime)`; Tone's stop lands after
  every queued pulse, so the test is "no `F8` timestamp after `FC`'s". The
  ≈100 ms caveat goes.
- `clockOut(true)` while running: pulses from the next pulse, `F2`/`FA` at
  the next bar-1 downbeat. `clockOut(false)` while running sends `FC`. Clock
  out with no output selected is a no-op. VERIFY V6 (clock before `FA`) is
  built as SPEC says and logged `stubbed` in `clockOut`.
- Follow mode lives in the spine, R6: `MidiBridge.follow(enabled, transport)`
  sets the transport BPM when confidence ≥ 0.8, at most once a beat, clamped
  to 30–300; clock out and follow are mutually exclusive; a mode getter and
  change event (`internal` / `clock out` / `follow`) feed R8's StatusBar. R9
  only toggles it.
- Follower: history clears on `0xFA`; BPM is 0 before 24 intervals; the EMA
  seeds from the first median. Its test feeds 100 pulses. `phasePerfMs`
  before any `FA` counts from the first pulse.
- Feeds for R9: `clockStats()` (headroom min / p5 / p50, late count, last
  1000 sends) and `onClockIn(perfTs)` for incoming `F8`; the access state is
  readable.
- `MicInput` is a class whose methods throw; it isn't registered on the bus.
- `MidiBridge.ts` imports only types from `TransportEngine.ts`. R6's fake
  transport is built on R4's real `timing.ts`, so its swing test isn't a
  tautology.

**State (R7)**
- Records: `Session { id, lessonId, startedAt, finishedAt?, scores }`,
  `Attempt { id, sessionId, module, mode, at, score?, offsets?:
  TimingOffset[], data? }`, `Sample { id, name, createdAt, key?, root? }`,
  `Kit { id, name, createdAt, sliceCount }`. Ids from
  `crypto.randomUUID()`. DB name `op-1-school`.
- Import replaces the named stores in one transaction and ignores unknown
  stores. The median of an even count is the mean of the middle two.
- Settings are stored flat: `{ version: 1, theme, … }`; a wrong-typed field
  falls back to its own default only. API: `get`, `save`, `subscribe`.
- Extra Done-when: opening with no `indexedDB` global rejects with the
  readable error (Vitest, node).

**UI (R8)**
- Exports the audio gate (start / resume button with the settled copy); R9
  uses it.
- `devOnly` modules: without `?dev`, both the nav entry and the route are
  hidden (the route shows `no page here`).
- StatusBar calibration is per active source: e.g. `touch ✓ · midi needs
  calibration`.
- `Keyboard24` takes `onOutOfRange(note)`. In one-octave mode a note in the
  hidden octave lights its equivalent in the visible one and is not counted.
  `keyboardOctave` transposes the base note by 12 × octave; the toggle only
  picks the visible half. Lit unclassified keys are gray *and* brighter
  (filled) than unlit keys.
- Pointer tracking is a pure tracker in `keyboardLayout.ts` with a test.
  `setPointerCapture` is wrapped so a scripted event can't throw.
- The theme script also updates `<meta name="theme-color">`.
- The import-rule test allows `src/curriculum/**` as a data path (Phase 2
  creates it).

**`/dev/spine` (R9)**
- BPM encoder 60–160, integers; full range is a 200 px drag, up increases.
- The database check writes id `dev-spine-check` to `attempts`, reads it,
  then deletes it.
- MIDI access is requested from the `request midi` button. The
  `ProgressionSpec`'s `id` is `dev-spine-fminor`, `family` a placeholder.
- State colours follow the rule (blue ok, red failed, yellow warning, gray
  neutral) and never by hue alone (each also has a word).

**Fan-out docs (R10)**
- `MODULE_CONTRACT.md` follows `AGENTS.md` on dependencies (ask the owner
  first), not SPEC §5.5's "list in your PR". It names `src/curriculum/` as
  created in Phase 2; the "nothing that doesn't exist" check skips that one
  path. It lists the fakes in `src/input/__fakes__` for Module 3, and where
  follow mode and the power warning live.

### Check notes

- **The OP-1 Field is plugged into this PC over USB during the run.** Agents
  never count it as a check and send nothing to a real port: no notes, no
  clock. R9's "no MIDI" check uses the refused-permission path (`midi
  permission denied`), which holds whether or not the Field is visible. If an
  agent does see a port, it reports the name under VERIFY items and doesn't
  write it into the log as a result; the owner confirms it in R11. If the
  browser pane's permission prompt blocks, that item is OWNER.
- The orchestrator runs `git add -N .` before `git diff --check`, so new
  files are checked too.

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

Model: Opus 5.5. Owns: `src/types/`, and deletes
`src/__tests__/scaffold.test.ts`.

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
      0.5 is 0.02778 s (±0.0001) on odd sixteenths and 0 on even ones.
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

Model: Opus 5.5. Owns: `src/ui/`, `src/modules/registry.ts`,
`src/modules/__tests__/`, `src/App.tsx`, `src/main.tsx`, `src/index.css`,
`index.html`, and `themeColor` in `vite.config.ts`. Read SPEC §5.4 and §5.5.

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
- The SPEC §2.2.3 power warning is row 8's, in the shell; this page shows it
  like every other page.

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
