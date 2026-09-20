"""Cut the `moderne` deck's own suit marks out of its Dečko (J) cards.

The J is the one court card whose pip stands alone on white paper, clear of
the figure. Background = white paper reachable from the crop's border
(flood fill), so pale colours INSIDE the mark (the bell's highlights, the
leaf's yellow half) survive. Output matches klasicne/suits: 192x192 RGBA.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
CROP = (24, 150, 150, 310)      # left, top, right, bottom on the 363x585 card
SIZE, PAD = 192, 8

def is_paper(p):
    r, g, b = p[:3]
    return min(r, g, b) > 212 and max(r, g, b) - min(r, g, b) < 28

for suit in ("HERC", "KARA", "PIK", "TREF"):
    card = Image.open(f"{SRC}/J{suit}.webp").convert("RGBA")
    white = Image.new("RGBA", card.size, "white"); white.alpha_composite(card)
    im = white.convert("RGB").crop(CROP)
    w, h = im.size
    px = im.load()
    # 1. paper reachable from the border
    bg = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or bg[y][x] or not is_paper(px[x, y]):
            continue
        bg[y][x] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # 2. largest connected blob of what is left = the pip (drops stray specks
    #    and anything of the figure that pokes into the crop)
    seen = [[False] * w for _ in range(h)]
    best = []
    for sy in range(h):
        for sx in range(w):
            if bg[sy][sx] or seen[sy][sx]:
                continue
            blob, q = [], deque([(sx, sy)])
            seen[sy][sx] = True
            while q:
                x, y = q.popleft()
                blob.append((x, y))
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1),(x+1,y+1),(x-1,y-1),(x+1,y-1),(x-1,y+1)):
                    if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if len(blob) > len(best):
                best = blob
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for x, y in best:
        mp[x, y] = 255
    xs = [p[0] for p in best]; ys = [p[1] for p in best]
    box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    touches = box[0] == 0 or box[1] == 0 or box[2] == w or box[3] == h
    # 3. soften the cut by half a pixel so no paper fringe survives the resize
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = im.convert("RGBA"); rgba.putalpha(mask)
    pip = rgba.crop(box)
    scale = (SIZE - 2 * PAD) / max(pip.size)
    pip = pip.resize((max(1, round(pip.width * scale)), max(1, round(pip.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(pip, ((SIZE - pip.width) // 2, (SIZE - pip.height) // 2))
    out.save(f"{OUT}/{suit}.webp", "WEBP", quality=92, method=6)
    print(suit, "box", box, "blob", len(best), "TOUCHES CROP EDGE" if touches else "ok")
