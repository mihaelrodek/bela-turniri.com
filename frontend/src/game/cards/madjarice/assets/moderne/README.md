# moderne deck

This is the project's own camera-scanned madjarice (Hungarian/Tell pattern) deck -
the set of 360x600 WebP photographs that lived directly under
`frontend/src/game/cards/madjarice/assets/*.webp` before it was replaced by the
`klasicne` deck. It was brought back on 2026-09-20 as a selectable "moderne" deck,
cleaned up programmatically so it can be drawn edge-to-edge with no CSS crop or
filter tricks, exactly like `klasicne`.

## Pipeline (see `frontend/scripts/clean-card-scans.py` for the real thing)

1. Extract the 33 raw scans (32 faces + `BACK`) from a git ref.
2. Crop off the photographed edge band with small, fixed, deck-wide margins
   (4px sides / 7px top-bottom) - conservative enough to never cut into the
   corner "VII"/"IIA"-style indices or artwork that runs close to the edge.
3. Estimate the paper colour per card from bright, low-saturation pixels and
   apply a per-channel white-point stretch (paper -> pure white), blended
   smoothly by brightness+saturation so pale in-art colours are not blown out,
   then a gentle global contrast/saturation lift and a mild denoise.
4. Scale the cleaned art down (uniformly, never stretched) to fit inside a
   printed inset frame matched to `klasicne` (see "Printed frame" below),
   with a small white gutter so nothing touches the frame line, then
   composite the same outer rounded-corner mask + hairline treatment sampled
   from `klasicne/KHERC.webp` (radius 22px, 1px dark ring, 1px light-grey
   ring) on top. Final geometry: 363x585 RGBA.
5. `BACK.webp` skips the paper white-balance (it's already an RGBA pattern,
   not a paper scan) but gets the same fit/frame/mask/hairline treatment.

### Printed frame

The outer 1px hairline alone reads as a border at native 363px resolution
but all but disappears once the browser downscales a card to its in-game
display width (~56-96px, a ~4-6x downscale) - moderne originally shipped
without a visible edge for this reason. `klasicne` avoids it by printing a
second, clearly visible frame line *inset* from the edge, which was measured
pixel-by-pixel off `klasicne/KHERC.webp`, `10TREF.webp` and `7HERC.webp`
(brightness profile inward from each edge, plus a corner-arc circle fit) and
reproduced in the script as `FRAME_INSET_X/Y`, `FRAME_RADIUS`,
`FRAME_WIDTH`, `FRAME_COLOR`:

- inset from the outer edge: ~16px left/right, ~14px top/bottom
- corner radius: ~13px
- line colour: the same dark grey as the outer hairline, ~(37,37,37)
- core line width in klasicne: ~1px; moderne uses 1.6px so it survives
  downscaling to in-game size (klasicne's own 1px line is thin enough that
  it likely relies on antialiasing landing favourably - not blindly copied)
- the art is scaled to fit *inside* this frame (with a further 4px white
  gutter) rather than being cropped by it, so corner indices and pips never
  touch or cross the line

Every moderne card was checked against this frame for clipping, in
particular the ones whose art runs closest to the original scan edge
(7/PIK, 8/TREF, the four Aces) - none touch it.

## Re-running it

```bash
cd frontend
python3 scripts/clean-card-scans.py                 # extracts from HEAD, writes here
python3 scripts/clean-card-scans.py --git-ref <ref>  # extract from a different commit
python3 scripts/clean-card-scans.py --src <dir>      # use already-extracted scans
```

Requires Pillow and numpy. If numpy is missing, install it into a scratch dir
(never into the repo or system):

```bash
pip install --target /tmp/pylib numpy
PYTHONPATH=/tmp/pylib python3 scripts/clean-card-scans.py
```
