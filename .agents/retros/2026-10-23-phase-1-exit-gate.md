# Phase 1 spine — exit gate (2026-10-23)

**Status:** reviewed with the owner on 2026-10-23.

Row 12, attended, run by the owner with `/step` on 2026-10-23 from the
phone, the OP-1 Field and Firefox, with the agent on the Windows PC.
`phase-1-spine` was fast-forwarded into `main` (`ee59677`), row 11's hash
backfilled (`f34df89`), and `main` pushed; `phase-1-spine` was moved to the
same commit. Mid-row the owner asked for diagnostics, committed and pushed as
`815238c` (`/dev/spine` probe). The results since then are uncommitted until
this retro's commit.

## Result

| Check (`docs/HARDWARE_NOTES.md`, exit gate) | Outcome |
| --- | --- |
| 1 `npm run check` on `main` | pass (agent): exit 0, 290 tests at `f34df89`; 296 at `815238c` |
| 2 Actions and Pages | pass (agent, curl): runs green; `/op-1-school/` and the deep link serve the shell |
| 3 phone clock readout | done: gap 28.8 ms, `outputLatency` 24, `baseLatency` 5, `output-timestamp` |
| 4 phone, by ear | pass: swung, no clicks with the screen on, touch lights keys and logs |
| 5 themes | pass: toggle works both ways |
| 6 screen lock | fails: the loop crackles and slows down |
| 7 Field connect | pass, after the right port was picked (see Friction) |
| 8 clock out, Field in midi sync | pass: tape starts at the app's tempo; jitter p95 1.92 ms |
| 9 Firefox desktop | fails: blank page after a moment; not diagnosed (owner: Chrome-only) |
| 10 Firefox for Android | fails: same |
| 11 decision 7 | settled: `getOutputTimestamp` includes output latency |
| 12 follow | pass: 75.0 BPM at confidence 0.99, transport 74.99 (Field on beat match) |
| 13 VERIFY log | done: V5 resolved, V7 has the Android name |

- **Decision 7.** The gap equals `outputLatency + baseLatency` on the phone
  (28.8 vs 29.0 ms) and the laptop (49.8–52.6 vs 50), so `contextTime` is
  the frame leaving the device. `audibleAt` adds `outputLatency` again: 24 ms
  late on the phone, 40 ms on the laptop. Spine request below.
- **Not seen again:** after a fresh load with the Field plugged in, the first
  `start` was sometimes silent while the chord readout stepped.

## Decisions the plan didn't cover

| Row | Decision | Why |
| --- | --- | --- |
| 12 | Merged with `--ff-only` and pushed by the agent, not the owner | The owner chose that when asked; the row assumed the owner merges |
| 12 | Added the `/dev/spine` probe (`probeReport.ts`, `liveProbe.ts`) with `copy report` and `send test note` | The owner asked for diagnostics they could paste from the phone; the readouts couldn't tell "nothing arrives" from "the follower drops it" |
| 12 | Firefox dropped | The owner's call: Chrome-only for this app |

## Questions for the owner

| From | Placeholder or question |
| --- | --- |
| 12 | The probe's labels (`probe`, `copy report`, `send test note`, `report copied`, `report text`, …) are placeholders |
| 12 | SPEC §2.3 says Firefox "degrades to Unplugged mode with a notice"; the app is now Chrome-only. Change the SPEC line, and should the app show a notice in Firefox? |
| 12 | Screen lock: warn, stop the transport when the page is hidden, or accept it? |
| 12 | Phase 2's MIDI setup copy: Android names the Field `USB Peripheral Port` and lists other apps' ports beside it |

## VERIFY items

| Row | Item | Status |
| --- | --- | --- |
| 12 | V5 clock jitter | resolved: loopback jitter p95 1.92 ms, through the Field's echo |
| 12 | V7 port name | Android: `USB Peripheral Port`, manufacturer `Android`; Windows: `OP-1` |
| 12 | V3 charging | still stubbed: no drain measured |
| 12 | V6 clock before `FA` | still stubbed: bar-1 lock wasn't watched |
| — | V1, V2, V4 | open, for Phase 3 |

## Spine requests

| From | Change | Why |
| --- | --- | --- |
| 12 | `WebAudioClockBridge.audibleAt`: `audioToPerf(t)` on the `output-timestamp` path; keep `+ outputLatencySec()` on `fit` | Decision 7's readout; today it's 24–40 ms late, and the error changes when the path switches |
| 12 | An error boundary in the shell that keeps the nav and shows the error | Firefox showed that one uncaught error blanks the whole app |

## Checks only the owner can do

- Phase 3 checklist items 2–6 in `docs/HARDWARE_NOTES.md` (item 1 is filled
  from check 8).
- V6: with clock out on, does the Field lock tempo on bar 1?

---

## Process retro

### Last retro's recommendations

The 2026-10-22 review's table: all done or dropped. "Set GitHub Pages'
source to GitHub Actions before row 12's push" held: the first deploy
passed.

### Friction

