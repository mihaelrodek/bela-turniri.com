/* ──────────────────────────────────────────────────────────────────────────
   Pure scoring/judgment helpers shared by the bots (game/README.md §5). No
   RNG, no I/O — every function here is a plain function of cards/PlayerView
   so it can be unit-tested with hand-built PlayerViews.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, Declaration, PlayerView, Seat, Suit, Team, TrickCard, WonTrick } from "@bela/engine"
import {
    RANKS,
    SEATS,
    SUITS,
    cardPoints,
    cardRank,
    cardStrength,
    cardSuit,
    makeCard,
    nextSeat,
    partnerOf,
    teamOf,
    trickWinner,
} from "@bela/engine"

/**
 * README §5 bidding heuristic: value of holding `hand` if `suit` becomes
 * trump. J 4, 9 3, A 1.5, 10 1, +0.5 per additional card of the suit.
 */
export function suitStrength(hand: readonly Card[], suit: Suit): number {
    let score = 0
    for (const card of hand) {
        if (cardSuit(card) !== suit) continue
        const rank = cardRank(card)
        if (rank === "J") score += 4
        else if (rank === "9") score += 3
        else if (rank === "A") score += 1.5
        else if (rank === "10") score += 1
        else score += 0.5
    }
    return score
}

/** The suit with the highest `suitStrength`; ties keep the first candidate. */
export function bestSuit(hand: readonly Card[], suits: readonly Suit[]): Suit {
    let best = suits[0] as Suit
    let bestScore = -Infinity
    for (const suit of suits) {
        const score = suitStrength(hand, suit)
        if (score > bestScore) {
            best = suit
            bestScore = score
        }
    }
    return best
}

/** How many cards of `suit` are in `hand`. */
export function suitLength(hand: readonly Card[], suit: Suit): number {
    let n = 0
    for (const card of hand) if (cardSuit(card) === suit) n++
    return n
}

/** Provisional winner of the trick as played so far, or null if it's empty. */
export function currentTrickWinner(view: PlayerView): Seat | null {
    if (view.trick.cards.length === 0) return null
    const trump = view.bidding.trump
    if (trump === null) return null
    return trickWinner(view.trick.cards, trump)
}

/** True when my partner (not me) currently holds the trick. */
export function isPartnerHoldingTrick(view: PlayerView): boolean {
    const seat = view.seat
    if (seat === null) return false
    const winner = currentTrickWinner(view)
    if (winner === null) return false
    return winner !== seat && teamOf(winner) === teamOf(seat)
}

/** True when this seat is about to play the trick's 4th (last) card. */
export function isLastToPlay(view: PlayerView): boolean {
    return view.trick.cards.length === 3
}

/** Would playing `card` right now make this seat the (provisional) winner? */
export function wouldWinTrick(view: PlayerView, card: Card): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false
    const cards = [...view.trick.cards, { seat, card }]
    return trickWinner(cards, trump) === seat
}

/** Highest-point card among `cards` (first occurrence wins ties). */
export function mostValuableCard(cards: readonly Card[], trump: Suit): Card {
    let best = cards[0] as Card
    let bestPoints = cardPoints(best, trump)
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const points = cardPoints(card, trump)
        if (points > bestPoints) {
            best = card
            bestPoints = points
        }
    }
    return best
}

/** Lowest-point card among `cards`; ties prefer a non-trump card. */
export function cheapestCard(cards: readonly Card[], trump: Suit): Card {
    let best = cards[0] as Card
    let bestPoints = cardPoints(best, trump)
    let bestIsTrump = cardSuit(best) === trump
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const points = cardPoints(card, trump)
        const isTrump = cardSuit(card) === trump
        if (points < bestPoints || (points === bestPoints && bestIsTrump && !isTrump)) {
            best = card
            bestPoints = points
            bestIsTrump = isTrump
        }
    }
    return best
}

/** "Strongest" card by rank inside its own suit; only meaningful for cards of
 *  ONE suit (`cardStrength` is not comparable across suits). */
export function strongestCard(cards: readonly Card[], trump: Suit): Card {
    let best = cards[0] as Card
    let bestStrength = cardStrength(best, trump)
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const strength = cardStrength(card, trump)
        if (strength > bestStrength) {
            best = card
            bestStrength = strength
        }
    }
    return best
}

/** "Weakest" card by trick-taking value: fewest points, then lowest strength. */
export function weakestCard(cards: readonly Card[], trump: Suit): Card {
    let best = cards[0] as Card
    let bestPoints = cardPoints(best, trump)
    let bestStrength = cardStrength(best, trump)
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const points = cardPoints(card, trump)
        const strength = cardStrength(card, trump)
        if (points < bestPoints || (points === bestPoints && strength < bestStrength)) {
            best = card
            bestPoints = points
            bestStrength = strength
        }
    }
    return best
}

/**
 * README §5 branch 3: the cheapest legal card that wins the trick right now,
 * or null when none does. Avoids spending trump J/9 on a poor trick (< 10
 * points accumulated) when a cheaper or non-trump winner is also available.
 */
export function cheapestWinningCard(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    const winners = legal.filter((card) => wouldWinTrick(view, card))
    if (winners.length === 0) return null

    const trickValueSoFar = view.trick.cards.reduce(
        (sum, tc) => sum + cardPoints(tc.card, trump),
        0,
    )
    const isTopTrump = (card: Card): boolean =>
        cardSuit(card) === trump && (cardRank(card) === "J" || cardRank(card) === "9")
    const safeWinners = winners.filter((card) => !isTopTrump(card))
    const pool = trickValueSoFar < 10 && safeWinners.length > 0 ? safeWinners : winners
    return cheapestCard(pool, trump)
}

/**
 * README §5 branch 4: discard the cheapest legal card by points, preferring a
 * non-trump card and, among ties, a card from the shortest suit in `hand`.
 */
export function cheapestDiscard(hand: readonly Card[], legal: readonly Card[], trump: Suit): Card {
    const suitLen = new Map<Suit, number>()
    for (const card of hand) {
        const suit = cardSuit(card)
        suitLen.set(suit, (suitLen.get(suit) ?? 0) + 1)
    }
    const score = (card: Card): readonly [number, number, number] => [
        cardPoints(card, trump),
        cardSuit(card) === trump ? 1 : 0,
        suitLen.get(cardSuit(card)) ?? 0,
    ]
    let best = legal[0] as Card
    let bestScore = score(best)
    for (let i = 1; i < legal.length; i++) {
        const card = legal[i] as Card
        const s = score(card)
        const isBetter =
            s[0] < bestScore[0] ||
            (s[0] === bestScore[0] &&
                (s[1] < bestScore[1] || (s[1] === bestScore[1] && s[2] < bestScore[2])))
        if (isBetter) {
            best = card
            bestScore = s
        }
    }
    return best
}

/* ──────────────────────────────────────────────────────────────────────────
   Counting and inference helpers. Everything below reads ONLY the PlayerView,
   i.e. public information: my own hand, the cards on the table, the completed
   tricks (`played`, plus the seat-attributed `trickHistory`/`lastTrick`) and
   the declarations, which are public once the trump is set (README §1.4).
   ────────────────────────────────────────────────────────────────────── */

/**
 * The completed tricks this seat may look at, oldest first. `trickHistory` is
 * the full seat-attributed record when the room allows reviewing tricks;
 * `null`/`undefined` means it may not, and then the only attributed trick left
 * is the last one (`played` is a flat card list with no seats).
 */
function reviewableTricks(view: PlayerView): readonly WonTrick[] {
    const history = view.trickHistory
    if (history !== undefined && history !== null) return history
    return view.lastTrick === null ? [] : [view.lastTrick]
}

/**
 * How many cards of `suit` are still held by the other three players: the 8 of
 * the suit minus the ones I hold and the ones already face up (completed tricks
 * plus the trick in progress).
 */
export function outstandingInSuit(view: PlayerView, suit: Suit): number {
    let accounted = 0
    for (const card of view.hand) if (cardSuit(card) === suit) accounted++
    for (const card of view.played) if (cardSuit(card) === suit) accounted++
    for (const tc of view.trick.cards) if (cardSuit(tc.card) === suit) accounted++
    return 8 - accounted
}

/**
 * Every card of `suit` that is neither in my hand nor face up — i.e. the ones
 * the other three seats can still be holding. `outstandingInSuit` is its size.
 */
export function outstandingCardsInSuit(view: PlayerView, suit: Suit): Card[] {
    const seen = new Set<Card>(view.hand)
    for (const card of view.played) seen.add(card)
    for (const tc of view.trick.cards) seen.add(tc.card)
    return RANKS.map((rank) => makeCard(rank, suit)).filter((card) => !seen.has(card))
}

/**
 * True when nothing still in play beats `card` inside its own suit — a
 * "master" card. For a plain suit that means it wins the trick whenever the
 * suit is led and nobody ruffs; for the trump suit it wins outright.
 */
export function isMasterCard(view: PlayerView, card: Card): boolean {
    const trump = view.bidding.trump
    if (trump === null) return false
    const mine = cardStrength(card, trump)
    return outstandingCardsInSuit(view, cardSuit(card)).every(
        (other) => cardStrength(other, trump) < mine,
    )
}

/**
 * Does this hand still hold anything that will actually take a trick once the
 * opponents are out of trumps — an ace, a 10 whose ace is gone, a top trump?
 * This is the "and then what?" test for drawing trumps: stripping the table
 * with nothing to cash afterwards is the deal the user described as
 * "ide do kraja … ali ništa ne napravi s tim".
 */
export function hasWinnersToCash(view: PlayerView): boolean {
    return view.hand.some((card) => isMasterCard(view, card))
}

/**
 * True when `seat` has provably shown void in `suit` — followed a lead of
 * `suit` with something else — in the trick in progress or in any trick this
 * seat can review. Never guesses: `false` means "not proven", not "he still
 * holds the suit".
 */
export function seatShownVoidIn(view: PlayerView, seat: Seat, suit: Suit): boolean {
    const showsVoid = (plays: readonly TrickCard[]): boolean => {
        const led = plays[0]
        if (led === undefined || cardSuit(led.card) !== suit) return false
        return plays.some((p) => p.seat === seat && cardSuit(p.card) !== suit)
    }

    if (showsVoid(view.trick.cards)) return true
    for (const trick of reviewableTricks(view)) if (showsVoid(trick.plays)) return true
    return false
}

/**
 * True when `seat` has provably shown void in TRUMP — the question the whole
 * trump count hangs on, and the one `seatShownVoidIn` alone cannot answer.
 *
 * Two proofs, both straight out of §1.5, both public:
 *   1. trump was led and he did not follow it (`seatShownVoidIn`);
 *   2. a PLAIN suit was led, he did not follow it either, and what he threw
 *      was not a trump. Being void in the led suit obliges him to ruff when he
 *      holds a trump — there is no partner exception — so a discard of a third
 *      suit proves he holds none.
 *
 * (2) is the half the bot was missing (2026-09-20, reported again): opponents
 * are stripped of trump by ruffing and discarding long before anybody leads
 * the suit at them, so waiting for proof (1) meant the count never registered
 * it and the bot kept "drawing trumps" out of its own partner.
 *
 * Cards only ever leave a hand, so the proof holds for the rest of the deal.
 */
export function seatShownVoidInTrump(view: PlayerView, seat: Seat): boolean {
    const trump = view.bidding.trump
    if (trump === null) return false
    if (seatShownVoidIn(view, seat, trump)) return true

    const discardedInsteadOfRuffing = (plays: readonly TrickCard[]): boolean => {
        const led = plays[0]
        if (led === undefined) return false
        const lead = cardSuit(led.card)
        if (lead === trump) return false // that is proof (1), already asked
        return plays.some(
            (p) =>
                p.seat === seat &&
                cardSuit(p.card) !== lead &&
                cardSuit(p.card) !== trump,
        )
    }

    if (discardedInsteadOfRuffing(view.trick.cards)) return true
    for (const trick of reviewableTricks(view)) {
        if (discardedInsteadOfRuffing(trick.plays)) return true
    }
    return false
}

/**
 * True when an OPPONENT has provably shown void in `suit`. Same caveat as
 * `seatShownVoidIn`: "not proven" is the default.
 */
export function opponentShownVoidIn(view: PlayerView, suit: Suit): boolean {
    const seat = view.seat
    if (seat === null) return false
    return SEATS.some((s) => teamOf(s) !== teamOf(seat) && seatShownVoidIn(view, s, suit))
}

/**
 * True when BOTH opponents have provably shown void in trump while trumps are
 * still outstanding — i.e. every trump I cannot see is in my PARTNER'S hand.
 *
 * From that moment a trump lead strips nobody but him (2026-09-20, reported:
 * both opponents discarded on the caller's first trump lead and she went on
 * leading trumps, pulling her own partner's out one by one). Proof only, like
 * everything else here: one opponent merely not having been tested is "no".
 *
 * Two independent proofs, and either is enough:
 *   - every outstanding trump is LOCATED on our own side — by a declaration,
 *     by the bela, or by a lead my partner made (`opponentCanHold`). Counting
 *     alone can settle it without anybody having been tested;
 *   - both opponents have SHOWN void in trump (`seatShownVoidInTrump`, which
 *     reads the discard-instead-of-ruff proof too), or have no cards left.
 */
export function onlyPartnerCanHoldTrumps(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false

    const outstanding = outstandingCardsInSuit(view, trump)
    // Nothing out means my partner has none either, so a trump lead takes
    // nothing off him — that is not this rule's case.
    if (outstanding.length === 0) return false

    const located = locatedCards(view)
    if (outstanding.every((card) => !opponentCanHold(view, card, located))) return true

    return SEATS.every(
        (s) =>
            teamOf(s) === teamOf(seat) ||
            view.handSizes[s] === 0 ||
            seatShownVoidInTrump(view, s),
    )
}

/**
 * True when no card of `suit` has been played yet — nobody has been led it,
 * and nobody has discarded it. The one moment a void in it is least likely.
 */
