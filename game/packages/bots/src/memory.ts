/* ──────────────────────────────────────────────────────────────────────────
   The bot's MEMORY OF THE DEAL (BOT.md §16, owner's request 2026-09-29).

   Four suits, eight cards each. For every one of the 32 cards the bot keeps,
   for this deal only, the answer to "where can it still be?":

     - in my hand, or already played                       → settled;
     - CERTAINLY with one seat (a declaration named it, the bela showed it,
       or the other two seats have been ruled out)         → `holder`;
     - POSSIBLY with a seat                                → `canHold`;
     - IMPOSSIBLE for a seat, because his own play proved it.

   The proofs are the rules of §1.5 read backwards. A card is never played
   freely: you must follow suit, you must go over the card that holds the
   trick when you can, and with no card of the led suit you must trump. So
   every card a seat plays is also a statement about the cards he did NOT
   play:

     1. he did not follow the led suit      → he has no card of that suit;
     2. …and what he threw was not a trump  → he has no trump either;
     3. he followed, but UNDER the card that held the trick (and the trick
        had not been ruffed)                → he has no card of that suit
                                              above the one that held it;
     4. he ruffed UNDER a trump already on the table
                                            → he has no trump above that one.

   The reported example is rule 3: acorns led, 7 – 9 – 8. The third seat
   played the 8 under the 9, so he holds nothing above the 9; the 7 and the 8
   are on the table, so he holds no acorn at all and ruffs the next round.

   Counting then finishes what the proofs start: a card two of the three
   unseen seats cannot hold is in the third; a seat whose hand is filled by
   cards known to be his can hold nothing else. Both are run to a fixpoint.

   Nothing here is a guess. `canHold === false` and `holder !== null` are
   certainties under the rules; "probably" lives in `likelyCount`, which only
   splits what is still open by hand size.

   Pure function of the PlayerView, like everything else in this package. A
   bot gets the whole trick record (`viewFor(…, { recallTricks: true })`), so
   the memory covers the deal from the first card; with only `lastTrick`
   available it simply knows less.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, PlayerView, Seat, Suit, TrickCard, WonTrick } from "@bela/engine"
import { RANKS, SEATS, SUITS, cardStrength, cardSuit, makeCard, teamOf } from "@bela/engine"

export interface DealMemory {
    /** Cards nobody has played and I do not hold — the ones still hidden. */
    readonly hidden: readonly Card[]
    /** Could `seat` still be holding `card`? False is a proof, true is not. */
    canHold(seat: Seat, card: Card): boolean
    /** The seat that CERTAINLY holds `card`, or null when it is still open
     *  (or the card is played / in my own hand). */
    holder(card: Card): Seat | null
    /** Every seat that could still hold `card`. */
    possibleHolders(card: Card): Seat[]
    /** Hidden cards of `suit` that `seat` could still hold. */
    possibleInSuit(seat: Seat, suit: Suit): Card[]
    /** Proved to hold no card of `suit`. */
    isVoid(seat: Seat, suit: Suit): boolean
    /** Hidden cards `seat` certainly holds. */
    certainCards(seat: Seat): Card[]
    /**
     * How many cards of `suit` `seat` is EXPECTED to hold: the ones he holds
     * for certain, plus his share of the open ones, split among the seats
     * that can still hold each. An estimate, not a proof.
     */
    likelyCount(seat: Seat, suit: Suit): number
}

/** The completed tricks this seat may look at, oldest first. */
export function rememberedTricks(view: PlayerView): readonly WonTrick[] {
    const history = view.trickHistory
    if (history !== undefined && history !== null) return history
    return view.lastTrick === null ? [] : [view.lastTrick]
}

/** The card holding the trick among `plays` (non-empty), by §1.5. */
function holdingCard(plays: readonly TrickCard[], trump: Suit): Card {
    let best = (plays[0] as TrickCard).card
    for (const play of plays.slice(1)) {
        const suit = cardSuit(play.card)
        const bestSuit = cardSuit(best)
        if (suit === bestSuit) {
            if (cardStrength(play.card, trump) > cardStrength(best, trump)) best = play.card
        } else if (suit === trump) {
            best = play.card
        }
    }
    return best
}

const ALL_CARDS: readonly Card[] = SUITS.flatMap((suit) => RANKS.map((rank) => makeCard(rank, suit)))

const cache = new WeakMap<PlayerView, DealMemory>()

/** The memory of this deal as `view.seat` has it. Cached per view object. */
export function recall(view: PlayerView): DealMemory {
    const known = cache.get(view)
    if (known !== undefined) return known
    const built = build(view)
    cache.set(view, built)
    return built
}

