# Phase 2 fan-out — exit gate (2026-10-28)

**Status:** reviewed with the owner on 2026-10-28.

Row G, attended. The agent ran its checks on the Windows PC on 2026-10-23.
The owner ran the owner's list on the phone and the OP-1 Field on
2026-10-28. `main` was at `c950d41` (the plan branch merged and pushed), with
S2's hash backfilled (`321fc20`). G's results are uncommitted until this
retro's commit.

## Result

| G Done when | Outcome |
| --- | --- |
| 1 `npm run check` on `main`, Pages green | pass (agent): exit 0, 493 tests; deploy-pages run 7 for `c950d41` green |
| 2 every owner's-list row has a result | done: see the list in the plan; one skipped by the owner |
| 3 `[phone]` daily-use target | accepted by the owner with a known bug: the session runs, but the first `start` is often silent or partial (below) |
| 4 touch row in **Tap offsets**, `TAP_OFFSETS` matches | done: median −29.4 ms, IQR 36.0 ms, touch voice on, Chrome 156 |

| Owner's list | Outcome |
| --- | --- |
| daily-use target | partial: one chord, no drums, then silence on the first `play`; `stop`/`start` fixed it; streak not reported |
| A0 on the phone | partial: drums, no chords; `stop`/`start` didn't fix it, leaving Module 1 and coming back did |
| Field same path as touch | pass, once MIDI was granted and `USB device` picked on `/dev/spine` |
| screen lock mid-drill | fail: no audio on `start` after unlock; `stop`/`start` fixed it. Logged-once not reported |
| touch voice, backing per progression, export, A1's bass | pass |
| silent first `start` | not on its own try, but it's the same fault as the three rows above |
| touch tap offsets | done (G item 4) |
| A0 pad vs keys | skipped by the owner: `touch` stays one entry |
| V6 restarts with clock out | "seems fine"; clock out staying on inside Module 1 wasn't confirmed |
| connect from Module 1 | "i think this works" |

- **The silent start.** After a fresh load, a tab switch or a screen
  unlock, the first `start` is often silent or plays only some parts. It was
  first seen on `/dev/spine` at the Phase 1 gate, so it's in the spine
  (`ToneTransport`, `ToneBackingSynth`'s gains, or the context's resume), not
  Module 1. The agent read the code and found no cause; it was never seen on
  desktop. Partial playback (one part sounding, then nothing) points at the
  scheduler stalling after the first sixteenth more than at a muted
  output, but that's a guess. The owner closed G with it open.
- **Touch with sound.** Taps land 14 ms later and tighter with the touch
  voice on (−29.4 / 36.0) than with silent keys (−43.2 / 46.5). The `on`
  window is −65.4 to +6.6 ms.

## Decisions the plan didn't cover

| Row | Decision | Why |
| --- | --- | --- |
| G | G closed with daily-use partial | The owner's call: the bug has a workaround and doesn't block building the rest of the app |
| G | V6 stays stubbed on a "seems fine" | The check didn't confirm clock out was on in Module 1; a VERIFY item isn't resolved on a guess |
| G | Pad vs keys skipped; `touch` is one entry | The owner's call |

## Questions for the owner

| From | Placeholder or question |
| --- | --- |
| G | The nav icons `[1]` and `[5]` (Module 1, Runner) read as lesson days. What should they say? |
| G | MIDI only worked after `/dev/spine`. Was Module 1's `connect midi` not seen, or did it not list the Field? |
| G | Is the streak at 1 after the full session? |

## VERIFY items

| Row | Item | Status |
| --- | --- | --- |
| G | V9 tap window | resolved, touch re-measured with sound (`docs/HARDWARE_NOTES.md`) |
| G | V6 clock before `FA` | still stubbed |
| G | V7 port name | Chrome 156 lists the Field as `USB device`; the row has `USB Peripheral Port` (Chrome 155). Not yet in the VERIFY log |

## Spine requests

| From | Change | Why |
| --- | --- | --- |
| G | Find and fix the silent first start, when the owner asks. Start with a level meter and a ticker heartbeat on `/dev/spine`'s report, so the phone can tell a stalled scheduler from a muted gain | Items 1, 2 and 4 |
| S2 | `openAppDb()` closes on `versionchange` | Carried forward from S2 |

## Checks only the owner can do

- `[phone]` The streak reads 1 after a full session.
- `[phone]` Screen lock: the attempt is logged once.
- `[field]` V6, with the status bar reading `clock out` inside Module 1.
- `[ear]` L2's end-of-drill blip (a ~50 ms chord at a finish): nobody
  reported it, so `TransportEngine.stop(atAudioTime?)` hasn't landed.

---

## Process retro

### Last retro's recommendations

From the Phase 2 run's review (2026-10-23): the plan branch was merged and
pushed before G, as the row asked.

### Friction

- [tools] `gh` isn't on the PC's PATH in Bash or PowerShell. The Actions
  page, read through a scraper, showed the deploy result.
- [plan] G's list asked for results but the table had no column for them;
  the agent added `Result`. A gate's owner's list should start with one.
- [plan] The V6 row couldn't be checked as written: clock out is a
  `/dev/spine` toggle that isn't saved, and the row didn't say how to keep it
  on into Module 1.
- [plan] The owner didn't know what A1–A6 were or what the nav icons meant.
  The test script assumed the owner knew the app's names.
