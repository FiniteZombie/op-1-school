# Phase 2 — curriculum, Module 1, Runner

Builds SPEC §6.2: the curriculum content, Module 1 (Progression Trainer,
levels A0–A6) and Module 5 (Runner), as three parallel lanes. Before them
come two spine steps (the contracts the lanes share, then the audio and input
pieces), and after them an integration step and the owner's exit gate.
Written 2026-10-23.

The phase's goal is SPEC §1's daily-use target: open the app on the phone
next to the Field, run a 15-minute guided session with procedural backing,
log results, with no cable required.

| Row | Name | Kind | Model | Branch | Merge order | Status | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1a | Spine contracts | step | Opus 5.5 | `phase-2-fan-out` | — | done 2026-10-23 | `14ec998` |
| S1b | Spine audio and input | step | Opus 5.5 | `phase-2-fan-out` | — | done 2026-10-23 | `4214869` |
| L1 | Curriculum | lane | Opus 5.5 | `phase-2-fan-out-curriculum` | 1 | done 2026-10-23 | `ff40050` (merge `aea5641`) |
| L2 | Module 1, Progression Trainer | lane | Opus 5.5 | `phase-2-fan-out-module-1` | 2 | done 2026-10-23 | `961d273` (merge `ab06ec5`) |
| L3 | Runner | lane | Sonnet 5.5 | `phase-2-fan-out-runner` | 3 | done 2026-10-23 | `c8225d5` (merge `218991f`) |
| S2 | Integration | step | Opus 5.5 | `phase-2-fan-out` | — | done 2026-10-23 | |
| G | Exit gate (**attended**) | step | — | `main` | — | **Next** | |

### Carried forward

- **S1b → G:** the touch voice (`src/audio/NoteVoice.ts`) is a placeholder
  patch (triangle `PolySynth`, -18 dB, under the chords' -14). Spine-built,
  never disposed, voices `touch` only once audio runs, and releases its notes
  when audio stops running. G re-measures touch tap offsets with it on.
- **L1 → later phases:** `content.test.ts` keeps its own copy of Module 1's
  `usableFor` rules (it can't import a module). The two agree today (S2 read
  both, and every A lesson opens in Module 1 without an error); a change to
  `usableFor` in `src/modules/progression-trainer/levels.ts` updates the copy.
- **L1 → G:** A-lesson drill minutes are 3 (A2 2, A6 2 + 2), B and C
  drills 4. The 4-track template (SPEC §4.3, "keep … from v1") isn't in the
  content: the v1 document isn't in the repo.
- **L2 → G:** the drill's own stops land on the loop's last MIDI pulse
  (deferred a microtask so clock out sends that pulse before `FC`); a
  finish can end with a ~50 ms blip of the first chord, unheard (`[ear]`).
  A score of 0, not absent, when nothing counted (absent would pass a gate).
- **L2, L3 → retro (placeholder question):** the library's `practice` link
  launches with `returnTo: '/runner'` and no `session`, so after a practice
  drill the result shows `back to session`, which leads to the Runner's home.
  The label is the owner's call.
- **L3 → G:** the library lives at `/runner?view=library&open=<id>`. An
  open session from today shows its steps directly (`resume session`); a
  segment's `startedAt` is the previous one's finish; `launchedAt` keeps the
  first launch.
- **S2 → a later spine step:** `openAppDb()` (`src/state/db.ts`) has no
  `blocking` / `versionchange` handler, so a database delete or a future
  `DB_VERSION` upgrade waits for every other open tab, and the Runner sits on
  `loading` meanwhile. Closing the connection on `versionchange` (and
  reloading or showing a line) would fix it; it's a spine change, not S2's.

### Process notes

- S1a: the row puts `availableFrom` in `availableModules.tsx` with a
  `availableModules.test.ts`, while **Repo conventions** says UI logic with a
  test lives in a pure `.ts`; it went into `router.ts`, and the test imports
  it from there.
- S1a: the row lists decisions 7 and 12 for the **Drills** section, but
  `heardAudioTime` and `MidiConnect` are S1b's; S1a wrote the rule only (see
  Carried forward).
- S1a: on `/dev/spine?dev`, `get_page_text` right after `navigate` can read
  the page before the lazy view mounts (only the nav and status bar); waiting
  a second, or reading `main` from the console, shows it.
- S1b: the row's Owns gives `docs/MODULE_CONTRACT.md` "MidiConnect only",
  while Carried forward asked S1b to name `heardAudioTime` there too; both
  went into **Drills**, nothing else on that page.
