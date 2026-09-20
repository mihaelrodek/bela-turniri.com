#!/usr/bin/env python3
"""
clean-card-scans.py

Rebuilds the "moderne" madjarice card deck from the original camera-scanned
360x600 WebP faces (the deck that lived at
frontend/src/game/cards/madjarice/assets/*.webp before it was replaced by the
"klasicne" deck on 2026-09-20).

The scans are photographed paper: the "white" of the card is a greyish
off-white paper tone, and there is a thin dark photographed edge/vignette
around every card. This script:

  1. extracts the 33 source faces (32 ranks + BACK) from a git ref (default:
     HEAD) into a scratch directory, or reads them from --src if given,
  2. crops away the photographed edge band (fixed, conservative margins -
     see CROP_* below - chosen so they never cut into the corner "VII"/"IIA"
     style indices or artwork that runs close to the edge on some cards),
  3. estimates the paper colour per card from bright/low-saturation pixels
     and applies a per-channel white-point stretch so paper -> pure white,
     blended smoothly (soft threshold on brightness+saturation) so pale
     in-art colours (light yellow leaves, pale greens) are not blown out and
     there is no hard halo around ink,
  4. applies a gentle global contrast/saturation lift (the old CSS
     saturate/contrast/brightness filter, baked in instead of applied at
     render time),
  5. a very mild denoise (small blur + unsharp) that keeps line art crisp,
  6. scales the corrected card DOWN (uniformly, never stretched) to fit
     inside a printed inset frame matched to the klasicne deck (measured off
     klasicne/KHERC.webp, 10TREF.webp, 7HERC.webp - see FRAME_* below), with
     a small white gutter so pips/indices never touch the frame line, then
     draws that frame onto a white 363x585 canvas,
  7. composites the deck's outer rounded-corner treatment on top: a
     radius-22px (6.06% of width) antialiased rounded-rect alpha mask, with
     a 1px dark (~#252525) hairline ring immediately inside the outer edge
     and a 1px light grey (~#cccccc) ring inside that - both measured by
     sampling frontend/src/game/cards/madjarice/assets/klasicne/KHERC.webp,
     which is the ground truth for "how a moderne card should look at the
     edge". The inset printed frame from step 6 is what actually stays
     visible once a card is downscaled to its small in-game display size -
     the outer hairline alone is too thin to survive that, same as klasicne.

BACK.webp is handled slightly differently: unlike the 32 faces it is already
an RGBA image with a soft/partial alpha fringe (not a paper scan), so it
skips the paper white-balance step - it is only cropped past its unstable
1-2px alpha fringe, then given the same frame/mask/hairline as everything
else.

Usage:

    cd frontend
    python3 scripts/clean-card-scans.py
    python3 scripts/clean-card-scans.py --git-ref HEAD~3 --out /tmp/preview
    python3 scripts/clean-card-scans.py --src /path/to/already-extracted/pngs

Requires Pillow (and numpy - the script will tell you how to get a
throwaway copy if it is missing; never installed into the repo).
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:  # pragma: no cover - environment bootstrap hint
    sys.stderr.write(
        "numpy is required. Example (throwaway, NOT into the repo):\n"
        "  pip install --target /tmp/pylib numpy\n"
        "  PYTHONPATH=/tmp/pylib python3 scripts/clean-card-scans.py\n"
    )
    raise

from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND = REPO_ROOT / "frontend"
ASSETS_DIR = FRONTEND / "src/game/cards/madjarice/assets"
KLASICNE_REF = ASSETS_DIR / "klasicne/KHERC.webp"
DEFAULT_GIT_PATH_PREFIX = "frontend/src/game/cards/madjarice/assets"
DEFAULT_OUT = ASSETS_DIR / "moderne"

SUITS = ["HERC", "KARA", "PIK", "TREF"]
RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"]
FACE_NAMES = [r + s for r in RANKS for s in SUITS]
ALL_NAMES = FACE_NAMES + ["BACK"]

# --- geometry, matched to the klasicne deck -------------------------------
TARGET_W, TARGET_H = 363, 585
TARGET_RATIO = TARGET_W / TARGET_H  # 0.62051...
CORNER_RADIUS = 22.0  # px, ~6.06% of width, sampled from klasicne/KHERC.webp
RING_DARK = (37, 37, 37)     # outermost 1px hairline, sampled from klasicne
RING_LIGHT = (204, 204, 204)  # 2nd px transition ring, sampled from klasicne
FEATHER = 1.1  # px, antialias width of the rounded-rect edge

# --- inner printed frame, matched to the klasicne deck ---------------------
# klasicne/KHERC.webp, 10TREF.webp and 7HERC.webp were measured pixel-by-pixel
# (brightness profiles inward from each edge + a corner arc fit): a clearly
# visible dark rounded-rect line sits INSET from the outer edge, with a
# white margin outside it and the art starting a little further inside it.
# Measured (at 363x585): left/right inset ~16px, top/bottom inset ~14px,
# corner radius ~13px, line colour the same dark grey as the outer hairline
# (~37,37,37), core line width ~1px (but see FRAME_WIDTH below - widened a
# touch so it still reads at in-game display sizes, ~56-96px wide, where a
# strict 1px line all but disappears on downscale).
FRAME_INSET_X = 16.0
FRAME_INSET_Y = 14.0
FRAME_RADIUS = 13.0
FRAME_WIDTH = 1.6  # px, at native 363x585 resolution
FRAME_COLOR = RING_DARK
FRAME_GUTTER = 4  # px of white kept between the frame line and the art/content box

# --- fixed, conservative crop margins for the 360x600 scans ---------------
# Derived from scanning the brightness profile of all 32 faces inward from
# each edge: the photographed dark edge/vignette band settles into the flat
# "paper" plateau by ~row/col 6-7 on top/bottom and ~2-4 on left/right for
# the large majority of cards. A handful of cards (7/PIK, 7/TREF, 8/TREF,
# the four Aces, and BACK) have art or a printed frame running close to one
# edge, which defeats a *per-card adaptive* plateau search (it either finds
# nothing within a reasonable window, or - worse - walks past the true
# margin into the art). Corner text ("VII", "IIA", ...) on every card starts
# at least ~15px in from the edge, so a single small fixed crop, applied
# identically to the whole deck ("crop to it *consistently*"), is both safer
# and simpler than per-card detection.
CROP_LEFT = 4
CROP_TOP = 7
CROP_RIGHT = 4
CROP_BOTTOM = 7

BACK_CROP = 2  # BACK.webp only needs its unstable soft-alpha fringe removed


def extract_sources(git_ref: str, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    missing = []
    for name in ALL_NAMES:
        dest = out_dir / f"{name}.webp"
        rel = f"{DEFAULT_GIT_PATH_PREFIX}/{name}.webp"
        try:
            data = subprocess.run(
                ["git", "-C", str(REPO_ROOT), "show", f"{git_ref}:{rel}"],
                check=True,
                capture_output=True,
            ).stdout
        except subprocess.CalledProcessError:
            missing.append(name)
            continue
        dest.write_bytes(data)
    if missing:
        raise SystemExit(f"could not extract from git {git_ref}: {missing}")
    return out_dir


# --- image processing -------------------------------------------------------

def rounded_rect_coverage_box(
    w: int, h: int, left: float, top: float, right: float, bottom: float,
    radius: float, feather: float,
) -> np.ndarray:
    """Antialiased coverage (0..1) of an arbitrary rounded rect box, via an
    analytic signed-distance field - no supersampling needed."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (left + right) / 2.0, (top + bottom) / 2.0
    hx, hy = (right - left) / 2.0 - radius, (bottom - top) / 2.0 - radius
    qx = np.abs(xx - cx) - hx
    qy = np.abs(yy - cy) - hy
    qx_pos = np.maximum(qx, 0.0)
    qy_pos = np.maximum(qy, 0.0)
    dist_outside = np.sqrt(qx_pos ** 2 + qy_pos ** 2)
    dist_inside = np.minimum(np.maximum(qx, qy), 0.0)
    sdf = dist_outside + dist_inside - radius  # <0 inside, 0 boundary, >0 outside
    coverage = np.clip(0.5 - sdf / feather, 0.0, 1.0)
    return coverage


