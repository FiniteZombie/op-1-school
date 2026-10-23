# Phase 2 — curriculum, Module 1, Runner

Builds SPEC §6.2: the curriculum content, Module 1 (Progression Trainer,
levels A0–A6) and Module 5 (Runner), as three parallel lanes. Before them
comes one spine step (the contracts the lanes share), and after them an
integration step and the owner's exit gate. Written 2026-10-23.

The phase's goal is SPEC §1's daily-use target: open the app on the phone
next to the Field, run a 15-minute guided session with procedural backing,
log results, with no cable required.

| Row | Name | Kind | Model | Branch | Merge order | Status | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Spine contracts | step | Opus 5.5 | `phase-2-fan-out` | — | **Next** | |
| L1 | Curriculum | lane | Opus 5.5 | `phase-2-fan-out-curriculum` | 1 | | |
| L2 | Module 1, Progression Trainer | lane | Opus 5.5 | `phase-2-fan-out-module-1` | 2 | | |
| L3 | Runner | lane | Sonnet 5.5 | `phase-2-fan-out-runner` | 3 | | |
| S2 | Integration | step | Opus 5.5 | `phase-2-fan-out` | — | | |
| G | Exit gate (**attended**) | step | — | `main` | — | | |

### Carried forward

### Process notes

## How this plan runs

- **`/run-steps` runs S1, L1–L3 and S2 unattended**, then stops before G.
  S1 is a step on the `phase-2-fan-out` branch and is committed before any
  lane starts. The three lanes then start together, each in its own worktree
  cut from the plan branch **after** S1's commit: before checking a lane, the
  orchestrator confirms `git merge-base --is-ancestor <S1 commit> HEAD` in its
  worktree. Lanes merge into the plan branch in the order above
  (`--no-ff`, `npm run check` after each). S2 runs on the merged plan branch.
- **G is attended.** After `/retro` and after the owner merges the plan
  branch into `main`, the owner runs G with `/step` from the phone.
- **No lane needs another lane's files to build or test.** Each lane reads
  the others only through S1's contracts: lesson and progression JSON through
  `src/curriculum/index.ts` and `src/types/lessons.ts`, drill launches and
  results through `src/types/drills.ts`, available modules through
  `src/ui/availableModules.tsx`. Tests in L2 and L3 use their own fixtures
  (or `SPEC_FIXTURES`), never the curriculum's content, which L1 replaces.
- **Nothing in this plan adds a dependency.** No markdown library, no test
  DOM: the Runner's card renderer is hand-rolled and pure.
- **Shared files.** `package.json`, the lockfile, `AGENTS.md`, `SPEC.md`,
  `docs/HARDWARE_NOTES.md` and `docs/MODULE_CONTRACT.md` belong to no lane.
  S1 and S2 edit the docs; a lane reports the doc change it needs.

## Decisions this plan makes

