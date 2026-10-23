# Module contract

What a module lane follows. SPEC §5.5 and §6.5 say the same at a higher level;
where this page and SPEC differ, this page wins (the dependency rule is one:
SPEC §5.5 says "list in your PR", this repo says ask the owner first).

## Your lane

- Own only your directory, `src/modules/<id>/`, and any path your plan gives
  the lane. Nothing else gets edited.
- Import only from the spine, your own directory and `src/curriculum/` (see
  [Imports](#imports)).
- Add Vitest tests for anything pure. Audio and MIDI behaviour ships with a
  check on a page the owner can run and steps for the phone and the Field.
- **Never add a dependency, a vendored file or a program.** Ask the owner first
  (AGENTS.md **Dependencies**); the packages SPEC §5.1 names are approved.
- Run `npm run check` (typecheck, Vitest, build) before reporting done. It
  must exit 0.
- Don't resolve a VERIFY item by guessing: stub behind the interface, leave
  it flagged, and list it in your report. The log is in
  [`HARDWARE_NOTES.md`](HARDWARE_NOTES.md).
- Never report a phone or hardware check as done. Tag it `[phone]`,
  `[field]` or `[ear]` and write its steps for the owner.

## `module.ts`

Each `src/modules/<id>/module.ts` exports `module`, typed by `ModuleDefinition`
in `src/types/modules.ts`:

```ts
import { lazy } from 'react';
import type { ModuleDefinition } from '../../types/modules';

export const module: ModuleDefinition = {
  id: 'progression-trainer', // one of MODULE_IDS
  route: '/progression-trainer', // relative to Vite's base, starts with /
  title: '…',
  icon: '…', // a one-character string
  component: lazy(() => import('./View')), // a view takes no props
  phase: 2,
  // devOnly: true, // hidden from the nav and the route, unless the URL has ?dev
};
```

Registration is automatic: `src/modules/registry.ts` finds every
`./*/module.ts` with `import.meta.glob`. No module edits or imports the
registry. A route matches exactly, after trailing slashes are dropped. `MODULE_IDS` is
in `src/types/modules.ts`; a new id is a spine change.

`src/modules/dev-spine/` is the worked example: `module.ts`, `View.tsx`, and a
pure `devSpine.ts` with its test.

## Imports

A module may import from:

- `src/types/`
- `src/theory/`
- `src/audio/` (including `src/audio/__fakes__/` in tests)
- `src/input/` (including `src/input/__fakes__/` in tests)
- `src/state/`
- `src/ui/`
- its own directory, `src/modules/<id>/`
- `src/curriculum/`, the data (lessons, progressions, recipes), through its
  `index.ts`: `lessons()`, `lessonById(id)`, `progressions()` (loaded),
  `progressionSpecs()`, `progressionById(id)`, `sequencerRecipes()` and
  `curriculumErrors()`. Every record is validated at load; a bad one is
  dropped and its error logged, never thrown.

It may not import another module, `src/modules/registry.ts`, `src/App.tsx` or
`src/main.tsx`. Packages are not this rule's business; dependencies are
(above). Nothing outside a module's directory imports from it, and only
`src/ui/AppShell.tsx` imports the registry.

`src/modules/__tests__/importRule.test.ts` enforces this (checker in
`importRule.ts` beside it) by reading every file under `src/`. It fails the
build, so `npm run check` catches a break.

**Import theory from its barrel**, `'../../theory'`, as `dev-spine` does.
Other spine directories have no barrel, so import their files by name
(`'../../audio/VirtualPushSynth'`).

## Spine changes

You can't edit the spine, and a spine change is a review flag, not a quiet
edit. If you need one, work around it inside your own paths and put the
smallest change that would help, and why, in your report under **Spine
requests**. Don't make it, unless your plan gives the lane that file.

Spine types gain fields and never change meaning.

## `useSpine()`

`useSpine()` (from `src/ui/spine.tsx`, inside `<SpineProvider>`, which `App.tsx`
puts around the shell) returns the page's single spine:

| Field | What it is |
| --- | --- |
| `clock` | `WebAudioClockBridge`: audio time ↔ `performance.now()`, output latency, `snapshot()` |
| `transport` | `ToneTransport` (the `TransportEngine` interface): `configure`, `start`, `stop`, `onBeat`, `onSixteenth`, `onLoop`, `onMidiPulse`, tick ↔ audio-time maps |
| `bus` | `NoteBus`: every note from every started source, as `NoteEvent`s |
| `midi` | `WebMidiBridge` (`MidiBridge`): access state, ports, clock out, follow |
| `touch` | `TouchInput`, started on the bus already |
| `settings` | the settings store: `get`, `save(patch)`, `subscribe` |
| `audio` | the audio controller: `state()` (`off` / `running` / `paused`) and `start()` |

There is one of each per page. Never dispose them. `useAudioState()` and
`useSetting(key)` are the hooks over the last two.

Other spine pieces a module uses:

- **Audio gate.** `<AudioGate />` is the start / resume button. The shell
  doesn't show it, so every page that plays sound puts it at the top. Nothing
  makes sound before the user has tapped it.
- **Backing.** `new ToneBackingSynth(spine.transport)` from
  `src/audio/VirtualPushSynth.ts`. Whoever builds one disposes it on unmount.
  Call `transport.configure(transportConfigFor(progression))` before
  `synth.load(progression)`. Stop the transport on unmount if you started it.
- **Theory.** `classify`, `realize`, `loadProgression`, `chordName`,
  `noteName` and the rest, from `src/theory`. The roman-numeral grammar
  is in the doc comment of `realize` in `src/theory/progressions.ts`, and
  degree names are `degreeName` in the same file; read those, not a copy here.
  They differ on purpose: `/<degree>` in a numeral is a degree of the key's mode, while
  degree *names* (`b6`) are relative to the tonic's major scale.
- **Touch voice.** The spine's `NoteVoice` (`src/audio/NoteVoice.ts`) sounds
  `touch` notes once audio runs, and nothing from `midi` or `mic` (the Field
  sounds by itself). A module builds no voice of its own for touch keys.
- **Tap window.** `tapVerdict(offsetMs, source, calibrated)` in
  `src/audio/tapWindow.ts` says `early`, `on`, `late` or `unscored` for an
  offset from `offsetMs()` in `src/audio/Clock.ts` (positive is late); the window comes from the measured
  `TAP_OFFSETS` per source (`tapWindow(source)`), and a source with no
  measurement, or `mic`, is `unscored`. Never pick a tolerance of your own;
  tests inject their measurements.
- **UI.** `Keyboard24` (props `chord`, `musicKey`, `guide`, `onOutOfRange`;
  `guide` is a list of pitch classes whose unlit keys carry a mark and
  `data-guide="true"`), `Encoder`,
  `StatusBar` (in the shell), `Link` / `navigate` / `useLocation` from
  `src/ui/navigation.tsx` (these take a `query` and keep `?dev`, and `fast`
  alongside it; `useLocation()` gives `path`, `dev`, `fast` and `query`),
  `useAvailableModules()` from `src/ui/availableModules.tsx`, and `COPY` in
  `src/ui/copy.ts` for settled strings.
- **State.** `openAppDb()` and the record types in `src/state/db.ts`;
  `settings` in `src/state/settings.ts`; calibration in
  `src/state/calibration.ts`.
- **Follow mode** is the spine's, in `MidiBridge.follow(enabled, transport)`
  (`src/input/MidiBridge.ts`, with `ExternalClockFollower` in
  `src/input/ClockFollower.ts`). A module only toggles it; it doesn't
  reimplement it. `clockMode()` is `internal`, `clock out` or `follow`.
- **The power warning** is the shell's: `PowerWarning` in
  `src/ui/PowerWarning.tsx`, driven by `raisesPowerWarning` in
  `src/ui/powerWarningLogic.ts` from `MidiBridge.onConnectionChange`. A module
  shows nothing of its own for it.

## Drills

A drill module (one with modes in `DRILL_MODES`, `src/types/drills.ts`) is
launched by URL, and reports by writing one `Attempt`.

- **The launch is the query.** The Runner, the library or a deep link
  navigates to the module's route with `launchQuery(launch)`; the module reads
  it back with `parseLaunch(module, useLocation().query)`, which returns
  `{ launch }` or `{ error }` naming the bad field. Fields: `mode` (the level
  id, one of `DRILL_MODES[module]`; `levelId('A', 0)` is `A0`), and
  optionally `session`, `lesson`, `step` (the step's index in its lesson),
  `progression`, `minutes`, `returnTo` (an app path) and `params` (the step's
  `params`; `params.form` is `phrase` or `call-response`). There's no shared
  in-memory state, so a reload mid-drill reopens the same drill. A query
  change on the same route doesn't remount the view: read `query` from
  `useLocation()` on every render.
- **Other modules** come from `useAvailableModules()`, `{ id, route }` for
  each visible module, never from the registry.
- **One `Attempt` per finished drill** (time up, or `finish` after at least
  one full loop), none for an abandoned one (navigating away, or `stop`
  before a loop). `module` is the module id, `mode` the level id, `score`
  0..1 or absent when unscored, `offsets` the `TimingOffset`s of a timed
  level, and `data` the module's own detail plus `step` copied from the
  launch when it has one (one attempt answers one step, so two steps of the
  same mode in a lesson don't collide).
- **A tap with no pitch** (A0's pad) is a `TimingOffset` with
  `note: PAD_NOTE` (`-1`, outside `MidiNote`'s 0..127 on purpose).
- **Sessions.** With a `session` in the launch, the attempt's `sessionId` is
  it and the module leaves the session row alone (the Runner owns it).
  Without one, the module writes its own `Session`: `kind: 'practice'`,
  `lessonId` the launch's `lesson` or `'practice'`, `startedAt` when the drill
  started, `finishedAt` the attempt's `at`, and `scores` `{ <mode>: score }`
  when scored (`{}` when not).
- **Which slot a played note answers** is the slot heard when it was played:
  `heardAudioTime(e.perfTs, spine.clock)` (`src/audio/Clock.ts`, the inverse
  of `audibleAt` on both clock paths) gives the audio time heard then, and
  `slotAtAudioTime(transport, prepared, t)` from `src/audio/voicing.ts` its
  slot. Scorers never call the synth's `currentSlot()`, so
  their tests stay Tone-free. There's no grace window into the next slot.
- **Connecting the Field** is `<MidiConnect />` (`src/ui/MidiConnect.tsx`),
  under the `AudioGate`: `connect midi` asks for access on the tap, then each
  input is a button labelled by the messages it has delivered, never by name
  (VERIFY V7), and the player picks the one that counts up when they play. The
  choice goes through `midi.select`, which remembers it. A module builds no
  port picker of its own.

## Fakes for Module 3

Pocket Dojo's timing tests run on the fakes in `src/input/__fakes__/` and
`src/audio/__fakes__/`. They
are app-typed (no Node types) and Tone-free; keep them so.

- `FakeMidiPort.ts`: `FakeMidiOutput` (records `[data, timestamp]`),
  `FakeMidiInput` (`emit`), `FakeMidiAccess` (`plug` / `unplug`), and
  `fakeMidiNavigator(access | null)`.
- `src/audio/__fakes__/FakeTransport.ts`: `createFakeTransport()`, a real `TransportCore` over
  `FakeTransportDriver.advanceTo(t)`, which hands out every pulse due by
  `t + lookAhead` like Tone; and `FakeClockBridge(originMs, latencySec)`.

Build the bridge as `new WebMidiBridge({ memory })` over a fake navigator.
Nothing in `src/input` has yet run against a real Web MIDI port.

## Rules that apply to everything

- **No red versus green.** The owner is red/green colorblind. Classifications,
  zones and pass/fail use blue or cyan = good, red = bad, yellow = warning,
  gray = neutral, and never differ by hue alone: pair every colour with a word,
  mark, outline or pattern (the keyboard's chord tones are solid, tensions
  outlined, avoid notes striped, outside notes crossed).
- **Colours come from the theme tokens** in `src/ui/tokens.css`, never raw
  hexes, so both themes work: Tailwind classes (`bg-surface`, `text-muted`,
  `border-warn`, …) or `var(--op-…)` in an inline style. State tokens are `ok`,
  `bad`, `warn` and `neutral`. Check your view in dark and light.
- **No third-party audio.** Backing is procedural; user samples come in
  through the file picker.
- **Creative choices are the owner's**: copy, names, look and layout beyond
  what the spec or your plan fixes. Settled strings are in `COPY`. For
  anything else use a neutral, obviously temporary placeholder, mark it
  `placeholder` in a comment, and list it in your report under **Questions for
  the owner**. Don't stop to ask unless the run says to.
- **Docs.** Update the docs your change affects in the same commit, written as
  what's true now.

## Your report

End with: what's done and what's stubbed; each Done-when item as PASS, FAIL or
OWNER; the VERIFY items you touched; **Spine requests**; **Questions for the
owner**; and **How to test this yourself** on the phone and the Field.