def rounded_rect_coverage(w: int, h: int, radius: float, feather: float) -> np.ndarray:
    """Antialiased coverage (0..1) of a centered, full-canvas rounded rect."""
    return rounded_rect_coverage_box(w, h, 0.0, 0.0, float(w), float(h), radius, feather)


def draw_inner_frame(canvas: Image.Image) -> Image.Image:
    """Paints the klasicne-style inset printed frame line onto an RGB canvas
    that is already exactly TARGET_W x TARGET_H. Returns RGB."""
    w, h = canvas.size
    assert (w, h) == (TARGET_W, TARGET_H)
    rgb = np.asarray(canvas.convert("RGB")).astype(np.float32)

    outer = rounded_rect_coverage_box(
        w, h, FRAME_INSET_X, FRAME_INSET_Y, w - FRAME_INSET_X, h - FRAME_INSET_Y,
        FRAME_RADIUS, FEATHER,
    )
    inner = rounded_rect_coverage_box(
        w, h,
        FRAME_INSET_X + FRAME_WIDTH, FRAME_INSET_Y + FRAME_WIDTH,
        w - FRAME_INSET_X - FRAME_WIDTH, h - FRAME_INSET_Y - FRAME_WIDTH,
        max(FRAME_RADIUS - FRAME_WIDTH, 0.5), FEATHER,
    )
    stroke = np.clip(outer - inner, 0.0, 1.0)[..., None]

    color = np.array(FRAME_COLOR, dtype=np.float32)
    rgb = rgb * (1 - stroke) + color[None, None, :] * stroke
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def apply_rounded_mask_and_hairline(rgb_img: Image.Image) -> Image.Image:
    """rgb_img must already be exactly TARGET_W x TARGET_H. Returns RGBA."""
    w, h = rgb_img.size
    assert (w, h) == (TARGET_W, TARGET_H)
    content = np.asarray(rgb_img.convert("RGB")).astype(np.float32)

    alpha_outer = rounded_rect_coverage(w, h, CORNER_RADIUS, FEATHER)
    cov_r1 = rounded_rect_coverage(w, h, CORNER_RADIUS - 1.0, FEATHER)
    cov_r2 = rounded_rect_coverage(w, h, CORNER_RADIUS - 2.0, FEATHER)

    ring0 = np.clip(alpha_outer - cov_r1, 0.0, 1.0)  # outermost hairline (dark)
    ring1 = np.clip(cov_r1 - cov_r2, 0.0, 1.0)        # transition ring (light grey)
    interior = np.clip(cov_r2, 0.0, 1.0)               # card content

    dark = np.array(RING_DARK, dtype=np.float32)
    light = np.array(RING_LIGHT, dtype=np.float32)

    rgb = (
        content * interior[..., None]
        + dark[None, None, :] * ring0[..., None]
        + light[None, None, :] * ring1[..., None]
    )
    denom = np.clip(alpha_outer, 1e-4, None)[..., None]
    rgb = rgb / denom
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)

    alpha = np.clip(alpha_outer * 255.0, 0, 255).astype(np.uint8)
    out = np.dstack([rgb, alpha])
    return Image.fromarray(out)