export function isFirstRoundOf(view: PlayerView, suit: Suit): boolean {
    return (
        !view.played.some((card) => cardSuit(card) === suit) &&
        !view.trick.cards.some((tc) => cardSuit(tc.card) === suit)
    )
}

/**
 * Fault (2), reworked 2026-09-09: should I LEAD the ace of `suit` now?
 *
 * An ace led into a suit an opponent is void in is 11 points handed to his
 * trump. Kept back, the same ace still fills a trick my partner wins later, or
 * takes a trick of its own once the trumps are gone. The previous version had
 * this backwards in two places — it spent the ace precisely when an opponent
 * had *shown void* in the suit or the suit was nearly exhausted, which is
 * exactly when it gets ruffed (the simulation probe counted 112 aces and tens
 * led straight into a ruff over 40 games). So the ace goes out only when the
 * ruff is unlikely or impossible:
 *   (a) no opponent can hold a trump any more (`trumpOutlook().opponentMax`);
 *       my partner ruffing my ace costs us nothing;
 *   (b) the deal is nearly over (≤ 2 cards in hand) — there is no later trick
 *       to cash it in, so it is now or never;
 *   (c) it is the FIRST round of the suit, no opponent has shown void in it,
 *       and at least four cards of it are outside my hand — three seats to
 *       share four or more cards makes a void the exception. The 10 behind the
 *       ace then rides home as the master of the suit on the next lead.
 * Anything else — a later round, a proven void, a suit I hold most of — keeps
 * the ace. One more veto, a consequence of §1.5 having no partner exception:
 * a PARTNER who has shown void in the suit and may still hold a trump would be
 * forced to ruff my own winning ace, so that suit is not led with the ace
 * while he can be holding one. The trump ace is not covered here: nothing can
 * trump it.
 */
export function shouldSpendAce(view: PlayerView, suit: Suit): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null || suit === trump) return true
    if (view.hand.length <= 2) return true
    // "Ako je tvoj suigrač zvao, a ti si prvi na igri i nemaš aduta, NE
    // podigravaj boju gdje imaš asa": the ace is my way back in, and he needs
    // me on lead again later more than he needs eleven points now.
    if (partnerCalledTrump(view) && myLength(view, trump) === 0 && view.played.length === 0) {
        return false
    }
    const partner = partnerOf(seat)
    const partnerMustRuff =
        seatShownVoidIn(view, partner, suit) &&
        !seatShownVoidInTrump(view, partner) &&
        outstandingInSuit(view, trump) > 0
    if (partnerMustRuff) return false
    if (trumpOutlook(view).opponentMax === 0) return true
    if (opponentShownVoidIn(view, suit)) return false
    return isFirstRoundOf(view, suit) && outstandingInSuit(view, suit) >= 4
}

/**
 * The card to open with when there is nothing worth attacking with: the
 * cheapest non-trump card by points, then from the shortest suit (to become
 * void and ruff later), then the lowest. `excluded` are the aces the caller
 * decided to keep. Falls back to the weakest card of all when the hand is
 * nothing but trumps and kept aces.
 *
 * Points come FIRST, before suit length: the old "lowest card of my shortest
 * suit" led a singleton 10 (or king) whenever that happened to be the shortest
 * suit — ten points handed to whoever held the ace, for no reason at all.
 */
export function quietLeadCard(
    view: PlayerView,
    legal: readonly Card[],
    excluded: ReadonlySet<Card>,
): Card {
    const trump = view.bidding.trump as Suit
    const pool = legal.filter((card) => !excluded.has(card) && cardSuit(card) !== trump)
    if (pool.length === 0) {
        const rest = legal.filter((card) => !excluded.has(card))
        return weakestCard(rest.length > 0 ? rest : legal, trump)
    }
    const score = (card: Card): readonly [number, number, number] => [
        cardPoints(card, trump),
        suitLength(view.hand, cardSuit(card)),
        cardStrength(card, trump),
    ]
    let best = pool[0] as Card
    let bestScore = score(best)
    for (let i = 1; i < pool.length; i++) {
        const card = pool[i] as Card
        const s = score(card)
        const isBetter =
            s[0] < bestScore[0] ||
            (s[0] === bestScore[0] &&
                (s[1] < bestScore[1] || (s[1] === bestScore[1] && s[2] < bestScore[2])))
        if (isBetter) {
            best = card
            bestScore = s
        }
    }
    return best
}

/**
 * A card that is a sure trick of its own later: the master of its suit that no
 * opponent can ruff — a master trump, or a master plain card once the
 * opponents are provably out of trumps. Filling my partner's trick with it
 * banks its points once; leading it later wins a whole trick.
 */
export function isSureFutureWinner(view: PlayerView, card: Card): boolean {
    const trump = view.bidding.trump
    if (trump === null || !isMasterCard(view, card)) return false
    return cardSuit(card) === trump || trumpOutlook(view).opponentMax === 0
}

/**
 * Which card to fill my partner's SAFE trick with. "Na suigračevo nošenje
 * nastoj upuniti svaki bod" — but which point, and in which order, is the
 * whole of BOT.md §2, so this defers to `signalDiscard` in feeding mode: the
 * suits I have given up on empty out first, high card first, and only when
 * they are gone does an ace with its own 10 behind it go across.
 *
 * That order is the difference between the user's worked example and what the
 * bot used to do. Holding hearts A-10-K, clubs A-10 and spades 8-7 while the
 * partner draws five trumps, "the most valuable card" threw both aces and both
 * tens away for 42 banked points and no tricks; the spades go first, then the
 * two aces, and the two tens come home as masters.
 *
 * A card that is a sure trick of its own (`isSureFutureWinner`) is never fed —
 * it wins a whole trick later rather than eleven points now — unless there is
 * nothing else in `pool`.
 */
export function fillCard(view: PlayerView, pool: readonly Card[]): Card {
    const trump = view.bidding.trump as Suit
    const spendable = pool.filter((card) => !isSureFutureWinner(view, card))
    if (spendable.length === 0) return cheapestCard(pool, trump)
    // A bare ace is never fed: the eleven points it banks now are worth less
    // than the trick it takes later, and this is the user's own rule —
    // "asa odbacujem samo zato jer imam i desetku doma". An ace WITH its 10
    // behind it stays spendable: the 10 inherits the suit.
    const keepable = spendable.filter(
        (card) =>
            !(
                cardRank(card) === "A" &&
                cardSuit(card) !== trump &&
                !hasBackedTen(view.hand, cardSuit(card))
            ),
    )
    const usable = keepable.length > 0 ? keepable : spendable

    // While my partner is DRAWING TRUMPS this is not one discard but a run of
    // them, and the run is what the message needs (BOT.md §2.3). Worthless
    // cards from the suits I have given up go first, so that if he runs out of
    // trumps sooner than expected the cards still at home are the good ones.
    // Measured neutral in self-play; kept because a shortened run is strictly
    // better this way and because it is what the convention asks for.
    const led = view.trick.cards[0]
    const partnerDrawing =
        led !== undefined &&
        cardSuit(led.card) === trump &&
        view.seat !== null &&
        led.seat === partnerOf(view.seat)
    if (partnerDrawing) {
        // On his JACK the backed ace goes in: it fills the trick and shows the
        // 10 behind it in one card ("na tvog dečka staviti tog asa da ti
        // napuni, a ujedno pokaže da ima desetku").
        const onJack = led !== undefined && cardRank(led.card) === "J"
        const backedAce = usable.find(
            (card) =>
                cardRank(card) === "A" &&
                cardSuit(card) !== trump &&
                hasBackedTen(view.hand, cardSuit(card)),
        )
        if (onJack && backedAce !== undefined) return backedAce
        // A live štihak outranks the points on this one trick: the suit I can
        // take over in stays whole (BOT.md §14).
        const forStiglja = stigljaSignalDiscard(view, usable)
        if (forStiglja !== null) return forStiglja
        // With a suit to take over in, the run of discards is a SENTENCE
        // (BOT.md §2): the suits I give up go high to low, the one I keep is
        // touched last and from the bottom. Feeding the most valuable card
        // here threw the 10 of exactly the suit I wanted led. With nothing to
        // take over in there is nothing to say, and every point is fed.
        const hasTakeOver = usable.some(
            (card) => cardSuit(card) !== trump && suitWorthKeeping(view, cardSuit(card)),
        )
        if (hasTakeOver) {
            const said = signalDiscard(view, usable, true)
            if (said !== null) return said
        }
        // Nothing to take over in, and he is playing for all eight: tell him
        // to stop, by mixing the suits (BOT.md §15.14).
        const stop = stigljaStopSignal(view, usable)
        if (stop !== null) return stop
        const junk = usable.filter(
            (card) => cardPoints(card, trump) === 0 && !suitWorthKeeping(view, cardSuit(card)),
        )
        if (junk.length > 0) return strongestCard(junk, trump)
    }

    // Otherwise every point I can put on a trick that is already ours is a
    // point scored: "na suigračevo nošenje nastoj upuniti svaki bod".
    return mostValuableCard(usable, trump)
}

/**
 * My partner holds the trick — is it his for certain, so that I can safely
 * fill it with an ace or a ten ("puniti štih")?
 *   - I am the last to play: nobody follows me, yes;
 *   - one opponent still follows me (I am third): only when the partner's card
 *     is the master of its suit (nothing still out beats it) AND that opponent
 *     cannot ruff it — the card is a trump itself, or the opponent has shown
 *     void in trump, or there is no trump left outside my hand at all.
 * Anything less and an ace fed now is an ace handed to the fourth player.
 */
export function partnerTrickIsSafe(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false
    if (!isPartnerHoldingTrick(view)) return false
    if (isLastToPlay(view)) return true

    const winner = currentTrickWinner(view)
    const winningCard = view.trick.cards.find((tc) => tc.seat === winner)?.card
    if (winningCard === undefined || !isMasterCard(view, winningCard)) return false
    // A master TRUMP is beyond everybody, whatever is still to be played and
    // however many seats are still to play. This is the common case the rule
    // exists for: the partner opens with the top trump and draws.
    if (cardSuit(winningCard) === trump) return true

    // A plain master only holds while nobody behind me can ruff it. Every seat
    // between me and the end of the trick has to be provably unable to.
    const trumpsOut = outstandingInSuit(view, trump)
    if (trumpsOut === 0) return true
    let follower = nextSeat(seat)
    while (follower !== view.trick.leader) {
        if (!seatShownVoidInTrump(view, follower)) return false
        follower = nextSeat(follower)
    }
    return true
}

/* ──────────────────────────────────────────────────────────────────────────
   Fault (3): drawing trumps for a partner who called.
   ────────────────────────────────────────────────────────────────────── */

/** True when the trump was called by my partner (not by me, not by an opponent). */
export function partnerCalledTrump(view: PlayerView): boolean {
    const seat = view.seat
    const caller = view.bidding.caller
    if (seat === null || caller === null) return false
    return caller === partnerOf(seat)
}

/**
 * True when the call was a forced one ("mus", README §1.2.4) rather than a
 * choice. The view carries no `forced` flag, but the sequence is fixed:
 * bidding opens at next(dealer) and the dealer speaks last, so three recorded
 * passes with the dealer as the caller can only be the forced call — nobody
 * else can ever be on turn after three passes. `game.ts` keeps `bidding.passes`
 * when it applies the BID, so this stays readable for the whole deal.
 */
export function callerWasForced(view: PlayerView): boolean {
    const caller = view.bidding.caller
    return caller !== null && caller === view.dealer && view.bidding.passes.length === 3
}

/**
 * Does `declaration` prove that its owner does NOT hold the jack of `trump`?
 *
 * README §1.4: sequences use the NATURAL order 7 8 9 10 J Q K A and the engine
 * always takes the MAXIMAL run in a suit. That maximality is the whole
 * inference: a trump run cannot skip over the jack, so
 *   - a trump run ending at the 10 (…-9-10) would have continued into the jack
 *     had its owner held it → he does not;
 *   - a trump run starting at the queen (Q-K-…) would have started one card
 *     lower for the same reason → he does not.
 * Any other run says nothing (7-8-9 stops two below the jack, a run containing
 * the jack obviously disproves it), and runs in other suits say nothing at all.
 */
function sequenceDeniesTrumpJack(declaration: Declaration, trump: Suit): boolean {
    if (declaration.kind !== "SEQUENCE") return false
    const cards = declaration.cards
    const low = cards[0]
    const high = cards[cards.length - 1]
    if (low === undefined || high === undefined) return false
    if (cardSuit(low) !== trump) return false
    // `cards` is ascending in natural rank order (engine contract).
    const jack = RANKS.indexOf("J")
    const lowIdx = RANKS.indexOf(cardRank(low))
    const highIdx = RANKS.indexOf(cardRank(high))
    if (lowIdx <= jack && jack <= highIdx) return false // the run contains the jack
    return highIdx === jack - 1 || lowIdx === jack + 1
}

/** Did `seat` declare four jacks (which means he holds the trump jack too)? */
function declaredFourJacks(declarations: readonly Declaration[]): boolean {
    return declarations.some(
        (d) => d.kind === "FOUR" && d.cards.every((card) => cardRank(card) === "J"),
    )
}

/**
 * True when the revealed declarations PROVE that `seat` has no trump jack.
 * "Not proven" (false) is the default: no declarations, unrevealed
 * declarations, or declarations that simply do not touch the jack.
 */
export function seatProvablyLacksTrumpJack(view: PlayerView, seat: Seat): boolean {
    const trump = view.bidding.trump
    if (trump === null || !view.declarationsRevealed) return false

    const own = view.declarations[seat] ?? []
    if (declaredFourJacks(own)) return false // he holds all four, trump jack included

    for (const [key, list] of Object.entries(view.declarations)) {
        const other = Number(key) as Seat
        if (other !== seat && declaredFourJacks(list ?? [])) return true
    }

    return own.some((d) => sequenceDeniesTrumpJack(d, trump))
}

