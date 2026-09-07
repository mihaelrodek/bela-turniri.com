import type { Card, Rank, Suit } from "@bela/engine"

/* ──────────────────────────────────────────────────────────────────────────
   Card id parsing + presentation, for the UI ONLY.

   These are deliberate local re-implementations of a handful of pure helpers
   that `@bela/engine` also exports. The UI must not pull the engine's RUNTIME
   in: `@bela/engine`'s entry point drags in the whole rules/scoring/state
   machine, and the browser bundle has no business carrying the authoritative
   rules — the server is authoritative and every legal move already arrives in
   `PlayerView.legalMoves`. So we import the engine's TYPES (erased at build
   time) and keep these four-line parsers here.

   Card ids are `${Rank}${Suit}`, e.g. "JHERC", "10PIK". "10" is the only
   two-character rank and "PIK" the only three-character suit, so the parse
   works off the SUFFIX rather than a fixed offset.
   ────────────────────────────────────────────────────────────────────── */

/** Same order as the engine's `SUITS` — the UI sorts and lays out by it. */
export const SUITS: readonly Suit[] = ["HERC", "KARA", "PIK", "TREF"]

/** Natural rank order (also the order sequences/terce use). */
export const RANKS: readonly Rank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"]

/** French pips — the app renders these, while the NAMES stay Croatian/Slovenian. */
export const SUIT_SYMBOL: Record<Suit, string> = {
    HERC: "♥",
    KARA: "♦",
    PIK: "♠",
    TREF: "♣",
}

/** Hearts and diamonds are the red pair, as on any French-suited deck. */
export const SUIT_IS_RED: Record<Suit, boolean> = {
    HERC: true,
    KARA: true,
    PIK: false,
    TREF: false,
}

/** The suit part of a card id. Falls back to HERC for a malformed id rather
 *  than throwing — a bad frame must never blank the table. */
export function cardSuit(card: Card | string): Suit {
    for (const suit of SUITS) {
        if (card.endsWith(suit)) return suit
    }
    return "HERC"
}

/** The rank part of a card id ("10PIK" → "10"). */
export function cardRank(card: Card | string): Rank {
    const suit = cardSuit(card)
    const head = card.slice(0, card.length - suit.length)
    return (RANKS as readonly string[]).includes(head) ? (head as Rank) : "7"
}

export function makeCard(rank: Rank, suit: Suit): Card {
    return `${rank}${suit}` as Card
}

/* ─────────────────── Hungarian ("mađarice", Tell) deck ───────────────────

   Bela is played with Hungarian cards, so the SAME engine `Suit`/`Rank` gets
   a second presentation: German suits (acorns/leaves/bells/hearts) and the
   unter/ober court pair instead of jack/queen. The engine is untouched — the
   mapping below is presentation only, and the French deck stays available as
   a setting (`useGamePrefs().deck`). See game/DESIGN.md §2.1.

   HERC → srce (heart, red)      KARA → bundeva (bell, gold)
   PIK  → list  (leaf,  green)   TREF → žir     (acorn, brown)
   7 8 9 10 → VII VIII IX X;  J → Dolnji (unter), Q → Gornji (ober),
   K → Kralj, A → As (a Tell ace carries a season).
   ────────────────────────────────────────────────────────────────────── */

/** Which deck a card is drawn as. Mirrors `DeckStyle` in `useGamePrefs`, but
 *  lives here so the pure helpers below need no hook import. */
export type DeckStyle = "madjarice" | "francuske"

/**
 * Fixed card ink (game/DESIGN.md §3). A playing card is a physical object —
 * cream face, dark ink, the four suit colours — so these do NOT follow the
 * theme, in either deck. Everything AROUND the card is on the brand palette.
 */
export const CARD_INK = {
    face: "#f7f1e3",
    /** The French deck's face is a touch whiter — it is a modern card. */
    faceFrench: "#fdfdfb",
    ink: "#1c1c1c",
    red: "#c0272d",
    green: "#2f8f52",
    brown: "#7a4a1d",
    gold: "#d9a521",
} as const

/** Suit colour on the Hungarian deck — four distinct hues, not two. */
export const SUIT_HU_COLOR: Record<Suit, string> = {
    HERC: CARD_INK.red,
    KARA: CARD_INK.gold,
    PIK: CARD_INK.green,
    TREF: CARD_INK.brown,
}

/**
 * What is PRINTED on a Hungarian card: roman numerals, and nothing at all on
 * the courts (a Tell court is told apart by its figure, not by a letter).
 * Not in the dictionaries because it is ink on a card, not language — the
 * same reason the French deck's "J"/"Q"/"K" are identical in hr and sl.
 */
export const RANK_HU_MARK: Record<Rank, string> = {
    "7": "VII",
    "8": "VIII",
    "9": "IX",
    "10": "X",
    J: "",
    Q: "",
    K: "",
    A: "",
}

