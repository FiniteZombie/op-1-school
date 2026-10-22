# op-1-school — OP-1 Field Live Jam & Improvisation Trainer

**Spec v2 (refined).** Supersedes `Op1 Field Improv Master Plan.md` (v1). Written to be executed by Claude Code using a **spine-first, fan-out-second** workflow (§6). Read §0 before doing anything.

---

## 0. For the agent reading this

- **Scope discipline.** Build what the current phase asks for and nothing more. Every module imports *only* from the spine (`src/types`, `src/theory`, `src/audio`, `src/input`, `src/state`, `src/ui`). Modules never import each other.
- **Hardware facts are tiered.** §2 separates *verified* facts from *VERIFY* items. Never resolve a VERIFY item by guessing or by "common knowledge" of the original OP-1 — the Field differs in several places that matter here. Leave the item flagged, build behind an interface, and surface it in your final report.
- **No third-party audio in the repo.** All backing material is procedural (`VirtualPushSynth`). User samples enter only through the file picker. This is a licensing decision, not a convenience.
- **Timing correctness is the product.** A drill that reports your snare as "+22 ms late" when the real offset is +22 ms minus 40 ms of Android output latency is worse than no drill. §3 is the structural core; read it before touching any audio or MIDI code.
- **Verification is not `tsc --noEmit`.** Type-checking proves the spine compiles, not that a `ii–V–i` in F minor contains the right pitch classes. Pure code (theory, clock conversion, kit packer) ships with Vitest tests. Audio/MIDI behavior ships with a manual smoke route (`/dev/spine`) and a checklist the human runs on the actual phone and OP-1 Field.

### 0.1 What changed from v1 and why

| v1 said | v2 says | Why |
| :--- | :--- | :--- |
| Kit compiler exports a **stereo WAV** to `drum/user` | Exports **AIFF with the OP-1 `APPL` chunk** carrying `op-1{...}` JSON slice metadata; 20 s stereo max (mono AIFF is capped at 12 s on the Field) | Without the metadata chunk every key plays the whole file. Format details are a Phase 4 spike (§8). |
| Velocity hats via index/middle finger alternation | Velocity exists only when the Field's velocity setting (Shift+Tempo: off/soft/hard) is on, and it is believed to be accelerometer-derived, not per-key force. Drills treat velocity as a **coarse, optional** signal and score **placement** primarily | Scoring a noisy signal as if it were an MPC pad would train the wrong thing. |
| Bundled royalty-free jazz/soul loops in `public/samples/` | No bundled audio. Procedural backing only; user-supplied samples via file picker | An agent cannot license audio; the repo must stay clean. |
| Tone.js transport "sends MIDI clock" | Explicit **clock-domain layer** (§3) converting audio time ↔ `performance.now()` ↔ transport ticks; MIDI clock scheduled with lookahead and explicit timestamps; input offsets corrected for output latency + per-device calibration | Web MIDI and Web Audio run on different clocks. Every module depends on this; it cannot be retrofitted. |
| Essentia.js WASM for key detection | Dropped from Phases 1–3. MPM in an **AudioWorklet** for monophonic pitch; small hand-rolled chroma + Krumhansl key estimate for slices. Essentia optional/lazy later | Multi-MB WASM on a phone PWA for a feature used on 1–4 s slices; MPM on the main thread would glitch on Android. |
| USB-C "Mode 2" and "Mode 3" described as independent | Documented as **coupled** on Android: when the Field is connected as USB audio, Android routes *all* phone audio to it, so backing-track audio lands in the Field's USB input | Changes what the drills can assume you're hearing and what you can record. |
| Spine = types + Transport + Synth + MidiBridge + db | Spine also includes **`theory.ts`** (pure, tested), a **`NoteInput`** abstraction (MIDI / touch / mic behind one event type), **UI primitives** (AppShell, Keyboard24, StatusBar, theme tokens), and the **module registry** via `import.meta.glob` | Otherwise five fan-out agents build five keyboards, five input handlers, and fight over one registry file. |
| Phases: Curriculum → Trainer → MIDI → Samples | Spine → (Module 1 + Curriculum content + Runner) → (hardware gate → Module 3) → (format spike → Modules 2 & 4) | Get a daily-usable vertical slice first; put the riskiest unknowns (file format, Android USB) last and behind spikes. |
| Finger-drum layout "Kick on C, Snare on D/E" | Default drum layout follows **TE's factory kit key assignment** (VERIFY by reading a factory kit's metadata); keyboard's lowest key is F | Drills should transfer to stock kits; a bespoke layout means relearning at the jam. |

---

## 1. Vision & scope

**Who:** one player with an OP-1 Field jamming alongside friends on Ableton Push / grooveboxes. Push covers quantized grids, pads and step-sequenced drums; the OP-1 covers tape, live sampling, unquantized playing and texture.

**What:** a curriculum (§4) plus a mobile-first PWA ("op-1-school") that runs in Chrome on an Android phone and on desktop, hosted on GitHub Pages, and talks to the Field over one USB-C cable when available.

**Daily-use target (end of Phase 2):** open the app on the phone next to the Field, run a 15-minute guided session with procedural backing, log results. No cable required.

