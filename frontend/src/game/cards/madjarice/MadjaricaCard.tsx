import type { Rank, Suit } from "@bela/engine"
import { RANK_HU_MARK } from "../../util/cards"
import { SUIT_PALETTE, ACE_PALETTE, FACE, HAIRLINE, INK, NUMERAL_FONT } from "./palette"
import SuitGlyph, { Pip } from "./SuitGlyph"
import CourtFigure from "./figures"
import SeasonVignette from "./vignettes"

/* ──────────────────────────────────────────────────────────────────────────
   MadjaricaCard — one Hungarian (Tell-pattern) card face as inline SVG.

   Drawn rather than scanned. The public-domain Tell scans on Wikimedia are
   photographs of worn 1930s decks: at the sizes this game actually renders a
   card (56 px wide in a trick) the roman numeral is a smudge, the four suits
   photograph at four different white balances, and no two cards in a shot are
   square to the lens. A flat vector face is legible at 56 px, identical
   across the pack, crisp at any DPI, and carries no attribution burden —
   game/DESIGN.md §2.1 allows either.

   The geometry is a real Tell card's:
     · 200 × 300 (2:3), cream face, thin double frame;
     · numeral cards VII–X: roman numeral in the corner, two overlapping pip
       columns flanking a stem, mirrored across the middle;
     · courts: a waist-up figure, **doppeldeutsch** — the identical `<g>`
       rotated 180° for the lower half, with the corner suit mark coming
       along for the ride;
     · aces: the one undoubled card — a big suit glyph standing on a season
       vignette, because a Tell ace names a season (srce = proljeće,
       bundeva = ljeto, list = jesen, žir = zima).
   ────────────────────────────────────────────────────────────────────── */

/**
 * Pip layout. A Tell VII–X shows exactly as many pips as its value, split
 * across the two halves: the top half carries ⌈n/2⌉, the bottom ⌊n/2⌋, so a
 * VII is 4 over 3 and a X is 5 over 5. Each half is rendered from the same
 * template (the bottom one rotated 180°), only the pip count differs.
 *
 *   3 → two flanking the stem + one on top of it
 *   4 → two columns of two
 *   5 → two columns of two + one on top of the stem
 */
type HalfPips = 3 | 4 | 5
function halfPips(rank: "7" | "8" | "9" | "10", top: boolean): HalfPips {
    const n = Number(rank)
    return (top ? Math.ceil(n / 2) : Math.floor(n / 2)) as HalfPips
}

const PIP_SIZE = 34
const PIP_ROWS = { one: 78, two: 118 }
const COL_X = { left: 52, right: 148 }
const CORNER = 30
const CORNER_SIZE = 30

function isNumeral(rank: Rank): rank is "7" | "8" | "9" | "10" {
    return rank === "7" || rank === "8" || rank === "9" || rank === "10"
}

/** One half's pips (3, 4 or 5) around the stem. */
function PipHalf({ suit, pips }: { suit: Suit; pips: HalfPips }) {
    const crown = pips === 3 || pips === 5
    const rows = pips === 3 ? [PIP_ROWS.two] : [PIP_ROWS.one, PIP_ROWS.two]
    return (
        <>
            {crown && <Pip suit={suit} x={100} y={40} size={PIP_SIZE} />}
            {rows.map((y) => (
                <g key={y}>
                    <Pip suit={suit} x={COL_X.left} y={y} size={PIP_SIZE} />
                    <Pip suit={suit} x={COL_X.right} y={y} size={PIP_SIZE} />
                </g>
            ))}
        </>
    )
}

/** One half of a VII–X. The caller rotates it to make the bottom half. */
function NumeralHalf({ suit, pips, mark }: { suit: Suit; pips: HalfPips; mark: string }) {
    const { main } = SUIT_PALETTE[suit]
    const crown = pips === 3 || pips === 5
    return (
        <>
            <path
                d={`M100 ${crown ? 58 : 40}V146`}
                stroke={main}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
            />
            <path
                d="M100 100q-13-4-17-16M100 100q13-4 17-16"
                stroke={main}
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
            />
            <PipHalf suit={suit} pips={pips} />
            <text
                x={18}
                y={46}
                fill={INK}
                fontFamily={NUMERAL_FONT}
                fontSize={32}
                fontWeight={700}
                letterSpacing={-0.5}
            >
                {mark}
            </text>
        </>
    )
}

/** The top half of a court card: the figure plus its corner suit mark. */
function CourtHalf({ suit, rank }: { suit: Suit; rank: "J" | "Q" | "K" }) {
    return (
        <>
            <CourtFigure suit={suit} court={rank} />
            <Pip suit={suit} x={CORNER} y={CORNER} size={CORNER_SIZE} />
        </>
    )
}

/** The ace — a whole-card picture, not a doubled half. */
function AceFace({ suit }: { suit: Suit }) {
    const { sky, ground, motif } = ACE_PALETTE[suit]
    return (
        <>
            <rect x={24} y={42} width={152} height={216} rx={12} fill={sky} stroke={HAIRLINE} strokeWidth={1.5} />
            <path d="M24 214h152v32a12 12 0 0 1-12 12H36a12 12 0 0 1-12-12Z" fill={ground} />
            <SeasonVignette suit={suit} motif={motif} />
            <Pip suit={suit} x={100} y={172} size={120} />
            <Pip suit={suit} x={CORNER} y={CORNER} size={CORNER_SIZE} />
            <g transform="rotate(180 100 150)">
                <Pip suit={suit} x={CORNER} y={CORNER} size={CORNER_SIZE} />
            </g>
        </>
    )
}

export default function MadjaricaCard({ rank, suit }: { rank: Rank; suit: Suit }) {
    return (
        <svg
            viewBox="0 0 200 300"
            width="100%"
            height="100%"
            aria-hidden="true"
            focusable="false"
            style={{ display: "block" }}
        >
            <rect x={1} y={1} width={198} height={298} rx={14} fill={FACE} stroke={INK} strokeWidth={2} />
            <rect x={8} y={8} width={184} height={284} rx={9} fill="none" stroke={HAIRLINE} strokeWidth={1.5} />
            {rank === "A" ? (
                <AceFace suit={suit} />
            ) : (
                <>
                    <path d="M9 150h182" stroke={HAIRLINE} strokeWidth={1.2} />
                    {isNumeral(rank) ? (
                        <>
                            <NumeralHalf suit={suit} pips={halfPips(rank, true)} mark={RANK_HU_MARK[rank]} />
                            <g transform="rotate(180 100 150)">
                                <NumeralHalf suit={suit} pips={halfPips(rank, false)} mark={RANK_HU_MARK[rank]} />
                            </g>
                        </>
                    ) : (
                        <>
                            <CourtHalf suit={suit} rank={rank} />
                            <g transform="rotate(180 100 150)">
                                <CourtHalf suit={suit} rank={rank} />
                            </g>
                        </>
                    )}
                </>
            )}
        </svg>
    )
}

/**
 * The bare suit glyph as a standalone `<svg>` — what the bidding panel, the
 * trump indicator and the scoreboard put next to a word. `mono` by default:
 * the printed two-tone acorn is mud below ~20 px.
 */
export function MadjaricaSuitIcon({ suit, mono = true }: { suit: Suit; mono?: boolean }) {
    return (
        <svg viewBox="-4 -4 108 108" width="100%" height="100%" aria-hidden="true" focusable="false" style={{ display: "block" }}>
            <SuitGlyph suit={suit} mono={mono} />
        </svg>
    )
}
