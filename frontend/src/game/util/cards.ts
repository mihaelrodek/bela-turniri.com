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

/** A suit for a caller that has none of its own — the blok's belot, which is
 *  entered by hand and never says which eight cards they were. Call it from
 *  an event handler, never from a render body. */
export function randomSuit(): Suit {
    return SUITS[Math.floor(Math.random() * SUITS.length)]
}

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

/* ─────────────────────────── the deck registry ───────────────────────────

   Four selectable decks since 2026-09-20 (game/DESIGN.md §2.1). THREE of them
   are mađarice — same Tell pattern, same names, same aria labels, same card
   box — and differ only in how a face is painted:

     klasicne   the licensed tomasdrus set (github.com/tomasdrus/
                hungarian-playing-cards, used with the author's permission for
                bela-turniri.com, 2026-09-20) — 363×585 RGBA WebP, the image
                IS the card. DEFAULT, and the only deck that also ships its own
                suit icons (see `suitImage`), so a called trump is shown in the
                artwork the player is actually holding.
     moderne    our own older scanned deck, cleaned into the SAME geometry, so
                it renders through the exact same code path (no crop, no filter).
     vektorske  our own inline-SVG faces — no raster at all, the SVG is the
                card. This is the code that used to be only the pre-decode
                fallback in `cards/madjarice/MadjaricaCard.tsx`.
     francuske  the original CSS card (rank + ♥♦♠♣), unchanged.

   `DeckStyle` lives here rather than in `useGamePrefs` so the pure helpers
   below need no hook import; the hook re-exports this type.
   ────────────────────────────────────────────────────────────────────── */

/** Which deck a card is drawn as. The ids are the PERSISTED pref values. */
export type DeckStyle = "klasicne" | "moderne" | "vektorske" | "francuske"

/** Every deck, in the order the settings sheet offers them. */
export const DECK_STYLES = ["klasicne", "moderne", "vektorske", "francuske"] as const

export const DEFAULT_DECK: DeckStyle = "moderne"

export function isDeckStyle(value: unknown): value is DeckStyle {
    return (DECK_STYLES as readonly string[]).includes(value as string)
}

/**
 * Mađarice — everything except the French deck. Drives the Hungarian NAMES
 * (suit/rank/season keys, aria labels) and the Hungarian card BOX (taller
 * 363×585 ratio, artwork radius, drop shadow instead of a frame).
 */
export function isHungarianDeck(deck: DeckStyle): boolean {
    return deck !== "francuske"
}

/**
 * Decks whose faces are raster files on disk. `vektorske` and `francuske` are
 * drawn, so they need no preload, no decode gate and no offline caching.
 */
export function deckHasImages(deck: DeckStyle): boolean {
    return deck === "klasicne" || deck === "moderne"
}

/**
 * Fixed card ink (game/DESIGN.md §3). A playing card is a physical object —
 * cream face, dark ink, the four suit colours — so these do NOT follow the
 * theme, in either deck. Everything AROUND the card is on the brand palette.
 */
export const CARD_INK = {
    face: "#f7f1e3",
    /** The CSS-painted card back's base tone. The Hungarian FACES no longer
     *  use it: since the licensed deck (2026-09-20) the artwork carries its
     *  own white face and rounded edge, so the card root is transparent. */
    frame: "#f3f5f2",
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
    return isHungarianDeck(deck) ? suitHuKey(suit) : suitKey(suit)
}

export function rankKeyFor(rank: Rank, deck: DeckStyle): string {
    return isHungarianDeck(deck) ? rankHuKey(rank) : rankKey(rank)
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
    if (isHungarianDeck(deck) && rank === "A") {
        return t("game.card.ariaAce", { suit: t(suitHuKey(suit)), season: t(seasonKey(suit)) })
    }
    return t("game.card.aria", {
        rank: t(rankKeyFor(rank, deck)),
        suit: t(suitKeyFor(suit, deck)),
    })
}

/**
 * Fixed display order for every hand: heart, bell, leaf, acorn, matching the
 * bidding controls and the Hungarian deck itself. Trump never moves a
 * suit to the front, so the same card always occupies the same relative place
 * from one shuffle and deal to the next. Ranks stay in natural low-to-high
 * order within their suit.
 */
export function sortHandForDisplay(hand: readonly Card[]): Card[] {
    return [...hand].sort((a, b) => {
        const suitDelta = SUITS.indexOf(cardSuit(a)) - SUITS.indexOf(cardSuit(b))
        if (suitDelta !== 0) return suitDelta
        return RANKS.indexOf(cardRank(a)) - RANKS.indexOf(cardRank(b))
    })
}

/* ─────────────────────────── card metrics ─────────────────────────── */

/** `ml` exists for the desktop hand only: a step between `md` and `lg`, the
 *  biggest card whose row of eight still fits the column beside my avatar. */
export type CardSize = "sm" | "md" | "ml" | "lg"

/**
 * One table of card geometry, so a card in the trick, a card in the hand and
 * a card in the declarations overlay are the same object at three scales.
 *
 * These base metrics are 2:3 for the French deck. The mađarice artwork uses
 * the same widths with its own slightly taller height below. `md` is the hand
 * size on a phone: 72 px wide stays a 44 px+
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
    ml: { w: "84px", h: "126px", rankFont: "22px", pipFont: "40px", cornerFont: "17px", radius: "md" },
    lg: { w: "96px", h: "144px", rankFont: "25px", pipFont: "46px", cornerFont: "19px", radius: "md" },
}

/**
 * The Hungarian artwork's own aspect, 363 × 585 = 0.6205 — a touch narrower
 * than the modern 2:3 French card in CARD_METRICS.
 *
 * These are `CARD_METRICS[size].w / 0.6205`, rounded (2026-09-20): the deck is
 * now a digital one whose file IS the card, so the box must match the file or
 * the art letterboxes inside it. Every value is slightly SMALLER than the old
 * 3:5 box the photographs used, so no layout that was tuned around a card can
 * overflow because of this.
 */
export const MADJARICA_HEIGHT: Record<CardSize, string> = {
    sm: "90px",
    md: "116px",
    ml: "135px",
    lg: "155px",
}

/**
 * Corner radius of the artwork itself — measured from the source alpha: the
 * first opaque pixel of the top row sits 22 px in on a 363 px wide card, i.e.
 * 6 % of the width. The card root uses this (not `CARD_METRICS.radius`) so the
 * focus ring and the selected outline hug the drawn edge instead of floating
 * around a squarer box, and nothing of the art is clipped.
 */
export const MADJARICA_RADIUS: Record<CardSize, string> = {
    sm: "3px",
    md: "4px",
    ml: "5px",
    lg: "6px",
}

/**
 * A card has no border any more (2026-09-20, user request: "modern, no
 * borders, like bela.fun"), so its separation from the felt and from its
 * neighbours in the fan comes from a shadow. `drop-shadow` rather than
 * `box-shadow` because it follows the artwork's ALPHA — a box shadow would
 * draw the rectangle the transparent corners just got rid of.
 */
export const CARD_SHADOW = "drop-shadow(0 1px 1px rgba(0,0,0,0.28)) drop-shadow(0 3px 6px rgba(0,0,0,0.22))"
