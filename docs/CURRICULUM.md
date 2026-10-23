**Draft for the owner to edit:** every word of this page and of the lesson cards was written by an agent as a starting point.

# Curriculum

Four vectors, each a ladder of levels (SPEC §4). The app reads the
curriculum from `src/curriculum/`: one lesson per level in
`lessons/<vector><level>.json` (cards, then the level's drill),
`progressions.json` for the backing loops, `sequencerRecipes.json` for B6.
This page is the human-readable side: what each level trains and why.

A daily session is 15 minutes: A for 4, B for 5, then a C or D lesson for 6.
A level opens once the one below it has two finished drills at 70% or better
(or two finishes where nothing is scored).

**Field steps.** A card names a button or menu on the Field only when SPEC
§2 or §4 or `docs/HARDWARE_NOTES.md` states it. Anything else is written as
the musical idea plus `(field steps: VERIFY)`, waiting for the owner to fill
in from the device.

## Before any jam

Not an app drill. Before you play, *ask* the Push player for the key and the
progression, then listen for 8 bars before you join. Asking is a skill too;
the trainer is for when the answer is "uh, I just found pads I liked".

## A: harmonic navigation in a known key

Ear before fingers, and a safety net before guide tones. Drills run in the
progression trainer. The loops come from six families: modal pendulum,
jazz-hop turnaround, cinematic walkdown, pedal point, i–v–iv and I–V–vi–IV,
in major and minor keys so the ear doesn't over-fit to minor.

### A0: hear the harmonic rhythm

Tap each time the chord changes. Starts at 8 beats per chord and steps down
to 4, then 2, as you land the changes. Scored: tap time against change time.
Loop: C major `I V vi IV`.

### A1: bass root as scale degree

Drums and bass only; play the bass note of each chord, and the reveal names
it as a degree of the key. Push players voice densely, so this trains the
*lowest* note. Scored: the right bass note. Loop: E minor `i v iv`.

### A2: safety net, pentatonic

Two minutes on the key's pentatonic, marked on the keyboard. The point is
permission to make sound. Not scored: clashes are counted, nothing more.
Loop: D dorian `i7 IV7`.

### A3: chord quality

After the root, the quality: `maj7`, `7`, `m7`, `m7b5` or `sus`, heard
through the 3rd and the 7th. Scored: the right family. Loop: F minor
`iiø7 V7 i7 VImaj7`, one of each seventh quality.

### A4: common tones vs moving tone

For each pair of chords, the notes they share, then the one line that moves
(Fm7 to B♭m7: F and A♭ stay, E♭ falls to D♭). Scored: the right notes.
Loop: D minor `i7 v7 iv7`.

### A5: guide tones

Two fingers on the 3rd and 7th, moving by a half or whole step at each
change; the voice-leading map after the drill is the payoff. Scored: both
guide tones in each bar. Loop: C major `ii7 V7 Imaj7 vi7`.

### A6: target-note phrasing

A 2-bar phrase that ends on the 3rd of the next chord, on beat 1. Then the
jam shape, call and response: play bars 1–2, land on bar 3, rest, turnaround
in bar 4. Scored: the landing note and its timing (and, in call and
response, keeping the rest). Loops: G major `Imaj7 V7 vi7 IVmaj7` for the
phrase, F minor's turnaround for call and response.

## B: pocket, finger drumming, OP-1 sequencers

Drills score **placement**; the Field's velocity is coarse, so it's an
optional second axis at most. The drills are for feel you then record:
unquantized tape is where the OP-1 earns its keep next to a quantized Push.
Drills run in the pocket dojo (a later phase); until then the Runner shows a
stub. Which key plays the kick, snare and hats in a factory kit is VERIFY V2,
so the cards say `(field steps: VERIFY)` there.

- **B0, calibrate.** A click for 2 bars, 16 taps along, the median becomes
  the correction, per input. Velocity off first (Shift+Tempo). Not scored.
- **B1, kick on the grid.** Four-on-the-floor, then boom-bap; ±10 ms. Scored.
- **B2, laid-back snare.** Kick on the grid, snare on 2 and 4 at +15 to
  +30 ms. Scored.
- **B3, ghost kick.** A soft pickup on the `a` of 2, by placement; velocity
  shown if it's on. Scored.
- **B4, hat swing.** 16th hats at 54–62% swing, measured from every second
  16th. Scored.
- **B5, dilla drunk.** Kick straight, snare late, hats swung, together.
  Scored.
- **B6, sequencer recipes.** Step-by-step cards from `sequencerRecipes.json`:
  six finger-sequencer variations on white keys switched one-handed with
  Hold, endless-sequencer motifs of 5, 6 and 7 steps with rests, and tombola
  in the upper octave for texture. Not scored.

## C: sample adaptation and live splicing

Drills run in sample flip (a later phase). None is scored by the Runner.

- **C1, hum and match.** Hum the sample's pitch, match it to the key. Mic
  only with headphones on the phone, or the Field as output.
- **C2, re-contextualization.** The same sample at 0, −2 and +3 semitones.
  More than one landing is right (root, 5th, relative, 9th); `check my flip`
  lists them by how far the sample moved and says which you got.
- **C3, micro-chopping.** One long sample plus markers becomes a sliced kit
  in the kit compiler. A card, not scored.

**The 10-second live resample loop** (a card in C3): sample 10 seconds of the
Push's output into the Field, chop it and play it back over the loop before
the countdown ends. The app runs the backing and the countdown, nothing
more. With the Field on the phone's USB, the phone's audio goes to the
Field, so recording tape with input set to USB records the backing too.

## D: OP-1 Field superpowers

Cards only, one lesson per topic.

- **D0, tape speed tricks.** Sync first: the Field in **sync** (Tempo, then
  the green encoder) with the app's clock out on, and `start` starts the
  tape at the app's tempo; in sync with clock in enabled, tape speed follows
  the clock. The speed tricks themselves are `(field steps: VERIFY)`.
- **D1, M1 and M2 brakes.** Slow a part to a stop before a drop.
- **D2, Element LFO to Nitro and the filter, from the G source.**
- **D3, per-track panning and master drive.**
- **D4, pre-tape panning.** Shift+orange on the tape screen pans before
  tape, to keep the OP-1 out of the Push's centre.
- **D5, line in, mono or stereo,** when sampling the Push's output.

D1, D2, D3 and D5 are written as the idea plus `(field steps: VERIFY)`.