**Out of scope for v2:** iOS (no Web MIDI in Safari), any backend, multi-user, DAW integration, audio recording of the OP-1's output into the app beyond pitch/transient detection.

---

## 2. Hardware & platform reality

### 2.1 Verified

| Fact | Consequence |
| :--- | :--- |
| OP-1 Field is a class-compliant USB MIDI device; sends/receives note on/off, MIDI clock, transport, song position pointer. Sync modes: **free** (clock ignored), **beat match** (Field is master), **sync** (Field follows external clock) — set via Tempo + the green encoder | App-as-master works: put the Field in **sync**. Field-as-master is possible but is a harder follower design (§3.5). |
| Field firmware added **tape speed follows external clock** when in sync mode with clock-in enabled | App-as-master also pins the tape speed, which is what a jam needs. |
| Field keys: **velocity sensitivity via firmware setting** (Shift+Tempo → off / soft / hard); velocity is transmitted over MIDI and used by internal sequencers. Widely believed to be accelerometer-based | Velocity over MIDI is present but coarse. Default drills assume **off** (fixed 127) and score timing; optional "velocity bands" drill when the user has it on. |
| Field drum kits: **AIFF** with an `APPL` chunk whose payload is the ASCII prefix `op-1` followed by JSON (`"type":"drum"`, per-key `start`/`end` arrays, `pitch`, `playmode`, `reverse`, `volume`, `dyna_env`, …). Field accepts **20 s stereo**; **mono AIFF is capped at 12 s** | `KitCompiler` writes AIFF, stereo, 44.1 kHz, 16-bit, with the chunk. Slice-position units are **not** verified for the Field (§8). |
| OP-1 keyboard spans two octaves, **lowest key is F**, 24 keys, with octave shift | `Keyboard24` renders F…E. Drum layouts are expressed in that range. |
| Web MIDI and `getUserMedia` require a secure context and a user gesture; GitHub Pages is HTTPS | Fine. Every audio/MIDI init happens inside a tap handler. |
| Chrome on Android supports Web MIDI (with a permission prompt) and class-compliant USB audio devices | Fine, with the routing caveat below. |

### 2.2 Android USB-C realities (design-affecting)

1. **Audio routing is global.** When the Field is attached as a USB audio device, Android sends the phone's entire audio output to it. The app's backing loop will therefore arrive at the Field's USB input. Consequences:
   - Drills in Mode 2 are *monitored* through the Field (headphones/speaker on the Field), which is actually convenient.
   - If the user records to tape with input = USB during a drill, they record the backing track. The app must say so on the Mode 2 screen.
   - Mode 3 (stream a sample into the Field for on-device slicing) is the same mechanism with the app playing *only* the sample. There is no separate "mode"; it's a UI state in which the transport is stopped.
   - The app cannot select an output device on Android (`setSinkId` is desktop-only). Desktop can route backing to speakers and samples to the Field.
2. **Mic mode needs headphones.** Mic-based pitch/transient detection with the phone speaker active hears the app's own audio. The mic-mode screen requires headphones on the phone (or the Field as output) and must disable `echoCancellation`, `noiseSuppression`, `autoGainControl` in `getUserMedia` constraints — defaults will crush transients and shift pitch.
3. **Power.** USB-C to USB-C with the phone as host may charge the Field from the phone. VERIFY whether the Field can decline charging (§8). Until known, the UI shows a one-line warning on connect.
4. **Background throttling.** Screen-off or backgrounded tabs throttle timers. Tone.js uses a Worker ticker for its clock; also request a wake lock (`navigator.wakeLock`) while a drill transport is running.
5. **Audio latency.** Expect 20–100 ms output latency depending on device. `AudioContext({ latencyHint: 'interactive' })`, and read `ctx.outputLatency` / `ctx.baseLatency` for correction (§3.3).

### 2.3 Desktop

Chrome on PC: same code path, plus `setSinkId` for output routing and far lower latency. Firefox lacks Web MIDI without an extension; the app detects and degrades to Unplugged mode with a notice.

---

## 3. Clock domains & timing architecture (spine core)

Three clocks exist and none of them agree:

| Clock | Unit | Who uses it |
| :--- | :--- | :--- |
| `AudioContext.currentTime` | seconds, audio hardware | Tone.js scheduling, synth note-ons, audible beat positions |
| `performance.now()` | ms, monotonic | Web MIDI `send(data, timestamp)` and `MIDIMessageEvent.timeStamp`, pointer events |
| Transport ticks | PPQ-relative integers | Musical positions (bar/beat/sixteenth), swing, loop points |

### 3.1 `src/audio/Clock.ts`

```ts
export interface ClockCorrelation { contextTime: number; performanceTime: number } // from ctx.getOutputTimestamp()

export class ClockBridge {
  constructor(ctx: AudioContext) {}
  refresh(): void                       // re-sample getOutputTimestamp() (call every ~250 ms)
  audioToPerf(audioSec: number): number // ms
  perfToAudio(perfMs: number): number   // sec
  outputLatencySec(): number            // ctx.outputLatency ?? ctx.baseLatency ?? 0
  audibleAt(audioSec: number): number   // audioToPerf(audioSec + outputLatencySec())
}
```

