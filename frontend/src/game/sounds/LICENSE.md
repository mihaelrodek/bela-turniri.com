# Sound assets — provenance and licence

`assets/card-place-2.wav` and `assets/card-shuffle.wav` are re-encoded
excerpts of Kenney's **Casino Audio** pack (originals: `card-place-2.ogg`,
`card-shuffle.ogg`).

- Author: Kenney Vleugels (www.kenney.nl)
- Source: https://kenney.nl/assets/casino-audio
- Licence: CC0 1.0 Universal (public domain) — see the pack's `License.txt`:
  "You may use these assets in personal and commercial projects. Credit
  (Kenney or www.kenney.nl) would be nice but is not mandatory."

## What changed from the originals

Downmixed to mono, resampled to 32 kHz, leading/trailing silence trimmed,
peak-normalised to -3 dBFS, and (shuffle only) truncated to 1.2 s with a short
fade-out so the "Runda 1" cue does not run long. Shipped as 16-bit PCM WAV —
not AAC/m4a — specifically because the card-place samples are latency
sensitive (`playSound("card")` fires on every trick) and AAC encoders add
~50 ms of priming silence at the start of the decoded buffer, which is
audible as a beat of lag on a "crisp" sound. WAV decodes with no such offset
in every engine `decodeAudioData` targets, including iOS Safari. Total size
for all five files is ~168 KB, under the file's ~200 KB budget.
