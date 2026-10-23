# Phase 2 fan-out — run (2026-10-23)

**Status:** not reviewed yet. Run `/retro` with the owner.

Branch `phase-2-fan-out`, cut from `main` at `3b6ff1e` (the plan's commit).
Lane branches: `phase-2-fan-out-curriculum` (`ff40050`),
`phase-2-fan-out-module-1` (`961d273`) and `phase-2-fan-out-runner`
(`c8225d5`), all three merged into the plan branch with `--no-ff`. The plan
branch also holds S1a, S1b, the lanes' reports, S2 and this retro. Nothing
is pushed: the owner chose to keep everything local. G, the attended exit
gate, is next and is the owner's.

## Result

| Row | Branch | Commit | Outcome |
| --- | --- | --- | --- |
| pre-flight | `phase-2-fan-out` | `0ba3c91` | answers written; S1 split into S1a and S1b |
| S1a | `phase-2-fan-out` | `14ec998` | done, 0 fix rounds |
| S1b | `phase-2-fan-out` | `4214869` | done, 0 fix rounds |
| L1 | `phase-2-fan-out-curriculum` | `ff40050`, merged `aea5641` | done, 0 fix rounds (respawned once for the wrong base) |
| L2 | `phase-2-fan-out-module-1` | `961d273`, merged `ab06ec5` | done, 1 internal fix round (an A4 fixture) (respawned once) |
| L3 | `phase-2-fan-out-runner` | `c8225d5`, merged `218991f` | done, 1 internal fix round (a file-name case clash) (respawned once) |
| lane reports | `phase-2-fan-out` | `a1e5e29` | status, Carried forward, Process notes |
| S2 | `phase-2-fan-out` | `321fc20` | done after 1 orchestrator fix round |
| G | — | — | not started: attended |

- **One stop-and-restart, no failed rows.** The Agent tool's
  `isolation: "worktree"` cut all three lanes from `origin/main`
  (`f56bbbf`), not from the plan branch. Each lane's first check caught it
  and the lane stopped before editing anything. The tool cleaned up the
  untouched worktrees. I respawned the lanes with `git reset --hard 4214869`
  as their first step. That cost about a minute.
- **S2's fix round.** Done-when 2 asks for a finished drill step that "reads
  done with its score". The Runner showed `done` alone, because no lane row
  built the score display. That is S2's own item failing, not two lanes
  disagreeing, so S2's ownership rule didn't let it touch the Runner. I
  extended S2's paths for that one fix. S2 added `doneStepScore` in
  `src/modules/runner/summary.ts`, with tests, and shows its result beside
  `done`.
- **Checks after every row.**
  - `npm run check` exited 0 in the row's tree: S1a 325 tests, S1b 356, L1
    366, L2 411, L3 423, and after each merge 366, 421 and 488. After S2 it
    was 492.
  - `git diff --check` was clean every time.
  - Every row's paths matched its Owns. The one exception is S2's authorized
    Runner fix.
  - Each lane worktree had S1b (`4214869`) as an ancestor.
  - The plan's status table was right after each step.
  - No dev server was left running on 5173–5175.
- **What I spot-checked myself:**
  - **S1a:** the `hrefFor` test asserts the exact
    `…?mode=A3&session=x&dev&fast` string; `parseLaunch`, `PAD_NOTE` and
    `SessionSegment.steps` exist.
  - **S1b:** `tapWindow.test.ts` passes on its own, no test file imports
    `tone`, and the V9 row is `resolved` with both windows.
  - **L1:** A6's two drill steps are `phrase` then `call-response`, the
    second on a 4-bar progression, and no `seed-` ids are left.
  - **L2:** no `currentSlot` call; no test reads `TAP_OFFSETS`; `a0.test.ts`
    passes on its own.
  - **L3:** the step-done test covers A6's other step through `data.step`;
    no raw hex colours and no `innerHTML`.
  - **S2:** in the browser pane on `dev`, `/runner?dev&fast&view=library&open=a6`
    gives two `practice` links with the right `step`, `params.form` and
    progression. Opening `call-response` lands on Module 1 with A6, `call and
    response` and `turnaround-f-minor` selected, no error, and an empty
    console. One oddity: a 0.1667-minute launch (10 s) shows `0:11 left`
    before start. That looks like rounding up; it's harmless but untested.

## Pre-flight

**What the grill found** (31 items):
- **Four that would have sunk the run:**
  - the Runner had no per-step state, and A6's two same-mode steps collided;
  - L2 and L3 would collide on port 5173 (`strictPort`) and share one
    IndexedDB;
  - there was no way to connect the Field outside `/dev/spine`;
  - `fast` was dropped on navigation.
- **One `Done when` that couldn't pass:** the library locked A1–A6 on a
  fresh database.
- **Contradictions:**
  - A0's example used curriculum seed data, which L2's tests can't use;
  - `currentSlot()` is Tone-bound;
  - A2 classified notes it counts as clashes;
  - A5 contradicted SPEC;
  - gates locked lessons that only have cards;
  - `parseLaunch` couldn't reject a mode without knowing the module;
  - the pad's `note: -1` falls outside `MidiNote`.
- **Undefined behaviour** in A0, A4, A6, pauses, launch errors, the loader,
  and the tap-offsets table parser.
- **Missing checks and owner items.**

**What the owner answered:** they took every suggested answer as written,
kept everything local, and accepted splitting S1 into S1a and S1b. The
retro's open tap-offset check was already done at `f56bbbf`. Before the
run, the owner unplugged the Field on my advice: nothing unattended needed
it, and it could have injected MIDI.

**Left as placeholders:** every label listed under the plan's
**Placeholders**, the touch-voice patch, the guide dot, and all curriculum
prose.

## Decisions the plan didn't cover

| Row | Decision | Why |
| --- | --- | --- |
| S1a | `availableFrom` lives in `router.ts`, not `availableModules.tsx` | repo convention: tested UI logic goes in a pure `.ts` |
| S1a | `parseLaunch` also rejects an empty `session`/`lesson`/`progression` and a `returnTo` that isn't an app path; it ignores unknown parameters and returns the first error only | a safe hand-off |
| S1a | A practice session's `startedAt` is when the drill starts; an unscored drill's `scores` is `{}` | `Session.scores` is required |
| S1b | `tapWindow` and `tapVerdict` take `calibrated` and optional measurements | `tapVerdict` needs both; L2's tests inject them |
| S1b | The touch voice is a triangle wave, not sine-ish, and triggers at `Tone.immediate()` | it carries on a phone speaker, and it skips the 100 ms look-ahead |
| S1b | MidiConnect counts every message kind, labels ports `<position>: <n> msgs`, and a tap on the chosen port clears it | two quiet ports would otherwise share a label |
| L1 | 14 progressions with tempo and swing by style; family and progression ids; one D lesson per §4.4 topic, with sync setup in d0; the resample-loop card in c3; B6 split into 5 recipes | the plan left these to the content |
| L1 | No 4-track template | SPEC §4.3's "keep … from v1": the v1 doc isn't in the repo |
| L2 | The drill's own stops land on the loop's last MIDI pulse, deferred by a microtask | so clock out sends that pulse before `FC` |
| L2 | A score is 0, not absent, when nothing counted | absent would pass a gate |
| L2 | Each transport start is a new run, and A6 skips every run's first downbeat; A0 matches taps greedily per run | defines the run boundaries |
| L2 | A4: answers count as questions answered, the moving tone is the last two notes played, pairs cycle until time's up | defines A4's pacing |
| L2 | Pickers are hidden inside a session; picking navigates to a practice launch; calibration is read from IndexedDB (none until Phase 3) | — |
| L3 | An open session from today shows its steps directly, with `resume session` | saves a tap on every return from a drill |
| L3 | The library is at `/runner?view=library&open=<id>` | back and reload work |
| L3 | The current level walks attempts only; a lock's predecessor is the nearest lower lesson with an available drill | otherwise B would jump to B6, and a card-only level would lock the ones above it |
| L3 | `launchedAt` keeps the first launch; a segment starts when the previous one finishes; `fast` minutes are rounded to 4 decimals | — |
| S2 | V10 and V11 group the content's Field steps (cards, recipes) | S2's call, per its row |
| run | S2 may edit `src/modules/runner/**` for the step score | its own Done-when item; no lane built it |

## Questions for the owner

| From | Placeholder or question |
| --- | --- |
| L1 | All curriculum prose, titles, recipe steps, and progression/family ids are drafts |
| L1 | Tempo and swing per style: chillhop 82–90 / 0.5, boombap 90–92 / 0.6, lofi-house 118–120 / 0.2, dorian-synth 100 / 0.3 |
| L1 | Is a 4-track template wanted? It needs the v1 doc |
| S1b | Touch voice patch: triangle, attack 5 ms, release 250 ms, −18 dB |
| S1b | Guide mark: an 8 px dot in `--op-muted` |
| S1b | MidiConnect: `connect midi`, `input`, `<position>: <n> msgs`; the chosen port shows `✓` with an `ok` border |
| L2 | Unlisted strings: `doesn't fit this level`, `notes` / `clashes`, `rest breaks`, `played: …`, `next pair at the loop end`, live reveal lines (`5 · right`), every level's reveal text, voice-leading map lines |
| L2 | Levels are labelled `a0`…`a6`; progression buttons read `<id> (<numerals>)`; the page layout and pad size |
| L3 | Unlisted strings: `loading`, `done`, `skipped`, `unfinished`, `practice`, `open`, `no sessions yet`, `<n> min`, `not done`, `cards only`, and the export's `streak <n>` |
| L2, L3 | After a library practice drill, the result says `back to session` and goes to the Runner home. What should it say? |
| S2 | A finished step reads `done A0 0%`, following `recent`, with no separator after `done` |

## VERIFY items

| Row | Item | What was stubbed |
| --- | --- | --- |
| S1b | V9 tap bias and tolerance | resolved from **Tap offsets**; G re-measures touch with the voice on |
| L2 | V6 bar-1 lock | A0's and A4's restarts send `F2`/`FA` with no pre-pulses, as the spine does |
| L1, S2 | V10: Field operations in the cards | `(field steps: VERIFY)` in b1 (also V2), c3, d0, d1, d2, d3, d5 |
| L1, S2 | V11: Field operations in the sequencer recipes | `(field steps: VERIFY)` in all 5 recipes |
| S1b | V7 port names | MidiConnect never labels a port by name; nothing stubbed |

## Spine requests

| Lane | Change | Why |
| --- | --- | --- |
| L2 | `TransportEngine.stop(atAudioTime?)` | a stop scheduled at the loop end would remove the end-of-drill blip and the microtask workaround |
| S2 | an `openAppDb` handler for `versionchange` / `blocked` | today a database delete, or a future `DB_VERSION` bump, hangs while another tab is open, and the Runner sits on `loading` |
| L2, L3 | `.claude/launch.json` per-configuration `cwd`, or a skill note (tools, not the spine) | `preview_start` with `dev-l2` / `dev-l3` serves the main checkout, not the lane's worktree |

## Checks only the owner can do

Each item is listed with its fake twin, where it has one:

- **`[phone]` daily-use target:** a full 15-minute session on the Pages URL,
  unplugged, logged, with the streak at 1. Fake twin: S2 ran it at `fast`
  in the desktop pane.
- **`[phone]` A0 on the phone:** taps read `on` on the beat and `late` when
  late on purpose. Fake twin: decision 6's example on the fake clock.
- **`[phone]` screen lock mid-drill:** the drill pauses, then resumes with
  the time left, and the attempt is logged once. Fake twin: L2's lifecycle
  test.
- **`[phone]` export:** the clipboard copy, or the box, and the `.md`
  download. Fake twin: `sessionMarkdown` tests, and S2's hooked export.
- **`[phone]` touch tap offsets:** re-measure with the touch voice on, then
  update the row and `TAP_OFFSETS` together. Fake twin: S1b's table test.
- **`[phone]` A0 pad vs keys medians:** if they differ by more than 10 ms,
  you decide. No fake twin.
- **`[field]` same path as touch:** A1, A5 and A6 answer the same. Fake
  twin: L2's `fieldTwin.test.ts`.
- **`[field]` connect from Module 1:** `connect midi` under the gate, then
  pick the port that lights up. Fake twin: S1b's labelling test over
  `FakeMidiAccess`.
- **`[field]` V6 restarts with clock out:** does the Field lurch at A0's and
  A4's restarts? No fake twin.
- **`[field]` the V10/V11 Field steps:** fill them in from the device. No
  fake twin.
- **`[ear]` touch voice:** no clicks, a level that sits with the backing,
  and Field keys don't double. Fake twin: S1b's which-events test.
- **`[ear]` backing per progression:** 14 progressions; three styles share
  `chillhop-rhodes` drums. Fake twin: L1's content test.
- **`[ear]` A1's bass on the phone speaker.** No fake twin.
- **`[ear]` the end-of-drill blip:** about 50 ms of the first chord at a
  finish. No fake twin.
- **`[ear]` silent first `start`** with the Field plugged in, carried from
  Phase 1. No fake twin.

## S1a: How to test this yourself

```bash
npm run check
```
```bash
npm run dev
```
1. `http://localhost:5173/op-1-school/?x=1&dev&fast`: hover the `dev spine`
   nav entry; its link ends in `?dev&fast`.
2. `/op-1-school/dev/spine?dev` loads with no red console errors.
3. In the console,
   `(await import('/op-1-school/src/curriculum/index.ts')).curriculumErrors()`
   prints `[]`.

(The row's "`/` still shows `modules arrive in phase 2`" no longer holds:
the Runner is home now that L3 is merged.)

## S1b: How to test this yourself

```bash
npm run dev
```
1. `http://localhost:5173/op-1-school/dev/spine?dev`. Before the gate, keys
   light and log `touch on <n>` but make no sound. Tap `tap to start audio`,
   then a key: you hear a soft tone (`[ear]`).
2. With the Field plugged in, play its keys: they log as `midi`, and the app
   adds no second sound (`[ear]`).
3. MidiConnect is on `/progression-trainer` (L2).

If a device check fails, send `/dev/spine`'s `copy report` first.

## L1: How to test this yourself

```bash
npm run check
```
1. `content.test.ts` passes.
2. Read `docs/CURRICULUM.md` and the cards in `src/curriculum/lessons/*.json`,
   and edit the prose: it's a draft.
3. `[ear]` at G: each A lesson's progression from Module 1 sounds right for
   its key and style.
4. `[field]` fill in each `(field steps: VERIFY)` from the device (V10,
   V11).

## L2: How to test this yourself

```bash
npm run dev
```
1. Open
   `http://localhost:5173/op-1-school/progression-trainer?dev&mode=A1&progression=pop-c-major&minutes=0.25`.
   Tap the gate, then `start`. Play the bass of each chord (C G A F). After
   about 15 s there's a score, `right`/`wrong`/`missed` rows, and the reveal
   `C: 1 · G: 5 · Am: 6 · F: 4`.
2. `mode=A0`: tap the pad on chord changes. The stage drops 8 → 4 → 2 as
   each loop scores 70% or more.
3. `mode=A9`: the error names `mode`.
4. `[phone]` lock the phone mid-drill: it reads `paused`, and `start`
   resumes with the time left.
5. `[field]` `connect midi`, pick the port that lights up, and check that
   A1, A5 and A6 answer the same as touch.

## L3: How to test this yourself

```bash
npm run dev
```
1. Open `http://localhost:5173/op-1-school/?dev&fast`. Run
   `indexedDB.deleteDatabase('op-1-school')` in the console, close any other
   tab on that port, and reload.
2. `start session`, `next` through the card, `open drill`, finish it,
   `back to session`; the step reads `done A0 <n>%`.
3. Skip B's stub; the C/D card, `next`, `skip`. You see `session done` and
   `streak 1`; `export` shows or copies the summary.
4. `library`, then a lesson: its cards show with no session. Under `?dev`
   every level opens; without it, locked levels read `locked`.

## S2: How to test this yourself

```bash
npm run dev
```
1. Run the whole session at `/?dev&fast`, as in L3's steps 1–3. The A0
   attempt is in IndexedDB with `data.step: 1`, and the export holds its
   score.
2. `library` → each of a0–a6 → `practice`: Module 1 opens on that level and
   progression with no error. a6 has `phrase` and `call and response`.
3. Everything `[phone]`, `[field]` and `[ear]` is in **Checks only the owner
   can do** above.

---

## Process retro

### Last retro's recommendations

From `2026-10-23-phase-1-exit-gate.md`:

- **1 (done): `audibleAt` fix and the error boundary.** It helped: S1b's
  `heardAudioTime` inverts `audibleAt` on both paths and was exact first
  time. The error boundary didn't come up.
- **(added, done): stop the transport when the page is hidden.** It helped:
  L2's `paused` state rests on it, and the lifecycle test drives it as an
  outside stop.
- **3 (done): ask for the probe's `copy report` first.** It didn't come up:
  no device checks ran unattended.
- **4 (done): Chrome-only.** It didn't come up.

### Timeline

All times 2026-10-23, local.

| Row | Start | Subagent done | Committed | Wall time | Fix rounds |
| --- | --- | --- | --- | --- | --- |
| grill | — | — | — | 7 min (subagent time) | — |
| pre-flight answers | — | — | 03:38 | — | — |
| S1a | 03:38 | 03:45 | 03:45 | 7 min | 0 |
| S1b | 03:45 | 03:54 | 03:55 | 10 min | 0 |
| lanes, first spawn | 03:55 | 03:55 | — | <1 min | wrong base |
| L1 | 03:56 | 04:03 | 04:03 | 7 min | 0 |
| L3 | 03:56 | 04:05 | 04:06 | 10 min | 0 (1 internal) |
| L2 | 03:56 | 04:19 | 04:20 | 24 min | 0 (1 internal) |
| merges and reports | 04:20 | — | 04:21 | 1 min | — |
| S2 | 04:21 | 04:28, fix 04:30 | 04:31 | 10 min | 1 |

### Friction

- **[run-steps] Lane worktrees cut from `origin/main`.** `isolation:
  "worktree"` cuts from `origin/main`, not from the checked-out plan
  branch. The base check in the plan caught it.
- **[run-steps] [step] `preview_start` serves the main checkout.** A lane's
  `dev-l2` / `dev-l3` server served the main checkout's code, not the
  worktree's. L2 and L3 each ran `npx vite --port <n> --strictPort` from
  their worktree and checked the served source.
- **[step] Clicks by coordinate miss in the browser pane.** The screenshot
  frame isn't CSS pixels; `find` → `ref` works. `find "skip"` once matched
  the `skipped` label, and `find 'button "skip"'` found the button.
- **[plan] [writing-a-plan] Checks that cross rows.**
  - L3's Done-when 3 expected `/progression-trainer` navigation, which
    decision 10 stubs without Module 1; L3 needed a temporary stub module.
  - S2's Done-when 2 checked a score no lane built.
  - In both cases the check belonged to, or should have cited, the lane row
    that builds the thing.
- **[plan] S1 rows' Owns didn't fit the work.** S1a's row put tested logic in
  a `.tsx`. S1b's MODULE_CONTRACT ownership ("MidiConnect only") was narrower
  than Carried forward asked.
- **[AGENTS.md] File names that differ only by case** bit L3 again
  (`home.ts` / `Home.tsx`); typecheck caught it.
- **[tools] Windows tooling quirks.**
  - Vite's watcher on Windows can miss the second of two near-simultaneous
    edits; touching the file fixes it.
  - Stopping a background Bash task left vite listening; it was killed by
    PID.
  - An empty `python -` heredoc hung for 120 s.
  - The Bash tool refuses compound commands in a worktree-isolated agent.
- **[tools] A second pane tab blocks the database delete.**
  `indexedDB.deleteDatabase` reports `blocked` while a second pane tab on the
  same origin is open; `AGENTS.md` now says so.
- **[plan] L1's content had gaps.** "One card per §4.4 topic" didn't say
  whether sync setup is a topic, or where C's resample-loop card goes.

### Orchestration

- **The overrides held.** No row stopped under (c). The only VERIFY stubs
  were V6 and the content's Field steps.
- **The lanes stayed in their paths.** L3's temporary stub module was
  deleted before it reported. The one exception was S2's Runner fix, which I
  authorized and which is recorded above.
- **Carried forward was enough.** I relayed nothing by hand beyond the
  pre-flight answers in each prompt. The lane bullets I wrote into the plan
  after the merges were S2's whole worklist, and S2 cleared them.
- **My spot-checks matched the reports.** One small oddity the reports
  didn't mention: a 10 s practice launch reads `0:11 left` before start.
- **The merges were clean,** in order, with green checks after each. The
  lanes shared no files, and the registry's glob meant no lane touched a
  shared file.
- **The grill paid off.** At least three of its four "sinking" items would
  have stopped a lane: step state, the ports, and `fast`.

### Verification gaps

- **The touch voice, the backing and the end-of-drill blip are unheard.**
  Only the owner's ear can check them.
- **MidiConnect has never met real Web MIDI.** It runs only over
  `FakeMidiAccess`. A virtual MIDI loopback, which needs the owner's OK to
  install a program, would make it checkable on the desktop.
- **Pause and resume on a real screen lock** is covered by the state machine
  test only. A `/dev/spine`-style button that fakes `visibilitychange` would
  cover the wiring.
- **`export`'s download and clipboard** were checked by hooking them from
  the console. The real download on the phone is the owner's.
- **V6 stays stubbed** until the owner runs G with the Field.

### Recommendations (ranked)

1. **Create lane worktrees from the plan branch.** In `/run-steps`, either
   create them yourself (`git worktree add -b <plan-slug>-<lane> <path> <S1
   commit>`) and spawn each lane without `isolation`, pointed at its path;
   or keep `isolation` and make "`git reset --hard <base>`, then verify" the
   prompt's first line. Either way, add a line saying `preview_start`
   serves the main checkout: a lane starts vite itself from its worktree.
   Cost: a few lines in `.claude/skills/run-steps/SKILL.md` and the `step`
   skill.
2. **`openAppDb` handlers for `versionchange` / `blocked`** (spine, small).
   Do it before any `DB_VERSION` bump, or the next DB change hangs a
   two-tab user on `loading`.
3. **`TransportEngine.stop(atAudioTime?)`** (spine, small), after the owner
   hears whether the end-of-drill blip matters at G. It removes the
   microtask workaround in L2's `drill.ts`.
4. **Integration Done-when items cite the row that builds what they check.**
   And a lane's browser check never depends on another lane's module. Add
   one line in `.agents/writing-a-plan.md` under **Done-when items**.
5. **Browser-pane habits in the `step` skill:** click by `find` → `ref`,
   close extra tabs before deleting IndexedDB, and touch a file if Vite
   serves a stale module. One bullet in `.claude/skills/step/SKILL.md`.
6. **Look at the `0:11 left` rounding** on a 10 s launch when Module 1 is
   next touched. Cosmetic.