Technical calls. They win over SPEC where they differ. The owner's calls are
under [The owner's calls](#the-owners-calls-2026-10-23).

1. **A drill is launched by URL.** The Runner (or the library, or a deep
   link) navigates to the module's route with a query that
   `src/types/drills.ts` encodes and parses (S1): `mode` (the level id,
   `A0`…), and optionally `session`, `lesson`, `progression`, `minutes`,
   `returnTo` (an app path) and `params` (the step's `params` as JSON). `?dev`
   survives as it does today. The query is the whole hand-off: no shared
   in-memory state, so a reload mid-drill reopens the same drill.
2. **A drill's result is an `Attempt` row.** A module writes one `Attempt`
   when a drill **finishes** (time up, or `finish` after at least one full
   loop), never for an abandoned one (navigating away, or `stop` before a
   loop). `module` is the module id, `mode` the level id, `score` is 0..1 or
   absent for an unscored drill, `offsets` holds `TimingOffset`s for timed
   levels (a tap on the A0 pad has `note: -1`), and `data` is the module's own
   detail. With a `session` in the launch, the attempt's `sessionId` is it and
   the module doesn't touch the session row (the Runner owns it). Without
   one, the module writes its own `Session` with `kind: 'practice'`.
3. **Sessions gain two optional fields** (types gain fields, S1):
   `kind?: 'daily' | 'practice'` (absent reads as `daily`) and
   `segments?: SessionSegment[]` (`{ lessonId, startedAt, finishedAt?,
   skipped? }`). A daily session's `lessonId` is `'daily'`. IndexedDB stores
   them as is, so `DB_VERSION` stays 1 and no upgrade case is added.
4. **Level gates** (SPEC §4): level N+1 of a vector opens once level N has
   two finished attempts with mode `<vector><N>` whose `score` is ≥ 0.7 or
   absent (absent = unscored, so a finish counts). Practice attempts count.
   The lowest level of each vector is always open. The gate is the Runner's
   (pure, L3); Module 1's own level picker shows every level (it's practice).
5. **Mode ids are spine data.** `DRILL_MODES` in `src/types/drills.ts` lists
   each drill module's modes: `progression-trainer` A0–A6, `pocket-dojo`
   B0–B6, `sample-flip` C1–C3, `kit-compiler` none. L1's tests check every
   drill step's mode against it; L2 handles every `progression-trainer` mode;
   L3 launches by it.
6. **The tap window is a spine constant fed by a measurement** (SPEC §3.3).
   `TAP_OFFSETS` in `src/audio/tapWindow.ts` holds, per input source
   (`touch`, `midi`), the measured `medianMs` and `iqrMs`, or `null` for a
   source with no measurement. `tapWindow(source)` derives the window from
   it by the owner's rule (2026-10-23): centred on `medianMs`, half-width
   `toleranceMs = max(iqrMs, TAP_TOLERANCE_FLOOR_MS)`, the floor being 20 ms.
   `tapVerdict(offsetMs, source, calibrated)` returns `early`, `on`, `late`
   or `unscored`: a calibrated offset is centred on 0 instead of the median
   (same half-width), and a source with no measurement is `unscored`. Mic is
   always `unscored` in Phase 2.
   - `medianMs` and `iqrMs` are copied from `docs/HARDWARE_NOTES.md` **Tap
     offsets** as written there: the latest Android row per input, `Field
     keys …` for `midi` and `touch …` for `touch`. Nobody picks a tolerance
     by feel.
   - A test reads the **Tap offsets** table and fails if the constant and
     the table disagree, so the doc and the code can't drift.
   - **VERIFY V9 (resolved by S1).** The table has both rows (2026-10-23,
     Android 10, Chrome 155, 90 BPM): Field keys median −5.7 ms, IQR 46.7,
     so `on` is −52.4 to +41.0 ms; touch median −43.2 ms, IQR 46.5, so `on`
     is −89.7 to +3.3 ms. The touch row was measured with silent keys;
     decision 8's touch voice may move it, so G re-measures it and updates
     the row and the constant together.
   - Worked example, the touch window, no calibration. At 90 BPM a beat is
     666.7 ms. On `FakeClockBridge(5000, 0.029)` a chord change scheduled at
     audio 10.000 s is heard at `audibleAt(10.000)` = 15 029 ms. A pad tap at
     14 999 ms reads `offsetMs` = −30.0; from the −43.2 median that's
     +13.2, inside ±46.5, so `on`. A tap at 15 039 ms reads +10.0, which is
     +53.2 from the median, so `late`: with silent keys the owner tapped
     about 43 ms ahead of the sound, so a tap 10 ms after it reads late
     against that habit. The drill keeps the raw offset in `offsets` either way.
7. **When a played note counts.** A note answers the slot that was being
   *heard* when it was played: `heardAudioTime(perfTs, clock)` (S1, in
   `Clock.ts`) inverts `audibleAt`, and `synth.currentSlot()` of that time is
   the slot. On `FakeClockBridge(5000, 0.029)`, a note at 15 000 ms was heard
   against audio time 9.971 s; if slot 2 starts at 9.980 s, the note answers
   slot 1. There's no grace window into the next slot.
8. **Touch notes make a sound.** Phase 1's touch keys are silent, which
   makes unplugged A2 ("permission to make sound") pointless. S1 adds a small
   touch voice to the spine that plays `touch` notes only (the Field sounds
   by itself) with a placeholder sound.
9. **Home is the Runner** once it's registered: `/` resolves to the module
   with id `runner` if the registry has it, else `COPY.home` as today. The
   Runner's own route stays `/runner`.
10. **Modules learn what's available from a context, not the registry.**
    `AppShell` (the one importer of the registry) provides the visible
    modules' `{ id, route }` through `useAvailableModules()`
    (`src/ui/availableModules.tsx`, S1). The Runner stubs a drill whose
    module isn't there (B and C drills in Phase 2).
11. **Field operations in card text come from the docs.** A button combo or
    menu path on the Field goes into a card only if SPEC §2/§4 or
    `docs/HARDWARE_NOTES.md` states it. Anything else is written as the
    musical idea plus `(field steps: VERIFY)`, and L1 lists each one.

## Rows

### S1. Spine contracts

**Owns:** `src/types/drills.ts` and `src/types/__tests__/drills.test.ts`
(new); `src/types/lessons.ts` is untouched. `src/state/db.ts` (decision 3's
fields only). `src/audio/Clock.ts` (`heardAudioTime`),
`src/audio/tapWindow.ts` (new), `src/audio/NoteVoice.ts` (new, the touch
voice) and their tests in `src/audio/__tests__/`. `src/theory/chords.ts`
(`qualityFamily`) and its test. `src/ui/router.ts`, `src/ui/navigation.tsx`,
`src/ui/AppShell.tsx`, `src/ui/availableModules.tsx` (new),
`src/ui/Keyboard24.tsx`, `src/ui/keyboardLayout.ts`, `src/ui/spine.tsx`
(wiring the touch voice) and their tests. `src/curriculum/` (new: the loader,
its test, and seed data). `docs/MODULE_CONTRACT.md`, `AGENTS.md` (**Repo
conventions**), `docs/HARDWARE_NOTES.md` (V9 row only).

**Builds:**

- `src/types/drills.ts`: `DRILL_MODES` (decision 5), `DrillLaunch`,
  `launchQuery(launch): Record<string, string>` and
  `parseLaunch(query): { launch } | { error }` (decision 1; an unknown mode
  for the module, a bad `minutes` or unparseable `params` is an error naming
  the field), `levelId(vector, level)` (`'A', 0` → `A0`).
- `src/state/db.ts`: decision 3's `Session.kind`, `Session.segments`,
  `SessionSegment`; doc comments on `Attempt.score` (0..1, absent =
  unscored) and decision 2's rules.
- `src/audio/Clock.ts`: `heardAudioTime(perfTs, clock)` (decision 7), pure,
  for both clock paths.
- `src/audio/tapWindow.ts`: `TAP_OFFSETS`, `TAP_TOLERANCE_FLOOR_MS`,
  `tapWindow`, `tapVerdict` (decision 6), with `TAP_OFFSETS` copied from the
  **Tap offsets** table as it stands when S1 runs. Its test parses the table
  from `docs/HARDWARE_NOTES.md` with `node:fs`.
- `src/audio/NoteVoice.ts`: a Tone `PolySynth` that subscribes to the bus
  and plays `touch` `on`/`off` (decision 8). Built in `createSpine()` after
  `getAudioContext()`; it never sounds before the audio gate. The Tone part
  stays thin; anything with logic (which events it voices) is a pure function
  next to it with a test.
- `src/theory/chords.ts`: `qualityFamily(quality)`: `maj7` → `maj7`, `7` →
  `7`, `m7` → `m7`, `m7b5` → `m7b5`, `sus2`/`sus4` → `sus`, anything else →
  `null`. A3's answer set (L2) and its progression filter (L1's test) both
  use it.