/**
 * Fault (3), REASON half: my partner called the trump, so he almost certainly
 * called on strength (the jack) — that is a reason to consider drawing for
 * him. It is NOT on its own an instruction to lead trump; `shouldDrawTrumps`
 * adds the counting guards. Exceptions, both spelled out by the rules:
 *   - the call was a mus (README §1.2.4): the dealer had to name something, it
 *     proves no strength at all;
 *   - his declarations prove he has no trump jack (see
 *     `seatProvablyLacksTrumpJack`) AND I do not hold it either — then nobody
 *     on our side controls the suit and drawing just feeds the opponents.
 */
export function shouldDrawTrumpsForPartner(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false
    if (!partnerCalledTrump(view)) return false
    if (callerWasForced(view)) return false

    const iHoldTheJack = view.hand.includes(makeCard("J", trump))
    if (iHoldTheJack) return true
    return !provablyNoTrumpJack(view, partnerOf(seat))
}

/**
 * The opening lead promised to a partner who voluntarily called trump.
 * Calling is read as holding the jack, so the opening seat feeds that suit
 * even when its only trump is the 10. A forced dealer call says nothing, and
 * a public declaration that excludes the partner's jack cancels the promise.
 * This is first-trick-only: later returns use `trumpDrawCard` and never throw
 * an expensive 10/A underneath an outstanding 9/J.
 */
export function openingTrumpForCallingPartner(
    view: PlayerView,
    legal: readonly Card[],
): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return null
    if (!partnerCalledTrump(view) || callerWasForced(view)) return null
    if (view.played.length > 0 || view.trick.cards.length > 0) return null

    const partner = partnerOf(seat)
    if (provablyNoTrumpJack(view, partner)) return null

    const trumps = legal.filter((card) => cardSuit(card) === trump)
    if (trumps.length === 0) return null
    // "Solo devet u adutu … igrat ćeš solo kartu u drugoj boji" and "7 i 8 u
    // adutu, ako nemaš drugih aduta, se ne podigravaju": the lone nine is the
    // second-best trump thrown under his jack, and a bare 7/8 says "vrati
    // aduta" about a hand with nothing to back the request.
    const soloNine = trumps.length === 1 && cardRank(trumps[0] as Card) === "9"
    const onlySmall = trumps.every((card) => cardRank(card) === "7" || cardRank(card) === "8")
    if (soloNine || onlySmall) return null
    return trumpDrawCard(view, trumps) ?? weakestCard(trumps, trump)
}

/** How the trump suit is distributed among the seats I cannot see. */
export interface TrumpOutlook {
    /** Trumps still held by the other three seats together. */
    readonly outstanding: number
    /**
     * Hard upper bound on how many of those the OPPONENTS can hold: 0 means
     * they are provably stripped (no trump left at all, or every opponent has
     * shown void in it / has no cards). Drawing past this point only pulls my
     * own partner's trumps out.
     */
    readonly opponentMax: number
    /**
     * The share of `outstanding` the opponents are expected to hold, splitting
     * it by remaining hand size across the seats that can still hold a trump.
     * A soft stop for the case the bound above cannot prove — with `trickReview`
     * off a bot sees seat attribution only for the trick in progress and the
     * last completed one, so voids are usually NOT provable and the count is
     * all we have.
     */
    readonly opponentExpected: number
}

const EMPTY_OUTLOOK: TrumpOutlook = { outstanding: 0, opponentMax: 0, opponentExpected: 0 }

export function trumpOutlook(view: PlayerView): TrumpOutlook {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return EMPTY_OUTLOOK
    // Trumps a DECLARATION or the bela puts on our own side are not trumps the
    // opponents can ruff with, and this is the one place that distinction is
    // unambiguously worth having: every decision downstream is "can they still
    // cut me?" (BOT.md §11).
    const outstanding = outstandingCardsInSuit(view, trump).filter((card) =>
        opponentCanHold(view, card),
    ).length
    if (outstanding <= 0) return EMPTY_OUTLOOK

    let opponentCards = 0
    let partnerCards = 0
    for (const other of SEATS) {
        if (other === seat) continue
        // A seat that has shown void in trump can hold none of them; a seat
        // with no cards left obviously cannot either.
        const capacity = seatShownVoidInTrump(view, other) ? 0 : view.handSizes[other]
        if (teamOf(other) === teamOf(seat)) partnerCards += capacity
        else opponentCards += capacity
    }

    const total = opponentCards + partnerCards
    return {
        outstanding,
        opponentMax: Math.min(outstanding, opponentCards),
        opponentExpected: total === 0 ? 0 : Math.min(outstanding, (outstanding * opponentCards) / total),
    }
}

/**
 * Below one expected opponent trump there is nothing left to strip: another
 * trump lead would only pull my own partner's trumps out.
 */
const MIN_OPPONENT_TRUMPS = 1

/**
 * Fault (3), reworked 2026-09-08 — should I OPEN a trick with a trump?
 *
 * Drawing trumps has exactly one purpose: strip the opponents so our own
 * winners can be cashed without being ruffed. So every one of these must hold,
 * and each of them is one of the ways the previous, unbounded version of this
 * rule went wrong:
 *   1. my side called the trump. The calling team promised the points and has
 *      to protect them; the defending team gains nothing by clearing the way
 *      for the caller's long suit;
 *   2. I actually hold a trump (otherwise there is nothing to lead);
 *   3. either I hold the top trump still in play — then the lead is a
 *      guaranteed trick, not a gamble — or my PARTNER called on strength and
 *      the jack is (as far as the declarations show) on our side
 *      (`shouldDrawTrumpsForPartner`). Leading a small trump with neither is
 *      just feeding the opponents' jack;
 *   4. the opponents can still HAVE a trump (`opponentMax > 0`), and enough of
 *      the outstanding ones are likely theirs rather than my partner's
 *      (`opponentExpected >= 1`). This is the stop condition the old rule
 *      lacked: it led trump on every single lead for the whole deal;
 *   5. our side has something to cash afterwards (`hasWinnersToCash`). Note
 *      that (3) makes this automatic in the top-trump case — a master trump is
 *      itself a winner.
 *
 * Only called when this seat is on lead; mid-trick play never routes here.
 */
export function shouldDrawTrumps(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    const caller = view.bidding.caller
    if (seat === null || trump === null || caller === null) return false
    if (teamOf(caller) !== teamOf(seat)) return false

    const myTrumps = view.hand.filter((card) => cardSuit(card) === trump)
    if (myTrumps.length === 0) return false

    const holdsTopTrump = myTrumps.some((card) => isMasterCard(view, card))
    if (!holdsTopTrump && !shouldDrawTrumpsForPartner(view)) return false

    const outlook = trumpOutlook(view)
    if (outlook.opponentMax <= 0) return false
    if (outlook.opponentExpected < MIN_OPPONENT_TRUMPS) return false

    return hasWinnersToCash(view)
}

/**
 * What counts as a trump you can spend on opening a trick you do not expect to
 * win: the 7 and the 8 (0 points), the queen (3) and the king (4). The 10, the
 * ace, the 9 and the jack are the deal, not small change.
 */
const CHEAP_TRUMP_POINTS = 4

/**
 * Which trump to draw with, given `shouldDrawTrumps` said yes: the top trump
 * when I hold it (a certain trick), otherwise my cheapest one — in the support
 * case the partner holds the high trumps and there is no point forcing my own
 * 10/A under his jack. Returns null when `legal` holds no trump at all.
 */
export function trumpDrawCard(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    const trumps = legal.filter((card) => cardSuit(card) === trump)
    if (trumps.length === 0) return null
    const masters = trumps.filter((card) => isMasterCard(view, card))
    if (masters.length > 0) return strongestCard(masters, trump)

    // Supporting a partner who called: the point is to make him play his high
    // trumps, so the card that does it has to be CHEAP. Leading the ten or the
    // ace here is ten or eleven points posted into a trick somebody else takes
    // — reported 2026-09-09, where a lone trump ten was led for exactly this
    // reason. With nothing cheap to lead there is no support to give, and the
    // opening book below is better than an expensive trump.
    const cheap = trumps.filter((card) => cardPoints(card, trump) <= CHEAP_TRUMP_POINTS)
    return cheap.length > 0 ? weakestCard(cheap, trump) : null
}

/**
 * On defence, cash a master trump when it pulls a valuable opposing trump.
 *
 * This is deliberately narrower than normal trump drawing. The defending
 * pair does not clear trumps merely because it can, but a master 9 should be
 * led when the only relevant trump still outside the hand is the caller's 10:
 * the 9 cannot lose and captures ten points. A remaining 7 or 8 is worth no
 * such lead, so low trumps do not trigger it. When several cards in our hand
 * are all masters against the cards outside it, spend the weakest one: an ace
 * that already covers the opponent's ten does the same job as the jack and
 * keeps the stronger control for the next trick.
 */
export function defensiveTrumpCapture(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null || !iAmDefending(view)) return null

    const trumps = legal.filter((card) => cardSuit(card) === trump)
    const masters = trumps.filter((card) => isMasterCard(view, card))
    if (masters.length === 0) return null

    const outstanding = outstandingCardsInSuit(view, trump)
    if (outstanding.length !== 1) return null
    const target = outstanding[0] as Card
    return cardPoints(target, trump) >= 10 && opponentCanHold(view, target)
        ? weakestCard(masters, trump)
        : null
}

/* ──────────────────────────────────────────────────────────────────────────
   SIGNALLING — the unwritten rules (game/BOT.md §2 and §3), added 2026-09-09.

   "VAŽNO JE SUIGRAČU POKAZATI ŠTO IMAŠ I OMOGUĆITI SUIGRAČU DA TO POKAŽE
   TEBI." Everything below is one half of that sentence or the other: what a
   discard SAYS, and how to read what the partner's discards said.

   All of it is public information: my own hand, the cards face up, and the
   seat-attributed completed tricks. Bots always have the whole of that record
   (engine `viewFor(..., { recallTricks: true })`) because remembering public
   play is not privileged — a person at the table remembers it too.
   ────────────────────────────────────────────────────────────────────── */

/** The 10 of `suit` with the A or K of the same suit beside it in `hand` —
 *  "potkovana"/"bezec" 10, the one that is worth keeping rather than leading. */
export function hasBackedTen(hand: readonly Card[], suit: Suit): boolean {
    if (!hand.includes(makeCard("10", suit))) return false
    return hand.includes(makeCard("A", suit)) || hand.includes(makeCard("K", suit))
}

/**
 * Is `suit` one I can still take a trick in — a suit "za preuzeti"?
 *
 * The ace, a backed 10, a card nothing outstanding beats, or simple length
 * (four cards of a suit outlast the other three hands). Everything else is a
 * suit I am willing to be void in, and that is what I discard from.
 */
export function suitWorthKeeping(view: PlayerView, suit: Suit): boolean {
    const trump = view.bidding.trump
    if (trump === null || suit === trump) return true
    const mine = view.hand.filter((card) => cardSuit(card) === suit)
    if (mine.length === 0) return false
    if (mine.length >= 4) return true
    if (mine.includes(makeCard("A", suit))) return true
    if (hasBackedTen(view.hand, suit)) return true
    return mine.some((card) => isMasterCard(view, card))
}

/**
 * The card to let go of on a trick MY OWN SIDE is taking, and the message it
 * carries (BOT.md §2). `cheapestDiscard` plays low-to-high in whatever suit is
 * cheapest, which in this language reads as "I want this suit" — said about
 * every suit at once.
 *
 *   1. A suit I am giving up on (`suitWorthKeeping` is false), played HIGH to
 *      LOW: "there is nothing for me here". Shortest such suit first, so the
 *      message finishes rather than being started in three places.
 *   2. When those run out, the ACE of a suit where I also hold the 10. My own
 *      10 becomes the master of the suit, eleven points are banked, and the
 *      discard asks for that suit to be led. The BARE ace is never thrown —
 *      that one is a trick.
 *   3. Otherwise the cheapest card that is not a master.
 *
 * `feeding` says whether our side has the trick, and false means SILENCE: see
 * the guard at the top. Returns null when there is nothing to choose between
 * (one suit on offer, or trumps only) and the caller keeps its own rule.
 */
export function signalDiscard(
    view: PlayerView,
    legal: readonly Card[],
    feeding: boolean,
): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    // Nothing is said while the OPPONENTS are taking the trick. The
    // high-to-low convention lives in the document's "partner is drawing
    // trumps" section, and outside it every rank of the message is paid for in
    // real points — measured at 1.5 percentage points of self-play strength,
    // which is more than the signal is worth. `cheapestDiscard` keeps the
    // points, and its shortest-suit tie-break is itself the document's
    // "očisti se u boji gdje nemaš štiha".
    if (!feeding) return null
    const plain = legal.filter((card) => cardSuit(card) !== trump)
    const suits = [...new Set(plain.map((card) => cardSuit(card)))]
    if (suits.length === 0) return null

    const cardsOf = (suit: Suit): Card[] => plain.filter((card) => cardSuit(card) === suit)
    const lengthOf = (suit: Suit): number =>
        view.hand.filter((card) => cardSuit(card) === suit).length

    // 1. Abandon a suit, high to low. Shortest first; ties to the suit holding
    //    the fewest points, so the cheapest message goes out first.
    const abandoned = suits
        .filter((suit) => !suitWorthKeeping(view, suit))
        .sort((a, b) => {
            const byLength = lengthOf(a) - lengthOf(b)
            if (byLength !== 0) return byLength
            const points = (suit: Suit): number =>
                cardsOf(suit).reduce((sum, card) => sum + cardPoints(card, trump), 0)
            return points(a) - points(b)
        })
    for (const suit of abandoned) {
        const offered = cardsOf(suit)
        if (offered.length > 0) return strongestCard(offered, trump)
    }

    // 2. Every suit is worth keeping, so one has to be broken into. The ace
    //    with its own 10 behind it is the one card that costs nothing to
    //    throw — see the header.
    const backedAce = suits
        .filter((suit) => hasBackedTen(view.hand, suit))
        .map((suit) => makeCard("A", suit))
        .find((card) => plain.includes(card))
    if (backedAce !== undefined) return backedAce

    // 3. Nothing clever left: the cheapest card that is not a master.
    const notMaster = plain.filter((card) => !isMasterCard(view, card))
    return cheapestCard(notMaster.length > 0 ? notMaster : plain, trump)
}

