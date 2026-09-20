import { type CSSProperties } from "react"
import type { Rank, Suit } from "@bela/engine"
import { deckHasImages, type CardSize, type DeckStyle } from "../../util/cards"

import SuitGlyph from "./SuitGlyph"
import VectorFace from "./VectorFace"
import { cardImage } from "./imageAssets"
import { useDecodedImage } from "./useDecodedImage"

/* ──────────────────────────────────────────────────────────────────────────
   MadjaricaCard — one Hungarian (Tell) card, in one of the THREE mađarice
   decks (game/DESIGN.md §2.1). Same box, same names, same shadow; only the
   paint differs, and `deck` is the whole switch:

     klasicne   the licensed tomasdrus set (github.com/tomasdrus/
                hungarian-playing-cards, used with the author's permission for
                bela-turniri.com, 2026-09-20): clean digital faces, 363×585
                with transparent rounded corners, so one image is the entire
                card — no frame, no inset, no colour correction.
     moderne    our own cleaned scans, in the IDENTICAL geometry on purpose,
                so they go through this exact same image path.
     vektorske  no raster at all — our OWN drawn deck, `VectorFace.tsx`.
                Since 2026-09-20 it is art-directed as a deck people pick
                (flat, frameless, four silhouettes); it still doubles as the
                pre-decode stand-in for the two image decks, which is what it
                used to be exclusively.

   Files are registered by engine card ID in imageAssets.ts;
   assets/klasicne/README.md has the licence note.

   This file therefore holds NO drawing at all: the deck switch, the decode
   gate and the two stacked layers live here, the 200 × 300 artwork lives in
   `VectorFace.tsx` (and `figures` / `vignettes` / `SuitGlyph` / `palette`
   under it). Keep it that way — the layer switching below is a fixed-shape,
   unconditional-hooks component on purpose (2026-09-20 flicker fix).
   ────────────────────────────────────────────────────────────────────── */

/* The artwork fills the whole card box: since the licensed deck (2026-09-20)
   the file IS the card — its own white face, printed edge and rounded,
   TRANSPARENT corners — so there is no frame to inset it into and no scan
   paper to colour-correct. `contain` rather than `fill` because the box is
   rounded off the true 0.6205 ratio by a fraction of a pixel and squashing a
   printed card is more visible than a hairline of felt. */
const ART_STYLE: CSSProperties = {
    display: "block",
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
}

export default function MadjaricaCard({
    rank,
    suit,
    deck = "klasicne",
}: {
    rank: Rank
    suit: Suit
    /** Which of the three mađarice decks to paint. */
    deck?: DeckStyle
    /** Accepted but unused since the artwork fills the box (2026-09-20): the
     *  face no longer needs a per-size inset or corner radius, and every
     *  caller already sizes the card root. Kept so call sites stay unchanged
     *  and a future size-dependent face has somewhere to read it. */
    size?: CardSize
}) {
    /* `vektorske` has no file to wait for, so `image` is undefined and the
       hook below answers "not ready" — which leaves the SVG visible forever,
       exactly right. The hook is called unconditionally either way: a deck
       change may remount a card, but `ready` flipping must never change the
       shape of this component (2026-09-20 flicker fix). */
    const image = deckHasImages(deck) ? cardImage(deck, rank, suit) : undefined
    const { ready, imgRef, settle } = useDecodedImage(image)
    return (
        <>
            {/* On an image deck this may be this browser's first request for
                an opponent's card. The complete vector face stands in until it
                has decoded, so the 320 ms throw animation never starts as an
                empty hole. It is HIDDEN the moment the image is up: the
                artwork's corners are transparent, so anything left underneath
                would show through them as a stray outline.

                On `vektorske` it is not a stand-in but the card itself, and
                it has to be a FINISHED one on a transparent root — the white
                frame that used to sit behind it in `PlayingCard` is gone
                (2026-09-20). `VectorFace` paints that face, rounded to the
                same radius the artwork decks carry in their pixels. */}
            <svg
                viewBox="0 0 200 300"
                preserveAspectRatio="none"
                width="100%"
                height="100%"
                aria-hidden="true"
                focusable="false"
                style={{ ...ART_STYLE, visibility: ready ? "hidden" : "visible" }}
            >
                <VectorFace rank={rank} suit={suit} />
            </svg>

            {image && (
                <img
                    ref={imgRef}
                    src={image}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="async"
                    onLoad={settle}
                    style={{
                        ...ART_STYLE,
                        objectFit: "contain",
                        pointerEvents: "none",
                        // No cross-fade: the swap happens on the one render
                        // where the SVG is hidden, so there is never a frame
                        // with both, or with neither.
                        opacity: ready ? 1 : 0,
                        WebkitTouchCallout: "none",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                    }}
                />
            )}
        </>
    )
}

/**
 * The bare suit glyph as a standalone `<svg>` — what the bidding panel, the
 * trump indicator and the scoreboard put next to a word. It uses the same
 * full-colour print as the deck artwork by default.
 */
export function MadjaricaSuitIcon({ suit, mono = false }: { suit: Suit; mono?: boolean }) {
    return (
        <svg viewBox="-4 -4 108 108" width="100%" height="100%" aria-hidden="true" focusable="false" style={{ display: "block" }}>
            <SuitGlyph suit={suit} mono={mono} />
        </svg>
    )
}