- `src/ui/router.ts` and `navigation.tsx`: queries. `hrefFor(path, base,
  dev, query?)` writes the query in insertion order and `dev` last;
  `navigate(path, query?)`; `Link` gains `query`; `AppLocation` gains `query`
  (every parameter but `dev`). Decision 9's home: `resolveRoute` returns the
  `runner` module for `/` when the module list has one.
- `src/ui/availableModules.tsx`: `AvailableModulesProvider` (used by
  `AppShell`) and `useAvailableModules()`, decision 10.
- `Keyboard24` gains `guide?: readonly PitchClass[]`: unlit keys of those
  pitch classes carry a mark (placeholder: a small dot in `--op-muted`) and
  `data-guide="true"`. A2 uses it for the pentatonic.
- `src/curriculum/index.ts`: `progressionSpecs()`, `progressions()` (loaded
  with `loadProgression`), `progressionById(id)`, `lessons()` (every
  `lessons/*.json`, sorted by vector then level), `lessonById(id)`,
  `sequencerRecipes()`. It reads the JSON through `import.meta.glob(…, {
  eager: true })` and a pure `buildCurriculum(raw)` that validates every
  record with `src/types/lessons.ts`; an invalid record is dropped with a
  `console.error` naming the file and field. `src/curriculum/__tests__/loader.test.ts`
  tests `buildCurriculum` on inline data only.
- **Seed data**, so the lanes have something to load. L1 replaces all of it:
  `progressions.json` holds SPEC §5.3's four fixtures with ids `seed-…`;
  `sequencerRecipes.json` one recipe; `lessons/a0.json` (a card and an A0
  drill on `seed-cmajor`), `lessons/b0.json` (a card and a `pocket-dojo` B0
  drill), `lessons/d0.json` (a card). Every seed title is
  `placeholder seed …`.
- Docs: `MODULE_CONTRACT.md` says `src/curriculum/` exists (drop "doesn't
  exist yet…") and adds a **Drills** section (decisions 1, 2, 5–7, 10:
  what a module reads from the launch and what it writes). `AGENTS.md`
  **Repo conventions**: one bullet on the drill contract and one on the tap
  window. `HARDWARE_NOTES.md` VERIFY log: V9, tap bias and tolerance per
  input source (decision 6), `resolved`, with both windows, the rule, and
  that touch is re-measured with the touch voice at G.

**Done when:**

1. `npm run check` exits 0.
2. `drills.test.ts`: a launch round-trips through `launchQuery` and
   `parseLaunch` with every field; `mode=A9` for `progression-trainer`,
   `minutes=0` and `params={` each return an error naming the field;
   `DRILL_MODES['progression-trainer']` is `A0`…`A6`.
3. `clock.test.ts`: `heardAudioTime(audibleAt(t))` returns `t` within 1e-6 s
   on `FakeClockBridge(5000, 0.029)` and on a `WebAudioClockBridge` over a
   fake context on each path; decision 7's example gives 9.971 s.
