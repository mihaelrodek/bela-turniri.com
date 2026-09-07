/* Cards — README §1.1 and §1.3.

   A card id is `${Rank}${Suit}`, e.g. "JHERC", "10PIK". Every suit name is
   exactly 4 characters long (HERC, KARA, PIK_, TREF — well, PIK is 3), so we
   parse by matching the known suffixes rather than by a fixed offset. */

import type { Card, Rank, Suit } from "./types"
import { RANKS, SUITS } from "./types"

/** Strength inside the trump suit: J > 9 > A > 10 > K > Q > 8 > 7. */
const TRUMP_STRENGTH: Record<Rank, number> = {
    "7": 0,
    "8": 1,
    Q: 2,
    K: 3,
    "10": 4,
    A: 5,
    "9": 6,
    J: 7,
}

/** Strength in a plain suit: A > 10 > K > Q > J > 9 > 8 > 7. */
const PLAIN_STRENGTH: Record<Rank, number> = {
    "7": 0,
    "8": 1,
    "9": 2,
    J: 3,
    Q: 4,
    K: 5,
    "10": 6,
    A: 7,
}

const TRUMP_POINTS: Record<Rank, number> = {
    "7": 0,
    "8": 0,
    "9": 14,
    "10": 10,
    J: 20,
    Q: 3,
    K: 4,
    A: 11,
}

const PLAIN_POINTS: Record<Rank, number> = {
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 10,
    J: 2,
    Q: 3,
    K: 4,
    A: 11,
}

const RANK_INDEX: Record<Rank, number> = {
    "7": 0,
    "8": 1,
    "9": 2,
    "10": 3,
    J: 4,
    Q: 5,
    K: 6,
    A: 7,
}

const SUIT_INDEX: Record<Suit, number> = { HERC: 0, KARA: 1, PIK: 2, TREF: 3 }

export function makeCard(rank: Rank, suit: Suit): Card {
    return `${rank}${suit}`
}

export function cardSuit(card: Card): Suit {
    for (const suit of SUITS) {
        if (card.endsWith(suit)) return suit
    }
    // Unreachable for well-typed Card values; keeps the function total.
    throw new Error(`Nepoznata boja karte: ${card}`)
}

export function cardRank(card: Card): Rank {
    return card.slice(0, card.length - cardSuit(card).length) as Rank
}

/** 0..7 within its own suit; only comparable between cards of the same suit. */
export function cardStrength(card: Card, trump: Suit): number {
    const rank = cardRank(card)
    return cardSuit(card) === trump ? TRUMP_STRENGTH[rank] : PLAIN_STRENGTH[rank]
}

export function cardPoints(card: Card, trump: Suit): number {
    const rank = cardRank(card)
    return cardSuit(card) === trump ? TRUMP_POINTS[rank] : PLAIN_POINTS[rank]
}

/** Position of a rank in the NATURAL order 7 8 9 10 J Q K A (sequences, sorting). */
export function rankIndex(rank: Rank): number {
    return RANK_INDEX[rank]
}

export function suitIndex(suit: Suit): number {
    return SUIT_INDEX[suit]
}

/**
 * Deterministic display/storage order: by suit in SUITS order, then by natural
 * rank. The UI relies on this being stable, so never make it trump-dependent.
 */
export function sortHand(hand: readonly Card[]): Card[] {
    return hand.slice().sort((a, b) => {
        const s = suitIndex(cardSuit(a)) - suitIndex(cardSuit(b))
        if (s !== 0) return s
        return rankIndex(cardRank(a)) - rankIndex(cardRank(b))
    })
}

/** All 32 cards, suit-major in SUITS order, natural rank order inside a suit. */
export function fullDeck(): Card[] {
    const deck: Card[] = []
    for (const suit of SUITS) {
        for (const rank of RANKS) deck.push(makeCard(rank, suit))
    }
    return deck
}