function build(view: PlayerView): DealMemory {
    const me = view.seat
    const trump = view.bidding.trump

    const gone = new Set<Card>(view.played)
    for (const tc of view.trick.cards) gone.add(tc.card)
    for (const trick of rememberedTricks(view)) for (const play of trick.plays) gone.add(play.card)
    const mine = new Set<Card>(view.hand)
    const hidden = ALL_CARDS.filter((card) => !gone.has(card) && !mine.has(card))

    const others = SEATS.filter((seat) => seat !== me)
    /** seat → hidden cards he provably does not hold. */
    const excluded = new Map<Seat, Set<Card>>()
    for (const seat of others) excluded.set(seat, new Set<Card>())
    const certain = new Map<Card, Seat>()

    const exclude = (seat: Seat, card: Card): void => {
        excluded.get(seat)?.add(card)
    }
    const excludeSuit = (seat: Seat, suit: Suit, aboveStrength = -1): void => {
        if (trump === null) return
        for (const card of hidden) {
            if (cardSuit(card) === suit && cardStrength(card, trump) > aboveStrength) exclude(seat, card)
        }
    }
    const locate = (card: Card, seat: Seat): void => {
        if (seat === me || gone.has(card) || mine.has(card)) return
        certain.set(card, seat)
        for (const other of others) if (other !== seat) exclude(other, card)
    }

    /* ── what the rules prove, play by play ─────────────────────────────── */
    const readTrick = (plays: readonly TrickCard[]): void => {
        if (trump === null) return
        const opener = plays[0]
        if (opener === undefined) return
        const led = cardSuit(opener.card)
        for (let i = 1; i < plays.length; i++) {
            const play = plays[i] as TrickCard
            if (play.seat === me) continue
            const holding = holdingCard(plays.slice(0, i), trump)
            const ruffed = led !== trump && cardSuit(holding) === trump
            const suit = cardSuit(play.card)

            if (suit === led) {
                // Followed, but under the card that held the trick: nothing
                // above that card. A ruffed trick lifts the obligation.
                if (!ruffed && cardStrength(play.card, trump) < cardStrength(holding, trump)) {
                    excludeSuit(play.seat, led, cardStrength(holding, trump))
                }
                continue
            }
            // Did not follow: void in the led suit.
            excludeSuit(play.seat, led)
            if (suit !== trump) {
                // …and did not trump either: no trump at all.
                excludeSuit(play.seat, trump)
            } else if (ruffed && cardStrength(play.card, trump) < cardStrength(holding, trump)) {
                // Trumped under a trump already there: nothing above it.
                excludeSuit(play.seat, trump, cardStrength(holding, trump))
            }
        }
    }
    for (const trick of rememberedTricks(view)) readTrick(trick.plays)
    readTrick(view.trick.cards)

    /* ── what was SAID: declarations and the bela ───────────────────────── */
    for (const [key, list] of Object.entries(view.declarations)) {
        const seat = Number(key) as Seat
        for (const declaration of list ?? []) for (const card of declaration.cards) locate(card, seat)
    }
    if (trump !== null && view.belaDeclared !== null && view.belaDeclared !== undefined) {
        const king = makeCard("K", trump)
        const queen = makeCard("Q", trump)
        const record = [...rememberedTricks(view).flatMap((trick) => trick.plays), ...view.trick.cards]
        const announced = record.find(
            (play) => (play.card === king || play.card === queen) && teamOf(play.seat) === view.belaDeclared,
        )
        if (announced !== undefined) locate(announced.card === king ? queen : king, announced.seat)
    }

    /* ── counting, to a fixpoint ────────────────────────────────────────── */
    const open = (seat: Seat, card: Card): boolean =>
        view.handSizes[seat] > 0 && excluded.get(seat)?.has(card) !== true
    let changed = true
    while (changed) {
        changed = false
        // A card only one seat can hold is in that seat.
        for (const card of hidden) {
            if (certain.has(card)) continue
            const able = others.filter((seat) => open(seat, card))
            if (able.length === 1) {
                locate(card, able[0] as Seat)
                changed = true
            }
        }
        // A hand filled by known cards has room for nothing else.
        for (const seat of others) {
            const held = hidden.filter((card) => certain.get(card) === seat)
            if (held.length < view.handSizes[seat]) continue
            for (const card of hidden) {
                if (certain.get(card) === seat || excluded.get(seat)?.has(card) === true) continue
                exclude(seat, card)
                changed = true
            }
        }
    }

    const canHold = (seat: Seat, card: Card): boolean => {
        if (seat === me) return mine.has(card)
        if (gone.has(card) || mine.has(card)) return false
        return open(seat, card)
    }
    const possibleHolders = (card: Card): Seat[] => SEATS.filter((seat) => canHold(seat, card))
    const possibleInSuit = (seat: Seat, suit: Suit): Card[] =>
        (seat === me ? view.hand : hidden).filter((card) => cardSuit(card) === suit && canHold(seat, card))

    return {
        hidden,
        canHold,
        holder: (card) => certain.get(card) ?? null,
        possibleHolders,
        possibleInSuit,
        isVoid: (seat, suit) => possibleInSuit(seat, suit).length === 0,
        certainCards: (seat) => hidden.filter((card) => certain.get(card) === seat),
        likelyCount: (seat, suit) => {
            let total = 0
            for (const card of possibleInSuit(seat, suit)) {
                if (seat === me || certain.get(card) === seat) total += 1
                else total += 1 / Math.max(1, possibleHolders(card).length)
            }
            return total
        },
    }
}