Fallback when `getOutputTimestamp` is unavailable: sample `(ctx.currentTime, performance.now())` pairs and keep a running linear fit.

### 3.2 `src/audio/TransportEngine.ts`

Wraps `Tone.getTransport()` and owns the loop.

```ts
export type ClockSource = 'internal' | 'midi-follow'  // midi-follow is a stretch target, see 3.5

export interface TransportConfig { bpm: number; swing: number /*0..1 on 16ths*/; bars: number; timeSig: [number, number] }

export interface BeatEvent { bar: number; beat: number; sixteenth: number; audioTime: number; tick: number }

export interface TransportEngine {
  configure(cfg: TransportConfig): void
  start(atAudioTime?: number): void     // fresh start: transport position 0, bar 1 beat 1
  stop(): void
  bpm(): number
  position(): { bar: number; beat: number; sixteenth: number; ticks: number }
  audioTimeOfTick(tick: number): number // for the *current* loop iteration
  tickOfAudioTime(audioSec: number): number
  onBeat(cb: (e: BeatEvent) => void): Unsubscribe        // scheduled via Transport, fires with audioTime
  onSixteenth(cb: (e: BeatEvent) => void): Unsubscribe
  onMidiPulse(cb: (audioTime: number) => void): Unsubscribe // 24 PPQN: scheduleRepeat with "<PPQ/24>i"
  onLoop(cb: (iteration: number) => void): Unsubscribe
}
```

Rules: PPQ stays at Tone's default (192); a MIDI pulse is every `192/24 = 8` ticks. Callbacks receive **audio time**, never wall-clock. Swing is applied by Tone for synth scheduling only; MIDI clock pulses are *unswung* (the Field's sequencers apply their own swing).

### 3.3 Input timing: the offset formula

For a played event with `perfTs` (MIDI event `timeStamp`, or pointer event `timeStamp`), against a target grid position with audio time `tAudio`:

```
offsetMs = perfTs − clock.audibleAt(tAudio) − calibrationMs[source]
```

`audibleAt` accounts for output latency: the user plays along to what they *hear*, which is later than when it was scheduled. `calibrationMs` is per-device, per-input-source (`midi`, `touch`, `mic`), stored in the DB, and obtained by a **calibration routine**: click plays for 2 bars, user taps along for 16 hits, calibration = median offset. The Pocket Dojo refuses to show ms numbers until calibration exists for the active source.

For the mic source the chain is longer (input latency + analysis window); calibration is mandatory and the UI says "±~10 ms" rather than implying MIDI precision.

### 3.4 MIDI clock out (app as master)

- `onMidiPulse(audioTime)` → `output.send([0xF8], clock.audioToPerf(audioTime))`. Tone's lookahead (≈100 ms) gives the Web MIDI scheduler timestamps in the future; Chrome honors `send` timestamps. Do **not** `setInterval` MIDI clock.
- `start()` sends `0xFA` at the audio time of tick 0 (converted), `stop()` sends `0xFC` immediately. Send `0xF2` (SPP 0) before `0xFA` for a clean restart.
- Send clock *before* the user has started the transport? No — many devices (including the OP-1 lineage) expect continuous clock, but the Field in **sync** mode only needs clock while running. Keep it simple: pulses only while running. Revisit if the Field shows tempo-detection lag on start.
- Jitter telemetry: `/dev/spine` logs the distribution of `(actualSendPerf − intendedPerf)` so the human can see whether a given phone keeps sub-2 ms scheduling.

### 3.5 MIDI clock in (Field or Push as master) — stretch, interface-only in spine

```ts
export interface ExternalClockFollower {
  onPulse(perfTs: number): void      // 0xF8
  onStart(perfTs: number): void      // 0xFA / 0xFB
  onStop(): void                     // 0xFC
  estimate(): { bpm: number; confidence: number; phasePerfMs: number }
}
```

The spine ships the interface and a BPM estimator (median of last 48 inter-pulse intervals → BPM; exponential smoothing), with Transport's bpm updated from it. Phase-locking the loop to external bar 1 is deferred; the first useful behaviour is "app follows tempo, user drops in on 1 by ear," which is also the real jam skill.

---

## 4. Curriculum v2

Delivered as `docs/CURRICULUM.md` (human-readable) + `src/curriculum/*.json` (machine-readable, typed by `src/types/lessons.ts`). Four vectors, each with numbered **levels**. Every lesson is a 15-minute session (§5.5). Levels are gates: the Runner won't offer level N+1 until level N has two logged completions at ≥70% accuracy (where scoring exists).

### 4.1 Vector A — Harmonic navigation in a known key

The v1 framing ("where are we in the progression?") is right; the fix is sequencing the ear before the fingers, and giving a safety net before asking for guide tones.

