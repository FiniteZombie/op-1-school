# Phase 1 spine — run (2026-10-22)

**Status:** not reviewed yet. Run `/retro` with the owner.

Branch `phase-1-spine`, from `main` at 92ea236 (Spine 1: scaffold). The
pre-flight (dc6ac78) and row 2 (e9ff2eb) ran in a local session on the
owner's Windows PC. Row 3 was started there and stopped before it wrote
anything, and the run moved to a Linux cloud container, which resumed from
row 3 and ran rows 3–10. These are steps, not lanes, so there are no lane
branches and nothing to merge: every row is a commit on `phase-1-spine`. The
branch is pushed to `origin/phase-1-spine` (the owner asked for that). There
is no PR and nothing is merged to `main`.

## Result

| Row | Branch | Commit | Outcome |
| --- | --- | --- | --- |
| 2 Types | phase-1-spine | e9ff2eb | done (local), 1 fix round |
| 3 Theory | phase-1-spine | 88aa382 | done |
| 4 Clock and transport | phase-1-spine | da45254 | done |
| 5 Backing synth | phase-1-spine | b82c7ca | done |
| 6 Input and MIDI | phase-1-spine | 4a067d9 | done |
| 7 State | phase-1-spine | 47e6252 | done |
| 8 UI primitives and registry | phase-1-spine | 39b01e5 | done |
| 9 `/dev/spine` | phase-1-spine | ad0c090 | done; `[ear]` item OWNER |
| 10 Fan-out docs | phase-1-spine | 16df9cd | done |
| 11 Exit gate | — | — | not started: attended |

- **Failures or stops:** none. The run stopped before row 11 as planned,
  because row 11 is attended.
- **Checks after every row:** the subagent's report (each Done-when item had
  PASS or OWNER and a how); `npm run check` exit 0; `git add -N .` then
  `git -c core.autocrlf=false diff --check` clean; `git status` showing only
  the row's paths, plus the docs `/step` says to update; the plan's status
  table (row done, next **Next**, previous hash backfilled) and Carried
  forward; nothing left running.
- **What I spot-checked:**
  - **R3:** read the `classify` test's 12-pitch-class lists against the
    pre-flight's and ran `vitest src/theory`.
  - **R4:** ran the Tone-free grep and read the +22 ms / +7 ms §3.3 test.
  - **R5:** ran the Tone-free grep (with `voicing.ts` and `drumPatterns.ts`)
    and read the drum data against the placeholder.
  - **R6:** ran the Tone-free grep (with `src/input`) and `clockOut.test.ts`,
    and read the VERIFY log diff.
  - **R7:** ran `vitest src/state` and read the three settings-default
    cases.
  - **R8:** my own headless-Chromium probe: home is dark on first load,
    `/nope` and `/dev/spine` without `?dev` show `no page here`, and there
    are no console errors.
  - **R9:** my own probe: audio gate, then `start`; the chord panel stepped
    Gdim → C7 → Fm → D♭ → Gdim with no console errors. My first probe
    reported no D♭; that was my regex (`\b` after `♭`), not the page.
  - **R10:** every `src/` path in `MODULE_CONTRACT.md` checked with
    `git ls-files`. The only ones missing are `src/curriculum/` (skipped by
    design) and the `src/modules/<id>/` templates.

## Pre-flight

Done locally before the move (dc6ac78). The grill found:
- row-text contradictions (swing units, the hat pattern, R2's grep
  matching its own tests, the `0xFC` timing caveat);
- ownership gaps (the scaffold test, R6's tests, R8's `themeColor`, R10's
  step skill);
- undefined behaviour across every row;
- the creative calls below.

The owner answered:
- hats on all 16 steps, even steps accented;
- an OP-1-style two-row keyboard, sized by its container;
- an app-wide power warning, in row 8's shell;
- every row 9 label (lowercase, placeholder);
- row 8 on Opus 5.5 rather than Sonnet;
- effort medium.

