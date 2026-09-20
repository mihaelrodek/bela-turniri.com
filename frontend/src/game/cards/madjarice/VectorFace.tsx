import type { Rank, Suit } from "@bela/engine"
import { ACE_PALETTE, FACE_TINT, INK, NUMERAL_FONT } from "./palette"
import { Pip } from "./SuitGlyph"
import CourtFigure from "./figures"
import SeasonVignette from "./vignettes"

/* ──────────────────────────────────────────────────────────────────────────
   The `vektorske` face — our own drawn mađarica, 200 × 300 (game/DESIGN.md
   §2.1). Since 2026-09-20 this is a deck a player chooses, not the sub-second
   stand-in it started as; it is STILL that stand-in for the two raster decks
   (`MadjaricaCard` decides), which is why every rule below is also a budget.

   THE BRIEF IS THE TRICK PILE. Four cards land overlapped and skewed by a
   dozen degrees, seventy pixels wide, and a player has to know what was
   thrown before the next one lands. Everything here is bent to that, even
   where it costs tradition:

     · ONE BIG NUMERAL, NO PIP GRID. VII–X are a single roman numeral dead
       centre, as large as the card is wide, with one large suit glyph above
       and one below. Counting four-over-three pips is exactly the work the
       pile does not give you time for.
     · CORNER INDICES, TWICE. Rank mark plus a small suit mark, top-left and
       again bottom-right rotated 180° — so a card is identified by the one
       corner that is showing, whichever way up it sits. This is what replaces
       the doppeldeutsch mirror, and it is why the courts could stop being
       mirrored at all (see `figures.tsx`).
     · THE FACE IS TINTED BY SUIT. ~3 % off white (`FACE_TINT`), so four
       overlapping cards separate before you read anything on them.
     · LETTERS ON THE COURTS. See `RANK_MARK` below for which letters and
       why they are not translated.
     · FLAT. Fills and one dark tone per material. No filters, no blur, no
       gradients. A numeral card is ~26 elements, a court ~34, an ace ~24 —
       roughly a third of the old pip-grid deck, which matters because this
       is still what the raster decks show while they decode.
   ────────────────────────────────────────────────────────────────────── */

/* The printed rim. A real card's edge is a thin dark line, not an ink border —
   and since the root is transparent (no white frame behind it) this rect is
   the only thing that gives the card its silhouette. It has to hold on green
   felt, on a dark table AND on the light theme's pale green-grey, so it stays
   a proper dark line rather than a grey hairline. */
const EDGE = "#3d3a34"
/** 12 / 200 = 6 % of the width, the radius a real card is guillotined to. */
const RADIUS = 12

/**
 * What is printed as the rank, in both corners.
 *
 * VII–X are the Tell numerals. The courts get J / Q / K and the ace A —
 * the SAME marks the app's `rankShort.*` dictionary carries, which is
 * identical in `hr` and `sl` on purpose ("kratice na samoj karti … to su
 * oznake na špilu, ne riječi"). An initial of the Hungarian NAME cannot be
 * used: hr says dolnji/gornji → D/G and sl says spodnji/zgornji → S/Z, so the
 * letter would change with the interface language — and ink on a physical
 * card does not. The spoken name stays Croatian/Slovenian in the aria label
 * and everywhere else (`rankHuKey`), which is where language belongs.
 */
const RANK_MARK: Record<Rank, string> = {
    "7": "VII",
    "8": "VIII",
    "9": "IX",
    "10": "X",
    J: "J",
    Q: "Q",
    K: "K",
    A: "A",
}

/* The big centred numeral. `textLength` pins the drawn width whatever font
   actually resolves — Georgia on every target platform, but a fallback must
   not be allowed to push a VIII past the card's edge, and a numeral that
   overflows in the pile is the exact failure this deck exists to fix. The
   sizes are chosen so the four numerals share a cap height wherever the width
   allows it, and only VIII (five glyphs wide) steps down. */
