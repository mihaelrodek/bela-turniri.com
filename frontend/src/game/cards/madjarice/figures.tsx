import type { Suit } from "@bela/engine"
import { CARD_INK } from "../../util/cards"
import { INK, SKIN, STEEL, SUIT_PALETTE } from "./palette"

/* ──────────────────────────────────────────────────────────────────────────
   Court figures — Dolnji (unter), Gornji (ober), Kralj.

   A Tell court card is a **doppeldeutsch**: one waist-up figure drawn in the
   top half and repeated upside-down in the bottom, so the card reads the same
   whichever way it is picked up. So only the TOP half is authored here, in
   card coordinates (200 × 300, this half is y 0…150), and the composer
   rotates the exact same `<g>` 180° about the card's centre for the bottom.
   Half the drawing, and the two halves can never drift apart.

   Everything below the neck is shared; the three ranks differ only in
   headwear and what the figure holds, which is also how the real pattern
   tells them apart at a glance across a table.
   ────────────────────────────────────────────────────────────────────── */

const HAIR = "#4a3527"
const FEATHER = "#efd9a0"

/** Torso, head and beard — identical for all three courts, recoloured by suit. */
function Body({ robe, alt }: { robe: string; alt: string }) {
    return (
        <>
            <rect x={92} y={84} width={16} height={12} fill={SKIN} stroke={INK} strokeWidth={2} />
            <path
                d="M50 150v-22c0-13 9-22 20-24 5-10 16-15 30-15s25 5 30 15c11 2 20 11 20 24v22Z"
                fill={robe}
                stroke={INK}
                strokeWidth={2.5}
                strokeLinejoin="round"
            />
            <path d="M87 92 100 112 113 92c-8-4-18-4-26 0Z" fill={alt} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <circle cx={100} cy={70} r={18} fill={SKIN} stroke={INK} strokeWidth={2.5} />
            <path
                d="M83 71c0 16 8 24 17 24s17-8 17-24c-5 9-29 9-34 0Z"
                fill={HAIR}
                stroke={INK}
                strokeWidth={2}
                strokeLinejoin="round"
            />
            <circle cx={93} cy={66} r={2} fill={INK} />
            <circle cx={107} cy={66} r={2} fill={INK} />
        </>
    )
}

/** The arm that reaches out and grips a pole — the two ranks that carry one. */
function GripArm({ robe }: { robe: string }) {
    return (
        <>
            <path
                d="M126 106c10-3 19-7 25-10l4 12c-7 3-16 8-25 12Z"
                fill={robe}
                stroke={INK}
                strokeWidth={2.5}
                strokeLinejoin="round"
            />
            <circle cx={152} cy={102} r={7} fill={SKIN} stroke={INK} strokeWidth={2.5} />
        </>
    )
}

/** A hat feather: a tapered blade with a visible spine, so it does not read
 *  as a second weapon at 56 px. */
function Feather({ d, spine }: { d: string; spine: string }) {
    return (
        <>
            <path d={d} fill={FEATHER} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <path d={spine} stroke={INK} strokeWidth={1.6} fill="none" opacity={0.55} />
        </>
    )
}

/** Dolnji — the foot soldier: soft brimmed cap with a feather, and a halberd. */
function Dolnji({ robe, alt }: { robe: string; alt: string }) {
    return (
        <>
            <rect x={149} y={22} width={6} height={128} fill={CARD_INK.brown} stroke={INK} strokeWidth={2} />
            <path d="M152 2 158 22h-12Z" fill={STEEL} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <path d="M155 28 176 36v18l-21-8Z" fill={STEEL} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <Body robe={robe} alt={alt} />
            <GripArm robe={robe} />
            <Feather d="M120 42c11-11 22-14 28-19-9 12-18 21-27 26Z" spine="M147 24 121 47" />
            <path d="M78 55c2-21 42-21 44 0Z" fill={alt} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
            <rect x={70} y={52} width={60} height={9} rx={4.5} fill={alt} stroke={INK} strokeWidth={2.5} />
        </>
    )
}

/** Gornji — the nobleman: wide feathered hat and a sash, no weapon. */
function Gornji({ robe, alt }: { robe: string; alt: string }) {
    return (
        <>
            <Body robe={robe} alt={alt} />
            <path d="M72 104 116 150h20L86 96Z" fill={alt} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <Feather d="M122 38c19-17 35-24 46-32-13 20-28 35-45 43Z" spine="M167 7 123 48" />
            <path d="M78 53c1-24 43-24 44 0Z" fill={alt} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
            <ellipse cx={100} cy={53} rx={40} ry={9} fill={alt} stroke={INK} strokeWidth={2.5} />
        </>
    )
}

/** Kralj — crown and a cross-bearing sceptre. */
function Kralj({ robe, alt }: { robe: string; alt: string }) {
    return (
        <>
            <rect x={149} y={44} width={6} height={106} fill={CARD_INK.gold} stroke={INK} strokeWidth={2} />
            <circle cx={152} cy={34} r={11} fill={CARD_INK.gold} stroke={INK} strokeWidth={2} />
            <path d="M152 23v22M141 34h22" stroke={INK} strokeWidth={2} />
            <Body robe={robe} alt={alt} />
            <GripArm robe={robe} />
            <path
                d="M73 48 78 20l10 18 12-22 12 22 10-18 5 28Z"
                fill={CARD_INK.gold}
                stroke={INK}
                strokeWidth={2.5}
                strokeLinejoin="round"
            />
            <rect x={72} y={46} width={56} height={11} rx={3} fill={CARD_INK.gold} stroke={INK} strokeWidth={2.5} />
            <circle cx={100} cy={52} r={3.2} fill={alt} />
            <circle cx={84} cy={52} r={2.4} fill={alt} />
            <circle cx={116} cy={52} r={2.4} fill={alt} />
        </>
    )
}

/** The top half of a court card, ready to be rotated for the bottom half. */
export default function CourtFigure({ suit, court }: { suit: Suit; court: "J" | "Q" | "K" }) {
    const { robe, alt } = SUIT_PALETTE[suit]
    if (court === "J") return <Dolnji robe={robe} alt={alt} />
    if (court === "Q") return <Gornji robe={robe} alt={alt} />
    return <Kralj robe={robe} alt={alt} />
}
