import type { Suit } from "@bela/engine"
import { CARD_INK, SUIT_HU_COLOR } from "../../util/cards"

/* ──────────────────────────────────────────────────────────────────────────
   Colour for the Hungarian (Tell / "doppeldeutsch") deck.

   Fixed, not tokenised: a card is a physical object and looks the same in a
   dark room as in a bright one (game/DESIGN.md §3). Every card is built from
   the five constants below plus its suit's three-colour set, so the deck can
   never drift into a fifth green or a second red.
   ────────────────────────────────────────────────────────────────────── */

export const FACE = CARD_INK.face
export const INK = CARD_INK.ink
/** Frame lines and hairlines — ink at a fraction, baked so SVG needs no opacity. */
export const HAIRLINE = "#b8ad97"
export const SKIN = "#e9c19b"
export const STEEL = "#9aa3ab"

export interface SuitPalette {
    /** The suit's own colour — pips, numerals' accent, the ace glyph. */
    main: string
    /** The second colour every Tell pip carries (acorn cap, bell rim…). */
    alt: string
    /** Court robes, so the four suits' figures are told apart at a glance. */
    robe: string
}

export const SUIT_PALETTE: Record<Suit, SuitPalette> = {
    // srce — red heart, spring
    HERC: { main: SUIT_HU_COLOR.HERC, alt: "#8e1b20", robe: "#2f5d8a" },
    // bundeva — gold bell with a red rim, summer
    KARA: { main: SUIT_HU_COLOR.KARA, alt: "#a8331f", robe: "#4a7a4f" },
    // list / zelena — green linden leaf, autumn
    PIK: { main: SUIT_HU_COLOR.PIK, alt: "#1d5c36", robe: "#8e1b20" },
    // žir — brown acorn with a gold nut, winter
    TREF: { main: SUIT_HU_COLOR.TREF, alt: CARD_INK.gold, robe: "#3f4a63" },
}

/** Ace ("Daus") scenery: a flat two-band vignette plus one motif colour. */
export interface AcePalette {
    sky: string
    ground: string
    motif: string
}

export const ACE_PALETTE: Record<Suit, AcePalette> = {
    HERC: { sky: "#f7ece9", ground: "#a8cf96", motif: "#e6899b" }, // proljeće — cvijet
    KARA: { sky: "#fbf1dc", ground: "#e0c46a", motif: "#e8a83a" }, // ljeto — sunce
    PIK: { sky: "#eef3ea", ground: "#c2a86a", motif: "#c8791f" }, // jesen — otpali list
    TREF: { sky: "#edf1f5", ground: "#dbe4ec", motif: "#8fa8bd" }, // zima — pahulja
}

/** Georgia is on every target platform and is the closest thing to the slab
 *  serif the roman numerals are printed in, with no webfont to download. */
export const NUMERAL_FONT = "Georgia, 'Times New Roman', serif"
