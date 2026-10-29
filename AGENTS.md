# op-1-school

**op-1-school** is a jam and improvisation trainer for the OP-1 Field: a
curriculum plus a mobile-first PWA (Vite, React, TypeScript, Tone.js, Web
MIDI) that runs in Chrome on an Android phone and on desktop, deploys to
GitHub Pages, and talks to the Field over one USB-C cable when one is plugged
in. No backend.

[`docs/SPEC.md`](docs/SPEC.md) is the design. Read its §0 before doing
anything.

## Where we are

The build goes spine first, fan-out second
(SPEC §6): the spine is a plan of steps, then an orchestrator (`/run-steps`)
runs each later phase as parallel lanes, with the owner's hardware gates in
between.

Open plans:

- [`phase-2-fan-out.md`](.agents/plans/phase-2-fan-out.md): SPEC §6.2, the
  curriculum, Module 1 (Progression Trainer) and the Runner, as two spine
  steps, three lanes, an integration step and the owner's exit gate.
- [`bug-report.md`](.agents/plans/bug-report.md): a diagnostics log in the
  spine and a bug button on every page that sends it, by clipboard or as a
  prefilled GitHub issue.

Phase 1, the spine, is done
([archived](.agents/plans/archive/phase-1-spine.md)).

Plans live in `.agents/plans/`, one per phase or spike; retros in
`.agents/retros/`. Name each open plan here with a link and what it's for,
never how far along it is: its status table says that. **When the owner asks
to continue plan work without naming the plan and more than one is open, ask
which one.**

## Before you start a job

