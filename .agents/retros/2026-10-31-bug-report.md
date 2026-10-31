# Bug report plan — retro (2026-10-31)

**Status:** not yet reviewed with the owner.

An attended plan, two rows: S1 (the diagnostics log and bug button, done
2026-10-28, `55c6e1b`) and G (one real report from the phone, done
2026-10-31). `main` was at `68e673c`, pushed and deployed, when the owner
filed the report.

## Result

| Row | Outcome |
| --- | --- |
| S1 | done: Done when 1–7 passed on the PC; `copy` checked in Chrome (the pane refuses clipboard writes) |
| G 1 `[phone]` file a report | done by the owner: [#1](https://github.com/FiniteZombie/op-1-school/issues/1), Chrome 156, Android 10 |
| G agent's check | pass: the `bug-report` label is on it; the header's commit `68e673c` matches the deployed `main`; the log has 15 heartbeat lines from an A0 drill (`pendulum-d-dorian`, 100 BPM), 6–7 sixteenths each, all three parts sounding (drums −11 to −21 dB, bass −14, chords −29 to −35), chord voices 4–8, then `transport stopped` |

- **The silent start didn't happen** on this run, so the report doesn't yet
  say which shape it is. It's still open; the next phone report of it will.
- The log shows `No drum pattern for style "dorian-synth" yet; using
  "chillhop-rhodes"`. That's expected: only `chillhop-rhodes` has a pattern
  (`src/audio/drumPatterns.ts`), and the warning is how the gap shows.

## Decisions the plan didn't cover

| Row | Decision | Why |
| --- | --- | --- |
| G | Issue #1 gets closed as a passed test, not left open | The owner's call; it reports no fault |

## Questions for the owner

| From | Placeholder or question |
| --- | --- |
| S1 | The placeholders in `COPY.bug` (`src/ui/copy.ts`) and `REPORT_TEXT` (`src/ui/bugReportText.ts`): the `bug` button, the box's wording, the issue title rule (`bug: ` and the first line) and the report's fixed lines. Keep or change? |
| G | Should agents be able to comment on and close `bug-report` issues (Pre-flight answer 3)? The GitHub MCP token reads issues but gets a 403 on writes. |

## VERIFY items

None.

## Spine requests

| From | Change | Why |
| --- | --- | --- |
| G | None new. The silent start's fix waits for a report that shows it | Plan overview |

## Checks only the owner can do

- Close [#1](https://github.com/FiniteZombie/op-1-school/issues/1) (the
  agent's token can't).

---

## Process retro

### Last retro's recommendations

From the Phase 2 exit gate's review (2026-10-28): the gate's owner's list
had a `Result` column, and G had one owner's check, as the
keep-testing-short note asked.

### Friction

- [tools] The GitHub MCP token has no issue write: comment and close both
  return `403 Resource not accessible by personal access token`. `gh` isn't
  installed. Pre-flight answer 3 assumed an agent could close issues.
- [tools] The browser pane refuses clipboard writes, so `copy` needed Chrome
  (recorded in `AGENTS.md` during S1).
- [plan] S1's Done when 4 named 120 BPM, but `/dev/spine` opens at 90 BPM
  (fixed in the row during S1).
- [tools] A `cat > file` with no input at the start of a Bash command waited
  on stdin until the 2-minute timeout (S1).
- [tools] Another session edited `src/ui/copy.ts` during S1's browser check;
  Vite reloaded the pane and S1 redid the check.

### What worked

- One owner's check, and the agent did the reading: the owner filed one
  issue, and the log answered every question the agent had. No follow-up.

### Verification gaps

- The cut near `MAX_ISSUE_URL` through GitHub's login redirect is untested
  (the phone is signed in).
- The silent start hasn't been caught in a log yet.

### Recommendations (ranked)

1. Give the GitHub MCP token issue write on `FiniteZombie/op-1-school`, or
   drop "an agent may close" from `AGENTS.md` and Pre-flight answer 3. The
   owner's call: it's their token.
2. Phase 3's plan picks up the open ends: the silent start (when a report
   shows it), `openAppDb()` and `versionchange`, V6 with clock out inside
   Module 1, and drum patterns for the other three styles.
