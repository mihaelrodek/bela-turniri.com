import type { Card, Rank, Suit } from "@bela/engine"
import type { DeckStyle } from "../../util/cards"

/* ──────────────────────────────────────────────────────────────────────────
   The raster decks' file registry — one map per deck (2026-09-20).

   Layout on disk, one folder per image deck:

     assets/klasicne/<RANK><SUIT>.webp   32 faces  (tomasdrus, licensed — see
     assets/klasicne/BACK.webp                      assets/klasicne/README.md)
     assets/klasicne/suits/<SUIT>.webp   4 suit icons, 192×192 RGBA
     assets/moderne/<RANK><SUIT>.webp    32 faces  (our own cleaned scans)
     assets/moderne/BACK.webp
     assets/moderne/suits/<SUIT>.webp    4 suit icons, 384×384 RGBA, cut from
                                         the ORIGINAL 12 MP photos of the J
                                         cards (2026-09-21; the first set came
                                         off the 363 px faces and was blurry —
                                         scripts/extract-moderne-suits-hires.py)

   Only bundled files are registered: a deck whose folder is missing or half
   finished simply yields nothing, and the card falls back to the vector face
   instead of requesting an image that is not there. Names follow engine card
   ids (7HERC), so no rank/suit translation table is needed.

   `?url` + `eager` deliberately: eager means the URLs are resolved at build
   time and inlined into the chunk as ~70 short STRINGS — the WebP bytes stay
   separate files that the browser fetches on demand (and that `preload.ts`
   warms at idle). Dropping `eager` would only trade those strings for ~70
   dynamic-import stubs, which is bigger, not smaller.
   ────────────────────────────────────────────────────────────────────── */

const faceFiles = import.meta.glob<string>("./assets/*/*.{png,webp,jpg,svg}", {
    eager: true,
    query: "?url",
    import: "default",
})

// A separate glob because Vite's `*` never crosses a `/`, so the faces above
// cannot match `suits/` — which is what we want: the suit icons are a second
// kind of asset with their own accessor.
const suitFiles = import.meta.glob<string>("./assets/*/suits/*.{png,webp,jpg,svg}", {
    eager: true,
    query: "?url",
    import: "default",
})

type DeckAssets = {
    faces: Map<Card, string>
    /** The 33rd file. Outside the face map — nothing looks a back up by id. */
    back?: string
    /** `klasicne` and `moderne` ship these; see `suitImage`. */
    suits: Map<Suit, string>
}

const decks = new Map<string, DeckAssets>()

function bucket(deck: string): DeckAssets {
    let found = decks.get(deck)
    if (!found) {
        found = { faces: new Map(), suits: new Map() }
        decks.set(deck, found)
    }
    return found
}

for (const [path, url] of Object.entries(faceFiles)) {
    const match = path.match(/\/assets\/([^/]+)\/(7|8|9|10|J|Q|K|A)(HERC|KARA|PIK|TREF)\.(png|webp|jpg|svg)$/)
    if (match) {
        bucket(match[1]).faces.set(`${match[2]}${match[3]}` as Card, url)
        continue
    }
    const back = path.match(/\/assets\/([^/]+)\/BACK\.(png|webp|jpg|svg)$/)
    if (back) bucket(back[1]).back = url
}

for (const [path, url] of Object.entries(suitFiles)) {
    const match = path.match(/\/assets\/([^/]+)\/suits\/(HERC|KARA|PIK|TREF)\.(png|webp|jpg|svg)$/)
    if (match) bucket(match[1]).suits.set(match[2] as Suit, url)
}

export function cardImage(deck: DeckStyle, rank: Rank, suit: Suit): string | undefined {
    return decks.get(deck)?.faces.get(`${rank}${suit}`)
}

/** The deck's own back artwork, if it is bundled. Nothing renders it since
 *  2026-09-20 — `CardBack` draws one CSS back for every deck — but the file
 *  stays with the pack and this accessor with it. */
export function cardBackImage(deck: DeckStyle): string | undefined {
    return decks.get(deck)?.back
}

/**
 * The deck's own suit icon, if it ships one.
 *
 * This is what makes a called trump look like the cards in hand (2026-09-20,
 * user request): `klasicne` has printed suit marks of its own, so the
 * scoreboard, the bidding buttons and the caller medallion show THOSE rather
 * than our vector glyph. `moderne` got its own the same day, cut from its
 * J cards. A deck without any keeps the vector glyph — `DeckSuitIcon` handles
 * both from this one answer.
 */
export function suitImage(deck: DeckStyle, suit: Suit): string | undefined {
    return decks.get(deck)?.suits.get(suit)
}

/** Everything the deck owns — 32 faces, the back and any suit icons — for the
 *  idle warm-up and the offline cache in `preload.ts` / `deckOffline.ts`. */
export function allDeckImages(deck: DeckStyle): string[] {
    const found = decks.get(deck)
    if (!found) return []
    return [
        ...found.faces.values(),
        ...(found.back ? [found.back] : []),
        ...found.suits.values(),
    ]
}