The "Technical answers" settled the rest per row. Left as placeholders:
- the palette;
- the classification marks;
- the backing sound;
- the theme toggle;
- anything a row needed that wasn't written down (listed under Questions
  below).

For the cloud resume, the owner said not to re-grill or re-ask, to skip the
`main`/merged pre-flight checks, and that the "Field plugged in" check note
didn't apply (no MIDI hardware here). Browser checks without a browser were
to be OWNER. The container did have Chromium and a global Playwright, so
rows 8 and 9 ran their browser checks headless (see Orchestration).

## Decisions the plan didn't cover

| Row | Decision | Why |
| --- | --- | --- |
| 3 | `maj7` ignores case (pre-flight's suffix table) over decision 3's lower-case mMaj7, so no numeral spells mMaj7 | Pre-flight wins; flagged as a question |
| 3 | `chordName(chord, key?)` takes an optional key | The pre-flight's signature has nothing to spell `D♭` vs `C♯` from |
| 3 | A slash bass or `extensions` aren't chord tones in `classify` | Quality-only chord tones; A under G/A in A minor shows as a tension |
| 3 | G♭/F♯ keys spell with flats | Needed a rule for the six-accidental keys |
| 4 | Anchors are pruned with a 2 s margin, not at the current anchor | Pruning at `currentTime` maps events just behind a tempo change at the new tempo (≈40 ms off) |
| 4 | `TransportCore` (all engine logic, Tone-free) lives in `timing.ts` | The row's Owns had no other Tone-free file; keeps the engine testable |
| 4 | `getAudioContext()` replaces Tone's load-time default context | Importing `tone` creates one, so "nothing touches it first" can't hold literally |
| 4 | Defaults before `configure`: 120 BPM, swing 0, 4 bars, 4/4; `onLoop` fires at iteration 0; per-tick order `onLoop`, `onBeat`, `onSixteenth`, `onMidiPulse` | Unspecified |
| 5 | A slot of ≤ 2 sixteenths holds its bass for half the slot | Unspecified |
| 5 | Unmasking bass or chords mid-slot returns at the next chord change | Unspecified |
| 5 | `chordChangeTimes()` is when chords are *heard* (swing included), `[]` before `load` | Unspecified |
| 6 | Ports present at access fire `connected`, so the power warning shows for a Field plugged in before the app opened | Unspecified |
| 6 | Changing output turns clock out off with `FC` to the old port; `select()` sets both sides | Unspecified |
| 6 | Clock stats record every clock send (`F2`, `FA`, `F8`, `FC`); follow applies the estimate unrounded; `0xFB` restarts the beat count | Unspecified |
| 7 | `computeCalibration(offsets, { source, device, outputLatencyMs })` | The row's one-argument form can't build a full record |
| 7 | The DB upgrade `switch` can't fall through | `noFallthroughCasesInSwitch` rejects the plan's shape |
| 8 | `clockContextOf` unwraps Tone's private `_nativeAudioContext` | Tone's `rawContext` is a wrapper without `getOutputTimestamp`/`outputLatency`; decision 7's readout would always read "fit" |
| 8 | The shell doesn't show the audio gate; each sounding page puts `<AudioGate />` at the top | Unspecified |
| 8 | `Keyboard24`'s `key` prop is `musicKey` | `key` is React's |
| 8, 9 | `settings.clockOut` isn't applied or saved; clock out starts off every load | Sending clock unasked on load seemed wrong; question below |
| 9 | Modules import `'../../theory/index'` | Row 8's import-rule checker rejects the bare barrel |
| 9 | BPM encoder stays enabled in follow mode | Unspecified; question below |
| 10 | MODULE_CONTRACT follows AGENTS.md on dependencies; the Windows-pitfalls row in AGENTS.md now says a cloud container is Linux | Pre-flight answer; the run moved to the cloud |

## Questions for the owner

| From | Placeholder or question |
| --- | --- |
| 3 | Should lower-case `maj7` give mMaj7 (decision 3) or plain maj7 (pre-flight table, as built)? How should mMaj7 print (`CmMaj7` now)? |
| 3 | A slash bass shows as a tension/avoid on the keyboard, not a chord tone. OK? |
| 5 | Every sound setting: envelopes, filters, levels, kick pitch (MIDI 36), velocities (bass 0.8, chords 0.45, kick 1, snare 0.9, hat 0.7 / 0.35) |
| 5 | Bass in a slot of two sixteenths or less: half the slot. OK? |
| 8 | The palette in `tokens.css`, including classification shades (dark / light): blue #4d8ff0 / #2f6fd6, cyan #35c4da / #0b8fa6, yellow #e6c440 / #b88a00, red #f05a50 / #c8322a |
| 8 | Power warning: `dismiss` button and yellow `!` badge |
| 8 | Keyboard: `octave 1` / `octave 2` toggle; keys capped at 72 px; rows 1.1 key widths tall; lit unclassified keys a solid mid-gray (literal "brighter" can't hold in light mode) |
| 8 | StatusBar `120 bpm`; no `home` nav entry (the title is the home link) |
| 8, 9 | Should clock out be remembered between loads (`settings.clockOut`)? |
| 9 | Nav icon `∿`; `family: 'dev'`; `write then read` / `checking`; `midi not requested`, `waiting for midi permission`, `midi ok`; `in <bpm> bpm, confidence <c>`; `out of range <n>`; `no events yet`; readout labels are the snapshot's field names; marks ✓ × ! ·; native checkboxes; one column, max width 3xl |
| 9 | Disable the BPM encoder while following? |
| 10 | The contract's wording; Phase 3 checklist step 5's 30-minute drain figure and step 6's "phone speaker is silent" reading of SPEC §6.3 |

## VERIFY items

| Row | Item | What was stubbed |
| --- | --- | --- |
| 6 | V6: clock before `0xFA` | Built as SPEC §3.4 (no pulses before `FA`); `stubbed` at `WebMidiBridge.clockOut` |
| 6 | V7: the Field's port name | No port picked by name; the user picks, remembered by id then name; `stubbed` |
| 6 | V5: Web MIDI clock jitter | Measurement built (`clockStats()`, loopback); still `open` for row 11 |
| 7 | V8: the Field's lowest key | `keyboardBaseNote` 53 (F3); `stubbed` |
| 8 | V3: Field charging from the phone | App-wide power warning on every MIDI input connect; `stubbed` |
| 4, 8, 9 | Decision 7: does `getOutputTimestamp` include output latency? | Not a VERIFY row; readout built, row 11 settles it on the phone. Headless Chromium read path `output-timestamp`, `outputLatency` 32 ms, `baseLatency` 10 ms, gap 42.4 ms (not recorded: not a device) |

No MIDI port was visible in this run, and nothing was sent to any port.

## Spine requests

| Lane | Change | Why |
| --- | --- | --- |
| 8 | `getAudioContext()` (`src/audio/TransportEngine.ts`): make a native `AudioContext` and pass it to `new Tone.Context({ context, lookAhead: 0.1, clockSource: 'worker' })`; then drop `src/ui/clockContext.ts` | `clockContextOf` reads a private field of standardized-audio-context; a Tone upgrade could silently put the clock back on the fit path |
| Laptop checks | `ClockFollower` (`src/input/ClockFollower.ts`): estimate BPM from the span of the kept pulses, (last − first) / (n − 1), not the median interval; keep the median for confidence | On Windows Chrome the Field's echoed clock arrives bunched (12.9–42 ms apart at 90 BPM). The median read 83 BPM at a true 90.01 and 155 at a true 120.04; the span gives 90.01 and 120.04. Follow would lock to the wrong tempo |
| 9 | Import-rule checker (`src/modules/__tests__/importRule.ts`, `areaOf`): accept a bare spine directory (`'../../theory'`) or resolve it to `<dir>/index`; then update `MODULE_CONTRACT.md` and `AGENTS.md` | Carried forward (3) says to import the barrel; the checker rejects it |

## Owner checks on the laptop (2026-10-22)

Windows 11 laptop, Chrome 155, the Field on USB-C, dev server, `/dev/spine?dev`.

- **Windows build:** `npm run check` failed typecheck. Three pure-logic files
  differed from their components only in case (`audioGate.ts` /
  `AudioGate.tsx`, `powerWarning.ts`, `statusBar.ts`), which Linux allows and
  Windows resolves to the wrong file. Renamed to `audioGateLogic.ts`,
  `powerWarningLogic.ts`, `statusBarText.ts`, with
  `src/__tests__/fileNames.test.ts` guarding it (1b3bbea). Check exits 0.
- **R9 `[ear]` desktop: pass.** No clicks; hats swung at 0.50 and straight at
  0.00 (at 120 BPM); unticking `bass` left drums and chords; no stray hat on
  three stop→start cycles 150 ms apart.
- **Field:**
  - The power warning shows on MIDI grant.
  - The port is `OP-1` (V7).
  - The lowest key is 53 (V8, resolved).
  - Field keys light the same on-screen key as touch.
  - Clock out with the Field in sync: the Field follows 90 and 120 BPM, with
    0 late sends.
  - Numbers are in `docs/HARDWARE_NOTES.md`.
- **Found:** the clock follower misreads bunched clock (spine request above).
- **Still open from the list below:** the R9 no-ports path (needs the Field
  unplugged), and all of R11.

## Checks only the owner can do

- **R9 no-ports path:** with MIDI allowed and nothing plugged in, the panel
  shows `! no midi` and the toggles are disabled. Headless Chromium only
  reached `midi permission denied`; the no-ports path ran in Vitest only.
- **R11, all of it (attended)**
  - `[phone]` clock readout, swing, touch, both themes and lock screen.
  - `[field]` power warning, port name, lowest key, notes light, and clock
    out with the Field in sync (`clockStats()` headroom; loopback if the
    Field echoes).
  - Firefox desktop and Firefox for Android.
  - Settling decision 7.
  - The steps are in `docs/HARDWARE_NOTES.md` → exit gate checks.
- **Before row 11's push:** GitHub **Settings → Pages → Source** =
  "GitHub Actions".

## 2: How to test this yourself

```bash
npm run check
```
1. Exit 0. `src/types/__tests__` passes: each validator accepts its fixture
   and rejects a missing `id`, a wrong `vector`, empty `steps`, an unknown
   drill `module` and a slot with `beats: 0`, naming the field.
2. `git grep -n --untracked "from '\.\./" -- src/types ':!src/types/__tests__'`
   prints nothing.

## 3: How to test this yourself

```bash
npx vitest run src/theory
```
1. All pass: the four SPEC §5.3 fixtures as pitch-class sets (bass 9 on
   `iv/1` and `VII/1`); `classify` over 12 pitch classes for G7/C and C7/Fm
   and F avoid on Cmaj7; `degreeName` `b6` and `#4`; `realize` over every
   suffix and case, `bVII` = B♭; `loadProgression` throws on `xii` and on
   15 beats; Dm7 → G7 voice leading and `commonTones(Fm7, B♭m7)` = {5, 8};
   F minor names `Gdim C7 Fm D♭`.

## 4: How to test this yourself

```bash
npx vitest run src/audio
```
1. "SPEC §3.3 worked number" (+22 ms, +7 ms calibrated), "fallback fit",
   swing at 90 BPM, "tempo anchors" (tick 960 ↔ 4.667 s) and
   "TransportCore" (96 straight pulses, last at 1.979 s) pass.
2. `git grep -n --untracked "from 'tone'" -- src/audio/Clock.ts src/audio/timing.ts src/audio/__tests__`
   prints nothing.
3. Known rough: the Tone driver and wake lock first ran in row 9's headless
   probe; the wake lock is row 11's `[phone]` lock-screen check.

## 5: How to test this yourself

```bash
npx vitest run src/audio
```
1. `voicing.test.ts`: voiced notes ≥ 52, bass 40–51 under the voicing,
   voicing pitch classes = `chordTones`; slots 0/0/1 at ticks 0/767/768 and
   starts 0, 768, 1536, 2304.
2. `drumPatterns.test.ts`: 16 steps with the placeholder hits.
3. Read `src/audio/drumPatterns.ts` and confirm the placeholder pattern.
4. The `[ear]` checks are row 9's, above.

## 6: How to test this yourself

```bash
npx vitest run src/input
```
1. Passes 5 files: 96 `F8` at 120 BPM within 0.5 ms and 20.833 ms apart,
   `F2 00 00`, `FA`, `F8` first with equal stamps, `FC` after stop with no
   later `F8`; swing leaves pulses unchanged; velocity-0 on channel 10 is an
   `off`, 64 → 0.504, unplug emits two `off`s; `unsupported` / `denied`;
   follower 100.0 ±0.1 BPM, confidence ≥ 0.95, a dropped pulse moves it
   < 0.1, 10 pulses give 0; every stub throws `NotImplementedError`.
2. Nothing has touched a real port: row 11's `[field]` checks are the first.

## 7: How to test this yourself

```bash
npx vitest run src/state
```
1. Upgrade from 0 creates the five stores with key paths and indexes;
   export round-trips and `dbVersion: 2` / `app: 'other'` are rejected by
   name; settings with nothing stored, `{not json` and a throwing storage
   give the defaults (`theme` `dark`) and an unknown key is dropped; 16
   offsets give the median, 15 throw; no `indexedDB` rejects readably.
2. The real IndexedDB round trip is row 9's `db ok`.

## 8: How to test this yourself

```bash
npm run dev
```
Open `http://localhost:5173/op-1-school/` in Chrome.
1. In DevTools run `localStorage.clear()` and reload: dark page, nav shows
   `op-1-school` and `light`, main says `modules arrive in phase 2`, status
   reads `120 bpm  internal  no midi  touch needs calibration`, no console
   errors.
2. `http://localhost:5173/op-1-school/nope` shows `no page here`.
3. Click `light`: light gray page, button reads `dark`; reload stays light;
   click `dark` to go back.
4. Narrow below 700 px: nav at the bottom; wider: nav on the left.
5. `npm run check` covers `keyboardLayout` (12 keys ≥ 40 px at 360 px, 24 at
   800 px, note mapping), `encoderMath` clamping, and the import rule
   (including failing on a scratch tree).

## 9: How to test this yourself

```bash
npm run dev
```
1. `http://localhost:5173/op-1-school/dev/spine` says `no page here` with no
   `dev spine` in the nav; `…/dev/spine?dev` shows transport, chord,
   keyboard, midi, clock, midi timing, database and log.
2. `tap to start audio`, then `start`: `currentTime` climbs; the chord reads
   Gdim ii°, C7 V7, Fm i, D♭ VI, one per bar; no console errors.
3. Press and release the lowest key (F): it lights while held; the log
   shows `touch on 53 …` then `touch off 53 …`.
4. `request midi` with nothing plugged in: Allow gives `! no midi`
   (yellow), Block gives `× midi permission denied` (red); either way
   `clock out` and `follow` are greyed out.
5. `write then read` shows `✓ db ok`.
6. `[ear]`, loop running: no clicks; off-beat hats lag at swing 0.50 and sit
   straight at 0.00; unticking `bass` leaves drums and chords; listen for a
   stray hat on a quick stop→start.

## 10: How to test this yourself

1. Read `docs/MODULE_CONTRACT.md`. It's the page every Phase 2 lane reads
   first.
2. Read `docs/HARDWARE_NOTES.md` → the exit gate checks, which is row 11's
   script with blanks for results.
3. `git grep -n "once it exists" -- AGENTS.md` prints nothing.

---

## Process retro

### Last retro's recommendations

None: this is the repo's first retro (`.agents/retros/` didn't exist).

### Timeline

All times UTC, 2026-10-22. "Fix rounds" are the orchestrator's (one was
allowed per row); the subagents' own fix-and-recheck rounds are in brackets.

