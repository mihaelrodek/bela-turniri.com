import type { Suit } from "@bela/engine"
import { CARD_INK, SUIT_HU_COLOR } from "../../util/cards"

/* ──────────────────────────────────────────────────────────────────────────
   Colour for the `vektorske` deck — our OWN drawn mađarice (game/DESIGN.md
   §2.1). Since 2026-09-20 this is a deck a player picks, not a loading
   stand-in, so the palette is art direction and not just "something in the
   right hue".

   Fixed, not tokenised: a card is a physical object and looks the same in a
   dark room as in a bright one (game/DESIGN.md §3).

   House rules the whole deck is built on:
     · FLAT. One fill per shape. No gradients, no filters, no opacity stacks —
       12 of these render at once on a phone, and the same SVG is still the
       pre-decode stand-in for the two raster decks.
     · Outlines are the suit's OWN dark tone, never black. Black hairlines go
       grey and muddy once a 200-unit card is drawn 56 px wide; a dark tone of
       the fill just reads as a firmer edge.
     · Four hues, four silhouettes. Colour alone must never be what separates
       two suits — see `SuitGlyph.tsx`.
   ────────────────────────────────────────────────────────────────────── */

/** The untinted stock. Kept for callers outside the artwork (index.ts
 *  re-exports it); the faces themselves use `FACE_TINT`. */
export const FACE = CARD_INK.face

/**
 * The face tint, per suit. A bela player's hardest moment is the trick pile:
 * four cards, overlapped and skewed, read in under a second. So the card
 * stock itself carries the suit — barely, about 3 % off white, enough that
 * four cards side by side separate before you have looked at anything on
 * them, not enough to stop reading as a white card on its own.
 */
export const FACE_TINT: Record<Suit, string> = {
    HERC: "#fceded", // srce — the faintest warm pink
    KARA: "#fdf5dd", // bundeva — warm cream
    PIK: "#ecf6ec", // list — cool green-white
    TREF: "#f1f0ea", // žir — a cool stone, so it never reads as the bells' cream
}
export const INK = CARD_INK.ink
export const SKIN = "#f0c49c"
export const SKIN_SHADE = "#d9a273"
export const STEEL = "#93a0ab"
/** Court hair/beard and the line weight inside a figure. */
export const HAIR = "#4a3527"
export const FIG_LINE = "#3b3228"

export interface SuitPalette {
    /** The suit's own colour — pips, the big ace glyph, the trump indicator. */
    main: string
    /** A dark tone of `main`: every outline and inner division in the glyph. */
    line: string
    /** The second printed colour every Tell pip carries (acorn cap, bell band…). */
    alt: string
    /** Court robes, so the four suits' figures are told apart at a glance. */
    robe: string
    /** Robe trim / collar — the robe's own dark tone. */
    robeLine: string
}

export const SUIT_PALETTE: Record<Suit, SuitPalette> = {
    // srce — red heart, spring
    HERC: { main: SUIT_HU_COLOR.HERC, line: "#8c1b1f", alt: "#7d4f96", robe: "#2f6ea0", robeLine: "#1d4666" },
    // bundeva — gold hawking bell with a red band, summer
    KARA: { main: SUIT_HU_COLOR.KARA, line: "#9a6a05", alt: "#c0272d", robe: "#3f8a58", robeLine: "#255a38" },
    // list / zelena — green linden leaf, autumn
    PIK: { main: SUIT_HU_COLOR.PIK, line: "#1c5e37", alt: "#8fbf5f", robe: "#b03a32", robeLine: "#75201b" },
    // žir — brown acorn under a green cap, winter
    TREF: { main: SUIT_HU_COLOR.TREF, line: "#4f2f12", alt: "#2f7a45", robe: "#465579", robeLine: "#2b3550" },
}

/** Ace ("Daus") scenery: one flat season tint, one ground band, one motif. */
export interface AcePalette {
    sky: string
    ground: string
    motif: string
    /** Second motif tone — a flat shadow shape, never an opacity. */
    motifAlt: string
}

export const ACE_PALETTE: Record<Suit, AcePalette> = {
    // proljeće — blossom over new grass
    HERC: { sky: "#fdeef0", ground: "#8cc472", motif: "#ef7f9a", motifAlt: "#f2c33c" },
    // ljeto — high sun over ripe field
    KARA: { sky: "#fdf3d8", ground: "#e3bf55", motif: "#f0a326", motifAlt: "#c97f16" },
    // jesen — falling leaves over turned earth
    PIK: { sky: "#f2f4e9", ground: "#b99553", motif: "#d1731c", motifAlt: "#9c4f14" },
    // zima — snowflake over snow
    TREF: { sky: "#eef4f9", ground: "#c3d9ea", motif: "#6f9cc2", motifAlt: "#9dbfd9" },
}

/** Georgia is on every target platform and is the closest thing to the slab
 *  serif the roman numerals are printed in, with no webfont to download. */
export const NUMERAL_FONT = "Georgia, 'Times New Roman', serif"