| The job | Load or read first |
| --- | --- |
| "Do the next step", or any named step or lane (including as a `/run-steps` subagent) | the **`/step`** skill |
| Orchestrating a plan's steps or lanes | the **`/run-steps`** skill |
| Going over a retro with the owner | the **`/retro`** skill |
| Writing or changing a plan, a step, a lane or a "Done when" list | [`.agents/writing-a-plan.md`](.agents/writing-a-plan.md) |
| Any audio, MIDI, clock or input-timing code | SPEC §3, all of it |
| Anything touching OP-1 Field behaviour or file formats | SPEC §2 and §8, then [`docs/HARDWARE_NOTES.md`](docs/HARDWARE_NOTES.md) |
| Work in a module lane | SPEC §5.5 and §6.5, then [`docs/MODULE_CONTRACT.md`](docs/MODULE_CONTRACT.md) |
| Adding a dependency, a vendored file, or installing a program | [Dependencies](#dependencies) below, and **ask the owner first** |
| Shell scripts, regexes, paths or commit messages on the owner's Windows PC (a cloud container is Linux: ignore its Git Bash, PowerShell and CRLF advice, but still write scripted edits to a file) | [`.agents/windows-tool-pitfalls.md`](.agents/windows-tool-pitfalls.md) |

## Load-bearing rules

Push back before breaking one.

- **Never resolve a VERIFY item by guessing,** or from what the original OP-1
  did. Build behind the interface, leave it flagged, and list it in your final
  report.
- **No third-party audio in the repo.** Backing is procedural; user samples
  come in through the file picker. Audio files are gitignored, and kits dumped
  off the Field for the format spike stay local.
- **Modules import only from the spine** (`src/{types,theory,audio,input,state,ui}`),
  never from each other. A module lane that needs a spine change describes it
  instead of making it, unless its plan gives the lane that file.
- **Type-checking isn't verification.** Pure code ships with Vitest tests.
  Audio and MIDI behaviour ships with a `/dev/spine` check and steps the owner
  runs on the phone and the Field. Never report a phone or hardware check as
  done; tag it as the owner's.
- **No red vs green.** The owner is red/green colorblind. Note
  classifications, radar zones and pass/fail states use blue or cyan = good,
  red = bad, yellow = warning, gray = neutral, and never differ by hue alone.
- **Creative choices are the owner's**: copy, names, look and layout beyond
  what the spec fixes. Use neutral, obviously temporary placeholders, mark
  them, and list them in your report rather than stopping to ask: the owner
  is fine with placeholders and asks for changes later.

## Dependencies

- The packages SPEC §5.1 names are approved. Ask before adding any other npm
  package, vendored file or program, and prefer ones with few dependencies.
- The committed `.npmrc` turns off install scripts, saves exact versions,
  skips releases younger than 7 days and blocks git dependencies. Don't loosen
  it. If a package can't work without its install script, ask. Install with
  `npm ci`.

## Repo conventions

- Vite's `base` is `/op-1-school/`, the repo name.
- `npm run check` runs typecheck (`tsc -b`, every project), Vitest, then the
  build; it must exit 0 before a step is done. CI runs the same on Node 24.
- Type projects: `tsconfig.app.json` (`src`, browser types),
  `tsconfig.test.json` (`src/**/__tests__`, adds Node types) and
  `tsconfig.node.json` (the Vite and Vitest configs). App code that imports
  `node:*` fails typecheck on purpose.
- Tests are `src/**/__tests__/**/*.test.ts`, in Vitest's node environment.
- `src/modules/__tests__/importRule.test.ts` enforces the import rule: a
  module imports only the spine, its own directory and `src/curriculum/`;
  only `src/ui/AppShell.tsx` imports `src/modules/registry.ts`.
- Test files never import `tone`. Pure maths lives in Tone-free files
  (`timing.ts`, `Clock.ts`, `voicing.ts`, `drumPatterns.ts`); the Tone
  wrappers stay thin and are checked on `/dev/spine`. Only
  `getAudioContext()` / `initAudio()` in `src/audio/TransportEngine.ts` reach
  Tone's context. No jsdom: UI logic that needs a test lives in a pure `.ts`
  file next to its component, named apart from it and not by case alone
  (`audioGateLogic.ts` beside `AudioGate.tsx`): Windows resolves imports
  case-insensitively, and `src/__tests__/fileNames.test.ts` fails on a clash.
- Fakes for tests: `src/input/__fakes__/` (fake MIDI ports) and
  `src/audio/__fakes__/` (a fake transport over the real `TransportCore`, a
  fake clock bridge). They stay Tone-free. Settled copy is `COPY` in `src/ui/copy.ts`; anything else a page
  shows is a labelled placeholder until the owner decides.
- Enum-like types come from `as const` lists next to them (`MODULE_IDS`,
  `STYLE_IDS`, …); adding a member means adding it to the list. The lesson
  validators reject unknown fields, so a field added to `Lesson`,
  `LessonStep`, `ProgressionSpec` or `SequencerRecipe` also goes in that
  validator's `known([...])` list.
- A DB version is a new `case` in `upgradeDb` (`src/state/db.ts`) after case
  0's block; the tsconfig forbids falling through into `default`.
- The VERIFY log is in `docs/HARDWARE_NOTES.md`; a VERIFY item you hit gets a
  row there (status `open` or `stubbed`, and where).
- Colours come from the theme tokens in `src/ui/tokens.css` (a dark and a
  light value each; dark is a `dark` class on `<html>`), never raw hexes.
- Dev server: the `dev` configuration in `.claude/launch.json` (`npm run dev`,
  port 5173). The app is at `http://localhost:5173/op-1-school/`. Parallel
  lanes use `dev-l2` (5174) and `dev-l3` (5175): another port is another
  origin with its own IndexedDB, so a check that reads it first runs
  `indexedDB.deleteDatabase('op-1-school')` and reloads. The app doesn't
  close its connection on `versionchange`, so the delete waits (`blocked`)
  until every tab on that origin is gone: close the pane's extra tabs
  (`preview_start` opens one) before reloading.
- Drills are launched by URL and report one `Attempt`: `src/types/drills.ts`
  (`launchQuery`, `parseLaunch`, `DRILL_MODES`) and **Drills** in
  `docs/MODULE_CONTRACT.md`. The router keeps `dev`, and `fast` only
  alongside it; `/` is the `runner` module (also `/runner`; its library is
  `/runner?view=library&open=<lesson id>`). Curriculum JSON is read only
  through `src/curriculum/index.ts`.
- Module 1's scorers run through a Tone-free `DrillController`
  (`src/modules/progression-trainer/drill.ts`), with the backing synth passed
  in as a `BackingLike`, so they're tested on the fake transport and clock;
  the view only wires the real `ToneBackingSynth` in. A new drill module
  follows the same pattern in its own directory (it can't import Module 1's).
- The diagnostics log is `diagnostics` in `src/state/diagnostics.ts`, fed by
  `src/ui/diagnosticsCapture.ts`: console errors and warnings, the context,
  transport, a 1 s heartbeat (levels from `liveBackingProbes()`), MIDI, page
  and route changes. Modules are captured without doing anything; keep log
  text ASCII and free of anything personal (reports are public). The nav's
  bug button sends it, as GitHub issues labelled `bug-report` on
  `FiniteZombie/op-1-school`; an agent may comment on and close the ones it
  fixes. The browser pane refuses clipboard writes, so check `copy` in Chrome.
- The tap window is `tapVerdict` in `src/audio/tapWindow.ts`, fed by
  `TAP_OFFSETS`, a copy of `docs/HARDWARE_NOTES.md` **Tap offsets** (latest
  Android row per input). `tapWindow.test.ts` parses that table and fails when
  the two differ, so a new measurement updates both in one commit. Drill tests
  inject their own measurements rather than read `TAP_OFFSETS`.
- The build copies `dist/index.html` to `dist/404.html` so GitHub Pages serves
  the app shell for deep links.
- `docs/` holds owner docs; `.agents/` holds agent notes. Every change updates
  the docs it affects in the same commit, written as what's true now, with no
  "was X, now Y".
- LF line endings everywhere (`.gitattributes`, `.editorconfig`).
- Before your final message, stop any dev server or browser you started, and
  nothing else. Say what you stopped.
