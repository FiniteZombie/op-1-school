---
name: write-plan
description: Write a new op-1-school plan (a SPEC phase or a spike) in .agents/plans/ - start from the last plan's leftovers, write the rows, have a fresh subagent grill it, ask the owner once, write their calls in as Pre-flight answers, and commit it ready for /step or /run-steps. Use whenever the user invokes /write-plan, or asks to "plan phase 3", "write the next plan", "plan the format spike", or similar.
---

# Writing a plan

You write the plan and get it grilled and answered, so whoever runs it
(`/step` for attended or one-at-a-time rows, `/run-steps` unattended) starts
building with nothing left to ask. Their request: **$ARGUMENTS** (if that's
blank, it's in their message). Read
[`.agents/writing-a-plan.md`](../../../.agents/writing-a-plan.md) first: it's
what the plan must cover and what the grill checks against.

1. **Inputs.** The newest file in `.agents/retros/`: if its **Status** says it
   wasn't reviewed, say so and suggest `/retro` first. Then the last plan's
   open **Carried forward** bullets and its retro's **Review**, the SPEC
   section for the phase, and the SPEC sections and docs `AGENTS.md`'s table
   sends that kind of work to. Rename the session (`set_session_title`,
   `session_id: "self"`) to `Plan: <slug>` if the tool is there.
2. **Write it** at `.agents/plans/<slug>.md`, as `writing-a-plan.md` says.
   Each leftover from step 1 becomes a row, a question for step 4, or a line
   saying what it waits for. Give each row a model: **Opus 5.5** for the
   spine and anything touching clocks, timing, MIDI, theory or file formats;
   **Sonnet 5.5** for content, UI wiring and rows written near code level;
   **Fable 5.1** not tried here yet, so ask the owner before naming it.
3. **Grill it.** Spawn one fresh read-only subagent to read the plan, the SPEC
   sections it cites, `AGENTS.md`, `docs/MODULE_CONTRACT.md` and
   `writing-a-plan.md`, and list:
   - contradictions inside a row or between rows;
   - behaviour the plan doesn't define (failure and empty cases, what happens
     to an earlier row's stub);
   - creative calls it doesn't make (copy, a label, a look, a name);
   - Done-when items with no check an agent can run, and items that should be
     tagged `[phone]`, `[field]` or `[ear]`;
   - VERIFY items a row would have to guess at;
   - for lanes: owned paths that overlap, a lane that needs another lane's
     output, a shared file no lane owns, and anything a lane needs from the
     spine that the spine doesn't have yet;
   - anything that breaks a load-bearing rule.

   Fix the plain mistakes it finds in the plan yourself.
4. **Ask the owner, once.** What's left, grouped as above, each with your
   suggested answer. Creative calls default to placeholders: list them, and
   the owner answers only the ones they care about. For lanes, also ask
   whether `/run-steps` should push the branches and open PRs at the end, or
   keep it all local.
5. **Write the answers in.** A `## Pre-flight answers (<date>)` section: the
   owner's calls, the technical answers you settled, then check notes, each
   saying which machine it holds for. Say that it wins over anything that
   reads differently. When an answer overrides a numbered decision or a row's
   text, edit that text to agree; when it renames something, fix every
   mention (`git grep -n '<old>' -- <plan>` hits only the answers afterwards).
6. **Finish.** List the plan in `AGENTS.md` **Where we are** (a link and what
   it's for). Commit on `main` as `Plan: <slug>`, ending with the attribution
   line from your system prompt. Tell the owner what runs first: `/step` if
   the first row is attended, else `/run-steps`.

## Keep this skill current

When a retro's Review changes how plans get written or grilled, change it here
or in `writing-a-plan.md` in the same change.