| Row | Start | Subagent done | Committed | Wall time | Fix rounds |
| --- | --- | --- | --- | --- | --- |
| Pre-flight | — | — | 02:18 | — | — |
| 2 (local) | 02:18 | — | 02:24 | 6 min | 1 |
| 3 (local) | ~02:24 | stopped before writing anything | — | — | — |
| *move to cloud; resume, `npm ci && npm run check` pass* | 09:27 | | | | |
| 3 | 09:28 | 09:32 | 09:33 | 5 min | 0 (0) |
| 4 | 09:34 | 09:41 | 09:41 | 7 min | 0 (1) |
| 5 | 09:42 | 09:48 | 09:48 | 6 min | 0 (1) |
| 6 | 09:49 | 09:58 | 09:58 | 9 min | 0 (1) |
| 7 | 09:59 | 10:01 | 10:01 | 2 min | 0 (1) |
| 8 | 10:02 | 10:14 | 10:15 | 13 min | 0 (2, probe scripts only) |
| 9 | 10:16 | 10:21 | 10:22 | 6 min | 0 (1) |
| 10 | 10:22 | 10:24 | 10:25 | 3 min | 0 (0) |

Rows 3–10 in the cloud took about an hour, wall clock. Every row was
pushed to `origin/phase-1-spine` as it was committed. The container's
stop hook asks for a clean, pushed tree at every turn end, and the owner
had asked for the branch to be pushed anyway.

