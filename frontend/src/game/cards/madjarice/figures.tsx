import type { Suit } from "@bela/engine"
import { CARD_INK } from "../../util/cards"
import { FIG_LINE, HAIR, SKIN, SKIN_SHADE, STEEL, SUIT_PALETTE } from "./palette"
import { Pip } from "./SuitGlyph"

/* ──────────────────────────────────────────────────────────────────────────
   Court figures — Dolnji (unter), Gornji (ober), Kralj.

   NOT doppeldeutsch any more (2026-09-20). A Tell court is traditionally one
   waist-up figure mirrored across the middle, and that is what this file drew
   until today — but two half-figures means each one is half the size, and in
   a skewed trick pile at 70 px a half-figure is a coloured smudge. So: ONE
   upright bust filling the whole card, head ~40 % of the card's width, and
   the card stays readable upside-down through the rotated corner index that
   `VectorFace` stamps on every card anyway. Size beat symmetry.

   Art direction:

     · THREE READS, IN ORDER. The corner letter (J / Q / K, see
       `VectorFace.RANK_MARK`) is the guarantee; the headwear is the glance —
       a low soft cap, a wide brim over long hair, a crown; the face is the
       close read — the Unter young and clean-shaven, the Ober neither, the
       King bearded.
     · THE SUIT IS ON HIS CHEST. A full-size suit mark sits on the robe, so
       the suit survives even when both corners are covered in the pile. That
       is the one thing bela.fun does not do and the reason these read faster.
     · Everything is centred on x = 100 and the bust bleeds to a rounded
       bottom that echoes the card's own corner radius, so the figure looks
       cropped by the card rather than floating in it.
     · Flat fills, one dark tone per material (`robeLine`, `FIG_LINE`), no
       gradients. Everything but the headwear and the facial hair is shared
       geometry recoloured per suit, so a court costs ~34 elements.
   ────────────────────────────────────────────────────────────────────── */

const FEATHER = "#f0dca8"
const CX = 100

/** Neck, robe, collar and the suit mark on the chest — shared by all three. */
function Bust({ suit, robe, robeLine }: { suit: Suit; robe: string; robeLine: string }) {
    return (
        <>
            <path d="M85 140h30v46H85Z" fill={SKIN_SHADE} />
            <path
                d="M36 272v-56c0-23 17-38 38-42l12-3h28l12 3c21 4 38 19 38 42v56a14 14 0 0 1-14 14H50a14 14 0 0 1-14-14Z"
                fill={robe}
                stroke={robeLine}
                strokeWidth={3}
                strokeLinejoin="round"
            />
            <path d="M80 183 100 216 120 183c-13-4-27-4-40 0Z" fill={robeLine} />
            <Pip suit={suit} x={CX} y={250} size={56} />
        </>
    )
}

/** The head: hair mass, face, eyes, and the facial hair that separates the
 *  three ranks once the card is actually in your hand. */
function Head({ beard }: { beard?: boolean }) {
    return (
        <>
            <circle cx={CX} cy={116} r={43} fill={HAIR} />
            <circle cx={CX} cy={112} r={40} fill={SKIN} stroke={FIG_LINE} strokeWidth={3} />
            {beard && (
                <path
                    d="M64 118c0 32 16 50 36 50s36-18 36-50c-10 16-62 16-72 0Z"
                    fill={HAIR}
                    stroke={FIG_LINE}
                    strokeWidth={2.6}
                    strokeLinejoin="round"
                />
            )}
            <circle cx={86} cy={108} r={4.2} fill={FIG_LINE} />
            <circle cx={114} cy={108} r={4.2} fill={FIG_LINE} />
            {!beard && (
                <path
                    d="M90 132c6 6 14 6 20 0"
                    fill="none"
                    stroke={FIG_LINE}
                    strokeWidth={3.4}
                    strokeLinecap="round"
                />
            )}
        </>
    )
}