| Level | Skill | Drill (Module 1 mode) | Scored? |
| :--- | :--- | :--- | :--- |
| A0 | **Hear the harmonic rhythm** | Backing plays; tap the screen each time the chord changes. Starts at 2 bars/chord, descends to 2 chords/bar | Tap-time vs change-time |
| A1 | **Bass root as scale degree** | Chord blocks masked; name/play the root of each bar as a degree of the key (1, b3, 4, 5, b6, b7…). Push players voice densely — train on the *lowest* note | Degree correct |
| A2 | **Safety net: pentatonic** | Play only minor-pentatonic (or major-pent for major keys) over the loop for 2 minutes. Goal is not scoring; it's permission to make sound without clashing | Clash count only |
| A3 | **Chord quality** | After root: m7 / 7 / maj7 / m7b5 / sus. Two-note test: 3rd vs b3rd, 7th vs b7th | Quality correct |
| A4 | **Common tones vs moving tone** | For 2-chord vamps: find the notes shared by both chords, then the single note that moves (e.g. Fm7→Bbm7: F and Ab stay, the moving line is the 7th → 3rd) | Notes correct |
| A5 | **Guide tones** | Two fingers on 3rd and 7th; move by half/whole step on each change. The "voice-leading map" reveal is the payoff | Chord tone / tension / avoid per bar |
| A6 | **Target-note phrasing** | Generate: 2-bar phrase that *ends* on the 3rd of the *next* chord, land on beat 1. Then call-and-response (play bars 1–2, rest 3, turnaround 4) | Landing note + timing |

Progression families (in `progressions.json`): the four from v1 (modal pendulum, jazz-hop turnaround, cinematic walkdown, pedal point) plus **i–v–iv** (minor plagal-ish loop common in lo-fi) and **I–V–vi–IV in a major key**, so the ear doesn't over-fit to minor. Styles select synth voicings and harmonic rhythm, not different theory.

**Non-app drill (document in CURRICULUM.md, not an app module):** before any jam, *ask* the Push player for key and progression and listen for 8 bars. Communication is a skill; the trainer exists for when the answer is "uh, I just found pads I liked."

### 4.2 Vector B — Pocket, finger drumming, OP-1 sequencers

Corrections from §2: keyboard velocity is coarse → drills score **placement**, with velocity as an optional second axis. Default kit layout = TE factory assignment (VERIFY; expose as a user-editable mapping in settings, with the F-start keyboard).

| Level | Skill | Drill (Module 3 mode) |
| :--- | :--- | :--- |
| B0 | **Calibrate** | Tap-along calibration per input source (§3.3). Mandatory, repeatable |
| B1 | **Kick on the grid** | Straight 4-on-the-floor, then boom-bap kick pattern. Target zone ±10 ms. Radar shows each hit |
| B2 | **Laid-back snare** | Kick on grid, snare on 2 and 4 at **+15 to +30 ms**. The radar has two target zones (kick: centred, snare: late) |
| B3 | **Ghost kick placement** | Soft pickup kick at the "a" of 2 (`2-and-a`), scored by placement; velocity shown if the Field has it on |
| B4 | **Hat swing** | 16th hats; target swing 54–62%. Score = measured swing % from alternate-16th offsets, not per-hit ms |
| B5 | **Dilla drunk** | Composite: kick straight, snare late, hats swung. Composite score |
| B6 | **Sequencer recipes** (no scoring) | Finger sequencer: 6 pattern variations on white keys with Hold → arrangement switching one-handed. Endless: 5/6/7-step motifs with rests. Tombola in the upper octave for texture. Each is a step-by-step card with a visualizer (`sequencerRecipes.json`) |

Keep the v1 note that unquantized tape recording is where the OP-1 earns its keep against a quantized Push — the drills are for feel you then *record*, not for playing live along a grid.

### 4.3 Vector C — Sample adaptation & live splicing

v1 is good here. Keep all three adaptation strategies and the 4-track template. Changes:

- **C1 Hum-and-match** is the Module 2 core drill. Mic required → headphones rule (§2.2).
- **C2 Re-contextualization** (0 / −2 / +3 instead of +7): the "Check My Flip" explanation must enumerate *all* consonant landings (root, 5th, relative, 9th-ish) and rank by timbre cost (|semitones|), not declare one right answer. Multiple flips are correct; the explanation says which one you got.
- **C3 Micro-chopping** moves to a card in Module 2 (no scoring) plus a Module 4 feature: the kit compiler can take one long sample and N marker times and emit a sliced kit — that *is* the micro-chop workflow prepped on the phone instead of on the device.
- The "10-second live resample loop" stays as an OP-1 card in CURRICULUM.md. The app's role is to run the backing and the countdown, nothing more.

### 4.4 Vector D — OP-1 Field superpowers

No app module; this is `CURRICULUM.md` content only (cards in the Runner). Keep v1's tape speed tricks, M1/M2 brakes, Element LFO → Nitro/filter with the G source, per-track panning + master drive. Add: **pre-tape panning** (Shift+orange on the tape screen, a Field-firmware addition) to keep OP-1 parts out of the Push's centre, and the **line-in mono/stereo toggle** when sampling the Push's output.

---

## 5. App architecture

