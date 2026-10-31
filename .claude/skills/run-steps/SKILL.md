---
name: run-steps
description: Orchestrate an op-1-school plan's remaining rows unattended - check the plan was grilled and the machine is clean, then one fresh subagent per step (in order) or per lane (in parallel, one worktree each), check and commit each, merge lanes in order on the plan branch, and finish with a retro in .agents/retros/. Use whenever the user invokes /run-steps, or asks to "run the fan-out", "orchestrate phase 2", "run the rest of the plan overnight", or similar.
---

# Run steps

You're the orchestrator. You don't build anything yourself: each step or lane
goes to a fresh subagent, and you check, commit, merge and write it up. Their
request: **$ARGUMENTS** (if that's blank, it's in their message). It names the
plan, and maybe which rows or where to stop. If it doesn't name the plan, ask
(**Where we are** in `AGENTS.md` lists the open ones). Without rows named,
it's every open row up to the plan's first **attended** row. If the next open
row is attended, there's nothing to run: say so and point the owner at
`/step`.

Read the [`step` skill](../step/SKILL.md): what each subagent does, including
its subagent mode.

## Phase 0: before the run (the owner is still here)

1. **The latest retro.** Read the newest file in `.agents/retros/`. If its
   **Status** says it wasn't reviewed, say so and suggest `/retro` first.
   Otherwise carry anything still open in its **Review** into this run.
2. **The plan was grilled.** It has a **Pre-flight answers** section. If it
   doesn't, say so and stop: [`/write-plan`](../write-plan/SKILL.md) grills it
   and asks the owner.