- [tools] The first MIDI checks failed because the phone's input was another
  app's port (`FlipSampler`). The `input` picker showed it, but nothing
  pointed the owner at the picker as the thing to check. The agent spent a round
  reasoning about Android dropping clock before the probe's report showed
  the port list. A port list with message counts belongs on any MIDI debug
  page from the start.
- [plan] Check 12 didn't say which Field tempo mode sends clock. **midi
  sync** only echoes; **beat match** sends from the tempo screen, tape
  stopped.
- [tools] Screenshots of readouts worked but lose precision and need
  retyping; the owner suggested the clipboard report, which is faster to
  read and carries every number.
- [tools] `gh` isn't installed on the PC; the agent read the Pages and
  Actions state from the public GitHub API with curl.
- [plan] The row assumed the owner merges; asking up front was quick and
  needed.

### Verification gaps

- The probe's Web MIDI side and the clipboard copy run only on a device; the
  desktop pane refuses clipboard writes (the fallback text box showed).
- The silent first start wasn't reproduced; a level meter on `/dev/spine`
  would tell a muted master gain from a silent output device.

### Recommendations (ranked)

1. Phase 2 pre-work: the `audibleAt` fix and the shell error boundary
   (spine requests above). Small; both touch spine files.
2. Name the Field's tempo mode in any check that needs the Field to send
   clock ([plan] for Phase 3's checklist). One line.
3. When a hardware check fails on a device, ask for the probe's `copy report`
   first ([step], How to test this yourself). One line.
4. Decide Firefox in SPEC §2.3 (owner).

---

## Review

With the owner on 2026-10-23. The owner took the reviewer's suggestion on
every item.

### Decisions

All three kept: the `/dev/spine` probe, the agent merging and pushing row 12
with `--ff-only`, and Chrome-only.

### Answers

1. **Firefox.** SPEC §2.3 says the app is Chrome-only, on Android and
   desktop; other browsers aren't supported or tested. No browser notice: the
   error boundary shows a crash instead of a blank page.
2. **Screen lock.** The transport stops when the page is hidden
   (`visibilityAction` in `src/audio/timing.ts`, called from `ToneTransport`).
   This also stops it when a desktop tab is switched away.
3. **Phase 2 MIDI setup copy.** The port picker can't name the Field (V7), so
   it labels ports with message counts, as the probe does, and the user picks
   the one that lights up. Wording stays a placeholder.

Placeholders kept: the probe's labels, and `COPY.pageError`
(`something broke on this page`).

### Spine requests

Both accepted, landed in this review's change, with the screen-lock stop:

- **`audibleAt`** (`src/audio/Clock.ts`): `audioToPerf(t)` on the
  `output-timestamp` path; on the fit path `audioToPerf(t + outputLatencySec())`,
  with `outputLatencySec()` = `outputLatency + baseLatency` (the measured gap),
  not the retro's `outputLatency` alone, which would leave the fit path 5 ms
  early on the phone and jump when the path switches. SPEC §3.1 matches.
- **Error boundary** (`src/ui/ErrorBoundary.tsx`): wraps everything in
  `AppShell` but the nav; navigating clears it (`resetKey`, not a React
  `key`, so the power warning keeps its state). It catches render errors
  only. The Firefox blank page was never diagnosed, so "one uncaught error"
  was an inference.

### Owner's checks still to run

- `[phone]` Tap along on `/dev/spine`'s **taps** panel (added after the
  review; `/dev/spine` had no offset readout), with touch and then with the
  Field's keys; record the medians in `docs/HARDWARE_NOTES.md`, **Tap
  offsets**. Levels A0 and A6 score tap timing, so Phase 2 depends on it.
- `[phone]` Lock the screen mid-loop: silence, and `start` on unlock.
  Passed (2026-10-23).
- `[field]` V6 (bar-1 lock) and Phase 3 checklist items 2–6, before Module 3.
- `[ear]` A silent first `start` after a fresh load with the Field plugged in.

### Recommendations

| Recommendation | Outcome |
| --- | --- |
| 1 Phase 2 pre-work: `audibleAt` fix, error boundary | done: `Clock.ts`, `ErrorBoundary.tsx`, with tests in `clock.test.ts` and `uiLogic.test.ts`; seen on `/dev/spine` in the desktop pane |
| (added) Stop the transport when hidden | done: `timing.ts`, `TransportEngine.ts`, test in `timing.test.ts`; SPEC §2.2.4 and HARDWARE_NOTES "Background throttling" |
| 2 Name the Field's tempo mode in clock checks | dropped: `docs/HARDWARE_NOTES.md` defines free / beat match / sync, and check 12 names beat match |
| 3 Ask for the probe's `copy report` first when a device check fails | done: `.claude/skills/step/SKILL.md`, folded into the "How to test this yourself" bullet on failures |
| 4 Firefox in SPEC §2.3 | done: Chrome-only |
| Friction: a port list on any MIDI debug page | dropped: `/dev/spine` has it |
| Friction: `gh` isn't installed | deferred: curl worked; installing it is the owner's call |
| Plan row 12's commit | backfilled `ec39a1a`; plan archived to `.agents/plans/archive/phase-1-spine.md` |