/** One discard somebody made: a card played on a led suit they did not follow
 *  and did not trump — so a card they CHOSE, in a suit they chose. Oldest
 *  first, which is all the order any rule here needs: reading a RUN of
 *  discards for its high-to-low shape is on the not-implemented list
 *  (BOT.md §9). */
interface DiscardRecord {
    readonly suit: Suit
    readonly card: Card
}

/** Every discard `seat` has made this deal, oldest first. */
function discardsBy(view: PlayerView, seat: Seat): DiscardRecord[] {
    const trump = view.bidding.trump
    if (trump === null) return []
    const out: DiscardRecord[] = []
    const scan = (plays: readonly TrickCard[]): void => {
        const led = plays[0]
        if (led === undefined) return
        const ledSuit = cardSuit(led.card)
        for (const play of plays) {
            if (play.seat !== seat) continue
            const suit = cardSuit(play.card)
            if (suit === ledSuit || suit === trump) continue
            out.push({ suit, card: play.card })
        }
    }
    for (const trick of reviewableTricks(view)) scan(trick.plays)
    scan(view.trick.cards)
    return out
}

/** What my partner's discards have told me (BOT.md §3). */
export interface PartnerSignal {
    /** A suit he has asked for, or null when he has not asked for one. */
    readonly wants: Suit | null
    /** Suits he has shown he has nothing in. */
    readonly avoids: readonly Suit[]
}

const NO_SIGNAL: PartnerSignal = { wants: null, avoids: [] }

/**
 * Read the partner's discards (BOT.md §3). Two claims, both of them things he
 * did rather than things I am guessing:
 *
 *   - he threw the ACE of a suit → he holds the 10 behind it and is asking for
 *     that suit (the other half of `signalDiscard` rule 2). Highest confidence,
 *     and it is the case the user described;
 *   - he has discarded from every plain suit but one, and is not proven void in
 *     that one → the one he is protecting is the one he wants.
 *
 * `avoids` is every suit he has discarded from. Both stay silent when there is
 * nothing to read: a bot that invents a signal is worse than one with none.
 */
/** The last two discards: both worthless cards, from two different suits. */
function discardsSayStop(discards: readonly DiscardRecord[], trump: Suit): boolean {
    if (discards.length < 2) return false
    const last = discards[discards.length - 1] as DiscardRecord
    const previous = discards[discards.length - 2] as DiscardRecord
    return (
        last.suit !== previous.suit &&
        cardPoints(last.card, trump) === 0 &&
        cardPoints(previous.card, trump) === 0
    )
}

/** True when my partner's discards read as "stop" — see `discardsSayStop`. */
export function partnerSaysStop(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false
    return discardsSayStop(discardsBy(view, partnerOf(seat)), trump)
}

export function partnerSignal(view: PlayerView): PartnerSignal {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return NO_SIGNAL

    const partner = partnerOf(seat)
    const discards = discardsBy(view, partner)
    if (discards.length === 0) return NO_SIGNAL

    const avoids = [...new Set(discards.map((d) => d.suit))]

    // An ace thrown away is an ace whose 10 is still at home.
    const acePitch = discards.find((d) => cardRank(d.card) === "A")
    if (acePitch !== undefined) {
        return { wants: acePitch.suit, avoids: avoids.filter((s) => s !== acePitch.suit) }
    }

    // Two LOW cards in a row from two different suits is not "I want the
    // third" but "stani, nemam što preuzeti" (BOT.md §15.14): a partner who
    // wants a suit sheds the others from the TOP, so his discards start high.
    if (discardsSayStop(discards, trump)) return { wants: null, avoids }

    const plainSuits = SUITS.filter((suit) => suit !== trump)
    const untouched = plainSuits.filter(
        (suit) => !avoids.includes(suit) && !seatShownVoidIn(view, partner, suit),
    )
    const wants = untouched.length === 1 ? (untouched[0] as Suit) : null
    return { wants, avoids }
}

/* ──────────────────────────────────────────────────────────────────────────
   BIDDING — expected tricks over the WHOLE hand (BOT.md §1).

   `suitStrength` scores the trump suit alone, which is why the hand the
   document calls a call — "dečka i dva strana asa" — used to be passed: the
   two aces were worth nothing to it. Aces are most of the deal; trumps are
   only 62 of the 162 points on the table.
   ────────────────────────────────────────────────────────────────────── */

const TRUMP_TRICK_VALUE: Partial<Record<string, number>> = { J: 1, "9": 0.9, A: 0.55, "10": 0.3 }
/** Each trump past the third is a ruff waiting to happen. */
const EXTRA_TRUMP_VALUE = 0.45
const PLAIN_ACE_VALUE = 0.8
const BACKED_TEN_VALUE = 0.45
const BARE_TEN_VALUE = 0.1
const BELA_VALUE = 0.2

/**
 * Roughly how many tricks `hand` takes with `suit` as trump (BOT.md §1). Not a
 * probability and not tuned to three decimals — a yardstick with the same
 * shape as the document's "two sure tricks and a half".
 */
export function handTricks(hand: readonly Card[], suit: Suit): number {
    let score = 0
    let trumps = 0
    for (const card of hand) {
        const cardsSuit = cardSuit(card)
        const rank = cardRank(card)
        if (cardsSuit === suit) {
            trumps++
            score += TRUMP_TRICK_VALUE[rank] ?? 0
            continue
        }
        if (rank === "A") score += PLAIN_ACE_VALUE
        else if (rank === "10") score += hasBackedTen(hand, cardsSuit) ? BACKED_TEN_VALUE : BARE_TEN_VALUE
    }
    if (trumps > 3) score += (trumps - 3) * EXTRA_TRUMP_VALUE
    if (hand.includes(makeCard("K", suit)) && hand.includes(makeCard("Q", suit))) score += BELA_VALUE
    return score
}

/**
 * Which suit to name, if naming one at all.
 *
 * This is `suitStrength` — the TRUMP holding alone — and deliberately not
 * `handTricks`. Most of `handTricks` is the plain suits, which are worth
 * almost the same whichever suit is named, so maximising it picks a trump the
 * hand barely holds: three plain aces score the same 2.4 in all four suits,
 * and the first one wins the tie. Naming a suit you have no cards in is a fall
 * with the bidding already over.
 *
 * So the two questions stay separate, which is also how the document puts
 * them: WHICH suit is a question about the trumps, WHETHER to call is a
 * question about the whole hand.
 */
export function bestTrumpSuit(hand: readonly Card[], suits: readonly Suit[]): Suit {
    return bestSuit(hand, suits)
}

/* ──────────────────────────────────────────────────────────────────────────
   LEADING (BOT.md §5).
   ────────────────────────────────────────────────────────────────────── */

/** How many cards of `suit` I hold. */
function myLength(view: PlayerView, suit: Suit): number {
    return view.hand.filter((card) => cardSuit(card) === suit).length
}

/**
 * A singleton non-trump lead is a card led hoping somebody ruffs it, and the
 * document prices that hope: whichever of the two things you want (the partner
 * holding a card, the partner ruffing) it is 2:1 against you. So a singleton is
 * only led when there is nothing else, or so late in the deal that every card
 * is one.
 */
export function isThinLead(view: PlayerView, card: Card): boolean {
    const trump = view.bidding.trump
    if (trump === null) return false
    const suit = cardSuit(card)
    if (suit === trump) return false
    if (view.hand.length <= 3) return false
    if (cardRank(card) === "10" && !isMasterCard(view, card)) return true // "potkovana" 10
    // Any card from a SHORT suit that holds the 10 under an ace still out
    // (reported 2026-09-21: 7-J-10, the 7 was led, the ace took it, and the 10
    // was left to be ruffed on the next round). Left alone, the 10 goes on
    // somebody else's ace — or gets its chance later; opened, it is dead.
    const ten = makeCard("10", suit)
    const ace = makeCard("A", suit)
    if (
        view.hand.includes(ten) &&
        !view.hand.includes(ace) &&
        myLength(view, suit) <= 3 &&
        outstandingCardsInSuit(view, suit).includes(ace)
    ) {
        return true
    }
    return myLength(view, suit) === 1 && !isMasterCard(view, card)
}

/**
 * THE ACE AFTER MY OWN WIN (BOT.md §15.18, owner's report 2026-09-21).
 * The opponents opened a plain suit, I took the trick with the 10 — the ace
 * stayed home — and now I am on lead. This is the safest moment the ace will
 * ever have: both opponents have just FOLLOWED the suit (so neither was void a
 * round ago), my partner either followed or threw a card away instead of
 * ruffing (which proves he has no trump to waste on my ace), and three or more
 * cards of the suit are still out among them. Leading a small card from
 * somewhere else instead "saves" the ace for a round in which it is more
 * likely to be ruffed, or never gets led at all and has to be thrown on the
 * last trick for nothing — the reported case.
 *
 * Only after the FIRST round of that suit (exactly four of its cards played,
 * one of them mine), so it is a decision about a fresh suit and not a way of
 * pulling an ace into a suit that has already been played to death. Silent
 * when my partner would be FORCED to ruff it (he is void and still holds
 * trumps), and when fewer than three cards of the suit are out.
 */
export function aceAfterMyWin(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return null

    const tricks = reviewableTricks(view)
    const last = tricks[tricks.length - 1]
    if (last === undefined || last.winner !== seat) return null
    const opener = last.plays[0]
    if (opener === undefined) return null
    const suit = cardSuit(opener.card)
    if (suit === trump) return null

    const ace = makeCard("A", suit)
    if (!legal.includes(ace)) return null

    // Every OPPONENT followed suit — nobody was void a round ago.
    const followed = last.plays
        .filter((play) => teamOf(play.seat) !== teamOf(seat))
        .every((play) => cardSuit(play.card) === suit)
    if (!followed) return null
    // Nobody ruffed it (I won it, but with the 10, not with a trump).
    if (last.plays.some((play) => cardSuit(play.card) === trump)) return null

    // A fresh suit: this was its first round — every card of it that has been
    // played so far fell in THIS trick. (Not "four of them": in the reported
    // deal the partner had none and threw a card away, so only three fell.)
    const inThisTrick = last.plays.filter((play) => cardSuit(play.card) === suit).length
    if (view.played.filter((card) => cardSuit(card) === suit).length !== inThisTrick) return null
    if (outstandingInSuit(view, suit) < 3) return null

    const partner = partnerOf(seat)
    const partnerMustRuff =
        seatShownVoidIn(view, partner, suit) &&
        !seatShownVoidInTrump(view, partner) &&
        outstandingInSuit(view, trump) > 0
    if (partnerMustRuff) return null

    return ace
}

/**
 * NO "ŠARANJE" (BOT.md §15.17). I opened the last trick with a plain ace and
 * took it; everybody followed. The next card comes from the SAME suit — not a
 * second ace from somewhere else, which opens a new suit for the opponents and
 * tells my partner nothing. The 10 when it is now the master of the suit and
 * nobody can be out of it yet; otherwise the lowest card.
 *
 * Silent when somebody failed to follow the ace (the suit is about to be
 * ruffed), when I have no card of it left, or when only one more card of the
 * suit is out (a third round is a ruff waiting to happen).
 */
export function continueAceSuit(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return null
    const tricks = reviewableTricks(view)
    const last = tricks[tricks.length - 1]
    if (last === undefined || last.winner !== seat) return null
    const opener = last.plays[0]
    if (opener === undefined || opener.seat !== seat) return null
    const suit = cardSuit(opener.card)
    if (suit === trump || cardRank(opener.card) !== "A") return null
    if (!last.plays.every((play) => cardSuit(play.card) === suit)) return null

    const mine = legal.filter((card) => cardSuit(card) === suit)
    if (mine.length === 0) return null
    if (outstandingInSuit(view, suit) < 2) return null

    const ten = makeCard("10", suit)
    if (mine.includes(ten) && isMasterCard(view, ten) && outstandingInSuit(view, suit) >= 3) return ten
    const low = mine.filter((card) => card !== ten)
    return low.length > 0 ? weakestCard(low, trump) : null
}

/**
 * A plain card that is a CERTAIN trick, to be cashed the moment I am on lead
 * (BOT.md §15.20, reported 2026-09-21: a bot holding four hearts, every
 * trump already gone, led hearts twice and then a card of another suit —
 * the rest of the hearts were never played and fell away with the deal).
 *
 * Certain means two things together, and both have to be PROVEN:
 *   - the opponents cannot ruff: `trumpOutlook.opponentMax === 0` — no trump
 *     left at all, or every opponent has shown void in it;
 *   - nothing still in play beats the card in its own suit
 *     (`isMasterCard`). With a suit that is exhausted everywhere else this is
 *     true of EVERY card I hold in it, which is exactly the "run the suit"
 *     case — the second and third heart are masters as soon as the first has
 *     gone.
 * Such a lead takes the trick whoever follows, so there is nothing to
 * manoeuvre for: each turn it is put off is a turn the lead can be lost
 * with the winner still in hand.
 *
 * The suit with the MOST sure tricks goes first, its strongest master
 * leading (the points fall into the trick either way; the order only decides
 * what an opponent's discard can dodge). The trump suit is never touched here
 * — trumps have their own rules (§14, §15.16) — and neither is a suit I hold
 * no master of. Returns null when nothing qualifies.
 */
export function sureWinnerToCash(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    if (trumpOutlook(view).opponentMax > 0) return null

    // A SOLO ace stays where §5.3 keeps it (`aceToCash`): cashing it tells the
    // partner nothing he can use and talks him into holding a 10 in a suit
    // that can never be opened for him again.
    const masters = legal.filter(
        (card) =>
            cardSuit(card) !== trump &&
            isMasterCard(view, card) &&
            !(cardRank(card) === "A" && myLength(view, cardSuit(card)) === 1),
    )
    if (masters.length === 0) return null

    const count = (suit: Suit): number => masters.filter((card) => cardSuit(card) === suit).length
    const suits = [...new Set(masters.map((card) => cardSuit(card)))]
    let best = suits[0] as Suit
    for (const suit of suits) {
        if (count(suit) > count(best)) best = suit
        else if (count(suit) === count(best) && myLength(view, suit) > myLength(view, best)) best = suit
    }
    return strongestCard(
        masters.filter((card) => cardSuit(card) === best),
        trump,
    )
}

