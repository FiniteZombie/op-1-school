# Bug report button and diagnostics log

A spine change, outside the phase order: a diagnostics log of recent events,
a bug button on every page that turns it and a line from the owner into a
report, and two ways to send it (`copy`, and a prefilled GitHub new-issue
page). Written 2026-10-28 from the brief the Phase 2 exit gate's review left
(`.agents/retros/2026-10-28-phase-2-exit-gate.md`, **The owner's testing
note**), which this plan replaces.

Why: the owner tests on an Android phone and reports later, in one message.
At the Phase 2 gate the first `start` after a fresh load, a tab switch or a
screen unlock was silent or partial on the phone, in two shapes, and nothing
in the report said which part failed:

1. one chord, no drums, then silence; `stop` then `start` fixes it;
2. drums and no chords; `stop`/`start` doesn't fix it, but leaving Module 1
   and coming back (a new `ToneBackingSynth`) does.

Unchecked guesses: shape 1 is the scheduler stalling after its first 0.1 s
lookahead; shape 2 is the chord `PolySynth` out of voices (Tone 15 frees one
only when its oscillator's `onended` fires; at `maxPolyphony = 16` it drops
notes and warns `Max polyphony exceeded. Note dropped.`). Fixing the silent
start is not this plan: with the log in, the owner's next report of it says
which shape it was, and the fix is its own change when the owner asks.

| Row | Name | Kind | Model | Branch | Status | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | Diagnostics log and bug button | step | Opus 5.5 | `main` | done 2026-10-28 | |
| G | One real report from the phone (**attended**) | step | — | `main` | **Next** | |

### Carried forward

- **S1 → G:** the owner creates the `bug-report` label before filing
  (Pre-flight answer 4); without it GitHub files the issue unlabelled, and a
  later agent's label filter misses it.
- **S1 → later:** a GitHub session that isn't signed in sends the owner
  through the login page, whose `return_to` re-encodes the whole issue URL
  (about 1.3 times longer). Fine at today's sizes; untested near
  `MAX_ISSUE_URL`. The phone is signed in.
- **S1 → the owner:** placeholders in `COPY.bug` (`src/ui/copy.ts`) and
  `REPORT_TEXT` (`src/ui/bugReportText.ts`): the `bug` button and all the
  box's wording, the issue title rule, the report's fixed lines.

### Process notes

- S1: the browser pane refuses clipboard writes (`NotAllowedError: Write
  permission denied`), so `copy` was checked in Chrome. Reading the clipboard
  back there (`readText`) raised a permission prompt and froze the tab for
  the tool; the `✓ copied` status is the check. Recorded in `AGENTS.md`.
- S1: Done when 4 named 120 BPM, but `/dev/spine` opens at 90 BPM; the
  check reads 6 sixteenths a heartbeat there (fixed in the row).
- S1: a `cat > file` with no input, left at the start of a Bash command,
  waited on stdin until the tool's 2-minute timeout.
- S1: another session edited `src/ui/copy.ts` (the nav's module names and
  icons) while S1 ran; Vite reloaded the pane mid-check, and S1 redid it.

Phase 2's other open ends (`openAppDb()` and `versionchange`, the `[1]`/`[5]`
nav names, V6 with clock out inside Module 1) wait for Phase 3's plan; this
plan picks up only the silent start, as diagnostics.

## Decisions this plan makes