### 5.1 Stack

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| Build | Vite + React 19 + TypeScript (strict), with `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` | `base` in `vite.config.ts` must equal `/<repo-name>/` for GitHub Pages; service worker scope follows |
| PWA | `vite-plugin-pwa` | Precache app shell + curriculum JSON. No audio to cache |
| Audio | Tone.js (transport, synths, sampler) + raw Web Audio for analysis | `Tone.start()` inside a tap handler. Worker ticker on |
| MIDI | Web MIDI API, no wrapper lib | Behind `NoteInput` (§5.3) |
| Pitch | MPM in an `AudioWorkletProcessor`; chroma + Krumhansl–Schmuckler key estimate for slices | Both pure-TS, tested |
| State | IndexedDB via a thin typed wrapper (e.g. `idb`) + `localStorage` for settings | Schema versioned from day 1 |
| UI | Tailwind v4 (via `@tailwindcss/vite`) + Canvas for radars/visualizers | TE "Field" palette; encoder colours blue / ochre / gray / orange as design tokens |
| Tests | Vitest (pure modules), Playwright optional later | CI runs `tsc --noEmit`, `vitest run`, `vite build` |
| Deploy | GitHub Actions → GitHub Pages on push to `main` | |

### 5.2 Directory layout

```text
op-1-school/
├── .github/workflows/deploy-pages.yml
├── docs/
│   ├── SPEC.md                    # this file
│   ├── CURRICULUM.md              # human-readable curriculum + OP-1 cards
│   ├── HARDWARE_NOTES.md          # verified facts, VERIFY log, spike results
│   └── MODULE_CONTRACT.md         # the one-page rules every fan-out agent follows
├── public/manifest.webmanifest
├── src/
│   ├── types/
│   │   ├── music.ts               # pitch, chord, scale, progression, note events, timing
│   │   └── lessons.ts             # Lesson, Step, Progression JSON shapes
│   ├── theory/
│   │   ├── pitch.ts               # pitch class math, note names, intervals
│   │   ├── chords.ts              # chord construction, tones, tensions, avoid notes
│   │   ├── scales.ts              # modes, pentatonics, degree naming
│   │   ├── progressions.ts        # roman numeral → chords in a key
│   │   └── __tests__/
│   ├── audio/
│   │   ├── Clock.ts               # §3.1
│   │   ├── TransportEngine.ts     # §3.2
│   │   ├── VirtualPushSynth.ts    # procedural drums/bass/Rhodes from a Progression
│   │   ├── PitchWorklet.ts        # MPM processor + main-thread wrapper
│   │   ├── KeyEstimate.ts         # chroma + K-S (pure, tested)
│   │   └── __tests__/
│   ├── input/
│   │   ├── NoteInput.ts           # unified NoteEvent source interface + bus
│   │   ├── MidiBridge.ts          # Web MIDI: ports, note in, clock out, follower hook
│   │   ├── TouchInput.ts          # on-screen keyboard/pads → NoteEvent
│   │   └── MicInput.ts            # transient + pitch → NoteEvent (uses PitchWorklet)
│   ├── state/
│   │   ├── db.ts                  # IndexedDB schema + migrations
│   │   ├── settings.ts            # localStorage-backed, typed
│   │   └── calibration.ts         # per-device, per-source offsets
│   ├── ui/
│   │   ├── AppShell.tsx           # layout, nav, module routing, StatusBar
│   │   ├── Keyboard24.tsx         # F…E, lights per NoteEvent, colour per classification
│   │   ├── StatusBar.tsx          # clock mode, BPM, MIDI port, input source, calibration state
│   │   ├── Encoder.tsx            # touch dial in the four TE colours
│   │   └── tokens.css             # palette, spacing, type
│   ├── modules/
│   │   ├── registry.ts            # import.meta.glob('./*/module.ts') → ModuleDefinition[]
│   │   ├── progression-trainer/   # Module 1
│   │   ├── sample-flip/           # Module 2
│   │   ├── pocket-dojo/           # Module 3
│   │   ├── kit-compiler/          # Module 4
│   │   ├── runner/                # Module 5
│   │   └── dev-spine/             # /dev/spine smoke page (spine owns this)
│   ├── curriculum/
│   │   ├── progressions.json
│   │   ├── sequencerRecipes.json
│   │   └── lessons/*.json
│   ├── App.tsx
│   └── main.tsx
├── CLAUDE.md
├── package.json / tsconfig.json / vite.config.ts / vitest.config.ts
```

### 5.3 Spine contracts

These are the interfaces the spine agent implements and every module consumes. Shapes may gain fields; they may not change meaning.

#### `src/types/music.ts`

```ts
export type PitchClass = 0|1|2|3|4|5|6|7|8|9|10|11          // C=0
export type MidiNote = number                                   // 0..127
export type ChordQuality = 'maj7'|'7'|'m7'|'m7b5'|'dim7'|'sus4'|'sus2'|'maj'|'min'|'mMaj7'|'6'|'m6'
export type Mode = 'ionian'|'dorian'|'phrygian'|'lydian'|'mixolydian'|'aeolian'|'locrian'

export interface Key { tonic: PitchClass; mode: Mode }
export interface Chord { root: PitchClass; quality: ChordQuality; extensions?: Array<9|11|13|'b9'|'#9'|'#11'|'b13'> }
export interface ChordSlot { chord: Chord; roman: string; beats: number }   // beats within the loop
export interface Progression { id: string; key: Key; bpm: number; swing: number; bars: number; slots: ChordSlot[]; style: StyleId; family: string }
export type StyleId = 'chillhop-rhodes'|'boombap-soul'|'lofi-house'|'dorian-synth'

export type NoteClassification = 'chord-tone'|'tension'|'avoid'|'outside'

export type InputSource = 'midi'|'touch'|'mic'
export interface NoteEvent {
  kind: 'on'|'off'
  note: MidiNote
  velocity: number           // 0..1; 1.0 when the source has no velocity
  perfTs: number             // performance.now() domain
  source: InputSource
  confidence?: number        // mic only
}

export interface TimingOffset { note: MidiNote; targetTick: number; offsetMs: number; source: InputSource; calibrated: boolean }
```