/**
 * The plain ace to cash right now (BOT.md §5.3): once the opponents provably
 * hold no trump, an ace is a certain trick and cashing it also tells the
 * partner to hold on to his backed 10. A SOLO ace is deliberately excluded —
 * the document keeps that one back so the partner is not talked into keeping a
 * 10 in a suit that can never be opened for him again.
 */
export function aceToCash(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    if (trumpOutlook(view).opponentMax > 0) return null
    const aces = legal.filter(
        (card) =>
            cardRank(card) === "A" && cardSuit(card) !== trump && myLength(view, cardSuit(card)) > 1,
    )
    if (aces.length === 0) return null
    return aces[0] as Card
}

/**
 * Which trump to open with as the CALLER, per the document's sequencing:
 *   - holding J, 9 and A: start with the ACE when I also hold a plain ace
 *     ("don't throw your backed 10 away, there is time"), otherwise 9, then A,
 *     and the jack last;
 * Returns null when this seat is not the caller or the sequence does not apply,
 * and the caller's deterministic jack rule or `trumpDrawCard` then applies.
 */
export function callerTrumpLead(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null || view.bidding.caller !== seat) return null

    const trumps = legal.filter((card) => cardSuit(card) === trump)
    if (trumps.length === 0) return null

    const jack = makeCard("J", trump)
    const nine = makeCard("9", trump)
    const ace = makeCard("A", trump)
    const holdsTop = trumps.includes(jack) && trumps.includes(nine) && trumps.includes(ace)

    if (holdsTop) {
        const plainAce = view.hand.some(
            (card) => cardRank(card) === "A" && cardSuit(card) !== trump,
        )
        return plainAce ? ace : nine
    }

    return null
}


/* ──────────────────────────────────────────────────────────────────────────
   BOT.md §9 — the rest of the document's rules, added 2026-09-09.

   Each one is a small pure function so it can be switched on alone and
   measured alone; what shipped and what did not is recorded in BOT.md.
   ────────────────────────────────────────────────────────────────────── */

/** My team, or null for a spectator. */
function myTeam(view: PlayerView): Team | null {
    return view.seat === null ? null : teamOf(view.seat)
}

/** True when the trump was called by the OTHER pair — I am defending. */
export function iAmDefending(view: PlayerView): boolean {
    const caller = view.bidding.caller
    const mine = myTeam(view)
    if (caller === null || mine === null) return false
    return teamOf(caller) !== mine
}

/**
 * Filling with the A or the 10 of the same suit is a different card depending
 * on WHO CALLED (TRIK):
 *
 *   - our side called → the ACE, so my partner knows to hold his backed 10;
 *   - they called → the TEN, "tako da igrač koji je zvao misli da njegov
 *     suigrač ima tog asa jer ti bježiš sa 10".
 *
 * Returns the substitute card, or null when the rule does not apply — I do not
 * hold both, or `ten` is not on offer.
 */
export function fillPreferringTen(
    view: PlayerView,
    chosen: Card,
    pool: readonly Card[],
): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    if (!iAmDefending(view)) return null
    const suit = cardSuit(chosen)
    if (suit === trump || cardRank(chosen) !== "A") return null
    const ten = makeCard("10", suit)
    return pool.includes(ten) ? ten : null
}

/**
 * My partner OPENED with a low trump (7 or 8) and §1.5 makes me go over him.
 * "Ako je suigrač zvao i podigrava sedmicu ili osmicu aduta, obavezno ćeš
 * staviti devetku iako bi mogao staviti manjeg aduta" (TRIK).
 *
 * The reason is that the cheap card is not the safe one: the queen or king is
 * cheaper than the nine and beats his eight, but the ten, ace and nine can
 * still be outside. The nine is preferred when held; without it, the jack is
 * the only card that certainly extracts it instead of gambling on its seat.
 *
 * Deliberately narrow — it is about a LOW TRUMP OPENING and nothing else. The
 * general version of it ("always take with the strongest card")
 * makes the bot ruff its own partner's ace with the trump jack, which is the
 * opposite of the rule it came from. Returns null when it does not apply.
 */
export function highTrumpOnPartnersLowTrump(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return null
    if (view.trick.cards.length === 0) return null

    const opener = view.trick.cards[0] as TrickCard
    if (opener.seat !== partnerOf(seat)) return null
    const rank = cardRank(opener.card)
    if (cardSuit(opener.card) !== trump || (rank !== "7" && rank !== "8")) return null

    const nine = makeCard("9", trump)
    if (legal.includes(nine)) return nine
    const jack = makeCard("J", trump)
    return legal.includes(jack) ? jack : null
}

/* ── Defensive leads (TRIK, §"PROTIVNIK ZVAO") ───────────────────────────── */

/** My longest plain suit in which I hold no ace, or null when there is none. */
function longestSuitWithoutAce(view: PlayerView, legal: readonly Card[]): Suit | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    const candidates = SUITS.filter(
        (suit) =>
            suit !== trump &&
            legal.some((card) => cardSuit(card) === suit) &&
            !view.hand.includes(makeCard("A", suit)),
    )
    if (candidates.length === 0) return null
    return candidates.reduce((best, suit) =>
        myLength(view, suit) > myLength(view, best) ? suit : best,
    )
}

/**
 * Opening a trick while the OPPONENTS hold the contract (TRIK). The document
 * gives this as four rules about four HAND SHAPES, and the shapes are the
 * point: outside them the ordinary opening book is better, and a version that
 * fired on every defensive lead (about 3 000 times per 800 games) cost half a
 * percentage point.
 *
 *   1. an ace in one suit and a backed 10 in another → lead the 10's suit.
 *      "Tad ćeš imati dvije boje za potencijalni štih";
 *   2. three or more trumps → "igraš boju gdje si dug, a nemaš asa";
 *   3. exactly two plain aces → "otvaraj treću boju gdje nemaš asa";
 *   4. a bad hand, no ace and no backed 10 → the long suit, "nego solo kartu
 *      boje koju bi možda sjekao".
 *
 * All four agree on the two things a defensive lead must not be: your own ace
 * suit, and a singleton. Returns null when the hand is none of these shapes.
 */
export function defensiveLead(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null || !iAmDefending(view)) return null
    if (view.hand.length <= 3) return null // endgame: cash what there is

    const plainSuits = SUITS.filter((suit) => suit !== trump)
    const aceSuits = plainSuits.filter((suit) => view.hand.includes(makeCard("A", suit)))
    const tenSuits = plainSuits.filter(
        (suit) => hasBackedTen(view.hand, suit) && legal.some((card) => cardSuit(card) === suit),
    )
    const trumps = myLength(view, trump)

    const lead = (suit: Suit): Card | null => {
        const cards = legal.filter((card) => cardSuit(card) === suit)
        if (cards.length === 0 || myLength(view, suit) < 2) return null
        return weakestCard(cards, trump)
    }

    // 1. Ace here, backed 10 there: open the 10's suit and both may take one.
    if (aceSuits.length >= 1) {
        const ten = tenSuits.find((suit) => !aceSuits.includes(suit))
        if (ten !== undefined) {
            const card = lead(ten)
            if (card !== null) return card
        }
    }

    const longWithoutAce = longestSuitWithoutAce(view, legal)
    // 2 and 3 pick the same card by different reasoning; 4 is the empty hand.
    const badHand = aceSuits.length === 0 && tenSuits.length === 0
    if (trumps >= 3 || aceSuits.length === 2 || badHand) {
        if (longWithoutAce !== null) return lead(longWithoutAce)
    }
    return null
}

/**
 * Which plain suits an OPPONENT's revealed declaration proves an ace in, split
 * by where he sits (TRIK):
 *   - the opponent on my LEFT plays after me, so opening his suit hands him
 *     the trick — avoid it;
 *   - the opponent on my RIGHT plays before me, so opening it makes him spend
 *     the ace under my own cards — prefer it.
 * Silent unless the declarations are revealed and actually name the ace.
 */
export interface DeclarationRead {
    readonly avoid: readonly Suit[]
    readonly prefer: readonly Suit[]
}

const NO_DECLARATION_READ: DeclarationRead = { avoid: [], prefer: [] }

export function declarationRead(view: PlayerView): DeclarationRead {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null || !view.declarationsRevealed) return NO_DECLARATION_READ

    const left = nextSeat(seat)
    const right = seatFromOffset(seat, 3)
    const avoid: Suit[] = []
    const prefer: Suit[] = []
    for (const [key, list] of Object.entries(view.declarations)) {
        const other = Number(key) as Seat
        if (other !== left && other !== right) continue
        for (const declaration of list ?? []) {
            for (const card of declaration.cards) {
                if (cardRank(card) !== "A") continue
                const suit = cardSuit(card)
                if (suit === trump) continue
                if (other === left) avoid.push(suit)
                else prefer.push(suit)
            }
        }
    }
    return { avoid, prefer }
}

/** `seat` moved `offset` places around the table. */
function seatFromOffset(seat: Seat, offset: number): Seat {
    return (((seat + offset) % 4) as Seat)
}

/**
 * How far our side still is from the pass, in card points (BOT.md §8).
 *
 * A deal holds 162 points — 152 in the cards plus the 10 for the last trick —
 * so "prolaz" is 82 for the calling side, and declarations count towards it.
 * Positive means we are still short by that much; zero or less means the pass
 * is already banked. Reads only completed tricks (`currentDealPoints`), which
 * is what is actually settled.
 */
export function pointsShortOfPass(view: PlayerView): number {
    const mine = myTeam(view)
    if (mine === null) return 0
    const PASS = 82
    const cards = view.currentDealPoints[mine] ?? 0
    const declarations = view.declarationPoints?.[mine] ?? 0
    return PASS - cards - declarations
}

/**
 * Fault: a backed 10 held back for a suit that never comes round again is ten
 * points thrown away. "Ako je suigrač zvao i podigrava adute pokušaj mu upuniti
 * svaki bod ... a ako se nije legitimirao asom upuni i potkovanu 10, osim ako
 * vidiš da to nije dovoljno za prolaz" (TRIK).
 *
 * So: on a trick that is certainly ours, a 10 I am otherwise keeping goes in
 * anyway when it is what carries us over the pass. Returns the 10 to feed, or
 * null.
 */
export function tenThatSecuresThePass(view: PlayerView, pool: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    const short = pointsShortOfPass(view)
    if (short <= 0) return null
    const trickSoFar = view.trick.cards.reduce((sum, tc) => sum + cardPoints(tc.card, trump), 0)
    const tens = pool.filter((card) => cardRank(card) === "10" && cardSuit(card) !== trump)
    if (tens.length === 0) return null
    // Only when this trick, with the 10 in it, actually reaches the pass.
    return trickSoFar + 10 >= short ? (tens[0] as Card) : null
}

/**
 * One trump higher than any of mine is still out and it may be my partner's
 * (TRIK): "ne daj aduta da ga istjeraš ... nego probaj ga istjerati bojom koja
 * ti bježi". The suit that "runs away" is my longest plain suit — leading it
 * makes whoever holds that trump spend it on a trick we were losing anyway,
 * and if it is my partner he ruffs a suit I could not have cashed.
 *
 * Returns the card to lead, or null when the shape does not hold: I must have
 * trumps, exactly one outstanding trump may beat them, and it must not be
 * provably an opponent's.
 */
export function forceOutTheLastTrump(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    const mine = view.hand.filter((card) => cardSuit(card) === trump)
    if (mine.length === 0) return null

    // "Ako je nakon povlačenja aduta ostao samo JEDAN adut u igri": the whole
    // outstanding trump holding is that single card, not merely one card above
    // mine. Without this the rule fires most of the middle game (1 394 times
    // per 800 games) and costs a full percentage point.
    const outstanding = outstandingCardsInSuit(view, trump)
    if (outstanding.length !== 1) return null
    const best = strongestCard(mine, trump)
    const above = outstanding.filter(
        (card) => cardStrength(card, trump) > cardStrength(best, trump),
    )
    if (above.length !== 1) return null
    // If the opponents provably cannot hold it, it is my partner's and there is
    // nothing to force; if they provably hold it, drawing is `shouldDrawTrumps`'
    // business, not this rule's.
    if (trumpOutlook(view).opponentMax === 0) return null

    const suit = longestSuitWithoutAce(view, legal)
    if (suit === null || myLength(view, suit) < 2) return null
    return weakestCard(
        legal.filter((card) => cardSuit(card) === suit),
        trump,
    )
}

/* ──────────────────────────────────────────────────────────────────────────
   The rules that came back in on 2026-09-09 by explicit request, after the
   measurement had taken three of them out (BOT.md §11 records what each one
   costs). They are the document's rules; the numbers are what they are.
   ────────────────────────────────────────────────────────────────────── */

/**
 * A suit nobody else can hold any more — every card of it is either in my hand
 * or face up. Such a card is the one that still forces a trump out of somebody
 * late in the deal, so it is not thrown away on an opponent's trick even when
 * it is a 7 (TRIK: "rađe mu daj kralja gdje imaš asa nego tu 7 ili 8").
 */
export function isLastOfADeadSuit(view: PlayerView, card: Card): boolean {
    const trump = view.bidding.trump
    if (trump === null) return false
    const suit = cardSuit(card)
    if (suit === trump) return false
    return outstandingInSuit(view, suit) === 0
}

/**
 * My partner opened a trick with a LOW trump (7, 8 or 9) at some point this
 * deal. The document reads that as a sentence: "Podigravati 7, 8 i 9 znači:
 * vrati aduta" — he holds the next-best trump, or all three plain aces. So
 * when the lead comes back to me, it goes back into trump.
 *
 * Only while there is still a trump to draw: the request was "vrati aduta" so
 * that the OPPONENTS' trumps come out, and once they provably have none the
 * sentence has been answered.
 */
