# op-1-school

**op-1-school** is a jam and improvisation trainer for the OP-1 Field: a
curriculum plus a mobile-first PWA (Vite, React, TypeScript, Tone.js, Web
MIDI) that runs in Chrome on an Android phone and on desktop, deploys to
GitHub Pages, and talks to the Field over one USB-C cable when one is plugged
in. No backend.

[`docs/SPEC.md`](docs/SPEC.md) is the design. Read its §0 before doing
anything.

## Where we are

Nothing is scaffolded yet. The build goes spine first, fan-out second
(SPEC §6): the spine is a plan of steps, then an orchestrator (`/run-steps`)
runs each later phase as parallel lanes, with the owner's hardware gates in
between.

Open plans:

- [`phase-1-spine.md`](.agents/plans/phase-1-spine.md): Phase 1, the spine
  (SPEC §6.1) and the `/dev/spine` smoke page.

Plans live in `.agents/plans/`, one per phase or spike; retros in
`.agents/retros/`. Name each open plan here with a link and what it's for,
never how far along it is: its status table says that. **When the owner asks
to continue plan work without naming the plan, ask which one.**

## Before you start a job

| The job | Load or read first |
| --- | --- |
| "Do the next step", or any named step or lane (including as a `/run-steps` subagent) | the **`/step`** skill |
| Orchestrating a plan's steps or lanes | the **`/run-steps`** skill |
| Going over a retro with the owner | the **`/retro`** skill |
| Writing or changing a plan, a step, a lane or a "Done when" list | [`.agents/writing-a-plan.md`](.agents/writing-a-plan.md) |
| Any audio, MIDI, clock or input-timing code | SPEC §3, all of it |
| Anything touching OP-1 Field behaviour or file formats | SPEC §2 and §8, then `docs/HARDWARE_NOTES.md` once it exists |
| Work in a module lane | SPEC §5.5 and §6.5, then `docs/MODULE_CONTRACT.md` once it exists |
| Adding a dependency, a vendored file, or installing a program | [Dependencies](#dependencies) below, and **ask the owner first** |
| Shell scripts, regexes, paths or commit messages on this machine | [`.agents/windows-tool-pitfalls.md`](.agents/windows-tool-pitfalls.md) |

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
  what the spec fixes. Use neutral, obviously temporary placeholders and ask.

## Dependencies

- The packages SPEC §5.1 names are approved. Ask before adding any other npm
  package, vendored file or program, and prefer ones with few dependencies.
- The committed `.npmrc` turns off install scripts, saves exact versions,
  skips releases younger than 7 days and blocks git dependencies. Don't loosen
  it. If a package can't work without its install script, ask. Install with
  `npm ci` once a lockfile exists.

## Repo conventions

- Vite's `base` is `/op-1-school/`, the repo name.
- `docs/` holds owner docs; `.agents/` holds agent notes. Every change updates
  the docs it affects in the same commit, written as what's true now, with no
  "was X, now Y".
- LF line endings everywhere (`.gitattributes`, `.editorconfig`).
- Before your final message, stop any dev server or browser you started, and
  nothing else. Say what you stopped.
