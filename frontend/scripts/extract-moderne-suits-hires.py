"""Cut the `moderne` deck's suit marks from the ORIGINAL 12 MP photos of the
Dečko cards (repo-root assets/IMG_23xx.HEIC, converted to PNG with `sips`).
Replaces extract-moderne-suits.py's source: that one cut them out of the
363 px card faces, where a pip is ~120 px wide — hence the blur and the
halftone mush. Here a pip is ~350 px.

Usage (2026-09-21):
    mkdir /tmp/heic && for n in 2351 2359 2367 2375; do
        sips -s format png assets/IMG_$n.HEIC --out /tmp/heic/full_$n.png; done
    python3 frontend/scripts/extract-moderne-suits-hires.py /tmp/heic \
        frontend/src/game/cards/madjarice/assets/moderne/suits
Output: 384x384 RGBA WebP (2x the klasicne icons; they are sized by CSS)."""
import sys
from collections import deque
from PIL import Image, ImageFilter, ImageEnhance, ImageChops

SRC, OUT = sys.argv[1], sys.argv[2]
SIZE, PAD = 384, 14
# photo number, crop box in the 4032x3024 frame, clockwise tilt of the card (deg)
JOBS = {
    "HERC": (2351, (1790, 1030, 2250, 1470), 2.3),
    "TREF": (2359, (1730, 1010, 2150, 1560), 4.6),
    "PIK":  (2367, (1730, 1160, 2130, 1580), 9.8),
    "KARA": (2375, (1930, 1110, 2360, 1560), 6.5),
}

def is_paper(p):
    r, g, b = p
    return min(r, g, b) > 150 and max(r, g, b) - min(r, g, b) < 34

for suit, (n, box, tilt) in JOBS.items():
    im = Image.open(f"{SRC}/full_{n}.png").convert("RGB").crop(box)
    w, h = im.size
    px = im.load()
    # paper colour = median of the paper pixels, for the white-point stretch
    paper = sorted(px[x, y] for x in range(0, w, 3) for y in range(0, h, 3) if is_paper(px[x, y]))
    pr, pg, pb = (sorted(c[i] for c in paper)[len(paper) // 2] for i in range(3))
    bg = [[False] * w for _ in range(h)]
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or bg[y][x] or not is_paper(px[x, y]):
            continue
        bg[y][x] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # blobs; keep the biggest one that does NOT touch the crop edge (the pip —
    # the frame line and the neighbouring figure all run off the crop)
    seen = [[False] * w for _ in range(h)]
    best = []
    for sy in range(h):
        for sx in range(w):
            if bg[sy][sx] or seen[sy][sx]:
                continue
            blob, qq, edge = [], deque([(sx, sy)]), False
            seen[sy][sx] = True
            while qq:
                x, y = qq.popleft()
                blob.append((x, y))
                if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                    edge = True
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1),(x+1,y+1),(x-1,y-1),(x+1,y-1),(x-1,y+1)):
                    if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        qq.append((nx, ny))
            if not edge and len(blob) > len(best):
                best = blob
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for x, y in best:
        # paper ENCLOSED by the mark (inside the bell's ring, the leaf's curl)
        # is still paper: on a dark table it showed as white specks
        r_, g_, b_ = px[x, y]
        if min(r_, g_, b_) > 170 and max(r_, g_, b_) - min(r_, g_, b_) < 30:
            continue
        mp[x, y] = 255
    # close pinholes, pull the edge in one pixel (paper fringe), feather it
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.9))
    # white point: photographed paper is ~ (225,225,228); stretch it to white
    r, g, b = im.split()
    lut = lambda white: [min(255, round(v * 250 / white)) for v in range(256)]
    im2 = Image.merge("RGB", (r.point(lut(pr)), g.point(lut(pg)), b.point(lut(pb))))
    im2 = ImageEnhance.Color(im2).enhance(1.12)
    im2 = ImageEnhance.Contrast(im2).enhance(1.05)
    rgba = im2.convert("RGBA"); rgba.putalpha(mask)
    rgba = rgba.rotate(tilt, resample=Image.BICUBIC, expand=True)   # PIL: +deg = counter-clockwise
    pip = rgba.crop(rgba.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())
    scale = (SIZE - 2 * PAD) / max(pip.size)
    pip = pip.resize((round(pip.width * scale), round(pip.height * scale)), Image.LANCZOS)
    if scale < 1:
        pass
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(pip, ((SIZE - pip.width) // 2, (SIZE - pip.height) // 2))
    out.save(f"{OUT}/{suit}.webp", "WEBP", quality=90, method=6)
    print(suit, "paper", (pr, pg, pb), "blob", len(best), "pip", pip.size, "scale %.2f" % scale)