- S1b: `/dev/spine` (not S1b's) has no `MidiConnect`, so S1b's browser check
  can't exercise it; it is unit-tested over `FakeMidiAccess` and the real
  `WebMidiBridge`.
- S1b: decision 6 names `tapWindow(source)`; it also takes `calibrated` and
  the measurements, since `tapVerdict` needs both.
- S1b: a Bash heredoc with an empty `python -` heredoc hung until the 120 s
  timeout (probably the Windows Store `python` stub waiting); scripted edits
  went to Node files in the scratchpad. A stray no-op line, not a needed step.
- Run: the Agent tool's `isolation: "worktree"` cut every lane from
  `origin/main` (`f56bbbf`), not the plan branch; the lanes stopped on the
  base check and were respawned with `git reset --hard 4214869` as their
  first step.
- L2, L3: `preview_start` with `dev-l2` / `dev-l3` serves the main
  checkout, not the lane's worktree; both lanes ran `npx vite --port <n>
  --strictPort` from the worktree instead and checked the served source.
- L2: browser-pane clicks by coordinate missed (the screenshot frame isn't
  CSS pixels); clicks by `find` → `ref` worked. Stopping a background Bash
  task left vite listening; it was killed by PID.
- L3: the case-clash rule bit again (`home.ts` / `Home.tsx`,
  `library.ts` / `Library.tsx`), caught by typecheck and renamed
  (`homeAction.ts`, `libraryLogic.ts`).
- L3: Vite's watcher on Windows can miss the second of two near-simultaneous
  edits and serve a stale module; touching the file fixes it.
- L3: L3's Done-when 3 expects `/progression-trainer` navigation, but
  decision 10 stubs a module that isn't registered, so L3 needed a temporary
  stub module outside its paths; that check belongs in S2.
- L1: "one card per §4.4 topic" didn't settle whether sync setup is a D
  topic (it went into d0), nor where C's resample-loop card goes (c3).
- S2: `indexedDB.deleteDatabase` returned `blocked` and the Runner sat on
  `loading`: `preview_start` had opened a second tab (`seed`) on the same
  origin that held the database. Closing it let the delete through;
  `AGENTS.md` **Repo conventions** says so, and Carried forward has the
  spine fix.
- S2: the pane's `find "skip"` once returned only the `skipped` label;
  `find 'button "skip"'` found the button.
- S2: `export` downloads a file and writes the clipboard; the check hooked
  `HTMLAnchorElement.prototype.click`, `URL.createObjectURL` and
  `navigator.clipboard.writeText` from the console and read the captured
  text, so nothing was downloaded.
- S2: Done-when 2's "reads done with its score" asked for something no lane
  row built: the Runner showed `done` alone. With the orchestrator's go-ahead
  S2 fixed it in the Runner's paths (`doneStepScore` in
  `src/modules/runner/summary.ts`, tested, shown beside `done` as
  `A0 <n>%` or `not scored`). A Done-when item in an integration row should
  cite the lane row that builds what it checks.
- S2: the time went on the browser flow (the blocked delete, then one
  `find` → click per control); docs were short.

## How this plan runs

- **`/run-steps` runs S1a, S1b, L1–L3 and S2 unattended**, then stops before
  G. S1a and S1b are steps on the `phase-2-fan-out` branch, in that order,
  each committed before the next row starts. The three lanes then start
  together, each in its own worktree cut from the plan branch **after** S1b's
  commit: before checking a lane, the orchestrator confirms `git merge-base
  --is-ancestor <S1b commit> HEAD` in its worktree. Lanes merge into the plan
  branch in the order above (`--no-ff`, `npm run check` after each). S2 runs
  on the merged plan branch.
- **Each lane checks in the browser on its own dev server**: L2 on `dev-l2`
  (port 5174), L3 on `dev-l3` (port 5175), steps on `dev` (5173), all from
  `.claude/launch.json` (S1a). A separate port is a separate origin, so each
  has its own IndexedDB. Every browser check that reads IndexedDB starts by
  running `indexedDB.deleteDatabase('op-1-school')` in the console and
  reloading.
- **G is attended.** After `/retro` and after the owner merges the plan
  branch into `main`, the owner runs G with `/step` from the phone.
- **No lane needs another lane's files to build or test.** Each lane reads
  the others only through S1a's contracts: lesson and progression JSON through
  `src/curriculum/index.ts` and `src/types/lessons.ts`, drill launches and
  results through `src/types/drills.ts`, available modules through
  `src/ui/availableModules.tsx`. Tests in L2 and L3 use their own fixtures
  (or `SPEC_FIXTURES`), never the curriculum's content, which L1 replaces.
- **Nothing in this plan adds a dependency.** No markdown library, no test
  DOM: the Runner's card renderer is hand-rolled and pure.
- **Shared files.** `package.json`, the lockfile, `AGENTS.md`, `SPEC.md`,
  `docs/HARDWARE_NOTES.md` and `docs/MODULE_CONTRACT.md` belong to no lane.
  S1a, S1b and S2 edit the docs; a lane reports the doc change it needs.

## Decisions this plan makes

Technical calls. They win over SPEC where they differ. The owner's calls are
under [The owner's calls](#the-owners-calls-2026-10-23).

1. **A drill is launched by URL.** The Runner (or the library, or a deep
   link) navigates to the module's route with a query that
   `src/types/drills.ts` encodes and parses (S1a): `mode` (the level id,
   `A0`…), and optionally `session`, `lesson`, `step` (the step's index in
   its lesson), `progression`, `minutes`, `returnTo` (an app path) and
   `params` (the step's `params` as JSON). `?dev` survives as it does today,
   and so does `fast` while `dev` is on (`?dev&fast`, L3). The query is the
   whole hand-off: no shared in-memory state, so a reload mid-drill reopens
   the same drill.
2. **A drill's result is an `Attempt` row.** A module writes one `Attempt`
   when a drill **finishes** (time up, or `finish` after at least one full
   loop), never for an abandoned one (navigating away, or `stop` before a
   loop). `module` is the module id, `mode` the level id, `score` is 0..1 or
   absent for an unscored drill, `offsets` holds `TimingOffset`s for timed
   levels (a tap on the A0 pad has `note: -1`, a sentinel outside
   `MidiNote`'s 0..127 that `drills.ts` and `MODULE_CONTRACT.md` document),
   and `data` is the module's own detail, plus `step` copied from the launch
   when it has one. With a `session` in the launch, the attempt's `sessionId`
   is it and the module doesn't touch the session row (the Runner owns it).
   Without one, the module writes its own `Session` with `kind: 'practice'`,
   `lessonId` the launch's `lesson` or `'practice'`, `finishedAt` the
   attempt's time and `scores` `{ <mode>: score }` when scored.
3. **Sessions gain two optional fields** (types gain fields, S1a):
   `kind?: 'daily' | 'practice'` (absent reads as `daily`) and
   `segments?: SessionSegment[]` (`{ lessonId, startedAt, finishedAt?,
   skipped?, steps? }`), where `steps?: SessionStep[]` has one entry per
   lesson step, by index: `{ launchedAt?, done?, skipped? }`. A daily
   session's `lessonId` is `'daily'`. IndexedDB stores them as is, so
   `DB_VERSION` stays 1 and no upgrade case is added.
4. **Level gates** (SPEC §4): level N+1 of a vector opens once level N has
   two finished attempts with mode `<vector><N>` whose `score` is ≥ 0.7 or
   absent (absent = unscored, so a finish counts). Practice attempts count.
   The lowest level of each vector is always open. Gates apply only to a
   lesson with a drill step whose module is available; a lesson without one
   (cards only, or only drills on modules not built yet) is always open, and
   the C/D rotation ignores gates. The gate is the Runner's (pure, L3);
   Module 1's own level picker shows every level (it's practice).
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
     the table disagree, so the doc and the code can't drift. The table's
     minus signs are U+2212 (`−`), the IQR cell is `46.7 (range …)` (take the
     first number), the last matching row in table order is the latest, and a
     missing Android row fails the test instead of reading as `null`.
   - Desktop mouse clicks use the `touch` entry until calibration (Phase 3).
   - **VERIFY V9 (resolved by S1b).** The table has both rows (2026-10-23,
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
   *heard* when it was played: `heardAudioTime(perfTs, clock)` (S1b, in
   `Clock.ts`) inverts `audibleAt`, and `slotAtAudioTime(transport,
   prepared, t)` of that time (Tone-free, `src/audio/voicing.ts`, with
   `prepareProgression`) is the slot. Scorers never call the Tone-bound
   synth's `currentSlot()`, so their tests don't import `tone`. On `FakeClockBridge(5000, 0.029)`, a note at 15 000 ms was heard
   against audio time 9.971 s; if slot 2 starts at 9.980 s, the note answers
   slot 1. There's no grace window into the next slot.
8. **Touch notes make a sound.** Phase 1's touch keys are silent, which
   makes unplugged A2 ("permission to make sound") pointless. S1b adds a small
   touch voice to the spine that plays `touch` notes only (the Field sounds
   by itself) with a placeholder sound.
9. **Home is the Runner** once it's registered: `/` resolves to the module
   with id `runner` if the registry has it, else `COPY.home` as today. The
   Runner's own route stays `/runner`.
10. **Modules learn what's available from a context, not the registry.**
    `AppShell` (the one importer of the registry) provides the visible
    modules' `{ id, route }` through `useAvailableModules()`
    (`src/ui/availableModules.tsx`, S1a). The Runner stubs a drill whose
    module isn't there (B and C drills in Phase 2).
11. **Field operations in card text come from the docs.** A button combo or
    menu path on the Field goes into a card only if SPEC §2/§4 or
    `docs/HARDWARE_NOTES.md` states it. Anything else is written as the
    musical idea plus `(field steps: VERIFY)`, and L1 lists each one. The
    same goes for the steps in `sequencerRecipes.json`.
12. **The Field is connected from the app, not only from `/dev/spine`.**
    `src/ui/MidiConnect.tsx` (S1b): a button whose tap (the gesture) calls
    `midi.requestAccess()`, then an input-port picker that labels each port
    with its message count, as the probe does: the port's name can't
    identify the Field (V7), so the user picks the one that lights up. Its
    logic (labels, the chosen port) is a pure `.ts` next to it with a test.
    Module 1 puts it under the `AudioGate`.
13. **A5 scores guide tones**, where SPEC §4.1's "Scored?" column says chord
    tone / tension / avoid per bar; this plan wins and S2 fixes SPEC. The
    classify counts still go into the attempt's `data`.

## Rows

### S1a. Spine contracts

**Owns:** `src/types/drills.ts` and `src/types/__tests__/drills.test.ts`
(new); `src/types/lessons.ts` is untouched. `src/state/db.ts` (decision 3's
fields only). `src/ui/router.ts`, `src/ui/navigation.tsx`,
`src/ui/AppShell.tsx`, `src/ui/availableModules.tsx` (new) and their tests.
`src/curriculum/` (new: the loader, its test, and seed data).
`.claude/launch.json`. `docs/MODULE_CONTRACT.md`, `AGENTS.md` (**Repo
conventions**).

**Builds:**

- `src/types/drills.ts`: `DRILL_MODES` (decision 5), `DrillLaunch`,
  `launchQuery(launch): Record<string, string>` and
  `parseLaunch(module, query): { launch } | { error }` (decision 1; an
  unknown mode for the module, a bad `minutes` or `step`, unparseable
  `params`, or a `params.form` other than `phrase` / `call-response` is an
  error naming the field), `levelId(vector, level)` (`'A', 0` → `A0`), and
  `PAD_NOTE = -1` with a comment on the sentinel (decision 2).
- `src/state/db.ts`: decision 3's `Session.kind`, `Session.segments`,
  `SessionSegment`, `SessionStep`; doc comments on `Attempt.score` (0..1,
  absent = unscored) and decision 2's rules.
- `src/ui/router.ts` and `navigation.tsx`: queries. `hrefFor(path, base,
  dev, query?, fast?)` writes the query in insertion order, then `dev`, then
  `fast` (only with `dev`); `navigate(path, query?)` keeps `dev` and `fast`
  as it keeps `dev` today; `Link` gains `query`; `AppLocation` gains `query`
  (every parameter but `dev` and `fast`) and `fast`, parsed by a pure
  `parseLocation(pathname, search, base)`. Decision 9's home: `resolveRoute`
  returns the `runner` module for `/` when the module list has one (at `/`
  the Runner's nav entry isn't marked active; that's accepted).
- `src/ui/availableModules.tsx`: `AvailableModulesProvider` (used by
  `AppShell`) and `useAvailableModules()`, decision 10, over a pure
  `availableFrom(modules, dev)` with a test.
- `src/curriculum/index.ts`: `progressionSpecs()`, `progressions()` (loaded
  with `loadProgression`), `progressionById(id)`, `lessons()` (every
  `lessons/*.json`, sorted by vector then level), `lessonById(id)`,
  `sequencerRecipes()`, `curriculumErrors()`. It reads the JSON through
  `import.meta.glob(…, { eager: true })` and a pure `buildCurriculum(raw)`
  that validates every record with `src/types/lessons.ts` and returns the
  records and their errors. An invalid record, a second record with an id
  already seen, and a progression `loadProgression` throws on are each
  dropped with an error naming the file and field, also sent to
  `console.error`. `src/curriculum/__tests__/loader.test.ts` tests
  `buildCurriculum` on inline data only.
- **Seed data**, so the lanes have something to load. L1 replaces all of it:
  `progressions.json` holds SPEC §5.3's four fixtures with ids `seed-…`;
  `sequencerRecipes.json` one recipe; `lessons/a0.json` (a card and an A0
  drill on `seed-cmajor`), `lessons/b0.json` (a card and a `pocket-dojo` B0
  drill), `lessons/d0.json` (a card). Every seed title is
  `placeholder seed …`.
- `.claude/launch.json`: `dev-l2` (`npm run dev -- --port 5174`) and
  `dev-l3` (`npm run dev -- --port 5175`) beside `dev`; `strictPort` stays.
- Docs: `MODULE_CONTRACT.md` says `src/curriculum/` exists (drop "doesn't
  exist yet…") and adds a **Drills** section (decisions 1, 2, 5, 7, 10, 12:
  what a module reads from the launch and what it writes, `PAD_NOTE`, and
  that a module copies the launch's `step` into `Attempt.data.step`).
  `AGENTS.md` **Repo conventions**: one bullet on the drill contract and the
  per-lane dev servers.

**Done when:**

1. `npm run check` exits 0.
2. `drills.test.ts`: a launch round-trips through `launchQuery` and
   `parseLaunch` with every field; `mode=A9` for `progression-trainer`,
   `minutes=0`, `step=-1`, `params={` and `params={"form":"x"}` each return
   an error naming the field; `DRILL_MODES['progression-trainer']` is
   `A0`…`A6`.
3. `router.test.ts` (the existing `/`-is-home case is replaced, not kept):
   `hrefFor('/progression-trainer', '/op-1-school/', true, { mode: 'A3',
   session: 'x' }, true)` is
   `/op-1-school/progression-trainer?mode=A3&session=x&dev&fast`; `fast`
   without `dev` is dropped; `parseLocation` leaves `dev` and `fast` out of
   `query` and sets `fast`; `/` resolves to a fake `runner` module when the
   list has one and to `home` when it doesn't.
4. `availableModules.test.ts`: `availableFrom` hides `dev`-only modules
   without `dev` and returns `{ id, route }` pairs.
5. `loader.test.ts`: `buildCurriculum` keeps valid records; drops an invalid
   one, a duplicate id and a progression `loadProgression` rejects, each
   with an error naming it in its errors; and sorts lessons by vector then
   level.
6. In the browser pane on `dev`, `/?dev` still shows `modules arrive in
   phase 2` (no Runner yet) and `/dev/spine?dev` loads; the console has no
   errors.
7. `git grep -n --untracked "doesn't exist yet" -- docs/MODULE_CONTRACT.md`
   prints nothing; `.claude/launch.json` parses as JSON and has `dev`,
   `dev-l2` and `dev-l3`.

### S1b. Spine audio and input

**Owns:** `src/audio/Clock.ts` (`heardAudioTime`), `src/audio/tapWindow.ts`
(new), `src/audio/NoteVoice.ts` (new, the touch voice) and a pure
`src/audio/noteVoiceLogic.ts` (new), and their tests in
`src/audio/__tests__/`. `src/theory/chords.ts` (`qualityFamily`) and its
test. `src/ui/Keyboard24.tsx`, `src/ui/keyboardLayout.ts`, `src/ui/spine.tsx`
(wiring the touch voice), `src/ui/MidiConnect.tsx` and a pure
`src/ui/midiConnectLogic.ts` (new), and their tests. `AGENTS.md` (**Repo
conventions**), `docs/MODULE_CONTRACT.md` (MidiConnect only),
`docs/HARDWARE_NOTES.md` (V9 row only).

**Builds:**

- `src/audio/Clock.ts`: `heardAudioTime(perfTs, clock)` (decision 7), pure,
  for both clock paths.
- `src/audio/tapWindow.ts`: `TAP_OFFSETS`, `TAP_TOLERANCE_FLOOR_MS`,
  `tapWindow`, `tapVerdict` (decision 6), with `TAP_OFFSETS` copied from the
  **Tap offsets** table as it stands when S1b runs. Its test parses the
  table from `docs/HARDWARE_NOTES.md` with `node:fs`, by decision 6's
  parsing rules. Window edges are inside (`|d| ≤ halfWidth` is `on`).
- `src/audio/NoteVoice.ts`: a Tone `PolySynth` that subscribes to the bus
  and plays `touch` `on`/`off` (decision 8). Built in `createSpine()` after
  `getAudioContext()`; it never sounds before the audio gate. The Tone part
  stays thin; which events it voices is `noteVoiceLogic.ts`, pure, tested.
- `src/theory/chords.ts`: `qualityFamily(quality)`: `maj7` → `maj7`, `7` →
  `7`, `m7` → `m7`, `m7b5` → `m7b5`, `sus2`/`sus4` → `sus`, anything else →
  `null`. A3's answer set (L2) and its progression filter (L1's test) both
  use it.
- `Keyboard24` gains `guide?: readonly PitchClass[]`: unlit keys of those
  pitch classes carry a mark (placeholder: a small dot in `--op-muted`) and
  `data-guide="true"`, chosen by a pure `guideKeys(...)` in
  `keyboardLayout.ts`. A2 uses it for the pentatonic.
- `src/ui/MidiConnect.tsx` (decision 12), over `midiConnectLogic.ts`.
  Placeholders: `connect midi`, `input`, `<n> msgs`.
- Docs: `AGENTS.md` **Repo conventions**: one bullet on the tap window.
  `MODULE_CONTRACT.md`: MidiConnect is how a module connects the Field.
  `HARDWARE_NOTES.md` VERIFY log: V9, tap bias and tolerance per input
  source (decision 6), `resolved`, with both windows, the rule, and that
  touch is re-measured with the touch voice at G.

**Done when:**

1. `npm run check` exits 0.
2. `clock.test.ts`: `heardAudioTime(audibleAt(t))` returns `t` within 1e-6 s
   on `FakeClockBridge(5000, 0.029)` and on a `WebAudioClockBridge` over a
   fake context on each path; decision 7's example gives 9.971 s.
3. `tapWindow.test.ts`: on decision 6's worked example (the measurement
   injected as data, not read from the constant) the tap at 14 999 ms is
   `on` and the one at 15 039 ms `late`; an IQR of 12 ms gives a ±20 ms
   window (the floor); a tap exactly on the edge is `on`; calibrated offsets
   centre on 0; a source with no measurement and `mic` are `unscored`; and
   `TAP_OFFSETS` matches the **Tap offsets** table, row for row (and fails
   when a row is missing).
4. `chords.test.ts`: `qualityFamily` for every member of `CHORD_QUALITIES`.
5. `noteVoiceLogic` test: touch `on`/`off` are voiced; `midi` and `mic`
   aren't; an `off` with no `on` is ignored.
6. `guideKeys` test: guide pitch classes mark unlit keys only.
7. `midiConnectLogic` test: ports are labelled by message count, never by
   name, and the chosen port survives a port list refresh.
8. In the browser pane on `dev`, `/dev/spine?dev`: tapping a key after the
   audio gate logs a touch `on` as before, and the page console has no
   errors. `[ear]` the touch voice is the owner's (G).
9. The VERIFY log has V9 as `resolved`.

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
  B6's drill step names them in `params.recipeIds`.
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
   `call-response` step's progression has `bars: 4`; each lesson's
   `minutes` and `scored` are as listed above; a lesson's drill-step
   minutes add up to no more than its own (A6's two steps fit in 4); every
   id in B6's `params.recipeIds` is a recipe; `curriculumErrors()` is empty.
3. `git grep -n --untracked "seed-" -- src/curriculum/progressions.json src/curriculum/lessons`
   matches only seed progressions a lesson still uses (expected: none).
4. Every `(field steps: VERIFY)` in the content is listed in the report, and
   so is every Field operation that *is* stated, with the SPEC or
   HARDWARE_NOTES line it came from.

### L2. Module 1, Progression Trainer

**Owns:** `src/modules/progression-trainer/**`.

**Consumes:** `useSpine()` (transport, clock, bus, settings),
`ToneBackingSynth`, `transportConfigFor`, `prepareProgression` and
`slotAtAudioTime` (`src/audio/voicing.ts`, decision 7), `src/theory`,
`Keyboard24` (with `chord`, `musicKey`, `guide`), `AudioGate`, `MidiConnect`,
`src/types/drills.ts`, `tapVerdict`, `heardAudioTime`, `offsetMs`,
`getCalibration`, `openAppDb`, `src/curriculum/index.ts`,
`navigate`/`useLocation`. Browser checks run on `dev-l2` (port 5174).

**Builds** SPEC §4.1's seven levels and §5.5's Module 1 row. Pure logic
(scoring, retiming, the drill state machine, answer matching) lives in `.ts`
files apart from the views, each with a Vitest test; views stay thin.

- **Page.** `/progression-trainer` (`module.ts`: id `progression-trainer`,
  phase 2, title and icon placeholders). Without a launch query: a level
  picker (every level open, decision 4), a progression picker showing only
  progressions the level can use, and for A6 a form toggle (`phrase` /
  `call and response`). With one (decision 1): that drill, ready to start;
  a launch with no `progression` opens the pickers with its level chosen. A
  bad query, an unknown progression id or one the level can't use shows the
  error (placeholders `can't open this drill`, `unknown progression`) above
  the pickers. The `AudioGate` is at the top with `MidiConnect` under it;
  `start` is disabled until audio runs.
- **Which progressions a level can use** (pure `usableFor(level, p)`):
  A0 at least two distinct chords; A3 every chord has a `qualityFamily`; A4
  at least one pair of consecutive chords that differ; A5 every chord has a
  7th or a 6th; A6 an even `bars`, and `bars: 4` for `call-response`; A1
  and A2 any. This also rules out every zero denominator below.
- **Drill lifecycle** (a pure state machine): `ready` → `running` (the drill
  configures the transport from its progression and starts it) → `finishing`
  (time up: it ends at the next loop end) → `done` (attempt written, result
  shown). The machine flags the stops it makes itself (finishing, A0's and
  A4's restarts); any other stop (the page hidden, `visibilityAction`) makes
  it `paused`: the clock stops counting, a partial loop's answers are
  dropped, and `start` resumes from bar 1 with the time left. `stop` before
  one full loop is abandoned (nothing written); `finish` after one writes
  the attempt (A4: after one question answered). Leaving the page stops the
  transport and writes nothing. Clock out and follow are left as the spine
  has them; A0's and A4's restarts send clock out's start with no
  pre-pulses, which is VERIFY V6 (stubbed), listed in the report.
- **Time.** `minutes` from the launch, else the level's default (2 for A2,
  4 for the rest). Counted in transport time while running, so a suspended
  audio context doesn't use it up. Shown as `<m>:<ss> left` (placeholder).
- **What each level shows** (classification is `Keyboard24`'s `chord` prop):

  | Level | Backing mask | Chord name shown | Keyboard classifies | Guide |
  | --- | --- | --- | --- | --- |
  | A0 | all | no | no | — |
  | A1 | drums, bass | no | no | — |
  | A2 | all | yes | no | pentatonic |
  | A3 | all | no | no | — |
  | A4 | all | yes | no | — |
  | A5 | all | yes | yes | — |
  | A6 | all | yes | yes | — |

- **A0, hear the harmonic rhythm.** A tap pad (pointer-down
  `timeStamp`, source `touch`, `note: PAD_NOTE`) plus any `on` from the bus
  counts as a tap. The drill merges consecutive identical chords, then
  retimes the chords to 8, then 4, then 2 beats per chord (repeating the
  sequence when the bar count would be fractional), and steps down a stage
  after a loop scoring ≥ 0.7, or after two loops when the loop is unscored;
  a stage change stops, reconfigures and restarts the transport at the loop
  end. The stage shows as `8 beats per chord` / `4` / `2` (placeholder). A
  **change** is a slot start whose chord (name and bass) differs from the
  slot before it, the loop's last slot counting as before the first; the
  drill's first downbeat isn't one. Each change takes the nearest unmatched
  tap within half the stage's slot length; other taps are **extra**. Each
  match is `tapVerdict`ed. The attempt's score pools every loop of every
  stage: `on` matches ÷ (changes heard + extra taps); absent when any match
  is `unscored` (a source with no measurement). Worked: decision 6's
  example, at stage 1 on `C_MAJOR_POP` (`test-cmajor`, the theory test
  fixture; `seed-cmajor` has the same chords) at 90 BPM (a change every
  5.333 s).
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
  two-chord vamps, played in turn (each chord for its own beats, the pair
  repeated to whole bars as A0 does). A vamp loops until both its questions
  are submitted, then the transport stops, is reconfigured for the next pair
  and restarts. Per pair, two questions (prompts `common tones`, `moving
  tone`, and `none` for an empty answer; placeholders) answered by playing
  keys and tapping `submit`: the **common tones** (the set of played pitch
  classes equals `commonTones(a, b)`; an empty submit answers "none"), then
  the **moving tone**, played as two notes in order: the first chord's 7th
  (`guideTones(a).seventh`) and where `voiceLead(a, b)` sends it. If the 7th
  doesn't move, the moving tone is the first voice in `voiceLead`'s order
  that does; if no voice moves, the pair has no moving-tone question. SPEC's
  worked case, Fm7 → B♭m7: common F and A♭; moving E♭ → D♭ (−2; the tie
  with F goes down). Score = right ÷ questions.
- **A5, guide tones** (decision 13). A heard slot is right when its `on`s include both
  `guideTones(chord)` pitch classes. Every `on` is also counted by
  `classify` into `data`. After the drill, the **voice-leading map**: one
  row per consecutive pair, each guide tone of the first chord with where
  `voiceLead` moves it and by how many semitones (placeholder layout: a
  text list). Worked: Dm7 → G7 in C, F and C then B and F: C → B (−1),
  F → F (0). Score = right ÷ slots heard.
- **A6, target-note phrasing.** `params.form` is `phrase` (default) or
  `call-response`. Targets are the downbeats of the loop's odd bars (1, 3,
  5, …, counted within the loop; A6 progressions have even `bars`), the
  drill's first downbeat excepted. Each target's candidate is the nearest
  `on` within half a beat; it lands when its pitch class is the 3rd of the
  chord at the target (`guideTones(chord).third`) and `tapVerdict` says
  `on` for its source (or pitch alone while `unscored`, the offset kept in
  `offsets`). In `call-response` (4-bar progressions only) bar 3 is the
  rest: its downbeat is still a target (the phrase lands there), and any
  `on` heard after half a beat past it and before bar 4's downbeat is a
  **rest break**, counted in `data`.
  Score = landed ÷ targets, times the share of loops with no rest break in
  `call-response`. Worked: F minor `ii°–V7–i–VI` at 90 BPM; a phrase over
  bars 1–2 lands on bar 3's Fm, so the target is A♭; an E♭ 400 ms after
  bar 3's downbeat (over the 333 ms half beat) breaks that loop's rest.
- **Results.** Per drill: score as a percentage (or `not scored`), counts
  (A0: `on`, `early`, `late`, `missed`, `extra`; A6: `on`, `early`, `late`,
  `missed`; no milliseconds, since nothing is calibrated yet), the level's
  reveal (heading `reveal`, placeholder), and `back to session` when the
  launch had `returnTo`. Colours by state token with the word always shown:
  `on` and right = `ok` (blue), `early`/`late` = `warn` (yellow), missed and
  wrong = `bad` (red), extra = `neutral` (gray). Each count row carries
  `data-state` (`ok`, `warn`, `bad`, `neutral`).
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
   unscored and a timed level, with and without a `session`, with `step`
   copied into `data.step`, and the practice session's `lessonId`,
   `finishedAt` and `scores`. A test that a rejecting `openAppDb` leaves the
   drill runnable with saving off.
6. `usableFor` test: one accepted and one rejected progression per level
   rule, including A4's identical-pair case and A6's odd `bars`.
7. In the browser pane on `dev-l2` (port 5174), after clearing IndexedDB:
   - `/progression-trainer?dev&mode=A1&progression=seed-cmajor&minutes=0.25`:
     the gate, then `start`; clicking keys lights them; after the time it
     shows a result whose rows carry `data-state`. Read IndexedDB from the
     console: one new `attempts` row with `mode: 'A1'` and one `sessions`
     row with `kind: 'practice'`. The same with `mode=A0`, clicking the tap
     pad.
   - `?dev&mode=A9` shows the parse error naming `mode`.
   - Start a drill, navigate to `/dev/spine?dev` mid-drill: the `attempts`
     count is unchanged.
   - The console has no errors.
8. `[phone]` and `[field]` items go to G (the owner's list).

### L3. Runner

**Owns:** `src/modules/runner/**`.

**Consumes:** `src/curriculum/index.ts`, `src/types/lessons.ts`,
`src/types/drills.ts`, `openAppDb` and the record types, `useAvailableModules()`,
`navigate`/`Link`/`useLocation`, `COPY`. Browser checks run on `dev-l3`
(port 5175).

**Builds** SPEC §5.5's Module 5 row. Pure logic in `.ts` files with tests;
views thin.

- **Page.** `/runner` (`module.ts`: id `runner`, phase 2, title and icon
  placeholders). It is also `/` (decision 9). It shows today's plan (three
  segments with lesson titles and minutes), `start session` (or `resume
  session`, placeholder, when today's is open), the streak, recent daily
  sessions, a link to the library, and `export` for the last finished daily
  session.
- **Today's plan** (pure): segment A is the current A level's lesson (the
  highest open level, decision 4), B the current B level's (B0 all through
  Phase 2: nothing writes B attempts yet), C/D the C or D lesson least
  recently in a finished segment (never shown first; ties by vector, then
  level). A vector with no lessons drops its segment.
- **A session.** `start session` writes a `Session` (`kind: 'daily'`,
  `lessonId: 'daily'`, `segments` for the plan, each with one `steps` entry
  per lesson step). Each segment shows its lesson's steps in order with an
  advisory countdown of the lesson's minutes (`<m>:<ss>`, placeholder): a
  card step shows its card and `next`; a drill step whose module is
  available records `launchedAt` in its `steps` entry, then launches it
  (decision 1, with `session`, `lesson`, `step`, `progression`, `minutes`,
  `params` and `returnTo: '/runner'`); one whose module isn't available
  shows a placeholder stub card with `skip`. Back on `/runner`, a drill step
  is done when an attempt in this session has its module, its mode and
  `data.step` equal to the step's index, at or after its `launchedAt`; it's
  then marked `done`. Otherwise it offers the drill again (`open drill`) or
  `skip`. A segment is finished when its steps are done or skipped. When all
  are, the session gets `finishedAt` and `scores` (`{ <mode>: best score
  }`). Reloading `/runner` mid-session resumes the open session from today;
  an unfinished daily session from an earlier day stays unfinished, doesn't
  count, and `start session` makes a new one.
- **`?dev&fast`** divides every minute it passes to a drill (and its
  countdowns) by 12, so a 15-minute session runs in 75 s: S2's check and G's
  fake twin use it. The router keeps `fast` across navigation while `dev`
  is on (S1a), so `back to session` keeps it.
- **Streak** (pure): consecutive local calendar days, ending today or
  yesterday, with at least one finished daily session. Practice sessions
  don't count.
- **Summary export** (pure `sessionMarkdown`): date, each segment's lesson,
  each drill's score or `not scored`, the streak (placeholder headings
  `# session <date>`, `## a`, …). `export` copies it and downloads
  `op-1-school-<date>.md` (local `YYYY-MM-DD`); if the clipboard refuses,
  the text shows in a box labelled `summary text` (placeholder), as
  `/dev/spine`'s probe does.
- **Library.** Every lesson, grouped by vector (headings `a`–`d`), in level
  order. Opening one shows its cards with no session, cable or completed
  level needed, and `back`; its drill steps launch as practice (no
  `session`) when the level is open and show `locked` (placeholder) when
  not. Under `?dev` every level is open (S2 relies on it). The lock rule is
  a pure function with a test.
- **Cards** render a markdown subset, pure and tested: paragraphs, `#`–`###`
  headings, `-` and `1.` lists, `**bold**`, `*italic*`, `` `code` ``. Any
  other syntax shows as text; there's no raw HTML.
- **Empty and failure cases.** No lessons: a placeholder line and no
  `start`. An empty database: A0, B0, streak 0. `openAppDb()` rejecting:
  its message (`can't save progress`) shows, `start session` is disabled,
  the library still works.

**Done when:**

1. `npm run check` exits 0, including the import rule.
2. Vitest, on lessons and attempts the tests build (not the curriculum):
   - the gate: A1 opens after two A0 attempts at 0.7 and 0.8, not after one,
     nor after two at 0.6 and 0.9; an unscored level opens after two
     finishes; practice attempts count;
   - today's plan: the C/D rotation over three finished sessions; a missing
     vector drops its segment;
   - the step-done rule: an attempt before the launch, in another session,
     for another mode, or for the other step of A6's two same-mode steps
     (`data.step`) doesn't count;
   - card-only lessons are always open (decision 4);
   - the library lock rule, including every level open under `?dev`;
   - no lessons gives no `start`; a rejecting database disables `start
     session` and leaves the library;
   - the streak across a gap, ending yesterday, ending two days ago (0), and
     with a practice-only day;
   - `sessionMarkdown` for a session with a scored, an unscored and a
     skipped drill;
   - the markdown subset, including text that looks like HTML;
   - `fast` scaling (4 minutes → 20 s).
3. In the browser pane on `dev-l3` (port 5175), after clearing IndexedDB,
   `/runner?dev&fast` with S1a's seed lessons: start a session; the A
   segment's card shows; its A0 drill step navigates to
   `/progression-trainer?…` with the launch query, `step` and `dev&fast`
   (the page there is `no page here` in this worktree: Module 1 isn't
   merged); back on `/runner` it offers the drill again and `skip`; reload
   mid-session: the same session resumes at the same step; skipping, B
   shows the stub for `pocket-dojo` and `skip`; D's card, `next`; the
   session finishes and IndexedDB has it with three segments and
   `finishedAt`; the streak reads 1; `export` produces the markdown (or its
   fallback box). The library opens `d0` with no session. The console has
   no errors.
4. `[phone]` items go to G.

### S2. Integration

**Owns:** `AGENTS.md`, `docs/MODULE_CONTRACT.md`, `docs/HARDWARE_NOTES.md`,
`docs/SPEC.md` (only where this phase made it untrue, including §4.1 A5's
"Scored?" for decision 13), the plan. A fix to a
lane's paths only when a check below fails because two lanes disagree, each
such fix listed in the report.

**Done when:**

1. `npm run check` exits 0 on the merged plan branch.
2. The whole flow in the browser pane on `dev`, after clearing IndexedDB,
   `/?dev&fast` (the Runner as home): start a session; segment A's card, then its drill opens
   Module 1 with the launch; tap through it (clicks on the pad or keys);
   `back to session`; the step reads done with its score; B is the stub;
   C/D's card; the session finishes. IndexedDB: one daily session with three
   segments and one `attempts` row in it for the A drill. Export holds the A
   score. The library opens a D lesson. The console has no errors.
3. Each A level's lesson, launched from the library as practice on
   `/?dev&fast` (every level open under `dev`), opens Module 1 on its own
   progression and level without a parse error (seven checks; A6 twice,
   once per form).
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
   `TAP_OFFSETS` matches it (S1b's test passes).

## The owner's list

Items only the owner can check, each with its fake twin (what the agents
checked instead).

| Item | Check | Fake twin |
| --- | --- | --- |
| `[phone]` daily-use target | On the Pages URL, unplugged: a full 15-minute session with touch, start to finish; it's logged and the streak reads 1 | S2 item 2 (`fast`, headless) |
| `[phone]` A0 on the phone | Taps on chord changes read mostly `on` when you're on them, and `late` when you tap a beat late on purpose | L2 item 2, decision 6's example on the fake clock |
| `[field]` same path as touch | Field keys answer A1, A5 and A6 as touch does, unplugged and plugged | L2 item 3 (`FakeMidiInput` vs touch) |
| `[phone]` screen lock mid-drill | Lock the phone mid-drill: the loop stops; unlock, `start`: it resumes with the time left, and the attempt is logged once | L2 item 4 (state machine) |
| `[ear]` touch voice | Touch keys sound, without clicks, at a level that sits with the backing; Field keys don't double | S1b item 5 (which events are voiced) |
| `[ear]` backing per progression | Each A lesson's progression sounds right for its key and style (styles other than `chillhop-rhodes` share its drums) | L1 item 2 (every progression loads) |
| `[phone]` export | `export` on the phone copies the summary (or shows the box) and downloads the `.md` | L3 item 2 (`sessionMarkdown`) |
| `[ear]` silent first `start` | Carried from the Phase 1 exit gate: after a fresh load with the Field plugged in, is the first `start` silent? | none |
| `[phone]` touch tap offsets | Re-measure touch on `/dev/spine`'s taps panel now that touch keys sound and add the row; the agent then copies it into `TAP_OFFSETS` (S1b's test fails until the two match) | S1b item 3 |
| `[phone]` A0 pad vs keys | Run A0 tapping the (silent) pad, then again tapping the (sounding) keys, and compare the two medians; if they differ by more than 10 ms the owner decides whether the pad gets its own entry. Until then `touch` is one entry | none |
| `[ear]` A1's bass on the phone | A1 (drums and bass only), unplugged: the bass line is audible on the phone's speaker | none |
| `[field]` restarts with clock out (V6) | With clock out on, A0's stage changes and A4's pair changes restart the transport: note whether the Field lurches or drifts at each restart | none: V6 is stubbed |
| `[field]` connect from Module 1 | `connect midi` under the gate, pick the port that lights up when you play: Field keys answer the drill | S1b item 7 (labels by message count) |

## Placeholders

Lanes use these as written, each marked `placeholder` in a comment, and list
them in the report. All lowercase.

- **Module 1:** title `progressions`, icon `1`; `level`, `progression`,
  `start`, `stop`, `finish`, `tap` (A0's pad), `submit` (A4), the quality
  buttons as their family names, `on`, `early`, `late`, `missed`, `extra`,
  `right`, `wrong`, `score`, `not scored`, `timing not scored yet` (a source
  with no measurement), `back to session`, `no progression fits this
  level`, `can't save progress`, `paused`, `voice-leading map`, `<m>:<ss>
  left`, `8 beats per chord` / `4` / `2`, `common tones`, `moving tone`,
  `none`, `phrase` / `call and response`, `unknown progression`, `reveal`,
  `can't open this drill`.
- **Runner:** title `session`, icon `5`; `today`, `start session`, `resume
  session`, `next`, `skip`, `open drill`, `arrives in a later phase` (the
  stub), `streak <n>`, `recent`, `library`, `back`, `export`, `copied`,
  `summary text`, `locked`, `no lessons yet`, `session done`, `can't save
  progress`, the countdown `<m>:<ss>`, library headings `a`–`d`, and the
  export's `# session <date>` / `## a` headings.
- **MIDI connect (S1b):** `connect midi`, `input`, `<n> msgs`.
- **Touch voice:** a soft sine-ish `PolySynth` patch at a level under the
  backing chords.
- **Keyboard guide mark:** a small dot in `--op-muted`.
- **All curriculum prose** (L1): a draft.

## The owner's calls (2026-10-23)

Settled with the owner before any `/run-steps` pre-flight. Each is already
written into the decision or row it names.

1. **Tap tolerance:** centred on the measured median, half-width
   `max(IQR, 20 ms)` per source (decision 6).
2. **Touch voice:** in S1b, with a placeholder sound, touch notes only
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

## Pre-flight answers (2026-10-23)

From the `/run-steps` pre-flight. **These win over anything that reads
differently.** Each is also written into the decision or row it names.

### The owner's calls

1. **Every suggested answer below is taken as written.**
2. **Keep it all local:** no branches pushed, no PRs.
3. **S1 is split** into S1a (contracts) and S1b (audio and input), both
   Opus 5.5, in that order, both before the lanes. The lanes start from
   S1b's commit.
4. **Placeholders** as listed under [Placeholders](#placeholders); the
   owner changes copy later.

### Technical answers

1. **Retro 2026-10-23's open `[phone]` tap-offset check is done**
   (`f56bbbf`): both Android rows are in `docs/HARDWARE_NOTES.md` **Tap
   offsets**. Nothing from that retro is open for this run.
2. **Runner step state** (decision 3, decision 1, L3): `SessionSegment.steps`,
   the launch's `step`, `Attempt.data.step`. One attempt answers one step,
   so A6's two same-mode steps don't collide.
3. **Per-lane dev servers** (How this plan runs, S1a): `dev-l2` on 5174 and
   `dev-l3` on 5175, so parallel lanes neither share a server nor an
   IndexedDB; every IndexedDB check clears the database first.
4. **`MidiConnect`** (decision 12, S1b, L2): the Field can be connected
   outside `/dev/spine`, labelled by message counts (V7, retro answer 3).
5. **`fast` is kept like `dev`**, only alongside it (decision 1, S1a, L3).
6. **The library opens every level under `?dev`** (L3), which S2 item 3
   relies on.
7. **A0's worked example** uses `C_MAJOR_POP` from
   `src/theory/__tests__/fixtures.ts` (L2): L2's tests never use curriculum
   content.
8. **Scorers use `slotAtAudioTime`** from `voicing.ts`, never the synth's
   `currentSlot()` (decision 7), so tests stay Tone-free.
9. **A2 doesn't classify** (L2's table): classification would show in-scale
   notes outside the pentatonic as `tension` while A2 counts them as
   clashes. The guide shows the pentatonic.
10. **A5 scores guide tones over SPEC** (decision 13); S2 fixes SPEC §4.1.
11. **Gates skip lessons without an available drill** (decision 4).
12. **`parseLaunch(module, query)`** (S1a).
13. **`PAD_NOTE = -1`** is a documented sentinel (decision 2, S1a).
14. **A0 pad vs keys** is a new owner item at G; `touch` stays one entry.
15. **`usableFor(level, p)`** defines each level's progressions (L2).
16. **A0:** pooled score, merged identical chords, inclusive window edges,
    partial loops at a pause dropped (L2, S1b).
17. **A4:** pairs repeat to whole bars and loop until answered; a 7th that
    holds falls back to the first moving voice, or no question (L2).
18. **A6:** loop-relative odd bars, a bounded rest window, no `extra`
    (L2).
19. **Own stops vs outside stops**, and time in transport time (L2).
20. **Launch errors** and A6's form toggle (L2).
21. **Practice session shape**; the Runner's recent list and export are
    daily-only; an earlier day's open session stays unfinished (decision 2,
    L3).
22. **`buildCurriculum` errors**, `curriculumErrors()`, duplicate ids and
    progressions `loadProgression` rejects (S1a, L1).
23. **The tap-offsets table parser** (decision 6, S1b).
24. **B6's `params.recipeIds`** (decision 11, L1).
25. **Desktop clicks use the `touch` window** until Phase 3 (decision 6).
26. **Added Done-when items** in S1a, S1b, L1, L2 and L3, and four new rows
    on the owner's list (pad vs keys, A1's bass, V6 restarts, connecting
    from Module 1).

### Models

As the status table says: Opus 5.5 for S1a, S1b, L1, L2 and S2; Sonnet 5.5
for L3 (redo on Opus if one fix round doesn't fix it).

### Check notes

- **The owner's Windows PC** (where this run happens): browser checks use
  the built-in browser pane with the configuration the row names from
  `.claude/launch.json`. There's no phone or Field here: every `[phone]`,
  `[field]` and `[ear]` item is the owner's, at G.
- **A cloud container**, if a row ever runs in one: headless Chromium and a
  global Playwright, per the `step` skill; the ports are the same.