### Friction

- **[plan]** Pre-flight answers that override a numbered decision left the
  decision's text standing. In R3, decision 3's lower-case `maj7` = mMaj7
  clashed with the suffix table, and the subagent had to pick. R5's row text
  ("close position") and R6's (`FC` with no timestamp, the ≈100 ms caveat)
  also contradicted their answers. The "answers win" rule worked, but each
  subagent spent time noticing it.
- **[plan]** Owns lists were too tight in places. R4 had nowhere Tone-free
  for the engine logic, so `TransportCore` went into `timing.ts`. R5
  duplicated R4's `FakeDriver` because there's no shared `src/audio/__fakes__`.
- **[plan]** R9's labels didn't cover every string the page needed (MIDI
  states, the db button, follower readout, empty log), so there were nine
  placeholders.
- **[spec]** Tone's `rawContext` is a standardized-audio-context wrapper.
  SPEC §3.1 and R4's "construct from `rawContext`" would silently disable
  the `getOutputTimestamp` path. R8 caught it in the browser; Vitest never
  could.
- **[spec]** SPEC §5.2 puts degree naming in `scales.ts`; the row put it in
  `progressions.ts`. SPEC §5.5 says "list dependencies in your PR";
  AGENTS.md says ask first.
- **[run-steps]** The pre-flight's check notes are tied to one machine (the
  Field plugged into the PC). Moving to the cloud needed the owner to
  restate them.
