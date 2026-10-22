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
- `src/audio/`
- `src/input/` (including `src/input/__fakes__/` in tests)
- `src/state/`
- `src/ui/`
- its own directory, `src/modules/<id>/`
- `src/curriculum/`, which is data (lessons, progressions, recipes) and is
  created in Phase 2. It doesn't exist yet, so a check of this page's paths
  against `git ls-files` skips this one.

It may not import another module, `src/modules/registry.ts`, `src/App.tsx` or
`src/main.tsx`. Packages are not this rule's business; dependencies are
(above). Nothing outside a module's directory imports from it, and only
`src/ui/AppShell.tsx` imports the registry.

`src/modules/__tests__/importRule.test.ts` enforces this (checker in
`importRule.ts` beside it) by reading every file under `src/`. It fails the
build, so `npm run check` catches a break.

**Import theory by its `index` file.** The checker rejects a bare barrel
import from a module: `'../../theory'` fails, because a one-segment target
isn't classed as spine. Write `'../../theory/index'`, as `dev-spine` does. Other
spine directories have no barrel, so import their files by name
(`'../../audio/VirtualPushSynth'`). A fix to the checker is a spine request
the owner settles; don't edit it.

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
  `noteName` and the rest, from `src/theory/index`. The roman-numeral grammar
  is in the doc comment of `realize` in `src/theory/progressions.ts`, and
  degree names are `degreeName` in the same file; read those, not a copy here.
  They differ on purpose: `/<degree>` in a numeral is a degree of the key's mode, while
  degree *names* (`b6`) are relative to the tonic's major scale.
- **UI.** `Keyboard24` (props `chord`, `musicKey`, `onOutOfRange`), `Encoder`,
  `StatusBar` (in the shell), `Link` / `navigate` / `useLocation` from
  `src/ui/navigation.tsx` (these keep `?dev`), and `COPY` in `src/ui/copy.ts`
  for settled strings.
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

## Fakes for Module 3

Pocket Dojo's timing tests run on the fakes in `src/input/__fakes__/`. They
are app-typed (no Node types) and Tone-free; keep them so.

- `FakeMidiPort.ts`: `FakeMidiOutput` (records `[data, timestamp]`),
  `FakeMidiInput` (`emit`), `FakeMidiAccess` (`plug` / `unplug`), and
  `fakeMidiNavigator(access | null)`.
- `FakeTransport.ts`: `createFakeTransport()`, a real `TransportCore` over
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
