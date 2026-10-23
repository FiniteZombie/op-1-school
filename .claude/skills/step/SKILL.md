---
name: step
description: Do one step or lane of an op-1-school plan in .agents/plans/ (find it in the status table, backfill the last commit, build, check it yourself, update docs and the handoff, end with the owner's test script). Use whenever the owner says "do the next step", "next step", "do step 3", names a step or lane of a plan, and whenever /run-steps spawns you as a subagent for a step or a lane. Also use when invoked as /step.
---

# Doing a step

When the owner says "do the next step" (or names a step or lane), this is the
whole job. Their request: **$ARGUMENTS** (if that's blank, it's in their
message). If an orchestrator spawned you, also read
[Subagent mode](#subagent-mode) before you start.

`AGENTS.md` is in your context: its **Load-bearing rules** and
**Dependencies** apply to every step.

## The steps

1. **Find it.** Open the plan the owner named. If they didn't name one and
   more than one is open, ask which; `AGENTS.md` **Where we are** lists them. Do the row marked
   **Next**, or the one named. Read:
   - its row text, and the SPEC sections it cites;
   - the plan's overview and any **Pre-flight answers** (they win over the row
     text);
   - the plan's **Carried forward** list;
   - for a lane, its owned paths and `docs/MODULE_CONTRACT.md`.

   Then rename this session so the sidebar says what's being built: call
   `set_session_title` (load it with ToolSearch, `session_id: "self"`) with
   the row's commit-style name, like `Spine 3: theory`. If the tool isn't
   there, carry on.
2. **Backfill the last commit.** If the previous row is done but has no commit
   hash, find it in `git log` and add it.

   If there's no commit because the owner tested the last step and forgot to
   commit it (`git status` shows its work), that's normal: commit that work
   first, as its own commit in the style of earlier step commits
   (`Spine 2: types` plus a bullet summary), then add its hash. Tell the owner,
   in a lightly passive-aggressive tone ("I went ahead and committed Spine 2
   for you, since it seemed to have slipped your mind 🙂"), and name any
   uncommitted files that look unrelated.
3. **Build it.**
   - Push back before going against a load-bearing rule or a resolved
     decision.
   - A creative decision the plan doesn't make (copy, a name, a look): a
     neutral placeholder, marked `placeholder` in a comment and listed in
     your report.
   - A VERIFY item: stub behind the interface, never guess, and log it (the
     VERIFY log in `docs/HARDWARE_NOTES.md`, and your report).
   - A lane touches only its owned paths. If it needs a spine change, don't
     make it: work around it inside your paths and describe the smallest
     spine change that would help.
   - Scripted edits and probes go in a file you write with the Write tool
     ([windows-tool-pitfalls.md](../../../.agents/windows-tool-pitfalls.md)).
4. **Check it yourself**, and fix what you find before handing it back.
   - `npm run check` (tsc, Vitest, build) exits 0.
   - Run each Done-when item's check. Browser checks use the dev server from
     `.claude/launch.json` and `/dev/spine?dev`; read the
     page as text and read the console. With no browser pane (a cloud
     container), the container has headless Chromium and a global
     Playwright: a scratchpad script imports Playwright by absolute path (ESM
     ignores `NODE_PATH`) and drives the dev server. That's a real check, not
     an OWNER item.
   - `[phone]`, `[field]` and `[ear]` items are the owner's. Write their test
     steps; don't call them done.
5. **Update the docs.**
   - The docs the change affects (`AGENTS.md`, **Repo conventions**), and the
     VERIFY log for any VERIFY item you hit.
   - In the status table, mark the row done with today's date and the next row
     **Next**. Leave its commit blank; the next step backfills it.
   - **Carried forward:** one bullet per open end, tagged with your row: a stub
     a later row replaces, a gap you left, a decision the plan didn't cover
     that later rows must respect. Remove the bullets you dealt with.
   - **Process notes:** one bullet per thing in `AGENTS.md`, a skill, the plan
     or the spec that was wrong, stale, ambiguous or missing, and any tool that
     failed or needed a workaround.
   - **Last row of the plan?** Write its retro, using the parts of the
     `/run-steps` shape (Phase 2) that apply to an attended plan, from the
     Process notes, Carried forward and the owner's checks. Tell the owner to
     run `/retro`, which archives the plan.
6. **Don't commit.** The owner tests first.
7. **Clean up**: stop any dev server or browser you started, and nothing else.
8. **End with How to test this yourself**, written for the owner at the
   machine with no other context:
   - what to start (one command per `bash` block) and which pages to open. The
     phone needs a secure context for Web MIDI and the mic: GitHub Pages, or
     `localhost` through `adb reverse` (wireless debugging when the Field holds
     the USB-C port). A LAN `http://` address won't do;
   - one numbered check per Done-when item: a concrete action and what they
     should see or hear ("tap the lowest F: it lights, and the log shows a
     touch `on` event");
   - the VERIFY items you hit and what you stubbed;
   - what's known to be rough, cut or untested;
   - what to tell you if a check fails.

## Subagent mode

When an orchestrator (usually [`/run-steps`](../run-steps/SKILL.md)) spawns
you, follow the steps above with these changes. Your prompt's overrides win.

- **Skip `set_session_title`.**
- **Never commit**, not even the backfill. Write the previous hash into the
  status table if your prompt gives one.
- **A lane edits nothing outside its owned paths**, not the plan, the VERIFY
  log or `AGENTS.md`: parallel lanes would conflict on them. Put your status,
  Carried forward bullets, VERIFY log entries, process notes and any doc
  change you'd make in your report; the orchestrator writes them. A lane runs
  in its own worktree, so run `npm ci` before anything else.
- **No one can answer you.** Where you'd stop and ask, follow your prompt's
  overrides; without one, stop and report.
- **End your report with:**
  - each Done-when item: PASS, FAIL or OWNER, and how you checked it;
  - how many fix-and-recheck rounds you needed, and whether `npm run check`
    passes;
  - `git status --porcelain`, so the orchestrator can see every path you
    touched;
  - **VERIFY items** you hit and what you stubbed;
  - **Spine requests** (lanes): the smallest spine change that would help, and
    why;
  - **Questions for the owner**: placeholders you used and decisions the plan
    didn't cover;
  - the usual **How to test this yourself**;
  - **Process notes**, as in item 5, plus where the time went.

## Keep this skill current

When a retro or the owner changes how a step is done, change it here in the
same commit. `/run-steps` and `/retro` point at this file.