/** A hat feather: a tapered blade with a spine, so it does not read as a
 *  weapon at 56 px. Both are kept clear of the card's top edge. */
function Feather({ d, spine }: { d: string; spine: string }) {
    return (
        <>
            <path d={d} fill={FEATHER} stroke={FIG_LINE} strokeWidth={2.2} strokeLinejoin="round" />
            <path d={spine} stroke={FIG_LINE} strokeWidth={1.8} fill="none" />
        </>
    )
}

/** Dolnji — the young foot soldier: a low soft cap over short hair. */
function Dolnji({ suit, robe, robeLine, alt }: { suit: Suit; robe: string; robeLine: string; alt: string }) {
    return (
        <>
            <Feather d="M138 60c14-13 25-21 34-28-10 17-22 30-34 36Z" spine="M170 36 139 66" />
            <Bust suit={suit} robe={robe} robeLine={robeLine} />
            <Head />
            <path d="M66 82c0-26 68-26 68 0v5H66Z" fill={alt} stroke={FIG_LINE} strokeWidth={3} strokeLinejoin="round" />
            <rect x={58} y={83} width={84} height={14} rx={7} fill={alt} stroke={FIG_LINE} strokeWidth={3} />
        </>
    )
}

/** Gornji — the wide feathered brim, and long hair under it. */
function Gornji({ suit, robe, robeLine, alt }: { suit: Suit; robe: string; robeLine: string; alt: string }) {
    return (
        <>
            <Feather d="M136 56c17-16 30-25 41-33-12 21-27 36-41 44Z" spine="M177 26 137 62" />
            <ellipse cx={56} cy={158} rx={16} ry={42} fill={HAIR} />
            <ellipse cx={144} cy={158} rx={16} ry={42} fill={HAIR} />
            <Bust suit={suit} robe={robe} robeLine={robeLine} />
            <Head />
            <path d="M64 78c0-30 72-30 72 0v4H64Z" fill={alt} stroke={FIG_LINE} strokeWidth={3} strokeLinejoin="round" />
            <ellipse cx={CX} cy={83} rx={58} ry={13} fill={alt} stroke={FIG_LINE} strokeWidth={3} />
        </>
    )
}

/** Kralj — crown and beard. No sceptre: the mirrored copy used to put a
 *  second gold rod on the far side of the card, and nothing was gained. */
function Kralj({ suit, robe, robeLine }: { suit: Suit; robe: string; robeLine: string }) {
    return (
        <>
            <Bust suit={suit} robe={robe} robeLine={robeLine} />
            <Head beard />
            <path
                d="M58 80 64 26l16 26 20-32 20 32 16-26 6 54Z"
                fill={CARD_INK.gold}
                stroke={FIG_LINE}
                strokeWidth={3}
                strokeLinejoin="round"
            />
            <rect x={57} y={76} width={86} height={16} rx={4} fill={CARD_INK.gold} stroke={FIG_LINE} strokeWidth={3} />
            <circle cx={CX} cy={84} r={4.6} fill={STEEL} />
            <circle cx={76} cy={84} r={3.6} fill={STEEL} />
            <circle cx={124} cy={84} r={3.6} fill={STEEL} />
        </>
    )
}

/** One upright court bust, filling the card. The corner rank/suit indices are
 *  stamped by `VectorFace` on every card, so nothing rank-specific is drawn
 *  outside the figure itself. */
export default function CourtFigure({ suit, court }: { suit: Suit; court: "J" | "Q" | "K" }) {
    const { robe, robeLine, alt } = SUIT_PALETTE[suit]
    if (court === "J") return <Dolnji suit={suit} robe={robe} robeLine={robeLine} alt={alt} />
    if (court === "Q") return <Gornji suit={suit} robe={robe} robeLine={robeLine} alt={alt} />
    return <Kralj suit={suit} robe={robe} robeLine={robeLine} />
}