- **[run-steps]** The skill's pre-flight assumes `main` with the last plan
  merged. A resume mid-plan needed the owner to waive that by hand.
- **[step]** Subagents mostly assumed "no browser" until told otherwise. The
  container has Chromium and a global Playwright (ESM import by absolute
  path; `NODE_PATH` doesn't work for ESM).
- **[step]** The step skill had stale "once it exists" qualifiers. R10
  fixed them.
- **[AGENTS.md]** / **[tools]** `.agents/windows-tool-pitfalls.md` didn't
  apply in Linux. R10 reworded its AGENTS.md row. Writing scripted edits to
  files still held.
- **[writing-a-plan]** R4 and R5's Done-whens are pure Vitest, but the Tone
  wrappers they own were only type-checked until R9. That's a long gap
  between building audio code and first running it.

### Orchestration

- **Overrides:** they held. No row hit (c). Every creative gap went to (b)
  and is listed above. (d) was used only through the VERIFY stubs.
- **Paths:** every row stayed in its Owns, plus the docs `/step` updates
  (VERIFY log, AGENTS.md conventions). R8 touched `vite.config.ts` only in
  `themeColor`'s comment. R10's AGENTS.md Windows-row change sits within its
  Owns.
- **Carried forward:** enough. I relayed by hand only:
  - R8's `rawContext` finding into R9's prompt;
  - the browser recipe for R8 and R9;
  - the barrel-import finding into R10's prompt.

  Carried forward grew long (rows 3–9 each added 4–9 bullets); R10 moved the
  durable ones into AGENTS.md and the contract.
- **Spot-checks:** they agreed with the reports every time. The one scare
  (no D♭ in R9) was my own probe's regex.
- **Merges:** none; steps only.

### Verification gaps

- **Sound:** nobody has heard the loop. A `/dev/spine` readout of
  scheduled-vs-planned onset times per part (from `planSixteenth`) would let
  an agent check swing and masks numerically in the browser. Clicks still
  need an ear.
- **Real MIDI:** only fakes and the refused-permission path have run. A
  virtual MIDI loopback (ALSA `snd-virmidi` in the container) could exercise
  ports, clock out and loopback stats unattended. Installing it is a program
  to ask the owner about.
- **IndexedDB:** `importData`/`exportData` and calibration get/put have only
  run against fakes. A `/dev/spine` button doing an export→import round trip
  would cover it in the browser.
- **Decision 7:** settleable only on the phone (row 11).
- **Wake lock and lock screen:** phone only.

### Recommendations (ranked)

1. **Fix the audio context before Phase 2.** `getAudioContext()` should build
   a native `AudioContext` and hand it to `Tone.Context`; delete
   `clockContextOf`. That's one small Opus step on `TransportEngine.ts` and
   `spine.tsx`, with R9's browser probe as its check. Otherwise every
   timing-scored module rests on a private library field. Settle it before
   row 11 so the exit gate measures the final code.
2. **Make the import-rule checker accept spine barrels**
   (`src/modules/__tests__/importRule.ts`), then update `MODULE_CONTRACT.md`
   and `AGENTS.md`. Tiny, and it removes a trap every Phase 2 lane would hit.
3. **Teach `/step` and `/run-steps` about the cloud browser.** Add a short
   "browser checks in a cloud container" recipe to `.claude/skills/step/`:
   global Playwright by absolute ESM import, headless Chromium, the dev
   server, read text and console, stop both. Also make `/run-steps`' check
   notes per-environment, with a "resuming a plan" path that skips the
   `main`/merged check. This changes two skill files. It turned row 8 and
   row 9's browser items from OWNER into real checks.
4. **When a pre-flight answer overrides a numbered decision, edit the
   decision too** (`.agents/writing-a-plan.md` and the run-steps pre-flight
   step 5). That's a few lines, and it saves each subagent from finding the
   conflict.
5. **Add `src/audio/__fakes__/` (or move `FakeDriver` next to the input
   fakes)** and give plans' Owns room for a Tone-free engine file. Small;
   it stops test fakes from being copied between rows.
6. **Consider a virtual MIDI loopback for unattended MIDI checks.** It needs
   the owner's OK to install a program; it would make clock out, follow and
   jitter checkable before the Field is in hand.