export function partnerAskedForTrump(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false
    if (trumpOutlook(view).opponentMax === 0) return false

    const partner = partnerOf(seat)
    const low = new Set<Card>([makeCard("7", trump), makeCard("8", trump), makeCard("9", trump)])
    for (const trick of reviewableTricks(view)) {
        const opener = trick.plays[0]
        if (opener !== undefined && opener.seat === partner && low.has(opener.card)) return true
    }
    return false
}

/**
 * "Sve najjače strance": every plain suit still in my hand is headed by a
 * master card. A hand of nothing but trumps counts as topped — there is no
 * plain suit left to protect, and the deal is nearly over anyway.
 *
 * This is the test the jack exception needs. It must NOT be `hasWinnersToCash`
 * (any master in hand), because the trump jack is itself a master and the
 * condition would then never be false — which is exactly how that branch spent
 * a day as dead code.
 */
export function plainSuitsAllTopped(view: PlayerView): boolean {
    const trump = view.bidding.trump
    if (trump === null) return true
    const held = SUITS.filter((suit) => suit !== trump && myLength(view, suit) > 0)
    if (held.length === 0) return true
    return held.every((suit) =>
        view.hand.some((card) => cardSuit(card) === suit && isMasterCard(view, card)),
    )
}

/* ── Štiglja (TRIK) ──────────────────────────────────────────────────────
   All eight tricks, worth 90 on top of the cards. */

/** Nobody on the other side has taken a trick yet, and tricks remain. */
export function stigljaIsLive(view: PlayerView): boolean {
    const mine = myTeam(view)
    if (mine === null || view.hand.length === 0) return false
    const theirs: Team = mine === "A" ? "B" : "A"
    return (view.tricksWon[theirs] ?? 0) === 0
}

/**
 * Should I be playing for all eight tricks?
 *
 * "Ako si skupio dovoljno za prolaz pokušaj igrati na štiglju jer 90 bodova
 * nije malo" — and, one line earlier, "**ne riskiraj pad** da bi išao na
 * štiglju". Those two together are the whole rule, and the second one is the
 * guard: the chase only starts once the pass is already banked
 * (`pointsShortOfPass`), so nothing that is chased can cost the deal.
 */
export function shouldChaseStiglja(view: PlayerView): boolean {
    const trump = view.bidding.trump
    if (trump === null || !stigljaIsLive(view)) return false
    // The points on the table count too. `currentDealPoints` is completed
    // tricks only, and with every trick so far ours the one in progress is
    // ours as well — without this the chase could not start until a trick
    // after the pass was actually banked, and the take-over below never fired
    // at all.
    const onTable = view.trick.cards.reduce((sum, tc) => sum + cardPoints(tc.card, trump), 0)
    return pointsShortOfPass(view) - onTable <= 0
}

/**
 * Leading while chasing the štiglja: only from a hand where EVERY card is a
 * master, so the run home is arithmetic rather than hope. Anything looser
 * pre-empts `shouldDrawTrumps`, which is built around when a trump lead has a
 * point, and measured worse than leaving it alone (BOT.md §8).
 */
export function stigljaLead(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null || !shouldChaseStiglja(view)) return null
    if (!view.hand.every((card) => isMasterCard(view, card))) return null
    const trumpMasters = legal.filter((card) => cardSuit(card) === trump)
    // Trumps last: a plain master cannot be ruffed by a hand with no trump,
    // and while any trump is still out there the trump is the safe lead.
    if (trumpOutlook(view).opponentMax > 0 && trumpMasters.length > 0) {
        return strongestCard(trumpMasters, trump)
    }
    const plain = legal.filter((card) => cardSuit(card) !== trump)
    return mostValuableCard(plain.length > 0 ? plain : legal, trump)
}

/**
 * My partner holds the trick but not safely, and the štiglja is still alive:
 * a trick lost here is 90 points lost, so I take it myself if I can rather
 * than leaving it to the seat behind me. Outside a chase this would be the
 * mistake the bot was built not to make — beating your own partner burns a
 * card that would have won a later trick — which is why it is gated.
 *
 * Returns the cheapest card that takes it, or null.
 */
export function stigljaTakeOver(view: PlayerView, legal: readonly Card[]): Card | null {
    if (!shouldChaseStiglja(view)) return null
    if (partnerTrickIsSafe(view)) return null
    return cheapestWinningCard(view, legal)
}

/* ── Štihak: the three seats of it (BOT.md §14, owner's rules 2026-09-20) ──
   `stigljaLead` above only fires once the pass is banked AND every card in
   hand is a master. That is the END of a štihak. What was missing is the
   middle of it: the hand that holds the top trumps keeps leading them so the
   partner can talk with his discards, the partner keeps the suit he can take
   over in, and the defenders stop throwing away the one card that stops it. */

/** Did my own side name the trump? A štihak is the calling side's play. */
function mySideCalled(view: PlayerView): boolean {
    const seat = view.seat
    const caller = view.bidding.caller
    return seat !== null && caller !== null && teamOf(caller) === teamOf(seat)
}

/** Plain suits in my hand that hold no master card — the ones I cannot run
 *  myself and need my partner to take over in. */
function suitsNeedingPartner(view: PlayerView): Suit[] {
    const trump = view.bidding.trump
    if (trump === null) return []
    return SUITS.filter(
        (suit) =>
            suit !== trump &&
            myLength(view, suit) > 0 &&
            !view.hand.some((card) => cardSuit(card) === suit && isMasterCard(view, card)),
    )
}

/**
 * THE RUNNER. I am on lead, nobody on the other side has taken a trick, and
 * every trump I hold is a master — so leading one can never lose the trick.
 * Keep leading them even after the opponents' trumps are gone
 * (`shouldDrawTrumps` stops there): each extra trump is a free discard for my
 * partner, and his discards are how he tells me where he can take over
 * ("baca adute da si suigrač odbaci slabe karte").
 *
 * It stops when the štihak has stopped being possible, not on a percentage:
 *   - my partner has discarded from every suit I would need him in, without
 *     asking for one — he has nothing there, so the rest of my trumps are
 *     worth more as ruffs and re-entries than as a parade;
 *   - my LAST trump is only led when it costs nothing: every plain card I
 *     hold is a master, or he has asked for a suit I can give him.
 * "Ne riskiraj pad da bi išao na štiglju" is kept by construction: a master
 * trump lead cannot lose a trick, so this never risks the pass on its own.
 */
export function stigljaTrumpRun(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null || !stigljaIsLive(view) || !mySideCalled(view)) return null

    const trumps = legal.filter((card) => cardSuit(card) === trump)
    if (trumps.length === 0) return null
    if (!view.hand.every((card) => cardSuit(card) !== trump || isMasterCard(view, card))) return null
    // The only trumps still out are my PARTNER's: every lead would pull one of
    // his instead of a discard, which is the opposite of the point — and the
    // fault the owner already reported once ("uzima suigraču adute").
    const outlook = trumpOutlook(view)
    if (outlook.outstanding > 0 && outlook.opponentMax === 0) return null

    // "Stranog asa odigravaš čim si protivnicima pokupio adute (tako da tvoj
    // suigrač zna zadržati bezec desetku), a onda nastaviš s povlačenjem
    // aduta": the ace goes BEFORE the rest of the run, so that when my partner
    // starts discarding he already knows which 10 to keep. `aceToCash` leaves
    // the solo ace out on purpose — that one is pulled after the trumps, so he
    // is not told to keep a 10 in a suit I can never open for him.
    if (outlook.opponentMax === 0) {
        const ace = aceToCash(view, legal)
        if (ace !== null) return ace
    }

    // He has said "stani": the trumps that are left are worth more at home.
    if (partnerSaysStop(view) && suitsNeedingPartner(view).length > 0) return null

    const needed = suitsNeedingPartner(view)
    const signal = partnerSignal(view)
    const askedFor = signal.wants !== null && myLength(view, signal.wants) > 0
    if (needed.length > 0 && !askedFor && needed.every((suit) => signal.avoids.includes(suit))) {
        return null
    }
    // The last trump is my way back in — but only while somebody else can
    // still hold one. Once every other trump has been played (reported
    // 2026-09-21: seven out in two rounds, the caller sitting on the eighth
    // and an ace), leading it costs nothing: I win the trick and am STILL on
    // lead, and my partner gets one more discard. One discard leaves him
    // between two suits; the second one names the suit he wants.
    //
    // And only with something to follow it with (owner's correction, same
    // day): a plain master of my own, a suit he has asked for, or an ace his
    // declaration shows. A hand with nothing but that trump is not on a
    // štihak at all — it plays the deal normally and the trump stays home.
    if (trumps.length === 1 && needed.length > 0 && !askedFor) {
        if (outlook.outstanding > 0) return null
        const seat = view.seat
        const ownPlainMaster = view.hand.some(
            (card) => cardSuit(card) !== trump && isMasterCard(view, card),
        )
        const partnersShownAce =
            seat !== null &&
            [...locatedCards(view).entries()].some(
                ([card, holder]) =>
                    holder === partnerOf(seat) && cardRank(card) === "A" && cardSuit(card) !== trump,
            )
        // The ace I cashed a moment ago counts too: it told him to keep the
        // 10 of that suit, and a card of it still in my hand is how I reach it.
        const reachCashedSuit =
            seat !== null &&
            reviewableTricks(view).some((trick) => {
                const opener = trick.plays[0]
                if (opener === undefined || opener.seat !== seat || trick.winner !== seat) return false
                const suit = cardSuit(opener.card)
                return suit !== trump && cardRank(opener.card) === "A" && myLength(view, suit) > 0
            })
        if (!ownPlainMaster && !partnersShownAce && !reachCashedSuit) return null
    }

    return strongestCard(trumps, trump)
}

/**
 * THE LAST TWO TRICKS (BOT.md §15.16). Two cards left, I am on lead, one of
 * them is the master trump and the other a plain card that is not a master.
 * The plain card goes FIRST: the trump then takes the LAST trick and the ten
 * points that come with it. Trump first wins the seventh trick instead and
 * hands the eighth — and its ten — to whoever beats my plain card.
 *
 * When the plain card is itself a master the order no longer costs anything
 * and the trump goes first as usual (it also pulls the last trump that could
 * have ruffed the master), so this returns null and the ordinary rules lead.
 */
export function plainBeforeLastTrump(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null || view.hand.length !== 2 || legal.length !== 2) return null
    const mine = view.hand.filter((card) => cardSuit(card) === trump)
    const plain = view.hand.filter((card) => cardSuit(card) !== trump)
    if (mine.length !== 1 || plain.length !== 1) return null
    if (!isMasterCard(view, mine[0] as Card)) return null
    const other = plain[0] as Card
    if (isMasterCard(view, other)) return null
    return other
}

/**
 * HANDING THE DEAL OVER (BOT.md §15.13). My trumps and my own winners are
 * gone, the štihak is still alive, and a declaration shows my partner holds
 * the ace of a suit I have cards in. He gets the lead there — with my HIGHEST
 * card of the suit, not my lowest: holding 10-7, the seven would let him take
 * with the ace and then leave MY ten sitting over his king on the next round,
 * so I take a trick I cannot follow up and the run dies in my hand. Under his
 * ace the ten costs nothing: the points are ours either way.
 *
 * Only with the ace PROVEN in his hand. On a mere discard signal the ten could
 * be walking into an opponent's ace, and that is a different bet.
 */
export function stigljaHandOver(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return null
    if (!stigljaIsLive(view) || !mySideCalled(view)) return null
    if (trumpOutlook(view).opponentMax > 0) return null
    if (view.hand.some((card) => isMasterCard(view, card))) return null

    const partner = partnerOf(seat)
    const located = locatedCards(view)
    // …or SAID, as plainly as discards can say it (owner, 2026-09-21): he has
    // thrown away from BOTH other plain suits and never from this one, and its
    // ace is still unseen and not mine. That is the whole sentence "predaj mi
    // ovdje"; one discard short of it, the low card goes as before.
    const signal = partnerSignal(view)
    const others = (suit: Suit): Suit[] => SUITS.filter((other) => other !== trump && other !== suit)
    const saidByDiscards = (suit: Suit): boolean => {
        const ace = makeCard("A", suit)
        return (
            signal.wants === suit &&
            others(suit).every((other) => signal.avoids.includes(other)) &&
            !view.hand.includes(ace) &&
            outstandingCardsInSuit(view, suit).includes(ace) &&
            (located.get(ace) === undefined || located.get(ace) === partner)
        )
    }
    for (const suit of SUITS) {
        if (suit === trump) continue
        if (located.get(makeCard("A", suit)) !== partner && !saidByDiscards(suit)) continue
        const mine = legal.filter((card) => cardSuit(card) === suit)
        if (mine.length > 0) return strongestCard(mine, trump)
    }
    return null
}

/**
 * THE PARTNER WITH NOTHING (BOT.md §15.14). He is running trumps for a štihak
 * and I have no suit to take over in. Saying so EARLY is worth more than the
 * points on these tricks: every further trump he leads is one he could have
 * kept. The sentence is a MIX — one card from a suit I have not thrown from
 * yet, then another suit, then the third — because his reading
 * (`partnerSignal`, `partnerSaysStop`) is: two LOW cards in a row from two
 * different suits mean "stani". The points on these tricks are worth less than
 * the trumps he keeps by stopping one round earlier.
 */
