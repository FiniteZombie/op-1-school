# OP-1 Field Live Jam & Improvisation System: Curriculum & GitHub PWA Specification

## 1. System Vision: A Mobile-First GitHub PWA Bridges Hardware Jamming and Structured Ear Training

Playing a [Teenage Engineering OP-1 Field](https://www.google.com/search?q=https%3A%2F%2Fteenage.engineering%2Fproducts%2Fop-1) alongside friends on an [Ableton Push](https://www.google.com/search?q=https%3A%2F%2Fwww.ableton.com%2Fen%2Fpush%2F) or hardware groovebox requires a distinct musical mindset. While the Push excels at quantized grid loops, pad progressions, and step-sequenced drums, the OP-1 Field shines as a tactile, unquantized tape workstation, live sampler, and sonic sculptor.

This specification defines a two-part system designed to be reviewed, refined, and built by an autonomous coding agent such as [Claude Code](https://www.google.com/search?q=https%3A%2F%2Fcode.claude.com%2Fdocs%2Fen%2Foverview):

1. **A 4-Track Improvisation Curriculum (`CURRICULUM.md` + Interactive JSON Modules):** A structured lesson and drill framework focused on functional ear training inside a known key, laid-back finger drumming and OP-1 sequencer idioms, chill-hop/boom-bap sample adaptation, and OP-1 Field live performance techniques.
2. **"FieldJam" — A Serverless Progressive Web App (PWA) Hosted on GitHub Pages:** A multi-file web application built with [Vite](https://www.google.com/search?q=https%3A%2F%2Fvite.dev%2Fguide%2Fstatic-deploy), TypeScript, and [Tone.js](https://www.google.com/search?q=https%3A%2F%2Ftonejs.github.io%2F) that runs natively on both an **Android phone** and a **desktop PC**, connecting directly to the OP-1 Field over a single USB-C cable (or operating standalone via speaker/microphone).

| Architectural Requirement | Design Decision | Why It Fits Your Workflow |
| :--- | :--- | :--- |
| **Cross-Device Access (Android + PC)** | Static PWA deployed to **GitHub Pages** via GitHub Actions using [Vite PWA](https://www.google.com/search?q=https%3A%2F%2Fvite-pwa-org.netlify.app%2F) | Opens instantly on your Android phone next to the OP-1 Field or on your PC browser; installs to the Android home screen and works offline via Service Workers |
| **Cloud & Local Agentic Development** | Pure client-side TypeScript repository with zero backend server dependencies | Allows [Claude Code](https://www.google.com/search?q=https%3A%2F%2Fcode.claude.com%2Fdocs%2Fen%2Foverview) (locally on PC or in the cloud against GitHub) to build modules, run tests, push commits, and trigger automatic GitHub Pages deployments |
| **Hardware Connectivity** | Dual-mode I/O: [Web MIDI API](https://www.google.com/search?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FAPI%2FWeb_MIDI_API) + Web Audio USB-C Input, plus an Unplugged Audio/Mic fallback | Chrome on Android and PC natively supports USB-C MIDI and class-compliant stereo USB audio from the OP-1 Field over `HTTPS` on GitHub Pages |
| **Jam Clock Synchronization** | Supports both **Manual BPM Matching** (with phase-nudge drills) and **USB MIDI Clock Sync** (`0xF8` at 24 PPQN) | Mirrors your exact real-world jam setups with Push players—whether dialing in a shared BPM by hand or syncing over a cable |
| **Persistent Progress & Sample Storage** | Browser-native `IndexedDB` + `localStorage` with JSON export/import | Stores drill history, ear-training accuracy, uploaded sample chops, and 20-second OP-1 drum kits locally on your phone or PC without needing a cloud database |

## 2. Hardware Signal Flow & Clock Sync Architecture

Because the [OP-1 Field User Guide](https://www.google.com/search?q=https%3A%2F%2Fteenage.engineering%2Fguides%2Fop-1) specifies that the unit operates as a class-compliant USB-C audio interface (2-in / 2-out stereo audio) and USB MIDI device simultaneously, connecting an Android phone or PC via a USB-C cable unlocks bidirectional interaction alongside an unplugged practice mode.

| Operating Mode | Physical Setup | Clock Sync Behavior | App Feedback Mechanism |
| :--- | :--- | :--- | :--- |
| **Mode 1: Unplugged Couch Mode** | Android phone or PC playing through built-in speakers/headphones; OP-1 Field unplugged | **Manual BPM Match:** App displays target BPM (e.g., `86 BPM`); you set OP-1 Field tempo manually and practice dropping in on Bar 1 Beat 1 | Self-verification reveal cards + optional phone microphone pitch/transient listening via [McLeod Pitch Method](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fsevagh%2Fpitch-detection%2Fblob%2Fmaster%2Fmisc%2Fmcleod%2FREADME.md) |
| **Mode 2: USB-C Linked Trainer Mode** | Single USB-C to USB-C cable between Android phone (or PC) and OP-1 Field | **Wired MIDI Clock (`24 PPQN`):** App sends MIDI Clock (`0xF8`) and Transport Start/Stop (`0xFA`/`0xFC`) via [Web MIDI API](https://www.google.com/search?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FAPI%2FWeb_MIDI_API), or acts as MIDI Clock follower | Real-time MIDI note detection highlights your played scale degrees, chord tones, and finger-drumming micro-timing offsets in milliseconds |
| **Mode 3: Sample Stream & Kit Transfer Mode** | USB-C cable connected in Audio/MTP disk mode | Free or locked tempo | Streams raw jazz/soul/vocal practice loops directly into the OP-1 Field's USB audio input for live on-device slicing, or exports compiled 20-second WAV kits to drag into `drum/user` |

## 3. Curriculum Blueprint: Four Vectors Integrated into Progressive Jam Loops

Rather than separating music theory from hardware muscle memory, the lesson plan should be structured into **four progressive tracks**, where each lesson consists of a **15-minute guided drill** pairing an interactive app challenge with a physical OP-1 Field workflow.

### Vector A: Harmonic Navigation Reduces the "Lost in the Key" Bottleneck

When jamming with a Push player, knowing the global key (e.g., F Minor or G Dorian) is only step one. The real challenge is identifying **which chord degree is active right now**, **how fast the harmonic rhythm moves**, and **which notes resolve cleanly**.

* **Isolate the Bass Root Movement First:** Train your ear to ignore dense upper synth pad extensions and lock onto the lowest note played by the Push. Focus on recognizing the four high-frequency chill-hop/electronic movement shapes within a known key:
  * **The Boom-Bap Pendulum (2-Chord Modal Vamp):** `i <-> iv` (Minor) or `i <-> IV` (Dorian, e.g., Fmin7 to Bb7), where a single shared guide tone (such as the 7th of `i` becoming the 3rd of `IV`) bridges the entire jam.
  * **The Jazz-Hop Turnaround:** `ii -> V -> I -> VI` (or minor `ii° -> V7 -> i -> VI`), training your ear to hear the dominant `V7` tension pulling back to Bar 1.
  * **The Cinematic Walkdown:** `i -> VII -> VI -> V7` (or `i -> VI -> III -> VII`), tracking stepwise bass motion.
  * **The Neo-Soul Pedal Point:** Shifting upper triad shapes over a static root bass note.
* **Target Guide Tones (3rds and 7ths) Over Full Scales:** Running 7-note scales up and down the OP-1's 24-key mini-keyboard often sounds noodle-y and loses the chord changes. Drills will train you to place two fingers on the **3rd and 7th** of the current chord—the two notes that define its harmonic identity—and move them by a single semitone or whole step when the chord shifts.
* **Map 4-Bar and 8-Bar Phrase Contours:** Practice structured melodic call-and-response (e.g., playing a 2-note rhythmic motif on Bars 1–2, leaving space on Bar 3 while the Push fills, and playing a tension-building turnaround phrase on Bar 4 Beats 3–4).

### Vector B: Rhythm, Finger Drumming & OP-1 Sequencer Fluency Build a Pocket That Complements the Push

Because the Push player usually runs quantized 16th-note grids or Ableton groove templates, your OP-1 rhythms will stand out best when they either add **humanized micro-timing** or **interlocking polyrhythmic modulation**.

* **Master the 3-Finger Chill-Hop / J Dilla Pocket:** Practice unquantized finger tapping directly to the OP-1 tape using a standardized two-hand layout (Left hand: Kick on `C`, Snare/Rim on `D` or `E`; Right hand: Closed Hat on `F#`, Open Hat on `G#`, Percussion/Chop on `A#`):
  * **The Laid-Back Snare:** Hitting Beats 2 and 4 intentionally `15ms–30ms` behind the click while keeping the Beat 1 Kick dead on the grid.
  * **Swung Ghost Kicks & Velocity Hats:** Alternating index and middle fingers on hi-hats for natural velocity bounce (`loud-soft-loud-soft`) and tucking a soft pickup kick just before Beat 3 (`2-and-a`).
* **Deploy OP-1 Sequencers One-Handed in Live Jams:**
  * **Finger Sequencer for Live Drum Switching:** Pre-load 6 variations of a drum groove (A: Stripped Kick/Snare, B: Full Boom-Bap, C: Hat Drop, D: Snare Roll Fill, E: Half-Time, F: Percussion Breakdown) onto different white keys in `Finger` mode (`Hold` enabled) so you can trigger arrangement switches with one finger while tweaking the synthesizer or tape with the other hand.
  * **Endless Sequencer for Polyrhythmic Melodic Motifs:** Program 5-step, 6-step, or 7-step melodic sequences with intentional rests (`Shift` + right arrow) that phase organically against the Push's 4-bar loop, paired with the `Random` or `Element` LFO modulating filter cutoff.
  * **Arpeggiator & Tombola for Textural Beds:** Use sparse, non-grid Tombola bounces in the upper octave to create ambient ear candy that never clashes with the Push's drum transient grid.

### Vector C: Sample Prep, Live Splicing & Harmonic Adaptation Unlock Dilla / MF DOOM Flip Workflows

Incorporating pre-recorded soul/jazz/vocal chops and slicing live audio on the fly requires combining **ear-based pitch matching** with **fast OP-1 tape and sampler muscle memory**.

* **Adapt Out-of-Key Samples Using Three Practical Ear Strategies:**
  * **Strategy 1 — Hum-and-Match Root Transposition:** Hum the dominant sustained pitch or bass center of your sample, tap the OP-1 keyboard to find which note matches your voice, and count the semitones needed to reach the root, 5th, or relative minor/major of the jam's key. Use the OP-1 sampler pitch encoder (`Shift` + Blue encoder for semitones, unshifted for fine cents) to lock it in.
  * **Strategy 2 — Relative & Fifth Re-Contextualization (Avoiding "Chipmunk" Pitch Shifts):** If shifting a sample by `+7` semitones ruins its timbre, shift it by `0`, `-2`, or `+3` semitones so its internal root lands on the **5th**, **9th**, or **relative minor/major** of the jam's key—the classic 90s boom-bap technique for lush, dusty harmonic tension.
  * **Strategy 3 — Micro-Chopping Around Internal Chord Changes:** When a sample contains its own chord progression that clashes with the Push, slice it into tight `150ms–400ms` single-chord hits across the OP-1 Drum Sampler keys and replay those slices in a new order that follows the jam's chord changes.
* **Execute Live Tape Splicing & On-the-Fly Resampling:**
  * **The 4-Track Live Jam Template:** Standardize your tape tracks so you never lose track of what is playing (Track 1: Drums/Percussion; Track 2: Bass/Sub; Track 3: Sample Chops / Chord Stabs; Track 4: Live Lead / Vocal Quotes / Resample Scratchpad).
  * **The 10-Second Live Resample Loop:** Set the Drum Sampler input to `Output` (ear icon) or `USB/Line-In`, capture a 4-bar phrase while tweaking master effects, let the OP-1 auto-slice or manually adjust slice points with the encoders, and immediately sequence a chopped variation back onto Track 3.
  * **Live Tape Loop Juggling:** Use `Lift` and `Drop` with `Shift` + Arrow keys to duplicate a 4-bar section, slice beats into stutter edits using `Split` (`Shift` + Mic button), and solo/mute tracks instantly from the Mixer view (`T1–T4` buttons).

### Vector D: OP-1 Field Hardware Superpowers Create Transitions and Textures a Push Cannot Replicate

Instead of competing with the Push on things it already does well, the final curriculum track trains you to perform the signature moves unique to the [OP-1 Field](https://www.google.com/search?q=https%3A%2F%2Fteenage.engineering%2Fproducts%2Fop-1):

* **Perform With Tape Speed & Mechanical Tricks:** Drop the tape to `1:2` half-speed, record a fast synth arpeggio an octave lower, and return to `1:1` for instant double-speed sparkling textures; use `M1` / `M2` tape brake stops and pitch nudges at the end of 8-bar phrases for DJ-style transitions.
* **Ride the Mother Reverb, Spring & Nitro Filter Live:** Map the **Element LFO** (using the G-Force accelerometer `G` source) to the **Nitro** bandpass/lowpass filter or synth timbre so physically tilting the OP-1 Field adds expressive wah/filter movement during solos.
* **Deploy Dual-Layer / Stereo Panning & Master Drive:** Use per-track stereo panning on the 4-track mixer and dial in warm master bus compression (`Drive` + `Release`) so your OP-1 cuts cleanly through the mid-range without muddying the Push's sub-bass.

## 4. Technical Specification: "FieldJam" Progressive Web App

The companion software should be architected as a modular, mobile-responsive single-page application (SPA) with PWA offline support, stored in a GitHub repository and automatically deployed to **GitHub Pages**.

### 4.1 Recommended Tech Stack & Libraries

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Build & Bundler** | [Vite](https://www.google.com/search?q=https%3A%2F%2Fvite.dev%2Fguide%2Fstatic-deploy) + React 19 + TypeScript | Fast builds, strict typing for audio/MIDI state machines, and out-of-the-box GitHub Pages static deployment |
| **PWA & Offline Support** | [Vite PWA (vite-plugin-pwa)](https://www.google.com/search?q=https%3A%2F%2Fvite-pwa-org.netlify.app%2F) | Caches app shell, synth presets, and bundled practice loops so the app runs offline on an Android phone |
| **Synthesis & Loop Engine** | [Tone.js](https://www.google.com/search?q=https%3A%2F%2Ftonejs.github.io%2F) + Native Web Audio API | Provides sample-accurate transport scheduling (`Tone.Transport`), swing quantization, FM/Rhodes chord synths, and drum samplers |
| **Hardware MIDI I/O** | Native [Web MIDI API](https://www.google.com/search?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FAPI%2FWeb_MIDI_API) | Zero-dependency access to OP-1 Field MIDI notes, CC encoders, and `24 PPQN` MIDI clock output on Android Chrome and Desktop Chrome |
| **Pitch & Key Analysis** | Web Audio `AnalyserNode` + [McLeod Pitch Method (MPM)](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fsevagh%2Fpitch-detection%2Fblob%2Fmaster%2Fmisc%2Fmcleod%2FREADME.md) & optional [Essentia.js](https://www.google.com/search?q=https%3A%2F%2Fmtg.github.io%2Fessentia.js%2F) WASM | Lightweight real-time monophonic pitch detection for humming/playing into the mic or USB audio, plus spectral key estimation for uploaded samples |
| **UI & Visual Design** | Tailwind CSS + HTML5 Canvas | High-contrast Teenage Engineering "Field" aesthetic (warm aluminum dark/light theme with color-coded **Blue, Ochre, Gray, and Orange** indicators matching the OP-1 Field's four physical encoders) |

### 4.2 Core Interactive App Modules

#### Module 1: "Virtual Push" Blind Progression & Guide-Tone Trainer
* **Goal:** Solve the *"I know the key, but where are we in the progression?"* problem.
* **How It Works:**
  1. You select a style (`Chill-Hop Rhodes`, `Boom-Bap Soul`, `Lo-Fi House`, `Dorian Synth Jam`), a BPM (`70–120 BPM`), and a Clock Sync mode (`Manual BPM` or `USB MIDI Clock`).
  2. The app announces the **Global Key** upfront (e.g., `Key: C Minor • 88 BPM`) and starts a 4-bar loop with drums, bass, and chords—but masks the chord blocks as `[ ? ] -> [ ? ] -> [ ? ] -> [ ? ]`.
  3. **Interactive Ear Drill:** You use the on-screen 24-key OP-1 keyboard (or play your physical OP-1 Field over USB-C) to find the **Bass Root** and **Guide Tones (3rd/7th)** for each of the 4 bars.
  4. **Real-Time Visual Feedback:** When connected via USB MIDI or USB Audio, a virtual 24-key OP-1 strip on your phone screen lights up as you play, scoring whether your notes land on **Chord Tones (Green)**, **Scale Tensions (Blue)**, or **Clashing Avoid Notes (Orange)** for the active bar, before revealing the full progression shape and voice-leading map.

#### Module 2: Sample Flip & Key-Adaptation Sandbox
* **Goal:** Train your ear to take an out-of-key melodic or vocal sample and adapt it to a live jam's key and tempo.
* **How It Works:**
  1. The app plays a target backing beat in a known key (e.g., `A Minor at 84 BPM`) and loads a "mystery sample slice" (either from bundled royalty-free jazz/soul loops or from your own local audio folder) pitched at a randomized semitone/cent offset.
  2. Using an on-screen **OP-1 Sampler Interface** (with touch sliders mapped to **Blue: Pitch/Semitones + Cents**, **Ochre: Start Point**, **Gray: End/Loop Point**, **Orange: Level/Filter**—or by streaming the raw sample out over USB-C into your real OP-1 Field), you pitch and chop the sample by ear until it fits the groove.
  3. Tapping **Check My Flip** shows your transposition offset against the harmonic target, explaining *why* your choice works (e.g., *"You pitched the sample `-3 semitones`, aligning its root to the 5th degree (`E`) of A Minor, creating a classic Dorian 9th texture"*).

#### Module 3: Dilla Pocket & Micro-Timing Dojo
* **Goal:** Build consistent unquantized finger-drumming feel and OP-1 sequencer muscle memory.
* **How It Works:**
  1. Displays a 1-bar or 2-bar timing radar with customizable target zones (e.g., `Straight Grid`, `J Dilla Drunk Swing (+22ms snare lag, 58% 16th swing)`, or `Boom-Bap Pocket`).
  2. Listens to your finger drumming via OP-1 USB MIDI notes (or tapping on the phone screen / microphone transients) and plots each Kick, Snare, and Hi-Hat hit in milliseconds ahead of (`-ms`) or behind (`+ms`) the beat.
  3. Includes an **OP-1 Sequencer Recipe Drawer** with interactive step visualizers showing exact button presses to build complex grooves on the Endless, Finger, and Pattern sequencers.

#### Module 4: 20-Second OP-1 Field Drum Kit & Sample Pack Compiler
* **Goal:** Eliminate sample-prep friction before a jam session.
* **How It Works:**
  1. Drop up to 24 short music slices, chord stabs, drum hits, or MF DOOM-style voice lines into the browser on your phone or PC.
  2. The app auto-detects the pitch/key of each slice, normalizes gain, trims silence, and packs them sequentially into a single **stereo 44.1kHz WAV file under the OP-1 Field's 20-second Drum Sampler limit** (with optional pitched-up `2x` speed packing to fit 40 seconds of lo-fi audio into 20 seconds).
  3. Exports the `.wav` file directly to your device so you can drag it into the OP-1 Field's `drum/user` directory over USB-C.

#### Module 5: Curriculum Runner & 15-Minute Practice Coach
* **Goal:** Guide daily solo practice and 10-minute pre-jam warmups without decision fatigue.
* **How It Works:**
  1. Loads structured markdown/JSON lessons from the repository (`src/curriculum/lessons/`).
  2. Runs a timed **15-Minute Session Flow**:
     * `Minutes 0–4:` Blind Progression Ear Warmup (Module 1)
     * `Minutes 4–9:` Finger-Drumming Pocket or Sequencer Recipe Drill (Module 3)
     * `Minutes 9–15:` Sample Adaptation & Live Tape Splicing Challenge on the OP-1 Field (Module 2)
  3. Logs completion streaks and ear-training accuracy in `IndexedDB` and generates a concise Markdown summary you can paste into a companion Gemini Gem or Claude chat for personalized coaching.

### 4.3 Proposed Repository Directory Structure

```text
op1-field-jam-trainer/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml         # Auto-builds & deploys Vite PWA to GitHub Pages on push to main
├── docs/
│   ├── SPEC.md                      # This master architectural & curriculum specification
│   ├── CURRICULUM.md                # Full 4-track lesson plan & OP-1 Field cheat sheets
│   └── COMPANION_AGENT_PROMPT.md    # System prompt for a companion Gemini Gem / NotebookLM / Claude Project
├── public/
│   ├── manifest.webmanifest         # Android PWA install manifest
│   └── samples/                     # Bundled royalty-free chill-hop/jazz/vocal practice slices
├── src/
│   ├── audio/
│   │   ├── TransportEngine.ts       # Tone.js loop scheduler, swing controller & BPM clock
│   │   ├── VirtualPushSynth.ts      # Procedural drum, bass, and Rhodes chord progression generator
│   │   ├── MidiBridge.ts            # Web MIDI API connection, 24 PPQN clock sender & note listener
│   │   ├── PitchDetector.ts         # McLeod Pitch Method & key estimation for audio/mic input
│   │   └── KitCompiler.ts           # Browser-side 20-second stereo WAV concatenator for OP-1 Field
│   ├── components/
│   │   ├── ProgressionTrainer/      # Module 1 UI + 24-key OP-1 mini-keyboard visualizer
│   │   ├── SampleFlipLab/           # Module 2 UI + 4-color OP-1 encoder controls
│   │   ├── PocketDojo/              # Module 3 micro-timing offset visualizer & sequencer recipes
│   │   ├── KitExporter/             # Module 4 drag-and-drop 20s OP-1 kit builder
│   │   └── CurriculumRunner/        # Module 5 guided 15-minute session timer & lesson cards
│   ├── curriculum/
│   │   ├── progressions.json        # Curated chill-hop, neo-soul, Dorian, and boom-bap progressions
│   │   ├── sequencerRecipes.json    # Step-by-step Endless, Finger, and Tape splicing drills
│   │   └── lessons/                 # Structured markdown lesson content across all 4 vectors
│   ├── state/
│   │   └── db.ts                    # IndexedDB persistence for user progress & custom sample kits
│   ├── App.tsx
│   └── main.tsx
├── CLAUDE.md                        # Agent instructions, coding conventions & build/test commands
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 5. Phased Implementation Plan for Agentic Execution

To keep implementation clean and verifiable when handing this off to [Claude Code](https://www.google.com/search?q=https%3A%2F%2Fcode.claude.com%2Fdocs%2Fen%2Foverview), the build should proceed in four self-contained milestones:

| Milestone | Deliverable Scope | Verification Criteria |
| :--- | :--- | :--- |
| **Phase 1: Curriculum Authoring & Repo Scaffolding** | Initialize Vite + React + TypeScript + Tailwind + [Vite PWA](https://www.google.com/search?q=https%3A%2F%2Fvite-pwa-org.netlify.app%2F) repo, configure `.github/workflows/deploy-pages.yml`, author `CLAUDE.md`, and write the complete 4-track curriculum (`CURRICULUM.md` + `progressions.json` + `sequencerRecipes.json`) | `npm run build` succeeds cleanly; GitHub Pages action deploys a mobile-responsive shell with browsable curriculum lessons and OP-1 Field workflow cards |
| **Phase 2: Virtual Push Audio Engine & Blind Progression Trainer** | Build `TransportEngine.ts` and `VirtualPushSynth.ts` using [Tone.js](https://www.google.com/search?q=https%3A%2F%2Ftonejs.github.io%2F); implement Module 1 (Blind Progression Trainer) with key/BPM display, masked chord blocks, interactive guide-tone hints, and on-screen 24-key OP-1 keyboard | Plays continuous swung drum + bass + Rhodes progressions smoothly on Android Chrome and Desktop without audio clicks; accurately scores root and guide-tone guesses |
| **Phase 3: Web MIDI / USB-C Audio Bridge & Pocket Dojo** | Implement `MidiBridge.ts` ([Web MIDI API](https://www.google.com/search?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fen-US%2Fdocs%2FWeb%2FAPI%2FWeb_MIDI_API) note input + `24 PPQN` MIDI clock output) and `PitchDetector.ts`; build Module 3 (Dilla Pocket & Micro-Timing Dojo) | Connecting OP-1 Field via USB-C to Android phone or PC syncs OP-1 tape tempo to the app and plots real-time MIDI key-press timing offsets in milliseconds |
| **Phase 4: Sample Flip Sandbox & 20-Second Kit Compiler** | Build Module 2 (Sample Key-Adaptation Lab with pitch/cent shifting and harmonic explanation) and Module 4 (`KitCompiler.ts` stereo 20-second WAV packer for `drum/user`) | Users can pitch-match mystery samples by ear against a backing loop and export a valid `<20s` stereo WAV drum kit ready for the OP-1 Field |

## 6. Handoff Prompt for Cross-Agent Architectural & Curriculum Review

Copy and paste the prompt below (along with this specification document) into Claude or your preferred coding agent to critique and kick off Phase 1:

> **Prompt for Reviewer / Implementation Agent:**
>
> I am designing a hybrid curriculum and Progressive Web App ("FieldJam") to improve my live improvisation on the Teenage Engineering OP-1 Field when jamming with friends who play Ableton Push and similar grooveboxes.
>
> Please review the attached specification (`op1_field_improv_master_plan.md`) across two dimensions before we begin writing code:
>
> 1. **Curriculum & Musical Pedagogy Critique:** Evaluate the 4-vector lesson structure (Harmonic Navigation in a Known Key, Dilla/Boom-Bap Pocket & OP-1 Sequencers, Sample Adaptation & Live Splicing, and OP-1 Field Hardware Superpowers). Suggest any high-leverage drills, voice-leading shortcuts, or OP-1 Field tape/sampler tricks that are missing or could be sequenced more effectively.
> 2. **Technical & Mobile UX Critique:** Evaluate the Vite + TypeScript + Tone.js + Web MIDI/Web Audio GitHub Pages PWA architecture for Android Chrome and Desktop PC. Identify any edge cases with Android Chrome Web Audio latency, Web MIDI clock jitter (`0xF8`), or OP-1 Field USB-C audio/sample formatting, and propose concrete mitigations.
>
> Do not write the application code yet—first give me your structured critique, proposed refinements to the spec, and a proposed outline for Phase 1 (`CURRICULUM.md` and repo initialization).