#### `src/theory/*` (pure, Vitest-covered)

```ts
chordTones(chord): PitchClass[]
availableTensions(chord, key): PitchClass[]
avoidNotes(chord, key): PitchClass[]
classify(note: MidiNote, chord: Chord, key: Key): NoteClassification
guideTones(chord): { third: PitchClass; seventh: PitchClass }
commonTones(a: Chord, b: Chord): PitchClass[]
voiceLead(a: Chord, b: Chord): Array<{ from: PitchClass; to: PitchClass; semitones: number }>
degreeName(pc: PitchClass, key: Key): string          // '1', 'b3', '#4'…
realize(roman: string, key: Key): Chord               // 'ii', 'V7', 'bVII', 'ivm7'
pentatonic(key): PitchClass[]
```

Test fixtures: F minor ii°–V7–i–VI, G dorian i–IV, C major I–V–vi–IV, A minor pedal. Assert pitch-class sets, not note names.

#### `src/audio/VirtualPushSynth.ts`

```ts
export interface VirtualPushSynth {
  load(p: Progression): void
  setMask(parts: { drums: boolean; bass: boolean; chords: boolean }): void   // A1 wants bass only, etc.
  currentSlot(audioTime: number): { slot: ChordSlot; index: number }
  chordChangeTimes(): number[]                                              // audio times within the loop, for A0 scoring
  dispose(): void
}
```

Sounds: Tone `MembraneSynth`/`NoiseSynth` drums, `MonoSynth` bass, `PolySynth(FMSynth)` Rhodes-ish voicings in a fixed register (so the "lowest note" is actually the bass). Swing from Transport. Drum patterns per style are data, not code (`drumPatterns.ts`).

#### `src/input/NoteInput.ts`

```ts
export interface NoteInputSource { id: InputSource; available(): Promise<boolean>; start(): Promise<void>; stop(): void; onNote(cb: (e: NoteEvent) => void): Unsubscribe }
export class NoteBus { register(src: NoteInputSource): void; active(): InputSource[]; onNote(cb): Unsubscribe }
```

Modules subscribe to the bus; they never know which physical thing produced the note.

#### `src/input/MidiBridge.ts`

```ts
export interface MidiBridge extends NoteInputSource {
  requestAccess(): Promise<'granted'|'denied'|'unsupported'>
  ports(): { inputs: PortInfo[]; outputs: PortInfo[] }            // Field shows up by name; let the user pick anyway
  select(input?: string, output?: string): void
  clockOut(enabled: boolean, transport: TransportEngine, clock: ClockBridge): void   // §3.4
  follower(): ExternalClockFollower                                // §3.5
  onConnectionChange(cb): Unsubscribe
}
```

Spine ships a `FakeMidiPort` (in `src/input/__fakes__`) so Vitest can assert that 24 pulses per quarter are scheduled at the right timestamps without hardware.

#### `src/state/db.ts`

Stores: `sessions` (lesson id, started/finished, scores), `attempts` (per-drill granular results incl. `TimingOffset[]`), `samples` (user audio blobs + detected key/root), `kits` (compiled kit metadata), `calibration`. `DB_VERSION = 1` with an upgrade switch from the start. Export/import as one JSON (+ blobs zipped later; not in spine).

### 5.4 UI primitives (spine)

- **AppShell**: bottom nav on phones, side nav on desktop; routes from `registry.ts`; `/dev/spine` hidden unless `?dev`.
- **Keyboard24**: 24 keys F…E. On viewports < 700 px wide, render **one octave with an octave toggle** so keys stay ≥ 40 px; landscape phone shows all 24. Keys light from `NoteBus` and colour by `NoteClassification` when a chord is supplied.
- **StatusBar**: BPM, clock mode (`internal` / `clock out` / `follow`), MIDI port name or "no MIDI", active input source, calibration state (✓ / needs calibration).
- **Encoder**: a touch dial with the four TE colours; used by Module 2 and the synth mixer.

### 5.5 Module contracts

Each module directory contains `module.ts` exporting:

```ts
export const module: ModuleDefinition = { id, route, title, icon, component: lazy(() => import('./View')), phase: 1|2|3|4 }
```

Registration is automatic (`import.meta.glob`). No module touches `registry.ts`.

