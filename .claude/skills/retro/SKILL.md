---
name: retro
description: Walk the owner through the latest op-1-school retro (from a /run-steps run, or the last row of an attended plan) - confirm the decisions agents made, answer their questions, settle spine requests, list the checks only the owner can do, then act on the recommendations the owner approves and record it all in the retro. Use whenever the user invokes /retro, or asks to "go through the run", "review the retro", "what happened with the fan-out", or similar.
---

# Retro

A run ([`/run-steps`](../run-steps/SKILL.md)) or the last row of an attended
plan ([`/step`](../step/SKILL.md)) left a retro in `.agents/retros/`. You walk
the owner through it, get their calls, then improve the process with them so
the next phase goes better. Their request: **$ARGUMENTS** (if that's blank,
it's in their message).

## 1. Find the retro

- Retros are `.agents/retros/<YYYY-MM-DD>-<plan-slug>.md`. The latest is the
  newest date in the name; if two share it, the one last changed in git
  (`git log -1 --format=%ci -- <file>`). If the owner named one, use that.
- If its **Status** says reviewed, say so and ask whether they meant an older,
  unreviewed one. Mention any older retro still unreviewed.

## 2. Check it against the repo

- The commits and branches it names exist, and you know where each branch is:
  merged to `main`, open as a PR, or still separate. If the plan branch isn't
  merged, do the review on it; the owner merges it afterwards.
- The plan's status table agrees with it.
- For anything you'll call risky, read the code yourself rather than repeating
  the retro's claim. If something's unclear, the session that ran it may still
  be listed: read its transcript (`mcp__ccd_session_mgmt__list_events`).

## 3. Walk the owner through it

One message, in this order, leading each section with what needs them.

1. **Decisions the agents made that the plan didn't cover.** A table: the
   decision, and your take (keep, or reconsider and why). The biggest call
   first.
2. **Questions**: behaviour the agents had to choose, numbered, each with
   your suggestion. Placeholders (names, copy, looks) go in one line: the
   owner is fine with them and asks for changes later.
3. **Spine requests.** For each: your take, and whether it should land as its
   own small change before the next fan-out (SPEC §6.5).
4. **VERIFY items** hit, and what was stubbed. Say which ones block a later
   phase.
5. **Checks only they can do**: `[phone]`, `[field]`, `[ear]`, with what each
   fake twin showed. Flag the ones a later phase depends on (the spine's
   timing on the phone, the Field following clock).
6. **The process retro**, short: how it went, then the recommendations grouped
   by the file they'd change (the tags in the retro's Friction section). For each, do it now, defer it, or drop it, and why. Weigh the
   lines every future agent reads against what it saves: a one-off slip the
   run already caught is usually a drop.

End by asking for their answers, and whether to act on the recommendations.

## 4. Act on it

1. **Record their answers** in a `## Review` section at the end of the retro:
   answers, overturned decisions, spine requests accepted or refused, and the
   results of their own checks.
2. **Fix what they overturned**, as a normal change with its docs.
3. **Do the recommendations they approved**, including changes to this skill,
   `run-steps`, `step` and `.agents/writing-a-plan.md` when the process itself
   changes. Check your own work as the `step` skill does.
4. **Save lasting preferences to memory.** Something the owner says about how
   they like things in general is a memory; a one-off answer isn't.
5. **Finish the Review** with a table of every recommendation and its outcome
   (done and where, partly, deferred, or dropped, with why). The next retro
   starts from this table, so be specific.
6. **Set the Status line** to `reviewed with the owner on <date>`. If that
   finished the plan, archive it
   ([writing-a-plan.md, When a plan is done](../../../.agents/writing-a-plan.md#when-a-plan-is-done)).
7. **Don't commit** unless asked. Clean up what you started, and end with what
   changed, plus a **How to test this yourself** for anything that runs.

## Keep this skill current

If a review shows this walkthrough missing something the owner needed, fix it
here in the same change.
