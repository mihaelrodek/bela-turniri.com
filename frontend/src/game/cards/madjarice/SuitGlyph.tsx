import type { Suit } from "@bela/engine"
import { INK, SUIT_PALETTE } from "./palette"

const PRINT_RED = "#b72b22"
const PRINT_GOLD = "#e0bf18"
const PRINT_GREEN = "#34753a"
const PRINT_DARK_GREEN = "#20542e"

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
        <>
            <path
                d="M50 94C18 70 6 52 6 34 6 17 18 6 32 6c9 0 15 5 18 12 3-7 9-12 18-12 14 0 26 11 26 28 0 18-12 36-44 60Z"
                fill={main} stroke={INK} strokeWidth={3.5} strokeLinejoin="round"
            />
            <path d="M50 20c5-9 12-12 20-10 13 4 20 16 18 29-3 17-15 31-38 49Z" fill={PRINT_RED} opacity={0.55} />
            <path d="M50 20v66" fill="none" stroke={INK} strokeWidth={1.5} opacity={0.55} />
        </>
    )
}

/** list / zelena — a linden leaf with a midrib and a short stem. */
function Leaf({ main, alt }: { main: string; alt: string }) {
    return (
        <>
            <path
                d="M50 4C40 18 10 23 7 48 4 69 22 84 46 76l4 20 4-20c24 8 42-7 39-28C90 23 60 18 50 4Z"
                fill={PRINT_GOLD}
                stroke={INK}
                strokeWidth={3.5}
                strokeLinejoin="round"
            />
            <path d="M50 5c10 13 40 19 43 43 3 21-15 36-39 28L50 96Z" fill={main} />
            <path d="M50 12v67M50 30 29 22M50 43 17 37M50 57 15 57M50 70 27 79M50 30l21-8M50 43l33-6M50 57h35M50 70l23 9"
                fill="none" stroke={alt} strokeWidth={2.2} strokeLinecap="round" />
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
                d="M50 98C30 98 19 81 19 63c0-14 14-23 31-23s31 9 31 23c0 18-11 35-31 35Z"
                fill={alt}
                stroke={INK}
                strokeWidth={3.5}
                strokeLinejoin="round"
            />
            <path d="M50 42v53c15-3 24-17 24-32 0-11-10-19-24-21Z" fill={main} opacity={0.85} />
            <path d="M50 43v51" stroke={INK} strokeWidth={1.5} opacity={0.55} />
            <rect x="18" y="35" width="64" height="11" rx="4" fill={PRINT_RED} stroke={INK} strokeWidth={3} />
            <path
                d="M50 4C29 4 15 19 14 34c0 7 6 10 14 10h44c8 0 14-3 14-10C85 19 71 4 50 4Z"
                fill={PRINT_GREEN}
                stroke={INK}
                strokeWidth={3.5}
                strokeLinejoin="round"
            />
            <path d="M24 35c5-10 10-10 15 0 5-10 10-10 15 0 5-10 10-10 15 0 4-8 8-9 12-3"
                fill="none" stroke={PRINT_DARK_GREEN} strokeWidth={4} strokeLinecap="round" />
        </>
    )
}

/** bundeva — a hawking bell: knob, body, rim, clapper. */
function Bell({ main, alt }: { main: string; alt: string }) {
    return (
        <>
            <path
                d="M50 4C26 4 13 20 13 40c0 17 8 29 15 36h44c7-7 15-19 15-36C87 20 74 4 50 4Z"
                fill={PRINT_GOLD}
                stroke={INK}
                strokeWidth={3.5}
                strokeLinejoin="round"
            />
            <path d="M50 6c19 0 31 13 31 34 0 14-7 25-13 31H50Z" fill={main} opacity={0.5} />
            <path d="M46 5h8v18h-8Z" fill={INK} />
            <rect x="10" y="55" width="80" height="14" rx="5" fill={alt} stroke={INK} strokeWidth={3} />
            <path d="M19 61h62M25 56c3 8 7 8 10 0 3 8 7 8 10 0 3 8 7 8 10 0 3 8 7 8 10 0 3 8 7 8 10 0"
                fill="none" stroke={PRINT_RED} strokeWidth={2} />
            <path d="M20 68h60c-2 17-13 24-30 24S22 85 20 68Z" fill={PRINT_GREEN} stroke={INK} strokeWidth={3.5} />
            <path d="M25 76c5-8 10-8 15 0 5-8 10-8 15 0 5-8 10-8 15 0" fill="none" stroke={PRINT_DARK_GREEN} strokeWidth={4} strokeLinecap="round" />
            <circle cx="50" cy="96" r="4" fill={PRINT_RED} stroke={INK} strokeWidth={2.5} />
        </>
    )
}

/**
 * One suit glyph in a 100 × 100 local box. Wrap it in a `<g transform>` to
 * place and size it; `mono` collapses the two-tone printing to a single
 * colour for the secondary etched lines when a caller needs a quieter mark.
 * The main printed colours remain intact so the suit never changes identity.
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