| Module | Owns | Consumes from spine | Done when |
| :--- | :--- | :--- | :--- |
| **1 Progression Trainer** | Levels A0–A6, masked chord blocks, reveal cards, voice-leading map | Transport, VirtualPushSynth, theory, NoteBus, Keyboard24, db | All seven levels run unplugged on the phone with touch input; scores persist; a MIDI note from the Field lights the same key path as a touch |
| **2 Sample Flip** | File picker → `samples` store, sampler view with 4 encoders (pitch semis+cents / start / end / level+filter), backing in a chosen key, "Check My Flip" with ranked consonant landings, micro-chop card | Transport, VirtualPushSynth, theory, KeyEstimate, PitchWorklet, MicInput, Encoder, db | Flip a pitched sample to ≥3 consonant landings with explanation; on desktop, route sample to a chosen output device |
| **3 Pocket Dojo** | Calibration routine (B0), radar canvas, levels B1–B5, swing % measurement, recipe cards B6 | Clock, Transport, NoteBus (all three sources), calibration store, db | Offsets within ±3 ms of ground truth with `FakeMidiPort` in tests; on real Field over USB, a human confirms "snare late" drills feel right |
| **4 Kit Compiler** | Drop/pick up to 24 slices, trim/normalise, optional 2× pack, slice markers from one long sample, AIFF + `op-1` chunk writer, download | KeyEstimate, db | Produces a kit the Field loads with correct per-key slices (**blocked on §8 spike**) |
| **5 Runner** | Lesson loader, 15-minute flow (0–4 A, 4–9 B, 9–15 C/D card), streaks, markdown summary export | lessons.json, db, all module routes | A full session can be completed start to finish and logged |

`docs/MODULE_CONTRACT.md` repeats: own only your directory; import only from spine; add tests for anything pure; never add dependencies without listing them in your PR description; run `npm run check` (tsc + vitest + build) before reporting done.

---

## 6. Build workflow: spine first, fan out second

### 6.1 Phase 1 — Spine (one agent, Opus 5.5, high effort, single session)

Deliverables, in order:

1. Scaffold: Vite + React 19 + TS strict + Tailwind v4 + vite-plugin-pwa + Vitest; `deploy-pages.yml`; `CLAUDE.md` (conventions, `npm run check`, the import rules, the VERIFY policy); `docs/HARDWARE_NOTES.md` seeded from §2.
2. `src/types/music.ts`, `src/types/lessons.ts`.
3. `src/theory/*` with tests (fixtures in §5.3). **This is the first thing to get right**; everything in Vector A depends on `classify`.
4. `src/audio/Clock.ts`, `TransportEngine.ts`, `VirtualPushSynth.ts` (one style is enough; the others are data).
5. `src/input/NoteInput.ts`, `MidiBridge.ts` (+ `FakeMidiPort`), `TouchInput.ts`. `MicInput` and `PitchWorklet` can be stubs that compile and throw `NotImplemented` — they belong to Module 2/3 agents.
6. `src/state/db.ts`, `settings.ts`, `calibration.ts`.
7. `src/ui/*` primitives + `registry.ts` + `/dev/spine`.
8. `/dev/spine` shows: start/stop a loop, BPM, swing, mask parts, Keyboard24 lighting from touch and MIDI, MIDI port picker, clock-out toggle, and a scrolling log of pulse-timestamp jitter and raw `NoteEvent`s.

**Exit criteria:** `npm run check` green; GitHub Pages serves the shell; the human opens `/dev/spine?dev` on the phone, hears a swung loop, taps keys and sees them light, and (optionally) plugs the Field in and sees its notes light the same keys. The agent's final report lists every VERIFY item it hit and what it stubbed.

Do **not** let the spine agent start Module 1 "because it's close." The point of the gate is a human sanity pass on timing before five agents build on it.

### 6.2 Phase 2 — First fan-out (parallel, worktree per lane)

| Lane | Agent | Output |
| :--- | :--- | :--- |
| Curriculum content | Opus 5.5 | `docs/CURRICULUM.md`, `progressions.json` (≥12 progressions across families and both major/minor), `sequencerRecipes.json`, `lessons/*.json` for A0–A6, B0–B6, C1–C3, D cards. Pure content; validated against `types/lessons.ts` by a schema test |
| Module 1 | Sonnet 5.5 or Opus 5.5 | Progression Trainer |
| Module 5 | Sonnet 5.5 | Runner (can stub links to modules 2–4) |

Merge order: curriculum → Module 1 → Runner. **Exit:** the daily-use target in §1.

### 6.3 Phase 3 — Hardware gate, then Module 3

Human runs the hardware checklist (`docs/HARDWARE_NOTES.md`): Field in sync mode follows app clock-out; tape speed matches; notes arrive with velocity 127 (velocity off) and varying (velocity on); phone doesn't drain; audio routing behaves as §2.2 says. Record results in the notes. Then one agent builds Module 3 (including `MicInput`/`PitchWorklet` if not yet done, since the Dojo needs transients).

### 6.4 Phase 4 — Format spike, then Modules 2 and 4

Spike first (§8.1), as a throwaway script in `scripts/`. Only once a generated kit loads on the Field with correct slices do Modules 2 and 4 fan out in parallel.

### 6.5 Orchestration rules for the fan-out session