4. `tapWindow.test.ts`: on decision 6's worked example (the measurement
   injected as data, not read from the constant) the tap at 14 999 ms is
   `on` and the one at 15 039 ms `late`; an IQR of 12 ms gives a ±20 ms
   window (the floor); calibrated offsets centre on 0; a source with no
   measurement and `mic` are `unscored`; and `TAP_OFFSETS` matches the **Tap
   offsets** table, row for row.
5. `chords.test.ts`: `qualityFamily` for every member of `CHORD_QUALITIES`.
6. `router.test.ts`: `hrefFor('/progression-trainer', '/op-1-school/', true,
   { mode: 'A3', session: 'x' })` is
   `/op-1-school/progression-trainer?mode=A3&session=x&dev`; the location's
   `query` leaves out `dev`; `/` resolves to a fake `runner` module when the
   list has one and to `home` when it doesn't.
7. `loader.test.ts`: `buildCurriculum` keeps valid records, drops an invalid
   one with an error naming it, and sorts lessons by vector then level.
8. In the browser pane on the dev server, `/dev/spine?dev`: tapping a key
   after the audio gate logs a touch `on` as before, the page console has no
   errors, and `/` still shows `modules arrive in phase 2` (no Runner yet).
   `[ear]` the touch voice is the owner's (G).
9. `git grep -n --untracked "doesn't exist yet" -- docs/MODULE_CONTRACT.md`
   prints nothing; the VERIFY log has V9 as `resolved`.

### L1. Curriculum

**Owns:** `docs/CURRICULUM.md` (new), `src/curriculum/progressions.json`,
`src/curriculum/sequencerRecipes.json`, `src/curriculum/lessons/**`,
`src/curriculum/__tests__/content.test.ts` (new). Not
`src/curriculum/index.ts` or `loader.test.ts`.

**Consumes:** `src/types/lessons.ts` (shapes and validators),
`src/types/drills.ts` (`DRILL_MODES`), `src/theory` (`loadProgression`,
`qualityFamily`, `chordTones`), `src/curriculum/index.ts`.

**Builds** SPEC §4 and §6.2's row as content. All prose is a **draft** for
the owner to edit: `CURRICULUM.md` says so in its first line.

- `docs/CURRICULUM.md`: the four vectors, one section per level with its
  skill, drill and what's scored (SPEC §4 tables); the non-app drill (ask
  the Push player, §4.1); C's cards and the 10-second live resample loop
  (§4.3); D's Field cards (§4.4). Decision 11 for every Field operation.
- `progressions.json`: at least 12 progressions over SPEC §4.1's six
  families (modal pendulum, jazz-hop turnaround, cinematic walkdown, pedal
  point, i–v–iv, I–V–vi–IV), at least four in a major mode and four in a
  minor one, every `style` used at least once (only `chillhop-rhodes` has
  its own drums today; the rest fall back, which is fine). At least two
  progressions where every chord's `qualityFamily` isn't `null` (A3), and at
  least two with `bars: 4` (A6's call-and-response). The `seed-…` entries
  go unless a lesson uses them.
- `sequencerRecipes.json`: SPEC §4.2 B6's recipes (finger sequencer
  variations, endless 5/6/7-step motifs, tombola), decision 11 for steps.
- `lessons/*.json`, one file per level, named `<vector><level>.json`
  (`a0.json`), id the same without `.json`: A0–A6, B0–B6, C1–C3, and D cards
  `d0.json` onwards (one per §4.4 topic). `minutes`: A 4, B 5, C and D 6
  (the Runner's 0–4 / 4–9 / 9–15 flow). `scored` follows SPEC §4's "Scored?"
  column (A2 is `false`); B1–B5 are `true`, every other B, C and D lesson
  `false`. Each A lesson has one or two short cards, then its
  `progression-trainer` drill on a progression that suits the level (A3 on
  an A3-ready one; A6 has two drill steps, `params.form` `phrase` then
  `call-response`, the second on a 4-bar progression). B lessons drill
  `pocket-dojo` and C lessons `sample-flip` at their own level ids; those
  modules come later.

**Done when:**

1. `npm run check` exits 0.
2. `content.test.ts`, through `src/curriculum/index.ts`, passes and asserts:
   every file validates with no errors and nothing is dropped; ids are
   unique; every progression loads with `loadProgression`; the counts and
   families above; every lesson listed above exists; each drill step's
   `mode` is in `DRILL_MODES[module]` and equals its lesson's level id;
   every `progressionId` exists; A3's progression is A3-ready; A6's
   `call-response` step's progression has `bars: 4`.
3. `git grep -n --untracked "seed-" -- src/curriculum/progressions.json src/curriculum/lessons`
   matches only seed progressions a lesson still uses (expected: none).
4. Every `(field steps: VERIFY)` in the content is listed in the report, and
   so is every Field operation that *is* stated, with the SPEC or
   HARDWARE_NOTES line it came from.

### L2. Module 1, Progression Trainer

**Owns:** `src/modules/progression-trainer/**`.

**Consumes:** `useSpine()` (transport, clock, bus, settings),
`ToneBackingSynth`, `transportConfigFor`, `src/theory`, `Keyboard24` (with
`chord`, `musicKey`, `guide`), `AudioGate`, `src/types/drills.ts`,
`tapVerdict`, `heardAudioTime`, `offsetMs`, `getCalibration`, `openAppDb`,
`src/curriculum/index.ts`, `navigate`/`useLocation`.

**Builds** SPEC §4.1's seven levels and §5.5's Module 1 row. Pure logic
(scoring, retiming, the drill state machine, answer matching) lives in `.ts`
files apart from the views, each with a Vitest test; views stay thin.

- **Page.** `/progression-trainer` (`module.ts`: id `progression-trainer`,
  phase 2, title and icon placeholders). Without a launch query: a level
  picker (every level open, decision 4) and a progression picker showing
  only progressions the level can use. With one (decision 1): that drill,
  ready to start. A bad query shows the parse error (placeholder) above the
  pickers. The `AudioGate` is at the top; `start` is disabled until audio
  runs.
- **Drill lifecycle** (a pure state machine): `ready` → `running` (the drill
  configures the transport from its progression and starts it) → `finishing`
  (time up: it ends at the next loop end) → `done` (attempt written, result
  shown). The transport stopping from outside (the page hidden, `visibilityAction`)
  makes it `paused`: the clock stops counting and `start` resumes from bar 1
  with the time left. `stop` before one full loop is abandoned (nothing
  written); `finish` after one writes the attempt. Leaving the page stops
  the transport and writes nothing. Clock out and follow are left as the
  spine has them.
- **Time.** `minutes` from the launch, else the level's default (2 for A2,
  4 for the rest). Counted while running.