1. **Where the code lives.** The log is pure and Tone-free:
   `src/state/diagnostics.ts` (a `DiagnosticsLog` class, with its clock
   injected, and the page's one shared instance, `diagnostics`). The report
   text, the cut and the issue URL are pure too: `src/ui/bugReportText.ts`.
   The browser wiring (console, errors, page lifecycle, the spine's objects,
   the heartbeat) is `src/ui/diagnosticsCapture.ts`; the button and box are
   `src/ui/BugReport.tsx`. Modules do nothing to be logged: their
   `console.warn`/`console.error` are captured, and the spine objects they use
   are watched.
2. **What an entry is.** `{ t, kind, text, repeat }`: `t` is
   `performance.now()` in ms, `kind` one of `error`, `warn`, `audio`,
   `transport`, `beat`, `midi`, `page`, `route`, `note` (an `as const`
   list). Text is clipped to 240 characters. An entry with the same kind and
   text as the newest one bumps its `repeat` instead of adding a line, so
   Tone's `Max polyphony exceeded` 30 times in a row is one line, `(x30)`.
   The ring holds 400 entries; the 401st drops the oldest. Log text is ASCII:
   an issue URL spends 6 characters on each non-ASCII one.
3. **What is logged**, all by `diagnosticsCapture.ts`:
   - `console.error` and `console.warn` (wrapped once, passing through to the
     real ones; Tone's warnings go through `console.warn` at call time),
     `window` `error` and `unhandledrejection`;
   - the audio context's `statechange` with its state and `currentTime`, and
     each gate tap (`initAudio()`);
   - transport `started`/`stopped` with their audio times (`onStateChange`);
   - a heartbeat, once a second while the transport runs: sixteenths
     scheduled since the last heartbeat, the last one's audio time, the
     context's `currentTime` and state, a level per backing part (the peak
     over the second, sampled every 100 ms, in dB, `-inf` for silence) and
     the chord synth's active voices;
   - MIDI access, port selection and clock mode changes (`onConnectionChange`
     `selection` events, `onClockModeChange`); port names only, never ids;
   - `visibilitychange`, and Chrome's `freeze`/`resume`;
   - route changes (path and query), from `AppShell`.
4. **Levels and voices come from the synth.** `ToneBackingSynth` adds a
   `Tone.Meter` on each part gain and a `probe()` that returns each part's
   level and `chords.activeVoices`. Every live instance registers itself in a
   set exported from `VirtualPushSynth.ts` (`liveBackingProbes()`) and leaves
   it on `dispose()`, so the heartbeat reads whichever synth is playing (Module
   1's or `/dev/spine`'s) without either module changing. `src/audio` doesn't
   import the log. These are thin Tone wrappers, checked on `/dev/spine`.
5. **The header**, taken when the box opens: the build's commit, the time
   (ISO, UTC), the page's path, Chrome's version and the platform (from the
   user agent; Android's reduced UA names no phone model), the screen and
   viewport size and pixel ratio, the audio context's state, sample rate,
   `outputLatency` and `baseLatency`, the gate's state, the transport's
   state and BPM, the MIDI access, selected port names and clock mode.
   The commit is a Vite `define`, `__APP_COMMIT__`: `GITHUB_SHA`'s first 7
   characters in CI, else `git rev-parse --short HEAD`, else `unknown`.
6. **The report** is Markdown, so it reads well both pasted into a chat and
   as an issue: the owner's text, then the header and the log in one fenced
   `text` block, oldest entry first. A log line is
   `+12.345 s beat 8 last 12.30 ctx 12.41 running | drums -11 bass -16 chords -19 | voices 4`
   (sixteenths since the last heartbeat, the last one's audio time, the
   context's time and state, peak dB per part, chord voices).
   Worked through for the two shapes, at 120 BPM (a sixteenth is 125 ms, so
   a healthy heartbeat reads 7–9 sixteenths, by phase):
   - shape 1: `transport started at 3.200`, then a heartbeat with `beat 1
     last 3.20` and later ones with `beat 0` while `ctx` keeps climbing and
     reads `running`: the scheduler stopped calling back;
   - shape 2: heartbeats at `beat 8` with drums near -11 dB, chords
     `-inf`, `voices 16`, and `warn Max polyphony exceeded. Note dropped.
     (x24)`: the chord synth is out of voices.
7. **The issue URL** is
   `https://github.com/FiniteZombie/op-1-school/issues/new` with `title`,
   `body` and `labels=bug-report`, encoded by `URLSearchParams` (spaces as
   `+`, which GitHub reads as spaces). The whole URL stays at or under 8,000
   characters (`MAX_ISSUE_URL`; GitHub refuses much past 8 KB). To fit, the
   oldest log lines go first, and a line in the block says how many were cut
   and that `copy` has the full report. Worked number: a heartbeat line is
   91 characters and 97 encoded; with a full header and a two-line message,
   72 lines fit, about 70 s of heartbeats. If the
   owner's text alone doesn't fit, it's cut too, with `…`. The title is
   `bug: ` and the text's first line, cut to 60 characters, or
   `bug report` when the text is empty (placeholders).
8. **The box.** A native `<dialog>` (`showModal`), opened by the bug button:
   a line saying reports are public, a text field, `copy`, `open on github`
   (an `<a target="_blank" rel="noopener">` whose `href` is rebuilt as the
   owner types), `close`, a status line, and a `<details>` showing exactly
   what gets sent. `copy` writes inside the click, before any await (the
   `copy report` rule). The log snapshot is taken when the box opens.
9. **`/dev/spine`'s `copy report`** gains a `[build]` section (the commit)
   and a `[log]` section with every entry.
10. **Nothing personal.** The log holds no lesson notes, file names or port
    ids; route queries hold only lesson and drill ids. A console error could
    still carry anything, so the box shows the full text before it's sent.
11. **Answers to the brief's questions** are in **Pre-flight answers**
    below: the button in the nav, nothing kept on the phone, and a later
    agent may close the issues it fixes.

## S1 — Diagnostics log and bug button

Builds decisions 1–10.

Owns: `src/state/diagnostics.ts`, `src/ui/bugReportText.ts`,
`src/ui/diagnosticsCapture.ts`, `src/ui/BugReport.tsx`, their tests in
`src/state/__tests__/` and `src/ui/__tests__/`, and changes to
`src/audio/VirtualPushSynth.ts` (meters, `probe()`, the live set),
`src/ui/AppShell.tsx` (the button, route logging), `src/ui/spine.tsx` (wiring
the capture to the spine's objects), `src/main.tsx` (installing the global
capture before React), `src/ui/copy.ts` (placeholder labels),
`src/modules/dev-spine/View.tsx` (the report's new sections), `vite.config.ts`
and a `src/env.d.ts` (`__APP_COMMIT__`), and the docs below.

Placeholders (marked in `copy.ts`): the button reads `bug`; the box's
heading `report a bug`; the note `reports on github are public: leave out
anything personal`; the field's label `what went wrong?`; buttons `copy`,
`open on github`, `close`; statuses `copied`, `copy failed: select the text
below`, `cut to fit github: copy has the full report`; the details summary
`what gets sent`; the issue title rule in decision 7.

Failure and empty cases: no clipboard (`navigator.clipboard` missing or
refused) says so and leaves the text selectable in the details; audio never
started reads `audio not started` in the header and logs no heartbeat; MIDI
unsupported (Firefox) or denied reads as its access state; an empty log is
the line `no entries`; the box works with the transport running.

Done when:

1. **The ring.** `src/state/__tests__/diagnostics.test.ts`, with a fake
   clock, passes: entries keep order and time; the 401st drops the oldest;
   a repeat of the newest kind and text bumps `repeat`, and a different line
   in between doesn't; text over 240 characters is clipped with `…`.
2. **The report text.** `src/ui/__tests__/bugReportText.test.ts` passes:
   a fixed header and three entries format as decision 6 says (asserted
   line by line, including `(x30)` and `+12.345 s`); an empty log reads
   `no entries`; Chrome's version and platform come out of a desktop
   Windows UA and an Android reduced UA, Firefox's reads `firefox 140`, and
   anything else `unknown`. `diagnostics.test.ts` also checks the heartbeat
   line for a healthy beat, a stalled one (`0`, `-inf`) and no synth.
3. **The cut and the URL.** The same test file: a 400-entry log gives a URL
   of at most `MAX_ISSUE_URL` that keeps the newest entry and drops the
   oldest, says how many it cut, and decodes (through `URLSearchParams`) to
   the right `title`, `body` and `labels=bug-report`; a short log isn't cut
   and has no cut line; a 10,000-character message is cut with `…` and the
   URL still fits; the title rule holds for empty, one-line and long text.
4. **Capture, in the browser pane.** On `/dev/spine?dev`: tap the audio
   gate, start the transport for 3 s, stop it, then `copy report`. The
   report's `[build]` reads the local commit, and `[log]` shows the gate
   tap, `transport started at …`, 3 heartbeat lines at the page's 90 BPM
   (a sixteenth is 166.7 ms) reading 6 sixteenths and a level for each
   part, and `transport stopped at …`. Running `console.warn('probe')`
   twice in the page shows one `warn probe (x2)` line.
5. **The button and box, in the browser pane.** The bug button shows on `/`,
   on Module 1's page and on `/dev/spine?dev`; it opens the box; typing a
   line updates the details text and the link's `body`, which match;
   `copy` reads `✓ copied` (in Chrome: the pane refuses clipboard writes);
   `open on github` opens a GitHub new-issue page with the title, body and
   label filled in (never submitted), or the login page whose `return_to`
   carries them when GitHub isn't signed in.
6. **No red vs green, tokens only.** `git grep -n --untracked '#[0-9a-fA-F]\{3,6\}\b' -- src/ui/BugReport.tsx`
   finds nothing.
7. `npm run check` exits 0.

Docs: `AGENTS.md` **Repo conventions** gets one bullet (the log, where it is,
that modules are captured without doing anything, and where bug reports
land); **Where we are** lists this plan. The VERIFY log is untouched (no
VERIFY item).

## G — One real report from the phone (attended)

The owner, after pushing `main` (GitHub Pages deploys it) and creating the
`bug-report` label (Pre-flight answer 4).

| # | Check | Result |
| --- | --- | --- |
| 1 | `[phone]` On the phone, open the app from GitHub Pages, tap the audio gate, start a Module 1 drill for a few seconds, tap the bug button, type one line, tap `open on github` and submit the issue. | |

Then an agent reads the issue (GitHub MCP `list_issues`, label
`bug-report`) and checks it: the label is on it, the header's commit matches
the deployed one, and the log has heartbeat lines from the drill. That's the
agent's PASS, not the owner's.

Exit: every row done, and the owner's issue reads as decision 6 says. Write
the retro (`/step`, last row) and the owner runs `/retro`.

## Pre-flight answers

The owner, 2026-10-28:

1. **Where the button sits:** in the nav, beside the theme toggle (the bottom
   bar on the phone, the side bar from 700 px), on every page, `/dev/spine`
   included.
2. **Kept on the phone:** no. `copy` covers offline; no IndexedDB change.
3. **Closing issues:** a later agent may comment on a `bug-report` issue and
   close it itself once its fix is committed.
4. **The label:** `bug-report` doesn't exist on the repo, and GitHub drops
   `labels=` for a missing label. The owner said to create it, but the
   GitHub MCP tools have no label write and `gh` isn't installed, so the
   owner creates it at `github.com/FiniteZombie/op-1-school/labels` before G.