- One worktree/branch per lane; PRs to `main`; CI must be green; the orchestrator reviews diffs for spine edits (**any change under `src/{types,theory,audio,input,state,ui}` by a module agent is a review flag**, not auto-merge — if a module needs a spine change, it files it as a separate small PR with a reason).
- Module agents receive: this spec, `MODULE_CONTRACT.md`, their row of §5.5, and the current `HARDWARE_NOTES.md`. Nothing else.
- Agents report: what's done, what's stubbed, what VERIFY items they touched, how to smoke-test on a phone.

### 6.6 Prompt for the spine agent

> Implement **Phase 1 (Spine)** of `docs/SPEC.md` exactly as listed in §6.1, in that order. Read §0, §2, §3 and §5.3 first. Theory functions ship with the Vitest fixtures in §5.3 before any audio code is written. Do not start any module other than `dev-spine`. Do not resolve any VERIFY item by assumption; stub behind the interface and list it in your final report. Finish with `npm run check` green and a deployable GitHub Pages build. Final report: what exists, what is stubbed, VERIFY items encountered, and the exact steps for a human to smoke-test `/dev/spine?dev` on an Android phone with and without the OP-1 Field attached.

### 6.7 Prompt template for a module agent

> You own `src/modules/<name>/` and nothing else. Implement **Module N** per `docs/SPEC.md` §5.5 and your lane in §6.x, following `docs/MODULE_CONTRACT.md`. Import only from the spine. If the spine is missing something you need, stop and describe the minimal spine change in your report instead of making it. Add Vitest tests for every pure function you write. Finish with `npm run check` green and a short phone smoke-test script.

---

## 7. Verification matrix

| Layer | How | Where it runs |
| :--- | :--- | :--- |
| Theory, key estimate, clock math, AIFF chunk writer, lesson JSON schema | Vitest | CI |
| MIDI clock scheduling (24 pulses/quarter, timestamps monotonic, start/stop bytes) | Vitest with `FakeMidiPort` + fake `ClockBridge` | CI |
| Audio plays without clicks, keys light, latency readout | `/dev/spine` + human | Phone & desktop |
| Field follows clock; tape speed; note velocity behaviour; USB audio routing; charging | Hardware checklist in `HARDWARE_NOTES.md` | Human, Phase 3 gate |
| Kit loads with correct slices | Spike script + Field | Human, Phase 4 gate |
| Lesson flow end-to-end | Manual session | Human, end of Phase 2 |

---

## 8. Open questions and spikes (do not guess)

### 8.1 Field drum-kit AIFF format (blocks Module 4)

Known: AIFF container, `APPL` chunk, payload `op-1` + JSON with `"type":"drum"`, per-key `start`/`end` arrays, 20 s stereo max, mono capped at 12 s. **Unknown for the Field:** the unit scale of `start`/`end` (the original OP-1 used a fixed-point scale that appears tied to its 12 s mono limit), whether the Field writes `sowt` little-endian AIFF-C or big-endian AIFF and accepts both, exact key→index order for 24 keys, and which optional fields are required. **Spike:** copy a factory kit and a user-recorded kit off the Field in disk mode, dump both chunks, derive the scale from a kit whose slice points you set on-device at known times, write a kit, load it, confirm. Document in `HARDWARE_NOTES.md`.

### 8.2 Factory drum key layout

Which key is kick/snare/hat in TE's stock kits (use the §8.1 dump). Becomes the default `DrumLayout` in settings.

### 8.3 Charging over phone USB-C host

Whether the Field can be told not to charge from the host, and how much a typical phone drains per hour of drilling. Affects the connect-time warning copy.

### 8.4 Velocity source

Whether velocity on the Field is accelerometer-based (affects how the "velocity bands" drill is described; irrelevant to code).

### 8.5 Web MIDI jitter on the target phone

Measured by `/dev/spine`. If p95 scheduling error is > 3 ms on the target device, drop app-as-master for jams and lead with the follower path (§3.5).

### 8.6 Clock-in behaviour on transport start

Whether the Field needs clock pulses before `0xFA` to lock tempo without a lurch on bar 1. Observed in the Phase 3 gate.

---

## 9. Sources

- TE: OP-1 original MIDI sync modes and message table — https://support.teenage.engineering/hc/en-us/articles/360023510434
- TE firmware notes via Soundtech (velocity off/soft/hard; tape speed follows external clock; pre-tape panning; line-in mono/stereo) — https://soundtech.co.uk/music-retail/teenageengineering/news/free-software-update-adds-velocity-sensitivity-to-teenage-engineering-op-1-field
- MusicRadar on the velocity update (accelerometer theory) — https://musicradar.com/news/teenage-engineering-op-1-field-velocity-sensitive
- OP-1 AIFF `APPL` chunk layout — https://marble-nation-afd.notion.site/AIFF-APPL-Chunk-Header-Format-51233bdb0e914c979222978a01bc9d3c
- OP-1 drum patch reverse engineering — https://schollz.com/blog/op1
- Field 20 s stereo / 12 s mono AIFF kit limits — https://equipboard.com/items/xfer-records-op-1-drum-utility
- `op1-drumkit-reader` (reference parser) — https://github.com/brentvatne/op1-drumkit-reader