- [tools] The owner reported in one pass several days after the agent's
  turn, which worked well: one message, every row answered.

### Verification gaps

- The silent start: no cause, no repro off the phone.
- Streak, logged-once and the end-of-drill blip were never answered.

### Recommendations (ranked)

1. Before a phase whose checks need audio on the phone, add a level meter
   and a scheduler heartbeat to `/dev/spine`'s report (the silent start's
   first step, when the owner asks for it). Small; spine.
2. A gate's owner's list starts with a `Result` column ([writing-a-plan]).
   One line.
3. A device check names how to reach its state ("turn on clock out on
   `/dev/spine`, then use the nav") and says what each name is the first
   time ([step], How to test this yourself). One line.
4. Record V7's Chrome 156 name (`USB device`) in the VERIFY log.

---

## Review

With the owner on 2026-10-28.

### Answers

- **MIDI only after `/dev/spine`:** the owner isn't sure; they think
  `USB device` was at the top of Module 1's list, so it may have been user
  error. Left alone; the owner says if it happens again.
- **Streak:** reads 1 after the full session. The `[phone]` streak check
  passes.
- **Nav icons `[1]` and `[5]`:** the owner named every module: `sesh`
  (Runner), `chords` (Module 1), `flip` (Module 2), `pocket` (Module 3),
  `kits` (Module 4); `dev spine` stays. They're settled copy in
  `COPY.moduleTitles` (`src/ui/copy.ts`), which each `module.ts` reads, and
  `docs/MODULE_CONTRACT.md` says so. The phone nav stays icon-only, with the
  owner's emoji in `COPY.moduleIcons`: ▶️ sesh, 🎹 chords, 🔀 flip,
  🎯 pocket, 🥁 kits, `∿` dev spine.
- **Decisions:** all three kept (G closed with the silent start open, V6
  stubbed, `touch` one entry). The reviewer's correction to the V6 friction
  note: clock out does survive in-app navigation (the MIDI bridge is one
  shared instance in `src/ui/spine.tsx`, and `/dev/spine` doesn't turn it off
  when you leave), so the check works as "turn on clock out on `/dev/spine`,
  tap `[1]`, the status bar reads `clock out`". It just never said so.

### Spine requests

- **Silent first start:** accepted as diagnostics first, folded into the bug
  report brief (below). The fix waits for the owner to ask, after a report
  says which of the two shapes it was. The reviewer's lead for shape 2
  (drums, no chords, fixed only by leaving Module 1): the chord `PolySynth`
  running out of voices, which logs `Max polyphony exceeded. Note dropped.`
- **`openAppDb()` closes on `versionchange`:** still open, for the next plan.

### Owner's checks still open

To keep the owner's testing short, two are dropped:

- **`[ear]` end-of-drill blip:** dropped. Full sessions didn't turn it up;
  reopen it if it's heard.
- **`[phone]` screen lock logs once:** dropped as its own check. The
  state machine is tested (L2 item 4), and a doubled entry would show in the
  Runner's history.
- **`[field]` V6 with clock out on inside Module 1:** kept, for the first
  plan that needs the Field following the app's clock at a restart.

### The owner's testing note

The 13-row owner's list was "a little brutal" and put off for days, and some
rows needed musical skill the owner is still learning. Their asks:

1. More diagnostics in the copied report.
2. A bug button on every page that sends what went wrong with recent
   diagnostics, by clipboard or as a GitHub issue. Not to be built or fully
   planned now: written up for a fresh agent.
3. As little manual testing as possible, leaning on the bug report.

All three went into the brief or the process (table below). It's a lasting
preference, saved to memory.

### Recommendations

| # | Recommendation | Outcome |
| --- | --- | --- |
| 1 | Level meter and scheduler heartbeat on `/dev/spine` | Deferred, into [`.agents/briefs/bug-report.md`](../briefs/bug-report.md): the diagnostics log covers it, with the chord voice count and Tone's warnings added. Listed in `AGENTS.md` **Where we are** |
| 2 | A gate's owner's list starts with a `Result` column | Done: `.agents/writing-a-plan.md`, Done-when items, the `[phone]`/`[field]`/`[ear]` bullet |
| 3 | A device check says how to reach its state and what each name is | Done: `.claude/skills/step/SKILL.md`, step 8, the numbered-check bullet |
| 4 | Record V7's Chrome 156 name | Done: `docs/HARDWARE_NOTES.md`, V7's row (`USB device`, Android 10, Chrome 156) |
| — | `gh` not on PATH | Dropped: reading the Actions page worked, and installing it is the owner's call |
| — | Keep the owner's list short (the owner's note) | Done: `.agents/writing-a-plan.md`, a new Done-when bullet; `.claude/skills/retro/SKILL.md` §3 item 5 proposes dropping checks no later phase needs; memory `keep-owner-testing-short` |
| — | A bug report button and diagnostics log (the owner's note) | Brief written: `.agents/briefs/bug-report.md`. Recommends `copy` plus `open on github` (a prefilled new-issue URL, no token); rejects the GitHub API from the page (needs a token in a public bundle, or a backend) |
| — | A new plan picks up the last plan's leftovers (the reviewer's) | Done: `.agents/writing-a-plan.md`, under the intro. Phase 2 leaves the silent start, `versionchange`, the nav names and V6 |

The plan is archived: `.agents/plans/archive/phase-2-fan-out.md`.