- **What each level shows** (classification is `Keyboard24`'s `chord` prop):

  | Level | Backing mask | Chord name shown | Keyboard classifies | Guide |
  | --- | --- | --- | --- | --- |
  | A0 | all | no | no | — |
  | A1 | drums, bass | no | no | — |
  | A2 | all | yes | yes | pentatonic |
  | A3 | all | no | no | — |
  | A4 | all | yes | no | — |
  | A5 | all | yes | yes | — |
  | A6 | all | yes | yes | — |

- **A0, hear the harmonic rhythm.** A tap pad (pointer-down
  `timeStamp`, source `touch`, `note: -1`) plus any `on` from the bus counts
  as a tap. The drill retimes the progression's chords to 8, then 4, then 2
  beats per chord (repeating the sequence when the bar count would be
  fractional), and steps down a stage after a loop scoring ≥ 0.7, or after
  two loops when the loop is unscored; a stage change stops, reconfigures
  and restarts the transport at the loop end. A **change** is a slot start
  whose chord (name and bass) differs from the slot before it, the loop's
  last slot counting as before the first; the drill's first downbeat isn't
  one. Each change takes the nearest unmatched tap within half the stage's
  slot length; other taps are **extra**. Each match is `tapVerdict`ed. Score =
  `on` matches ÷ (changes heard + extra taps); absent when any match is
  `unscored` (a source with no measurement). Worked: decision 6's example, at stage 1 on
  `seed-cmajor` at 90 BPM (a change every 5.333 s).
- **A1, bass root as degree.** The first `on` in each heard slot (decision
  7) answers it: right if its pitch class is the slot's bass
  (`chord.bass ?? chord.root`). The reveal after each slot shows the bass's
  `degreeName`. Score = right ÷ slots heard (unanswered is wrong). Worked:
  `I–V–vi–IV` in C has degrees 1, 5, 6, 4; a G2 played in slot 2 is right
  and reveals `5`.
- **A2, pentatonic safety net.** A clash is an `on` whose pitch class isn't
  in `pentatonic(key)`. Unscored (`score` absent); `data` keeps notes and
  clashes.
- **A3, chord quality.** Buttons for the five families (`m7`, `7`, `maj7`,
  `m7b5`, `sus`); the first tap in each heard slot answers it, right if it
  equals `qualityFamily` of the slot's chord. Only progressions where every
  chord has a family are offered. The reveal names the quality and lights
  its `guideTones` on the keyboard's guide. Score = right ÷ slots heard.
- **A4, common tones vs moving tone.** The progression's consecutive chord
  pairs (the last to the first included, identical pairs skipped) become
  two-chord vamps, played in turn (each chord for its own beats). Per pair,
  two questions answered by playing keys and tapping `submit`: the **common
  tones** (the set of played pitch classes equals `commonTones(a, b)`; an
  empty submit answers "none"), then the **moving tone**, played as two
  notes in order: the first chord's 7th (`guideTones(a).seventh`) and where
  `voiceLead(a, b)` sends it. SPEC's worked case, Fm7 → B♭m7: common F and
  A♭; moving E♭ → D♭ (−2; the tie with F goes down). Score = right ÷
  questions.
- **A5, guide tones.** A heard slot is right when its `on`s include both
  `guideTones(chord)` pitch classes. Every `on` is also counted by
  `classify` into `data`. After the drill, the **voice-leading map**: one
  row per consecutive pair, each guide tone of the first chord with where
  `voiceLead` moves it and by how many semitones (placeholder layout: a
  text list). Worked: Dm7 → G7 in C, F and C then B and F: C → B (−1),
  F → F (0). Score = right ÷ slots heard.
- **A6, target-note phrasing.** `params.form` is `phrase` (default) or
  `call-response`. Targets are the downbeats of odd bars (1, 3, 5, …), the
  drill's first downbeat excepted. Each target's candidate is the nearest
  `on` within half a beat; it lands when its pitch class is the 3rd of the
  chord at the target (`guideTones(chord).third`) and `tapVerdict` says
  `on` for its source (or pitch alone while `unscored`, the offset kept in
  `offsets`). In `call-response` (4-bar progressions only) bar 3 is the
  rest: its downbeat is still a target (the phrase lands there), and any `on`
  later than half a beat after it is a **rest break**, counted in `data`.
  Score = landed ÷ targets, times the share of loops with no rest break in
  `call-response`. Worked: F minor `ii°–V7–i–VI` at 90 BPM; a phrase over
  bars 1–2 lands on bar 3's Fm, so the target is A♭; an E♭ 400 ms after
  bar 3's downbeat (over the 333 ms half beat) breaks that loop's rest.
- **Results.** Per drill: score as a percentage (or `not scored`), counts
  (A0/A6: `on`, `early`, `late`, `missed`, `extra`; no milliseconds, since
  nothing is calibrated yet), the level's reveal, and `back to session` when
  the launch had `returnTo`. Colours by state token with the word always
  shown: `on` and right = `ok` (blue), `early`/`late` = `warn` (yellow),
  missed and wrong = `bad` (red), extra = `neutral` (gray).
- **Saving** (decision 2). `openAppDb()` rejecting (no IndexedDB) shows its
  message (placeholder heading) and the drill runs without saving.
- **Empty cases.** No usable progression for a level: a placeholder line,
  `start` disabled. No MIDI: touch only, nothing else changes. The Field
  unplugged mid-drill: its held notes get `off`s from the bridge; the drill
  goes on with touch.

**Done when:**

1. `npm run check` exits 0, including the import rule.
2. One Vitest file per level under `src/modules/progression-trainer/__tests__/`,
   each driving the level's scorer over `createFakeTransport()` and
   `FakeClockBridge(5000, 0.029)` with `SPEC_FIXTURES` (or a progression the
   test builds) at 90 BPM, swing 0.5, and asserting the worked example
   above, plus: A0 at every stage (change counts, an extra tap, the stage
   step-down, an unscored loop from a source with no measurement); A1 an
   unanswered slot; A2 a clash count; A3 a progression it rejects; A4 an
   empty common set; A5 a half-right slot; A6 a landing in each form and a
   rest break. Measurements are injected; no test reads `TAP_OFFSETS`'
   values, so a re-measured row doesn't break L2's tests.
3. Fake twin of `[field]`: a test sends the same note sequence once as
   `touch` and once as `midi` (through `WebMidiBridge` over
   `fakeMidiNavigator` and `FakeMidiInput.emit`, into a `NoteBus`) and gets
   the same A1 and A5 answers.
4. The drill state machine's test covers `ready → running → finishing →
   done`, `paused` and resume with the time left, abandon before a loop, and
   `finish` after one.
5. A test of the attempt builder: decision 2's fields for a scored, an
   unscored and a timed level, with and without a `session`.
6. In the browser pane on the dev server,
   `/progression-trainer?dev&mode=A1&progression=seed-cmajor&minutes=0.25`:
   the gate, then `start`; clicking keys lights them; after the time it
   shows a result. Read IndexedDB from the console: one new `attempts` row
   with `mode: 'A1'` and one `sessions` row with `kind: 'practice'`. The
   same with `mode=A0`, clicking the tap pad. The console has no errors.
7. `[phone]` and `[field]` items go to G (the owner's list).

### L3. Runner

**Owns:** `src/modules/runner/**`.

**Consumes:** `src/curriculum/index.ts`, `src/types/lessons.ts`,
`src/types/drills.ts`, `openAppDb` and the record types, `useAvailableModules()`,
`navigate`/`Link`/`useLocation`, `COPY`.

**Builds** SPEC §5.5's Module 5 row. Pure logic in `.ts` files with tests;
views thin.

- **Page.** `/runner` (`module.ts`: id `runner`, phase 2, title and icon
  placeholders). It is also `/` (decision 9). It shows today's plan (three
  segments with lesson titles and minutes), `start session`, the streak,
  recent sessions, a link to the library, and `export` for the last
  finished session.
- **Today's plan** (pure): segment A is the current A level's lesson (the
  highest open level, decision 4), B the current B level's (B0 all through
  Phase 2: nothing writes B attempts yet), C/D the C or D lesson least
  recently in a finished segment (never shown first; ties by vector, then
  level). A vector with no lessons drops its segment.
- **A session.** `start session` writes a `Session` (`kind: 'daily'`,
  `lessonId: 'daily'`, `segments` for the plan). Each segment shows its
  lesson's steps in order with an advisory countdown of the lesson's
  minutes: a card step shows its card and `next`; a drill step whose module
  is available launches it (decision 1, with `session`, `lesson`,
  `progression`, `minutes`, `params` and `returnTo: '/runner'`); one whose
  module isn't available shows a placeholder stub card with `skip`. Back on
  `/runner`, a drill step is done when an attempt for its module and mode
  exists in this session after its launch; otherwise it offers the drill
  again or `skip`. A segment is finished when its steps are done or skipped.
  When all are, the session gets `finishedAt` and `scores` (`{ <mode>:
  best score }`). Reloading `/runner` mid-session resumes the open session
  from today.
- **`?dev&fast`** divides every minute it passes to a drill (and its
  countdowns) by 12, so a 15-minute session runs in 75 s: S2's check and G's
  fake twin use it.
- **Streak** (pure): consecutive local calendar days, ending today or
  yesterday, with at least one finished daily session. Practice sessions
  don't count.
- **Summary export** (pure `sessionMarkdown`): date, each segment's lesson,
  each drill's score or `not scored`, the streak. `export` copies it and
  downloads `op-1-school-<date>.md`; if the clipboard refuses, the text shows
  in a box (as `/dev/spine`'s probe does).
- **Library.** Every lesson, grouped by vector, in level order. Opening one
  shows its cards with no session, cable or completed level needed; its
  drill steps launch as practice (no `session`) when the level is open and
  show `locked` (placeholder) when not.
- **Cards** render a markdown subset, pure and tested: paragraphs, `#`–`###`
  headings, `-` and `1.` lists, `**bold**`, `*italic*`, `` `code` ``. Any
  other syntax shows as text; there's no raw HTML.
- **Empty and failure cases.** No lessons: a placeholder line and no
  `start`. An empty database: A0, B0, streak 0. `openAppDb()` rejecting:
  its message shows, `start session` is disabled, the library still works.

**Done when:**

1. `npm run check` exits 0, including the import rule.
2. Vitest, on lessons and attempts the tests build (not the curriculum):
   - the gate: A1 opens after two A0 attempts at 0.7 and 0.8, not after one,
     nor after two at 0.6 and 0.9; an unscored level opens after two
     finishes; practice attempts count;
   - today's plan: the C/D rotation over three finished sessions; a missing
     vector drops its segment;
   - the step-done rule: an attempt before the launch, in another session,
     or for another mode doesn't count;
   - the streak across a gap, ending yesterday, ending two days ago (0), and
     with a practice-only day;
   - `sessionMarkdown` for a session with a scored, an unscored and a
     skipped drill;
   - the markdown subset, including text that looks like HTML;
   - `fast` scaling (4 minutes → 20 s).
3. In the browser pane on the dev server, `/runner?dev&fast` with S1's seed
   lessons: start a session; the A segment's card shows; its A0 drill step
   navigates to `/progression-trainer?…` with the launch query (the page there
   is `no page here` in this worktree: Module 1 isn't merged); back on
   `/runner` it offers the drill again and `skip`; skipping, B shows the stub
   for `pocket-dojo` and `skip`; D's card, `next`; the session finishes and
   IndexedDB has it with three segments and `finishedAt`; the streak reads 1;
   `export` produces the markdown (or its fallback box). The library opens
   `d0` with no session. The console has no errors.
4. `[phone]` items go to G.

### S2. Integration

**Owns:** `AGENTS.md`, `docs/MODULE_CONTRACT.md`, `docs/HARDWARE_NOTES.md`,
`docs/SPEC.md` (only where this phase made it untrue), the plan. A fix to a
lane's paths only when a check below fails because two lanes disagree, each
such fix listed in the report.

**Done when:**

1. `npm run check` exits 0 on the merged plan branch.
2. The whole flow in the browser pane on the dev server, `/?dev&fast` (the
   Runner as home): start a session; segment A's card, then its drill opens
   Module 1 with the launch; tap through it (clicks on the pad or keys);
   `back to session`; the step reads done with its score; B is the stub;
   C/D's card; the session finishes. IndexedDB: one daily session with three
   segments and one `attempts` row in it for the A drill. Export holds the A
   score. The library opens a D lesson. The console has no errors.
3. Each A level's lesson, launched from the library as practice with `fast`,
   opens Module 1 on its own progression and level without a parse error
   (seven checks).
4. Docs: `AGENTS.md` **Repo conventions** has the conventions the lanes
   reported (a new pure-file pattern, a route), and **Where we are** still
   names this plan with no progress in it. The VERIFY log has V9's state and every
   `(field steps: VERIFY)` L1 reported, as one row per topic or one grouped
   row (its call). Lanes' Carried forward and Process notes are in the plan.

### G. Exit gate (attended)

The owner, with `/step`, after `/retro` and after merging the plan branch
into `main` and pushing. SPEC §6.2's exit is SPEC §1's daily-use target.
G records each result in **The owner's list** below and in
`docs/HARDWARE_NOTES.md` where it's a measurement, then writes the retro.

**Done when** (the phase's exit):

1. `npm run check` exits 0 on `main`, and the Pages deploy is green.
2. Every row of **The owner's list** has a result.
3. `[phone]` The daily-use target holds: a full 15-minute session on the
   phone, unplugged, with touch, logged.
4. **Tap offsets** has a touch row measured with the touch voice on, and
   `TAP_OFFSETS` matches it (S1's test passes).

## The owner's list

Items only the owner can check, each with its fake twin (what the agents
checked instead).

| Item | Check | Fake twin |
| --- | --- | --- |
| `[phone]` daily-use target | On the Pages URL, unplugged: a full 15-minute session with touch, start to finish; it's logged and the streak reads 1 | S2 item 2 (`fast`, headless) |
| `[phone]` A0 on the phone | Taps on chord changes read mostly `on` when you're on them, and `late` when you tap a beat late on purpose | L2 item 2, decision 6's example on the fake clock |
| `[field]` same path as touch | Field keys answer A1, A5 and A6 as touch does, unplugged and plugged | L2 item 3 (`FakeMidiInput` vs touch) |
| `[phone]` screen lock mid-drill | Lock the phone mid-drill: the loop stops; unlock, `start`: it resumes with the time left, and the attempt is logged once | L2 item 4 (state machine) |
| `[ear]` touch voice | Touch keys sound, without clicks, at a level that sits with the backing; Field keys don't double | none: L2 and S1 only check events |
| `[ear]` backing per progression | Each A lesson's progression sounds right for its key and style (styles other than `chillhop-rhodes` share its drums) | L1 item 2 (every progression loads) |
| `[phone]` export | `export` on the phone copies the summary (or shows the box) and downloads the `.md` | L3 item 2 (`sessionMarkdown`) |
| `[ear]` silent first `start` | Carried from the Phase 1 exit gate: after a fresh load with the Field plugged in, is the first `start` silent? | none |
| `[phone]` touch tap offsets | Re-measure touch on `/dev/spine`'s taps panel now that touch keys sound and add the row; the agent then copies it into `TAP_OFFSETS` (S1's test fails until the two match) | S1 item 4 |

## Placeholders

Lanes use these as written, each marked `placeholder` in a comment, and list
them in the report. All lowercase.

- **Module 1:** title `progressions`, icon `1`; `level`, `progression`,
  `start`, `stop`, `finish`, `tap` (A0's pad), `submit` (A4), the quality
  buttons as their family names, `on`, `early`, `late`, `missed`, `extra`,
  `right`, `wrong`, `score`, `not scored`, `timing not scored yet` (a source
  with no measurement), `back to session`, `no progression fits this
  level`, `can't save progress`, `paused`, `voice-leading map`.
- **Runner:** title `session`, icon `5`; `today`, `start session`, `next`,
  `skip`, `open drill`, `arrives in a later phase` (the stub), `streak <n>`,
  `recent`, `library`, `export`, `copied`, `locked`, `no lessons yet`,
  `session done`.
- **Touch voice:** a soft sine-ish `PolySynth` patch at a level under the
  backing chords.
- **Keyboard guide mark:** a small dot in `--op-muted`.
- **All curriculum prose** (L1): a draft.

## The owner's calls (2026-10-23)

Settled with the owner before any `/run-steps` pre-flight. Each is already
written into the decision or row it names.

1. **Tap tolerance:** centred on the measured median, half-width
   `max(IQR, 20 ms)` per source (decision 6).
2. **Touch voice:** in S1, with a placeholder sound, touch notes only
   (decision 8).
3. **Home is the Runner** once it's registered (decision 9).
4. **Practice** attempts count toward level gates; practice sessions don't
   count toward the streak (decision 4, L3).
5. **Module 1's picker** opens every level; only the Runner gates
   (decision 4).
6. **Field operations in cards:** only what SPEC and `HARDWARE_NOTES.md`
   state; the rest `(field steps: VERIFY)` (decision 11).
7. **Curriculum prose** is L1's draft for the owner to edit.
8. **B in Phase 2** shows B0's cards and a stub for its drill, with `skip`
   (L3).
9. **A4's moving tone** is the first chord's 7th and where `voiceLead` takes
   it; **A6's targets** are odd-bar downbeats, and bar 3 is the rest in
   `call-response` (L2).
10. **A1 answers by playing** the bass note, not with degree buttons (L2).
11. **Results show counts, not milliseconds**, until calibration in Phase 3
    (L2).
12. **Drum patterns** for the three other styles wait past Phase 2; they
    fall back to `chillhop-rhodes` (L1).