const BIG: Record<"7" | "8" | "9" | "10", { size: number; width: number }> = {
    "7": { size: 98, width: 148 },
    "8": { size: 82, width: 156 },
    "9": { size: 102, width: 114 },
    "10": { size: 104, width: 76 },
}
/** Georgia's cap height is ≈ 0.69 em; half of it centres the numeral on 150. */
const CAP = 0.345

/* Corner index. This is the deck's guarantee: in a trick pile the cards
   overlap from the left, so the top-left corner is the ONE region that is
   always showing, and it alone has to name the card. It is therefore drawn
   big — a 34-unit letter over a 26-unit suit mark, about a third larger than
   a French deck's index — and everything else on the card gives way to it. */
const INDEX = { x: 14, baseline: 46, size: 34, markX: 26, markY: 70, markSize: 26 }
/** The two large suit marks a numeral card carries. */
const FIELD = { y: { top: 74, bottom: 226 }, size: 52 }

function isNumeral(rank: Rank): rank is "7" | "8" | "9" | "10" {
    return rank === "7" || rank === "8" || rank === "9" || rank === "10"
}

/** One corner's rank mark + suit mark. The card draws it twice, the second
 *  time rotated 180° about the centre. */
function CornerIndex({ suit, mark }: { suit: Suit; mark: string }) {
    return (
        <>
            <text
                x={INDEX.x}
                y={INDEX.baseline}
                fill={INK}
                fontFamily={NUMERAL_FONT}
                fontSize={INDEX.size}
                fontWeight={700}
                letterSpacing={-0.5}
            >
                {mark}
            </text>
            <Pip suit={suit} x={INDEX.markX} y={INDEX.markY} size={INDEX.markSize} />
        </>
    )
}

/** VII–X: one numeral, one suit mark above it and one below. */
function NumeralFace({ rank, suit }: { rank: "7" | "8" | "9" | "10"; suit: Suit }) {
    const { size, width } = BIG[rank]
    return (
        <>
            <Pip suit={suit} x={100} y={FIELD.y.top} size={FIELD.size} />
            <Pip suit={suit} x={100} y={FIELD.y.bottom} size={FIELD.size} />
            <text
                x={100}
                y={150 + size * CAP}
                textAnchor="middle"
                textLength={width}
                lengthAdjust="spacingAndGlyphs"
                fill={INK}
                fontFamily={NUMERAL_FONT}
                fontSize={size}
                fontWeight={700}
            >
                {RANK_MARK[rank]}
            </text>
        </>
    )
}

/** The ace — the one card that is a picture: its season, and a suit mark big
 *  enough to be the whole point of looking at it. */
function AceFace({ suit }: { suit: Suit }) {
    const { ground, motif, motifAlt } = ACE_PALETTE[suit]
    return (
        <>
            <path d="M26 252h148v20a14 14 0 0 1-14 14H40a14 14 0 0 1-14-14Z" fill={ground} />
            <SeasonVignette suit={suit} motif={motif} motifAlt={motifAlt} />
            <Pip suit={suit} x={100} y={190} size={140} />
        </>
    )
}

/**
 * One mađarica face, as SVG children of a `viewBox="0 0 200 300"` root.
 * Rendering it apart from `MadjaricaCard` is deliberate: the card component
 * owns the deck switch and the image decode, this owns the drawing.
 */
export default function VectorFace({ rank, suit }: { rank: Rank; suit: Suit }) {
    return (
        <>
            <rect
                x={0.8}
                y={0.8}
                width={198.4}
                height={298.4}
                rx={RADIUS}
                fill={FACE_TINT[suit]}
                stroke={EDGE}
                strokeWidth={1.6}
            />
            {rank === "A" ? (
                <AceFace suit={suit} />
            ) : isNumeral(rank) ? (
                <NumeralFace rank={rank} suit={suit} />
            ) : (
                <CourtFigure suit={suit} court={rank} />
            )}
            <CornerIndex suit={suit} mark={RANK_MARK[rank]} />
            <g transform="rotate(180 100 150)">
                <CornerIndex suit={suit} mark={RANK_MARK[rank]} />
            </g>
        </>
    )
}