export function stigljaStopSignal(view: PlayerView, pool: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    const led = view.trick.cards[0]
    if (seat === null || trump === null || led === undefined) return null
    if (!stigljaIsLive(view) || !mySideCalled(view)) return null
    if (cardSuit(led.card) !== trump || led.seat !== partnerOf(seat)) return null

    const plain = pool.filter((card) => cardSuit(card) !== trump)
    const suits = [...new Set(plain.map((card) => cardSuit(card)))]
    if (suits.length < 2) return null
    if (suits.some((suit) => suitWorthKeeping(view, suit))) return null

    const already = new Set(discardsBy(view, seat).map((discard) => discard.suit))
    const fresh = suits.filter((suit) => !already.has(suit))
    if (fresh.length === 0) return null
    // LOW, and that is the point: a high first discard is how a suit is given
    // up by somebody who wants another one. Prefer a suit that actually holds
    // a worthless card, so the sentence is not muddied by a king.
    const lowest = (suit: Suit): Card => weakestCard(plain.filter((card) => cardSuit(card) === suit), trump)
    fresh.sort((a, b) => cardPoints(lowest(a), trump) - cardPoints(lowest(b), trump) || myLength(view, a) - myLength(view, b))
    return lowest(fresh[0] as Suit)
}

/**
 * THE PARTNER of the runner, with no trump to follow: keep the suit I can
 * take over in WHOLE and say so by throwing the others away, high to low,
 * shortest first ("odbacuje ostale dvije boje od veće prema manjoj").
 *
 * `fillCard` would otherwise put the most valuable spendable card on the
 * trick — which, holding A-10-K of a plain suit, is the 10 of exactly the
 * suit the štihak needs. Ninety points beat the ten. Returns null when there
 * is nothing to say (no suit to keep, or only that suit left) and the normal
 * fill applies.
 */
export function stigljaSignalDiscard(view: PlayerView, pool: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    const led = view.trick.cards[0]
    if (seat === null || trump === null || led === undefined) return null
    if (!stigljaIsLive(view) || !mySideCalled(view)) return null
    if (cardSuit(led.card) !== trump || led.seat !== partnerOf(seat)) return null

    const plain = pool.filter((card) => cardSuit(card) !== trump)
    const suits = [...new Set(plain.map((card) => cardSuit(card)))]
    const kept = suits.filter((suit) => suitWorthKeeping(view, suit))
    const given = suits.filter((suit) => !kept.includes(suit))
    if (kept.length === 0 || given.length === 0) return null

    given.sort((a, b) => myLength(view, a) - myLength(view, b))
    const from = given[0] as Suit
    return strongestCard(plain.filter((card) => cardSuit(card) === from), trump)
}

/** The OTHER side has taken every trick so far, and at least two of them:
 *  they are playing for all eight. */
export function opponentsChasingStiglja(view: PlayerView): boolean {
    const mine = myTeam(view)
    if (mine === null) return false
    const theirs: Team = mine === "A" ? "B" : "A"
    return (view.tricksWon[mine] ?? 0) === 0 && (view.tricksWon[theirs] ?? 0) >= 2
}

/** How many cards I must keep in `suit` for my best card there to take a
 *  trick once the higher ones have been played: one more than the number of
 *  outstanding cards that beat it. 0 = nothing here can ever stop them. */
function stopperGuard(view: PlayerView, suit: Suit): number {
    const trump = view.bidding.trump
    if (trump === null) return 0
    const mine = view.hand.filter((card) => cardSuit(card) === suit)
    if (mine.length === 0) return 0
    const best = cardStrength(strongestCard(mine, trump), trump)
    const above = outstandingCardsInSuit(view, suit).filter(
        (card) => cardStrength(card, trump) > best,
    ).length
    const guard = above + 1
    return mine.length >= guard ? guard : 0
}

/**
 * THE DEFENDER. They are running for the štihak and I have to throw a card on
 * a trick I cannot win. One trick is all it takes to save ninety points, so
 * the discard comes from a suit where I can never take one, and a stopper is
 * never unguarded ("ne odbaci uzalud neku kartu"): a 10 with two small cards
 * under an outstanding ace keeps both small cards, a master keeps itself.
 * Returns null when every card on offer is part of a guard, and the ordinary
 * rule picks the least bad one.
 */
export function stigljaDefenceDiscard(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null || !opponentsChasingStiglja(view)) return null

    const free: Card[] = []
    for (const suit of SUITS) {
        const offered = legal.filter((card) => cardSuit(card) === suit)
        if (offered.length === 0) continue
        const guard = stopperGuard(view, suit)
        if (guard === 0) {
            free.push(...offered)
            continue
        }
        // Spare cards beyond the guard may go — cheapest first, never the top.
        const spare = myLength(view, suit) - guard
        if (spare <= 0) continue
        const lowFirst = [...offered].sort((a, b) => cardStrength(a, trump) - cardStrength(b, trump))
        free.push(...lowFirst.slice(0, spare))
    }
    if (free.length === 0 || free.length === legal.length) return null
    return cheapestCard(free, trump)
}

/* ──────────────────────────────────────────────────────────────────────────
   INFERENCE — who holds what (BOT.md §11), added 2026-09-09.

   Everything here answers one question: which cards can an OPPONENT still be
   holding? The bot already counted what has been SEEN; this adds what has been
   SAID. Both are public and both are proof, never guesswork — a card is
   located only when the rules make it impossible for it to be anywhere else.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Cards whose owner is known, from the declarations this seat may see
 * (README §1.4: own always, plus the pair that WON the declarations contest).
 *
 * A declaration NAMES its cards, so every card in one is located in that
 * seat's hand. It is the largest piece of free information in the deal and the
 * bot used to throw all of it away except one inference about the trump jack.
 * Cards already played are dropped: a located card that has been played is
 * just a played card.
 */
export function locatedCards(view: PlayerView): Map<Card, Seat> {
    const out = new Map<Card, Seat>()
    const gone = new Set<Card>(view.played)
    for (const tc of view.trick.cards) gone.add(tc.card)
    for (const [key, list] of Object.entries(view.declarations)) {
        const seat = Number(key) as Seat
        for (const declaration of list ?? []) {
            for (const card of declaration.cards) {
                if (!gone.has(card)) out.set(card, seat)
            }
        }
    }
    return out
}

/**
 * What a seat's own PLAY has proved about its hand, over and above the voids
 * `seatShownVoidIn` already reads (BOT.md §11).
 *
 * The bot plays these conventions itself (`callerTrumpLead`); this is the same
 * sentences read rather than spoken:
 *   - the CALLER opened with the trump ACE → he holds the jack and the nine.
 *     He would not spend the ace with either of them missing, because the
 *     card above it would take the trick;
 *   - the CALLER opened with the trump NINE → he holds the jack and the ace,
 *     and no plain ace (that is the branch that starts with the nine);
 *   - anybody opened with the trump KING or QUEEN → he does NOT hold the jack.
 *     With the jack he leads the jack; the king and queen are the bela's
 *     cards, and leading one is what you do INSTEAD.
 *
 * `holds` and `lacks` are cards, and both are claims about the deal as a
 * whole — a card in `holds` may since have been played, which is why callers
 * intersect them with what is still outstanding.
 */
export interface SeatRead {
    readonly holds: readonly Card[]
    readonly lacks: readonly Card[]
}

const NO_READ: SeatRead = { holds: [], lacks: [] }

export function readSeatFromLeads(view: PlayerView, seat: Seat): SeatRead {
    const trump = view.bidding.trump
    if (trump === null) return NO_READ
    const jack = makeCard("J", trump)
    const nine = makeCard("9", trump)
    const ace = makeCard("A", trump)
    const king = makeCard("K", trump)
    const queen = makeCard("Q", trump)

    const holds: Card[] = []
    const lacks: Card[] = []
    const isCaller = view.bidding.caller === seat

    const readOpening = (card: Card): void => {
        if (cardSuit(card) !== trump) return
        if (isCaller && card === ace) holds.push(jack, nine)
        else if (isCaller && card === nine) holds.push(jack, ace)
        else if (card === king || card === queen) lacks.push(jack)
    }

    for (const trick of reviewableTricks(view)) {
        const opener = trick.plays[0]
        if (opener !== undefined && opener.seat === seat) readOpening(opener.card)
    }
    const current = view.trick.cards[0]
    if (current !== undefined && current.seat === seat) readOpening(current.card)

    return { holds, lacks }
}

/**
 * The seat that announced the bela, or null.
 *
 * `PlayerView.belaDeclared` is a TEAM, which is not enough to reason with — it
 * has to be pinned to the seat that actually played the first of trump K/Q,
 * and that is in the trick record. Once pinned, the seat is known to hold
 * BOTH the king and the queen of trump (a bela is declared out of a hand that
 * has both), and by the leading convention it is known not to hold the jack.
 */
export function belaSeat(view: PlayerView): Seat | null {
    const trump = view.bidding.trump
    const team = view.belaDeclared
    if (trump === null || team === null || team === undefined) return null
    const king = makeCard("K", trump)
    const queen = makeCard("Q", trump)
    const scan = (plays: readonly TrickCard[]): Seat | null => {
        for (const play of plays) {
            if ((play.card === king || play.card === queen) && teamOf(play.seat) === team) {
                return play.seat
            }
        }
        return null
    }
    for (const trick of reviewableTricks(view)) {
        const found = scan(trick.plays)
        if (found !== null) return found
    }
    return scan(view.trick.cards)
}

/**
 * Can `card` still be in an OPPONENT's hand?
 *
 * False when it is face up, in my own hand, or located elsewhere: with my
 * partner by a declaration, or on our side by the bela. Never says false on a
 * guess — every branch is something the rules make certain.
 */
export function opponentCanHold(view: PlayerView, card: Card, located?: Map<Card, Seat>): boolean {
    const seat = view.seat
    if (seat === null) return true
    if (view.hand.includes(card)) return false
    if (view.played.includes(card)) return false
    if (view.trick.cards.some((tc) => tc.card === card)) return false

    const owner = (located ?? locatedCards(view)).get(card)
    if (owner !== undefined) return teamOf(owner) !== teamOf(seat)

    const bela = belaSeat(view)
    if (bela !== null && teamOf(bela) === teamOf(seat)) {
        const trump = view.bidding.trump
        if (trump !== null && (card === makeCard("K", trump) || card === makeCard("Q", trump))) {
            return false
        }
    }

    // The read from my PARTNER's leads: a card he is proved to hold is not a
    // card an opponent can hold. My own seat is deliberately excluded — I know
    // my hand exactly (the check at the top of this function), and inferring
    // about myself from my own play turns any lead the convention did not
    // dictate into a false claim about cards I do not have.
    if (readSeatFromLeads(view, partnerOf(seat)).holds.includes(card)) return false
    return true
}

/**
 * True when the declarations, the bela or a lead prove that `seat` has no
 * trump jack. The declaration half already existed
 * (`seatProvablyLacksTrumpJack`); this adds the two spoken ones and is the
 * version the play should ask.
 */
export function provablyNoTrumpJack(view: PlayerView, seat: Seat): boolean {
    const trump = view.bidding.trump
    if (trump === null) return false
    const jack = makeCard("J", trump)
    if (seatProvablyLacksTrumpJack(view, seat)) return true
    if (readSeatFromLeads(view, seat).lacks.includes(jack)) return true
    return false
}

/**
 * As the CALLER'S PARTNER, coming on lead holding the bela (TRIK): lead the
 * KING, and if the nine is there too lead the QUEEN instead — "on će znati da
 * je devet kod tebe". This is the sending half of the sentence
 * `readSeatFromLeads` reads back: either card says "no jack here".
 *
 * Only as his partner and only while the opponents can still hold a trump —
 * with the trumps gone the message has nothing left to organise.
 */
export function belaLead(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return null
    if (!partnerCalledTrump(view)) return null
    if (trumpOutlook(view).opponentMax === 0) return null

    const king = makeCard("K", trump)
    const queen = makeCard("Q", trump)
    if (!view.hand.includes(king) || !view.hand.includes(queen)) return null
    // With the jack the jack is the lead; the bela's cards are what you lead
    // INSTEAD of it, which is exactly why the message is readable.
    if (view.hand.includes(makeCard("J", trump))) return null

    const withNine = view.hand.includes(makeCard("9", trump))
    const wanted = withNine ? queen : king
    return legal.includes(wanted) ? wanted : null
}

/* ──────────────────────────────────────────────────────────────────────────
   BOT.md §13 — four table rules reported 2026-09-20.

   All four are about a card that is worth more NOW than it will be in two
   tricks' time: the ace under a coming ruff, the suit the partner brought out,
   and the jack that has to be flushed before it eats a winner.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Last to play a PLAIN-suit trick I am about to win, holding both the ace and
 * the ten of the led suit: take it with the ACE (BOT.md §13.1, reported).
 *
 * The trick is mine either way — the reported shape was 7, 8, J on the table
 * and A, 10, K in hand, where the king wins for four points. But the ace and
 * the ten are 21 points sitting in a suit that has now gone round once, so the
 * next round of it is the one somebody ruffs. Cashing the ace banks its eleven
 * while the suit is still safe and leaves the ten as the master behind it.
 *
 * Only when the ace actually WINS: once an opponent has ruffed, the ace is not
 * a winner at all and the normal discard rules own the decision.
 */
export function aceOverCheapWinner(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null || !isLastToPlay(view)) return null

    const led = view.trick.cards[0]
    if (led === undefined) return null
    const suit = cardSuit(led.card)
    if (suit === trump) return null

    const ace = makeCard("A", suit)
    if (!legal.includes(ace) || !legal.includes(makeCard("10", suit))) return null
    // NB "odnesi cenerom" (the caller-partner opened, I hold A and 10) needs no
    // exception here: when my partner opens I am THIRD to play, never last, so
    // this rule cannot see that trick at all — `cheapestWinningCard` already
    // takes it with the ten, and §13.2 then sends the trump back.
    return wouldWinTrick(view, ace) ? ace : null
}

/** A plain-suit lead of 7, 8 or 9 — "mala", the card that carries a message
 *  rather than a trick. The same three ranks `partnerAskedForTrump` reads in
 *  the trump suit. */
const LOW_LEAD_RANKS: ReadonlySet<string> = new Set(["7", "8", "9"])

/** Did `trick` open with the partner's plain-suit card, and did I take it with
 *  the ace of that suit? Returns the suit, or null. */