3. **The machine.** `git status` is clean, you're on `main`, the last plan's
   branch is merged (`git branch --no-merged main` doesn't list it),
   `npm run check` passes, and no dev server is running. If not, say so and
   stop. **Resuming a plan** whose branch is still unmerged: stay on it and
   skip the `main` and merged checks. If its branch was merged (a run, then
   `/retro` and an attended row on `main`), Phase 1 restarts it from `main`. Re-read the answers' check notes for this
   machine (a cloud container has no Field and no phone; its browser is
   headless Chromium, see the `step` skill).
4. **Recommend a model and effort.** You can't change your own, so recommend
   and wait for the owner to switch and say go. Subagents inherit your effort;
   pass each one the `model` its row names. To change one, say why here and
   record the owner's pick in the answers. **High effort** only when the
   answers left a lot undefined; otherwise the plan carries the thinking and
   medium is enough.

## Phase 1: the run

1. **Branch.** `git switch -c <plan-slug>` from `main`, unless you're
   resuming on it; if it exists and is merged, `git switch -C <plan-slug>
   main`. A model change from Phase 0 goes into the first row's
   commit. Note the time.
2. **Steps:** one fresh subagent per step, in order, never two at once, all on
   the plan branch. Check each (below) and commit it before the next.
3. **Lanes:** create each lane's worktree yourself from the plan branch's
   `HEAD` (the last step's commit, if any), `git worktree add -b <plan-slug>-<lane>
   .claude/worktrees/<plan-slug>-<lane> <commit>`, and confirm the commit is
   its `HEAD`. Don't use the Agent tool's `isolation: "worktree"`: it cuts
   from `origin/main`, not the plan branch. Then spawn every lane's subagent
   in one message, each pointed at its worktree's absolute path, with its
   `model`. You're notified as each finishes; don't poll. Check each as it
   returns and commit on its branch. When all are in, merge them into the
   plan branch in the plan's merge order (`git merge --no-ff`), running
   `npm run check` after each merge. Then write what each lane reported into
   the plan branch: its status, Carried forward, Process notes, VERIFY log
   entries and the doc changes it asked for. Remove the lane worktrees once
   merged; keep the branches.
4. **Stop the run** before an attended row, when a subagent stops under
   override (c), when a row fails its checks after one fix round, or when a
   merge conflicts or goes red. Don't start or merge anything more; go to
   Phase 2 and say why it stopped.

### The subagent prompt

Fill in the `<…>` parts and keep the rest as written.

```
You are working in <repo path | lane: its worktree's absolute path> on branch `<branch>`.
<Lanes: Every command runs there (`cd <path> && …`) and every file you edit
is under it; the main checkout belongs to other lanes.>
Read AGENTS.md first. Then load the `step` skill
(.claude/skills/step/SKILL.md) and follow it in its subagent mode.

Do <step | lane> <id> (<name>) of <plan doc>, with these overrides:
(a) <build the whole row | the owner cut: …>;
(b) if a creative call isn't written down, use a neutral, obviously
    temporary placeholder and list it under "Questions for the owner"
    instead of stopping;
(c) if the row would break a load-bearing rule or a resolved decision,
    STOP and report why instead of building;
(d) if a VERIFY item blocks you, stub behind the interface and keep going;
(e) <lanes: touch only <owned paths>; if you need a spine change, work
    around it inside them and put it under "Spine requests";>
(f) don't commit.

<Steps: The previous step was committed as <hash | "nothing: this is the
first step">; backfill it in the status table. Read Carried forward and
write yours before you finish.>
<Lanes: Don't edit the plan; report your status, Carried forward bullets
and process notes instead. Run `npm ci` first.>
The plan's "Pre-flight answers" win over anything that reads differently.
<Point at the answers that matter most for this row.>
Write any scripted edit or probe to a file with the Write tool and run it
from there (.agents/windows-tool-pitfalls.md).
```

### Checking a row

1. **Its report.** Every Done-when item is PASS or OWNER, with how it was
   checked. A FAIL, or an item with no "how", fails the row.
2. **`npm run check`** exits 0 in its tree.
3. **`git -c core.autocrlf=false diff --check`** is clean.
4. **Paths.** A lane's `git status` shows only its owned paths. A spine path
   or `package.json` fails it unless its plan row or the pre-flight answers
   give it that path. A step's shows only what its row says.
5. **The plan** (steps): the row is done, the next is **Next**, the previous
   hash is backfilled, Carried forward is updated.
6. **Spot-check one item yourself**: the Done-when item that matters most and
   has a check you can run. If none has, say so in the retro: that's a
   plan-writing finding.
7. **Nothing left running** that the subagent started.

**One fix round.** If a check fails, `SendMessage` the same subagent what
failed and ask it to fix and re-check. If it still fails, stop the run.

**Commit** each row in the style of earlier ones (`<Plan> <id>: <name>` and a
bullet summary: what changed, what the subagent added beyond the plan, the
docs touched), written to a file and committed with `git commit -F`. End with
the attribution line from your system prompt.

Keep, for the retro: each row's start and end times, fix rounds, the
subagent's full report, and your own check results.

## Phase 2: the retro

Write `.agents/retros/<YYYY-MM-DD>-<plan-slug>.md` (the run's start date) and
commit it on the plan branch as `<Plan>: run retro`. Use exactly this shape,
so `/retro` can walk it:

```markdown
# <Plan> — run (<date>)

**Status:** not reviewed yet. Run `/retro` with the owner.

<One paragraph: branch, base commit, lane branches, what's merged into the
plan branch, what's pushed (nothing, unless the owner said so).>

## Result
| Row | Branch | Commit | Outcome |
- Failures or stops, and why.
- What you checked after each row, including the item you spot-checked.

## Pre-flight
Which of the plan's Pre-flight answers the run leaned on, and any that turned
out wrong or missing.

## Decisions the plan didn't cover
| Row | Decision | Why |

## Questions for the owner
| From | Placeholder or question |

## VERIFY items
| Row | Item | What was stubbed |

## Spine requests
| Lane | Change | Why |

## Checks only the owner can do
Every OWNER item: `[phone]`, `[field]`, `[ear]`. Say what its fake twin
measured, if it had one.

## <Row id>: How to test this yourself
(one section per row, copied from its report, in order)

---

## Process retro

### Last retro's recommendations
For each one the last Review marked done: did it help this run? For each still
open: did its problem come up again?

### Timeline
| Row | Start | Subagent done | Committed | Wall time | Fix rounds |

### Friction
The subagents' process notes plus yours, merged and de-duplicated, each tagged
with the file it would change: [plan], [spec], [AGENTS.md],
[writing-a-plan], [step], [run-steps], [retro], [tools].

### Orchestration
Did the overrides hold? Did lanes stay in their paths? Was Carried forward
enough, or did you relay things by hand? How did your spot-check compare with
the report? How did the merges go?

### Verification gaps
Items that couldn't really be checked unattended, and what would make them
checkable (a fake, a test, a `/dev/spine` readout).

### Recommendations (ranked)
Concrete changes for the next run: where each goes and what it costs. Don't
make them; the owner picks in `/retro`.
```

## Finishing

- **Don't merge to `main`.** Push and open PRs only if the plan's Pre-flight
  answers say so; then use `.github/pull_request_template.md`. The owner merges
  the plan branch after `/retro`, and the next run won't start until they
  have.
- **Clean up** what you and your subagents started.
- **Your final message:** the result table, what needs the owner (their
  checks, questions, decisions, spine requests), the top three
  recommendations, and what you stopped. Point at the retro and tell them to
  run `/retro`.

## Keep this skill current

When a retro's Review approves a change to how runs work, make it here in the
same change. This file is the process; the retros are its history.