/** The season printed on a Tell ace ("Daus"). */
export type Season = "proljece" | "ljeto" | "jesen" | "zima"

export const SUIT_SEASON: Record<Suit, Season> = {
    HERC: "proljece",
    KARA: "ljeto",
    PIK: "jesen",
    TREF: "zima",
}

/** i18n key for a suit's spoken name — "herc" / "srce". */
export function suitKey(suit: Suit): string {
    return `game.suit.${suit}`
}

/** i18n key for a rank's spoken name — "dečko" / "fant". */
export function rankKey(rank: Rank): string {
    return `game.rank.${rank}`
}

/** i18n key for a suit's Hungarian-deck name — "žir" / "želod". */
export function suitHuKey(suit: Suit): string {
    return `game.suitHu.${suit}`
}

/** i18n key for a rank's Hungarian-deck name — "dolnji" / "spodnji". */
export function rankHuKey(rank: Rank): string {
    return `game.rankHu.${rank}`
}

/** i18n key for the season on a Tell ace — "proljeće" / "pomlad". */
export function seasonKey(suit: Suit): string {
    return `game.season.${suit}`
}

/** Deck-aware key pair, so one call site labels either deck. */
export function suitKeyFor(suit: Suit, deck: DeckStyle): string {
    return deck === "francuske" ? suitKey(suit) : suitHuKey(suit)
}

export function rankKeyFor(rank: Rank, deck: DeckStyle): string {
    return deck === "francuske" ? rankKey(rank) : rankHuKey(rank)
}

/**
 * Accessible name for a card, e.g. "dečko herc" — this is what a screen
 * reader announces and what the tap target is labelled with, since the card
 * face itself is a glyph a screen reader cannot read out sensibly.
 *
 * `deck` defaults to the French names so every existing caller keeps its
 * current output; `PlayingCard` passes the player's actual deck, which on the
 * default (Hungarian) deck reads "dolnji žir" / "sedmica list".
 */
export function cardAriaLabel(
    t: (key: string, params?: Record<string, string | number>) => string,
    card: Card,
    deck: DeckStyle = "francuske",
): string {
    const suit = cardSuit(card)
    const rank = cardRank(card)
    // The Tell ace is the one card whose face names a season, so it says so.
    if (deck === "madjarice" && rank === "A") {
        return t("game.card.ariaAce", { suit: t(suitHuKey(suit)), season: t(seasonKey(suit)) })
    }
    return t("game.card.aria", {
        rank: t(rankKeyFor(rank, deck)),
        suit: t(suitKeyFor(suit, deck)),
    })
}

/**
 * Display order for a hand: suits grouped, trump first, then alternating
 * colours so two red suits never sit next to each other (the classic way a
 * bela player fans their cards — misreading ♥ for ♦ mid-trick is the single
 * most common misclick). Within a suit, high cards to the right in NATURAL
 * order; the trump ranking is deliberately NOT used, because a hand re-sorted
 * into trump order every deal is disorienting.
 */
export function sortHandForDisplay(hand: readonly Card[], trump: Suit | null): Card[] {
    const order = suitDisplayOrder(trump)
    return [...hand].sort((a, b) => {
        const suitDelta = order.indexOf(cardSuit(a)) - order.indexOf(cardSuit(b))
        if (suitDelta !== 0) return suitDelta
        return RANKS.indexOf(cardRank(a)) - RANKS.indexOf(cardRank(b))
    })
}

/* ─────────────────────────── card metrics ─────────────────────────── */

export type CardSize = "sm" | "md" | "lg"

/**
 * One table of card geometry, so a card in the trick, a card in the hand and
 * a card in the declarations overlay are the same object at three scales.
 *
 * All three are a true **2:3** — a real card's proportion, and the ratio the
 * Hungarian artwork's `0 0 200 300` viewBox is drawn in, so the SVG never has
 * to letterbox. `md` is the hand size on a phone: 72 px wide stays a 44 px+
 * tap target even once the fan overlaps the cards by a third, which is the
 * accessibility floor for a control a player hits sixteen times a deal.
 */
export const CARD_METRICS: Record<CardSize, {
    w: string
    h: string
    rankFont: string
    pipFont: string
    cornerFont: string
    radius: string
}> = {
    sm: { w: "56px", h: "84px", rankFont: "15px", pipFont: "26px", cornerFont: "12px", radius: "sm" },
    md: { w: "72px", h: "108px", rankFont: "19px", pipFont: "34px", cornerFont: "15px", radius: "md" },
    lg: { w: "96px", h: "144px", rankFont: "25px", pipFont: "46px", cornerFont: "19px", radius: "md" },
}

/** Trump suit first, the rest alternating red/black around it. */
export function suitDisplayOrder(trump: Suit | null): Suit[] {
    const base: Suit[] = ["HERC", "PIK", "KARA", "TREF"]
    if (!trump) return base
    return [trump, ...base.filter((s) => s !== trump)]
}
