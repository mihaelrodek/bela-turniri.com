#!/usr/bin/env python3
"""Perspective-correct photographed bela cards into web-ready assets.

Requires OpenCV and Pillow. HEIC decoding is delegated to macOS `sips` so the
source photographs remain untouched.
"""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets"
OUTPUT = ROOT / "frontend/src/game/cards/madjarice/assets"
PREVIEW = ROOT / "design/cards/contact-sheet.jpg"

# Engine IDs: HERC=srce, TREF=žir, PIK=list, KARA=bundeva/zvono.
CARDS = {
    "IMG_2347": "8HERC", "IMG_2348": "7HERC", "IMG_2349": "9HERC", "IMG_2350": "10HERC",
    "IMG_2351": "JHERC", "IMG_2352": "QHERC", "IMG_2353": "KHERC", "IMG_2354": "AHERC",
    "IMG_2355": "7TREF", "IMG_2356": "9TREF", "IMG_2357": "8TREF", "IMG_2358": "10TREF",
    "IMG_2359": "JTREF", "IMG_2360": "QTREF", "IMG_2361": "KTREF", "IMG_2362": "ATREF",
    "IMG_2363": "7PIK", "IMG_2364": "8PIK", "IMG_2365": "9PIK", "IMG_2366": "10PIK",
    "IMG_2367": "JPIK", "IMG_2368": "QPIK", "IMG_2369": "KPIK", "IMG_2370": "APIK",
    "IMG_2371": "7KARA", "IMG_2372": "8KARA", "IMG_2373": "9KARA", "IMG_2374": "10KARA",
    "IMG_2375": "JKARA", "IMG_2376": "QKARA", "IMG_2377": "KKARA", "IMG_2378": "AKARA",
}

# Four times the largest in-app card height; sharp on high-DPI screens without
# making players download 32 full-resolution phone photographs.
WIDTH, HEIGHT = 360, 600
EXPANSION = 1.018  # keeps the complete paper edge and rounded corners


def order_points(points: np.ndarray) -> np.ndarray:
    points = points.astype(np.float32)
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1).ravel()
    return np.array([
        points[np.argmin(sums)], points[np.argmin(diffs)],
        points[np.argmax(sums)], points[np.argmax(diffs)],
    ], dtype=np.float32)


def card_quad(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (9, 9), 0), 30, 80)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    candidates: list[tuple[float, np.ndarray]] = []
    image_area = image.shape[0] * image.shape[1]
    for contour in contours:
        area = cv2.contourArea(contour)
        if not 0.08 * image_area < area < 0.55 * image_area:
            continue
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            ordered = order_points(approx.reshape(4, 2))
            top = np.linalg.norm(ordered[1] - ordered[0])
            side = np.linalg.norm(ordered[3] - ordered[0])
            ratio = min(top, side) / max(top, side)
            if 0.50 < ratio < 0.72:
                candidates.append((area, ordered))
    if not candidates:
        raise RuntimeError("nije pronađen vanjski rub karte")
    quad = max(candidates, key=lambda item: item[0])[1]
    center = quad.mean(axis=0)
    return center + (quad - center) * EXPANSION


def process(source: Path, target: Path) -> None:
    with tempfile.NamedTemporaryFile(suffix=".jpg") as converted:
        subprocess.run(
            ["sips", "-s", "format", "jpeg", str(source), "--out", converted.name],
            check=True, stdout=subprocess.DEVNULL,
        )
        image = cv2.imread(converted.name)
    quad = card_quad(image)

    # Rotate point order when the photographed card's long side is horizontal.
    top = np.linalg.norm(quad[1] - quad[0])
    left = np.linalg.norm(quad[3] - quad[0])
    if top > left:
        quad = np.roll(quad, -1, axis=0)

    destination = np.array([[0, 0], [WIDTH - 1, 0], [WIDTH - 1, HEIGHT - 1], [0, HEIGHT - 1]], np.float32)
    matrix = cv2.getPerspectiveTransform(quad, destination)
    warped = cv2.warpPerspective(image, matrix, (WIDTH, HEIGHT), flags=cv2.INTER_LANCZOS4)
    rgba = cv2.cvtColor(warped, cv2.COLOR_BGR2RGBA)

    # The expanded quadrilateral gives a small safety margin. Clip that margin
    # to the real rounded silhouette instead of baking the tabletop into it.
    scale = 4
    mask = Image.new("L", (WIDTH * scale, HEIGHT * scale), 0)
    inset_x = round(WIDTH * (EXPANSION - 1) / (2 * EXPANSION) * scale)
    inset_y = round(HEIGHT * (EXPANSION - 1) / (2 * EXPANSION) * scale)
    radius = round(23 * scale)
    ImageDraw.Draw(mask).rounded_rectangle(
        (inset_x, inset_y, WIDTH * scale - inset_x - 1, HEIGHT * scale - inset_y - 1),
        radius=radius, fill=255,
    )
    mask = mask.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    result = Image.fromarray(rgba)
    result.putalpha(mask)
    result.save(target, "WEBP", quality=92, method=6)


def contact_sheet(paths: list[Path]) -> None:
    thumb_w, thumb_h, label_h = 180, 300, 24
    sheet = Image.new("RGB", (thumb_w * 8, (thumb_h + label_h) * 4), "#d8d8d8")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(paths):
        card = Image.open(path).convert("RGBA")
        background = Image.new("RGBA", card.size, "white")
        background.alpha_composite(card)
        card = background.convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        x, y = index % 8 * thumb_w, index // 8 * (thumb_h + label_h)
        sheet.paste(card, (x, y))
        draw.text((x + 6, y + thumb_h + 4), path.stem, fill="black")
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW, quality=90)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    generated: list[Path] = []
    for photo, card_id in CARDS.items():
        source = SOURCE / f"{photo}.HEIC"
        target = OUTPUT / f"{card_id}.webp"
        process(source, target)
        generated.append(target)
        print(f"{source.name} -> {target.name}")
    contact_sheet(generated)


if __name__ == "__main__":
    main()
