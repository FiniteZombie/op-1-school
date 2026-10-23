# Writing a plan

**Read this before you write or change a plan, a step, a lane, or a "Done
when" list.** `AGENTS.md` sends you here and doesn't repeat it.

One plan per SPEC phase or spike, in `.agents/plans/<slug>.md` (for example
`phase-1-spine.md`). The spec is the design; a plan says how one phase gets
built and where it stands, and wins over the spec where they differ. Agents
read plans, often unattended ([`/step`](../.claude/skills/step/SKILL.md),
[`/run-steps`](../.claude/skills/run-steps/SKILL.md)), so write them so an
agent can build and check each row without asking.

## Steps or lanes

- **Steps** run one at a time, in order, each on top of the last. The spine
  (SPEC §6.1) is steps: its order is its dependency order.
- **Lanes** run at the same time, each in its own worktree and branch (SPEC
  §6.2, §6.5). Each lane lists the paths it owns, and two lanes never own the
  same path. A lane can use another lane's output only through a spine
  contract (a type, a schema) and a place after it in the merge order, as the
  Runner reads lessons typed by `src/types/lessons.ts`. If it needs the other
  lane's files to build or test, it's a later lane.
- **Files every lane would touch** (`package.json`, the lockfile, shared
  types) belong to no lane. If a lane needs one changed, that change goes into
  the spine first, or the plan names the one lane allowed to make it.
- Each lane row gives: owned paths, what it consumes from the spine, its Done
  when, a model, and its place in the merge order. A lane that builds a spine
  stub (SPEC §6.3: Module 3 builds `MicInput`) owns that file by name.

## The spine plan

The fan-out depends on more than SPEC §6.1 lists. Besides its eight
deliverables, the spine plan's rows create:

- `.claude/launch.json`, the dev server that `/step` and `/run-steps` check
  with;
- `docs/HARDWARE_NOTES.md` with its VERIFY log, and `docs/MODULE_CONTRACT.md`;
- anything SPEC §5.5's "Consumes" column needs that §6.1 doesn't list
  (`KeyEstimate`), or a row saying which later lane owns it.

Its last row is attended: the §6.1 exit, where the owner pushes `main`, checks
GitHub Pages, and runs `/dev/spine?dev` on the phone and the Field.

## Done-when items

- **Each item gets a check an agent can run**: a Vitest test, a command, a
  number, or what to read on `/dev/spine?dev` in a browser. Keep the
  human-facing wording too: it's the owner's test script.
  - "ii°–V7–i–VI in F minor is right" becomes "the F-minor fixture in
    `src/theory/__tests__` asserts each chord's pitch-class set, and passes".
  - "MIDI clock is tight" becomes "with `FakeMidiPort` at 120 BPM, 4 beats
    schedule 96 pulses, each within 0.5 ms of `audioToPerf` of its tick".
- **Timing items name what they assume**: BPM, PPQ, lookahead, output latency,
  calibration, and whether the clock is scheduled time or audible time
  (SPEC §3.3). An offset check that leaves out output latency measures the
  wrong thing.
- **Tag items only a person can check**: `[phone]` (the Android phone in hand:
  its Chrome, touch, latency, wake lock), `[field]` (the OP-1 Field attached),
  `[ear]` (listening: clicks, swing, a sound that's right). They go straight to
  the owner's list. Give each a fake twin where one exists (`FakeMidiPort`, a
  fake `ClockBridge`, touch input).
- **A VERIFY item is never an agent's PASS.** A row that hits one names it, and
  its Done when is "stubbed behind `<interface>`, listed in the report and the
  VERIFY log".
- **Search with `git grep -n --untracked <pattern> -- . ':!.agents'`**, never
  `grep -rn`, which also reads `.git/`. `--untracked` matters: a row's new files
  aren't committed while it's checked. Run each grep on today's tree as you
  write it; one that already matches files the row doesn't own can't pass.

## What a row must cover

- **Work one number through every new rule.** "At 90 BPM a sixteenth is
  166.7 ms. A snare played 62 ms after its scheduled time, with 40 ms output
  latency and no calibration, reads +22 ms." Doing the maths shows whether the
  rule does its job.
- **Say what happens to what an earlier row left**: a stub (`MicInput` throws
  `NotImplemented`) names the row or phase that replaces it.
- **Cover failure and empty cases**: MIDI denied or unsupported (Firefox), no
  calibration yet, an empty or older database, the Field unplugged mid-drill.
  Name the placeholder copy for empty states and new labels, marked as
  placeholder, so the agent doesn't invent it.
- **Read it once for contradictions** before calling it done: examples that
  break the doc's own rules, the same rule stated two ways, a row that deletes
  something a later row checks against.

## The status table

- **At the top**, one row per step or lane: id, name, status (**Next**, or
  done with a date), commit, and for lanes the branch and merge order.
- **Mark attended rows** with **attended** in the name: a hardware gate, the
  format spike, or anything whose `[phone]` or `[field]` result a later row
  needs. `/run-steps` stops before them; the owner and `/step` do them.
- Under it, an empty `### Carried forward` list (handoffs between rows) and an
  empty `### Process notes` list (what attended rows found wrong with the
  process; the retro reads it).
- The phase's exit criteria (from the spec) are the plan's last Done-when list.
- A `/run-steps` pre-flight adds a **Pre-flight answers** section. It wins over
  the row text where they differ, but an answer that overrides a numbered
  decision or a row edits that text too, and a later edit to either keeps
  them in agreement.

## When a plan is done

A plan is done when every row is done or cut and its retro has been reviewed.
The `/retro` session that reviews it moves it to `.agents/plans/archive/` and,
in the same change, fixes links to it and points `AGENTS.md`'s **Where we are**
at the next plan.