def estimate_paper_white_point(rgb: np.ndarray) -> np.ndarray:
    """rgb: HxWx3 float32 in [0,255]. Returns per-channel white point."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    v = mx / 255.0
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)

    paperish = (v > 0.80) & (s < 0.12)
    if paperish.sum() < 200:  # fallback for heavily inked cards
        thresh = np.percentile(v, 90)
        paperish = v >= thresh

    wp = np.array(
        [np.median(r[paperish]), np.median(g[paperish]), np.median(b[paperish])],
        dtype=np.float32,
    )
    wp = np.clip(wp, 150.0, 255.0)  # guard against a degenerate/near-black estimate
    return wp


def whiten_paper(rgb: np.ndarray) -> np.ndarray:
    """rgb: HxWx3 float32 in [0,255]. Returns corrected float32 [0,255]."""
    wp = estimate_paper_white_point(rgb)
    scaled = np.clip(rgb * (255.0 / wp)[None, None, :], 0, 255)

    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    v = mx / 255.0
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)

    def smoothstep(x, lo, hi):
        t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
        return t * t * (3 - 2 * t)

    w_bright = smoothstep(v, 0.60, 0.92)
    w_lowsat = smoothstep(0.30 - s, 0.0, 0.25)
    weight = (w_bright * w_lowsat)[..., None]

    blended = rgb * (1 - weight) + scaled * weight
    return blended


def gentle_contrast_saturation(rgb: np.ndarray) -> np.ndarray:
    """Mimic the old CSS saturate(1.08) contrast(1.04) brightness(1.08),
    applied post white-balance so it is subtler (most of the brightening
    already happened in whiten_paper)."""
    # brightness + contrast around mid grey
    rgb = (rgb - 128.0) * 1.035 + 128.0
    rgb = rgb * 1.03

    # saturation lift via simple luma-based mix
    luma = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2])[..., None]
    rgb = luma + (rgb - luma) * 1.08

    return np.clip(rgb, 0, 255)


def denoise_mild(img: Image.Image) -> Image.Image:
    img = img.filter(ImageFilter.GaussianBlur(radius=0.35))
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=65, threshold=2))
    return img


def fit_contain(img: Image.Image, box_w: int, box_h: int, fill=(255, 255, 255)) -> Image.Image:
    """Scales img down (uniformly, preserving aspect, never up) to fit inside
    box_w x box_h, and letterboxes the leftover with fill - i.e. exactly the
    "small white gutter" fit-inside-the-frame behaviour, no stretching."""
    w, h = img.size
    scale = min(box_w / w, box_h / h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGB", (box_w, box_h), fill)
    left = (box_w - new_w) // 2
    top = (box_h - new_h) // 2
    canvas.paste(resized, (left, top))
    return canvas


def compose_card(content: Image.Image) -> Image.Image:
    """content: the cleaned/corrected art (any size, roughly the scan's own
    aspect). Fits it inside the klasicne-measured inner frame box (with a
    white gutter so nothing touches the frame line), draws the frame, then
    the outer rounded mask + hairline. Returns the final TARGET_W x TARGET_H
    RGBA card."""
    box_left = FRAME_INSET_X + FRAME_WIDTH + FRAME_GUTTER
    box_top = FRAME_INSET_Y + FRAME_WIDTH + FRAME_GUTTER
    box_w = TARGET_W - 2 * box_left
    box_h = TARGET_H - 2 * box_top

    fitted = fit_contain(content, round(box_w), round(box_h), fill=(255, 255, 255))

    canvas = Image.new("RGB", (TARGET_W, TARGET_H), (255, 255, 255))
    canvas.paste(fitted, (round(box_left), round(box_top)))

    canvas = draw_inner_frame(canvas)
    return apply_rounded_mask_and_hairline(canvas)


def process_face(src_path: Path) -> Image.Image:
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    cropped = im.crop((CROP_LEFT, CROP_TOP, w - CROP_RIGHT, h - CROP_BOTTOM))

    rgb = np.asarray(cropped).astype(np.float32)
    rgb = whiten_paper(rgb)
    rgb = gentle_contrast_saturation(rgb)
    corrected = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))

    corrected = denoise_mild(corrected)
    return compose_card(corrected)


def process_back(src_path: Path) -> Image.Image:
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    cropped = im.crop((BACK_CROP, BACK_CROP, w - BACK_CROP, h - BACK_CROP))
    # Flatten onto white: the remaining alpha is already >=250/255, so this
    # is a no-op almost everywhere and just removes any residual fringe.
    flat = Image.new("RGB", cropped.size, (255, 255, 255))
    flat.paste(cropped, (0, 0), cropped)

    return compose_card(flat)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", type=Path, default=None,
                         help="directory already containing the 33 raw *.webp "
                              "scans (skips git extraction)")
    parser.add_argument("--git-ref", default="HEAD",
                         help="git ref to extract the raw scans from when --src "
                              "is not given (default: HEAD)")
    parser.add_argument("--scratch", type=Path,
                         default=Path("/tmp/clean-card-scans-src"),
                         help="scratch dir to extract into when using --git-ref")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                         help="output directory (default: assets/moderne)")
    args = parser.parse_args()

    src_dir = args.src if args.src else extract_sources(args.git_ref, args.scratch)
    args.out.mkdir(parents=True, exist_ok=True)

    for name in FACE_NAMES:
        out_img = process_face(src_dir / f"{name}.webp")
        out_img.save(args.out / f"{name}.webp", "WEBP", quality=88, method=6)
        print(f"wrote {name}.webp {out_img.size} {out_img.mode}")

    back_img = process_back(src_dir / "BACK.webp")
    back_img.save(args.out / "BACK.webp", "WEBP", quality=88, method=6)
    print(f"wrote BACK.webp {back_img.size} {back_img.mode}")


if __name__ == "__main__":
    main()
