import type { Suit } from "@bela/engine"
import { FACE, INK, SUIT_PALETTE } from "./palette"

/* ──────────────────────────────────────────────────────────────────────────
   The four German suits of the Tell pattern, drawn flat.

   Every glyph is authored in its OWN 100 × 100 box with the origin top-left,
   and renders as bare `<path>`/`<circle>` children — never an `<svg>`. That
   is the whole trick that keeps this deck small: a caller places a glyph with
   one `<g transform="translate(x,y) scale(s/100)">`, so the same four paths
   serve as the pip on a numeral card, the corner mark on a court card, the
   big motif on an ace and the icon in the bidding panel. 32 cards, four
   shapes.

   Strokes are drawn with `vectorEffect="non-scaling-stroke"` NOWHERE on
   purpose: the outline must thin out with the glyph, otherwise a 24-unit pip
   becomes a black blob at `sm`.
   ────────────────────────────────────────────────────────────────────── */

/** srce — the one suit shared with the French deck. */
function Heart({ main }: { main: string }) {
    return (
        <path
            d="M50 94C18 70 6 52 6 34 6 17 18 6 32 6c9 0 15 5 18 12 3-7 9-12 18-12 14 0 26 11 26 28 0 18-12 36-44 60Z"
            fill={main}
            stroke={INK}
            strokeWidth={4}
            strokeLinejoin="round"
        />
    )
}

/** list / zelena — a linden leaf with a midrib and a short stem. */
function Leaf({ main, alt }: { main: string; alt: string }) {
    return (
        <>
            <path
                d="M50 4c12 16 42 26 44 48 2 20-18 30-34 25l-7-2v21h-6V75l-7 2C24 82 4 72 6 52 8 30 38 20 50 4Z"
                fill={main}
                stroke={INK}
                strokeWidth={4}
                strokeLinejoin="round"
            />
            <path d="M50 16v58" stroke={alt} strokeWidth={4} strokeLinecap="round" />
        </>
    )
}

/** žir — a brown nut under a gold cap.
 *
 *  The printed pack has it the other way round (gold nut, dark cap), but then
 *  žir and bundeva are both dominantly gold, and at 56 px in a fan that is the
 *  one confusion a trick-taking game cannot afford. Brown-dominant also
 *  matches the suit colour the design system assigns žir (DESIGN §3). */
function Acorn({ main, alt }: { main: string; alt: string }) {
    return (
        <>
            <path
                d="M50 97c-20 0-31-16-31-34 0-13 14-21 31-21s31 8 31 21c0 18-11 34-31 34Z"
                fill={main}
                stroke={INK}
                strokeWidth={4}
                strokeLinejoin="round"
            />
            <path d="M46 12V2h8v10Z" fill={INK} />
            <path
                d="M50 7C27 7 13 23 13 35c0 7 6 10 14 10h46c8 0 14-3 14-10C87 23 73 7 50 7Z"
                fill={alt}
                stroke={INK}
                strokeWidth={4}
                strokeLinejoin="round"
            />
        </>
    )
}

/** bundeva — a hawking bell: knob, body, rim, clapper. */
function Bell({ main, alt }: { main: string; alt: string }) {
    return (
        <>
            <circle cx={50} cy={11} r={8} fill={alt} stroke={INK} strokeWidth={4} />
            <circle cx={50} cy={11} r={3} fill={FACE} />
            <path
                d="M43 19C25 26 20 44 20 60c0 11-5 19-11 23h82c-6-4-11-12-11-23 0-16-5-34-23-41Z"
                fill={main}
                stroke={INK}
                strokeWidth={4}
                strokeLinejoin="round"
            />
            <rect x={5} y={81} width={90} height={9} rx={4} fill={alt} stroke={INK} strokeWidth={4} />
            <circle cx={50} cy={97} r={7} fill={alt} stroke={INK} strokeWidth={4} />
        </>
    )
}

/**
 * One suit glyph in a 100 × 100 local box. Wrap it in a `<g transform>` to
 * place and size it; `mono` collapses the two-tone printing to a single
 * colour, which is what the tiny corner marks and the settings thumbnails
 * want (two colours at 14 px is mud).
 */
export default function SuitGlyph({ suit, mono = false }: { suit: Suit; mono?: boolean }) {
    const { main, alt: printed } = SUIT_PALETTE[suit]
    const alt = mono ? main : printed
    if (suit === "HERC") return <Heart main={main} />
    if (suit === "PIK") return <Leaf main={main} alt={alt} />
    if (suit === "TREF") return <Acorn main={main} alt={alt} />
    return <Bell main={main} alt={alt} />
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