function partnerSuitTakenByMyAce(view: PlayerView, trick: WonTrick, seat: Seat): Suit | null {
    const trump = view.bidding.trump
    const opener = trick.plays[0]
    if (trump === null || opener === undefined) return null
    if (opener.seat !== partnerOf(seat) || trick.winner !== seat) return null

    const suit = cardSuit(opener.card)
    if (suit === trump) return null
    const mine = trick.plays.find((play) => play.seat === seat)
    if (mine === undefined) return null
    // The ace — or the TEN, which is how the caller's partner takes it when he
    // holds both (`aceOverCheapWinner`).
    return mine.card === makeCard("A", suit) || mine.card === makeCard("10", suit) ? suit : null
}

/**
 * The suit to give back to my partner (BOT.md §13.2, reported): he opened a
 * trick with it, I took it with the ace, so on my next lead it goes back.
 *
 * WHO CALLED decides which of the two readings applies (owner's correction,
 * 2026-09-20): when my partner did NOT call, any plain card he opens with —
 * low or high — may well be a singleton, and giving the suit back lets him
 * ruff it and "save" a small trump he would otherwise lose. So it goes back,
 * always. Only when he IS the caller does a LOW opening mean something else
 * (the request for trump below). The two can never fire on the same trick.
 *
 * The debt is paid once: a later trick I opened in that suit myself clears it,
 * so the rule cannot pin the bot to one suit for the whole deal.
 */
export function suitToReturnToPartner(view: PlayerView): Suit | null {
    const seat = view.seat
    if (seat === null || view.bidding.trump === null) return null

    let wanted: Suit | null = null
    for (const trick of reviewableTricks(view)) {
        const opener = trick.plays[0]
        if (opener === undefined) continue
        if (opener.seat === seat && cardSuit(opener.card) === wanted) {
            wanted = null
            continue
        }
        const suit = partnerSuitTakenByMyAce(view, trick, seat)
        if (suit === null) continue
        if (partnerCalledTrump(view) && LOW_LEAD_RANKS.has(cardRank(opener.card))) continue
        wanted = suit
    }
    return wanted
}

/**
 * The other half of §13.2: my partner opened a trick with a LOW plain card and
 * I took it with the ace. "Ako je suigrač 1. na štihu i odigra malu, znači da
 * želi da mu podigraš aduta jer ima doma dečka" — the low lead is not about
 * that suit at all, it is a request to put trump through while he holds the
 * jack.
 *
 * Same two guards as `partnerAskedForTrump`: only while the opponents can
 * still hold a trump, and never once the declarations or his own leads have
 * proved he has no jack to protect.
 */
export function partnerLowPlainLeadAsksForTrump(view: PlayerView): boolean {
    const seat = view.seat
    if (seat === null || view.bidding.trump === null) return false
    // Only the CALLER's low lead is this sentence; from anybody else it is a
    // suit to give back (`suitToReturnToPartner`).
    if (!partnerCalledTrump(view)) return false
    if (trumpOutlook(view).opponentMax === 0) return false
    if (provablyNoTrumpJack(view, partnerOf(seat))) return false

    for (const trick of reviewableTricks(view)) {
        const opener = trick.plays[0]
        if (opener === undefined || !LOW_LEAD_RANKS.has(cardRank(opener.card))) continue
        if (partnerSuitTakenByMyAce(view, trick, seat) !== null) return true
    }
    return false
}

/**
 * Opening with a SINGLETON so the partner can give the suit back and I ruff it
 * (BOT.md §13.6) — the mirror image of `suitToReturnToPartner`, which is the
 * partner's half of the same conversation.
 *
 * Decided by what is known, not by a dice roll:
 *   - I am not the caller: the caller's trumps are for drawing, not ruffing;
 *   - I hold a SMALL trump to ruff with — spending the jack or the nine on a
 *     ruff saves nothing;
 *   - the suit has not been played yet and my partner is not known to be void
 *     in it, so he can still hold the card that wins and the card to return;
 *   - the ace is not known to sit with an opponent (then the lead only hands
 *     them the tempo). Known to sit with my PARTNER is the best case, and the
 *     only one in which a singleton 10 may be led — it rides home under his
 *     ace. A singleton ace is not this rule's business at all.
 */
export function singletonLead(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null || view.bidding.caller === seat) return null
    if (view.hand.length <= 3) return null

    const smallTrump = view.hand.some(
        (card) => cardSuit(card) === trump && cardRank(card) !== "J" && cardRank(card) !== "9",
    )
    if (!smallTrump) return null

    const partner = partnerOf(seat)
    const located = locatedCards(view)
    let fallback: Card | null = null
    for (const card of legal) {
        const suit = cardSuit(card)
        const rank = cardRank(card)
        if (suit === trump || rank === "A" || myLength(view, suit) !== 1) continue
        if (!isFirstRoundOf(view, suit) || seatShownVoidIn(view, partner, suit)) continue

        const aceHolder = located.get(makeCard("A", suit))
        if (aceHolder === partner) return card
        // His declaration shows cards of this suit WITHOUT the ace (seen:
        // partner declared 8-9-10, I led my lone jack). He has to go over my
        // card (§1.5), so the lead drags his 10 out under an ace that is
        // somewhere else — I "save" one small trump and cost him ten points
        // and the suit. A declaration outranks the hope of a ruff.
        const partnerShownInSuit = [...located.entries()].some(
            ([held, seatOf]) => seatOf === partner && cardSuit(held) === suit,
        )
        if (partnerShownInSuit) continue
        if (aceHolder !== undefined || rank === "10") continue
        fallback ??= card
    }
    return fallback
}

/** A length call needs this many trumps before a low lead is the way to flush
 *  the jack; below it the hand has no trumps to spare. */
const LENGTH_CALL_TRUMPS = 3

/**
 * The caller who called on QUANTITY leads a small trump (BOT.md §13.3,
 * reported): three or more trumps and no jack — 7, 9, 10, Q, A was the shape
 * described — means the jack is out there and every plain winner in the hand
 * is living underneath it. A low trump brings it down onto nothing.
 *
 * Deliberately outside `shouldDrawTrumps`: that rule wants a master trump or a
 * partner who called, and a jackless hand has neither, so a branch placed
 * inside it could never run. This one is the caller spending a worthless card
 * to find the one card that matters.
 *
 * It stops on its own — the moment the jack is face up or located on our side,
 * `opponentCanHold` is false and there is nothing left to flush. A forced call
 * (mus) is excluded: that hand is not a length call, it is no call at all.
 */
export function callerLengthTrumpLead(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null || view.bidding.caller !== seat) return null
    if (callerWasForced(view)) return null

    const jack = makeCard("J", trump)
    if (view.hand.includes(jack) || !opponentCanHold(view, jack)) return null

    const trumps = legal.filter((card) => cardSuit(card) === trump)
    if (trumps.length < LENGTH_CALL_TRUMPS) return null

    // Never the 9, the 10 or the ace: leading one of those under the jack is
    // the ten points the flush was supposed to save (same line `trumpDrawCard`
    // draws for the support case).
    // "Ako si zvao, a nemaš adutskog dečka, moraš to pokazati … podigrati
    // aduta (NE 7 i 8)": a 7/8 is the sentence "vrati aduta". The queen or the
    // king flushes the jack just as well and says the right thing; only a hand
    // without either falls back to the small one.
    const middle = trumps.filter((card) => cardRank(card) === "Q" || cardRank(card) === "K")
    if (middle.length > 0) return weakestCard(middle, trump)
    const cheap = trumps.filter((card) => cardPoints(card, trump) <= CHEAP_TRUMP_POINTS)
    return cheap.length > 0 ? weakestCard(cheap, trump) : null
}

/* ── §15.9: the caller's jack waits for the partner's DECLARED nine ─────────
   Reported 2026-09-21. The partner showed 7-8-9 or 8-9-10 of the trump suit,
   so the whole table knows where the nine is. Leading the jack then pulls his
   trumps along with theirs; getting HIM on lead instead lets the nine come
   through — nothing but my own jack beats it — and the jack is still at home
   for the round after. */

/** The trump nine, if a declaration places it in my partner's hand and it has
 *  not been played yet. */
function partnersDeclaredNine(view: PlayerView): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return null
    const nine = makeCard("9", trump)
    if (view.played.includes(nine)) return null
    return locatedCards(view).get(nine) === partnerOf(seat) ? nine : null
}

/**
 * THE CALLER: hold the jack back and look for my partner's hand instead — a
 * low card from a plain suit in which I have no ace (so I am not throwing a
 * trick away to find him), best of all a suit where a declaration shows his
 * ace. Null when there is no such card, and the ordinary jack lead applies.
 */
export function callerLeadsToPartnersNine(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null || view.bidding.caller !== seat) return null
    if (!view.hand.includes(makeCard("J", trump))) return null
    if (partnersDeclaredNine(view) === null) return null
    if (trumpOutlook(view).opponentMax === 0) return null

    const partner = partnerOf(seat)
    const located = locatedCards(view)
    let best: Card | null = null
    let bestScore = -Infinity
    for (const suit of SUITS) {
        if (suit === trump || view.hand.includes(makeCard("A", suit))) continue
        if (seatShownVoidIn(view, partner, suit)) continue
        const mine = legal.filter((card) => cardSuit(card) === suit)
        if (mine.length === 0) continue
        const low = weakestCard(mine, trump)
        if (cardPoints(low, trump) >= 10) continue // never a ten led blind
        const aceHolder = located.get(makeCard("A", suit))
        if (aceHolder !== undefined && aceHolder !== partner) continue // their ace: no entry there
        const score = (aceHolder === partner ? 100 : 0) - cardPoints(low, trump) + mine.length
        if (score > bestScore) {
            best = low
            bestScore = score
        }
    }
    return best
}

/**
 * THE PARTNER: I declared the nine, he called and has kept his jack at home —
 * on lead, the nine goes through. Only my DECLARED nine: that is what made his
 * waiting a plan rather than a guess, and it is the only case in which I know
 * he is not the one hoping for the nine from somebody else.
 */
export function declaredNineThrough(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null || !partnerCalledTrump(view)) return null
    const nine = makeCard("9", trump)
    if (!legal.includes(nine)) return null
    if (view.played.includes(makeCard("J", trump))) return null
    if (provablyNoTrumpJack(view, partnerOf(seat))) return null
    const mine = view.declarationsRevealed ? (view.declarations[seat] ?? []) : []
    const declared = mine.some((declaration) => declaration.cards.includes(nine))
    return declared ? nine : null
}

/* ── §13.4 and §13.5: the two trump rules reported alongside them ──────── */

/** Did my partner open a trick with a LOW trump that I then took with the
 *  jack? The premise of `lowTrumpBackAfterJack`, and the only shape in which
 *  his "vrati aduta" and my jack are the same sentence. */
function partnerLowTrumpTakenByMyJack(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false

    const partner = partnerOf(seat)
    const jack = makeCard("J", trump)
    for (const trick of reviewableTricks(view)) {
        const opener = trick.plays[0]
        if (opener === undefined || opener.seat !== partner) continue
        if (cardSuit(opener.card) !== trump) continue
        if (!LOW_LEAD_RANKS.has(cardRank(opener.card))) continue
        if (trick.winner !== seat) continue
        if (trick.plays.some((play) => play.seat === seat && play.card === jack)) return true
    }
    return false
}

/**
 * He led a low trump, I took it with the jack: the trump goes back SMALL
 * (BOT.md §13.4, reported).
 *
 * His low lead already said he has no jack, and the jack is now face up in
 * front of me — so the highest trump left is very likely the nine in my own
 * hand. Leading it would be spending the card that the opponents' last trump
 * has to fall under; leading a 7 or a queen pulls two of their trumps for
 * nothing and keeps the nine for the trick after.
 *
 * Two conditions from the table, and neither is a guess:
 *   - I must actually HOLD the top remaining trump (`isMasterCard`). Without
 *     it there is no honour to protect and the ordinary draw is better;
 *   - the opponents must still be able to hold a trump (`trumpOutlook`). If
 *     every trump left is the partner's, a low lead only pulls his.
 */
export function lowTrumpBackAfterJack(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null || !partnerLowTrumpTakenByMyJack(view)) return null
    if (trumpOutlook(view).opponentMax === 0) return null

    const trumps = legal.filter((card) => cardSuit(card) === trump)
    if (!trumps.some((card) => isMasterCard(view, card))) return null

    const cheap = trumps.filter((card) => cardPoints(card, trump) <= CHEAP_TRUMP_POINTS)
    return cheap.length > 0 ? weakestCard(cheap, trump) : null
}

/**
 * Following a TRUMP lead holding both the jack and the ace, with the nine
 * still out and a seat behind me that can hold it: win with the JACK
 * (BOT.md §13.5, reported).
 *
 * The reported trick was the partner's king, an opponent's ten, and this hand
 * holding A and J. The ace is the cheaper winner by points, which is why the
 * bot chose it — and the fourth player's nine takes eleven points off the
 * table with it. The jack cannot be captured by anything.
 *
 * Nothing here touches the caller's own LEADING sequence (`callerTrumpLead`,
 * BOT.md §5, which opens with the ace or the nine and keeps the jack back):
 * this only ever runs with a card already on the table.
 */
export function jackOverAceOnTrumpLead(view: PlayerView, legal: readonly Card[]): Card | null {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null || isLastToPlay(view)) return null

    const led = view.trick.cards[0]
    if (led === undefined || cardSuit(led.card) !== trump) return null

    const jack = makeCard("J", trump)
    const ace = makeCard("A", trump)
    if (!legal.includes(jack) || !legal.includes(ace)) return null

    const nine = makeCard("9", trump)
    if (!outstandingCardsInSuit(view, trump).includes(nine)) return null

    // Only the seats that still play after me matter: a nine in front of me is
    // a nine that has already missed its chance at my ace.
    const owner = locatedCards(view).get(nine)
    for (let follower = nextSeat(seat); follower !== view.trick.leader; follower = nextSeat(follower)) {
        if (view.handSizes[follower] <= 0) continue
        const canHoldIt = owner === undefined ? !seatShownVoidInTrump(view, follower) : owner === follower
        if (canHoldIt) return jack
    }
    return null
}
