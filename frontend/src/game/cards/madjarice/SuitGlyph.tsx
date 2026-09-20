import type { Suit } from "@bela/engine"
import { SUIT_PALETTE } from "./palette"

/* ──────────────────────────────────────────────────────────────────────────
   The four German suits of the Tell pattern, drawn flat.

   Every glyph is authored in its OWN 100 × 100 box with the origin top-left,
   and renders as bare `<path>`/`<circle>` children — never an `<svg>`. That
   is the whole trick that keeps this deck small: a caller places a glyph with
   one `<g transform="translate(x,y) scale(s/100)">`, so the same four shapes
   serve as the pip on a numeral card, the mark a court figure holds, the big
   motif on an ace and the icon in the bidding panel. 32 cards, four shapes.

   Art direction (2026-09-20, when `vektorske` became a deck you can pick):

     · SILHOUETTE FIRST. The smallest a glyph is ever drawn is 11 px, in the
       trump indicator, where colour is all but the only thing left — so the
       four outlines are deliberately four different families: heart =
       notched top, bell = a circle, acorn = egg under a cap, leaf = a point
       with a midrib. Hold the sheet at arm's length and no two are the same
       blob.
     · FOUR SHAPES, NOT FOUR COLOURS. žir and bundeva were both gold in the
       printed pack; here the acorn is brown-dominant under a green cap and
       the bell is gold with a red band, because at 56 px in a fan that is the
       one confusion a trick-taking game cannot afford.
     · Outlines are the suit's own dark tone (`SuitPalette.line`), at 3 units
       — roughly a third of a device pixel once a pip is on a phone-sized
       card, so it firms the edge up instead of ringing it in black.
     · At most ~6 nodes per glyph. A X has ten pips and a hand has twelve
       cards; everything here is paid for 120 times over.

   Strokes are drawn with `vectorEffect="non-scaling-stroke"` NOWHERE on
   purpose: the outline must thin out with the glyph, otherwise a 24-unit pip
   becomes a blob at `sm`.
   ────────────────────────────────────────────────────────────────────── */

/** Shared edge weight, in the 100 × 100 glyph box. */
const EDGE_W = 3

/** srce — the one suit shared with the French deck. A clean, slightly tall
 *  heart: the notch is the read at 11 px, so it is cut deep, and there is no
 *  midrib — on the ace it is drawn 130 units wide and any inner line there
 *  reads as a scratch. */
function Heart({ main, line }: { main: string; line: string }) {
    return (
        <>
            <path
                d="M50 95C20 73 6 55 6 36 6 19 18 7 33 7c8 0 14 4 17 11 3-7 9-11 17-11 15 0 27 12 27 29 0 19-14 37-44 59Z"
                fill={main}
                stroke={line}
                strokeWidth={EDGE_W}
                strokeLinejoin="round"
            />
        </>
    )
}

/** list / zelena — a linden leaf: one point up, a fat midrib, four veins.
 *  Drawn as a rounded rhombus rather than the printed pack's spade-ish blade,
 *  because a spade silhouette is exactly what a bela player must NOT read
 *  here — the French deck is one setting away. */
function Leaf({ main, line, alt }: { main: string; line: string; alt: string }) {
    return (
        <>
            <path
                d="M50 4C36 23 15 38 15 56c0 21 17 37 35 40 18-3 35-19 35-40C85 38 64 23 50 4Z"
                fill={main}
                stroke={line}
                strokeWidth={EDGE_W}
                strokeLinejoin="round"
            />
            <path d="M50 13v82" stroke={line} strokeWidth={4} strokeLinecap="round" fill="none" />
            <path
                d="M50 38 30 28M50 38l20-10M50 62 27 55M50 62l23-7"
                stroke={alt}
                strokeWidth={3.2}
                strokeLinecap="round"
                fill="none"
            />
        </>
    )
}

/** žir — a brown nut under a green cap on a short stalk. Egg-shaped on
 *  purpose: it is the only glyph wider at the top than at the bottom. */
function Acorn({ main, line, alt }: { main: string; line: string; alt: string }) {
    return (
        <>
            <path d="M50 2v18" stroke={line} strokeWidth={6} strokeLinecap="round" fill="none" />
            <path
                d="M50 39h29c0 31-13 55-29 55S21 70 21 39Z"
                fill={main}
                stroke={line}
                strokeWidth={EDGE_W}
                strokeLinejoin="round"
            />
            <path
                d="M50 12c-20 0-34 12-34 23 0 5 4 8 10 8h48c6 0 10-3 10-8 0-11-14-23-34-23Z"
                fill={alt}
                stroke={line}
                strokeWidth={EDGE_W}
                strokeLinejoin="round"
            />
            <path d="M28 33h44" stroke={line} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </>
    )
}

/** bundeva — a hawking bell: stud, round gold body, red band, a dark slot.
 *  The only circular glyph in the pack, which is what carries it at 11 px. */
function Bell({ main, line, alt }: { main: string; line: string; alt: string }) {
    return (
        <>
            <rect x={42} y={4} width={16} height={16} rx={5} fill={line} />
            <circle cx={50} cy={54} r={40} fill={main} stroke={line} strokeWidth={EDGE_W} />
            <path d="M12 46h76v14H12Z" fill={alt} />
            <path d="M12 46h76M12 60h76" stroke={line} strokeWidth={2.4} fill="none" />
            <ellipse cx={50} cy={76} rx={15} ry={6} fill={line} />
        </>
    )
}

/**
 * One suit glyph in a 100 × 100 local box. Wrap it in a `<g transform>` to
 * place and size it; `mono` drops the secondary printed tone (veins, band)
 * back to the suit's own dark line colour when a caller needs a quieter mark.
 * The main fill never changes, so the suit keeps its identity.
 */
export default function SuitGlyph({ suit, mono = false }: { suit: Suit; mono?: boolean }) {
    const { main, line, alt: printed } = SUIT_PALETTE[suit]
    const alt = mono ? line : printed
    if (suit === "HERC") return <Heart main={main} line={line} />
    if (suit === "PIK") return <Leaf main={main} line={line} alt={alt} />
    if (suit === "TREF") return <Acorn main={main} line={line} alt={alt} />
    return <Bell main={main} line={line} alt={alt} />
}

/** `SuitGlyph` already placed and scaled — the form every card uses. */
export function Pip({
    suit,
    x,
    y,
    size,
    mono = false,
}: {
    suit: Suit
    /** Centre of the pip, in card coordinates. */
    x: number
    y: number
    size: number
    mono?: boolean
}) {
    const s = size / 100
    return (
        <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}>
            <SuitGlyph suit={suit} mono={mono} />
        </g>
    )
}
