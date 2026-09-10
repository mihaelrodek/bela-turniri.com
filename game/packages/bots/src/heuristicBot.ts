/* ──────────────────────────────────────────────────────────────────────────
   The heuristic bot — the one and only bot. `game/BOT.md` is the contract:
   what it thinks and why, rule by rule, with the unwritten rules of bela it
   comes from. This file is the priority list; `evaluate.ts` holds the
   judgements each step asks for.

   Bidding: expected tricks over the whole hand (`handTricks`) against a
   threshold that moves with the seat — easier to call when the partner leads,
   harder without the jack when the opponent on my left does, and no threshold
   at all on a mus or when passing would hand the opponents the game.

   Play, in order:
     1. leading → `leadCard` below;
     2. partner holds the trick and nobody after me can take it → fill it
        (`partnerTrickIsSafe`, `fillCard`);
     3. partner holds it but it is not safe → the cheapest card that leaves it
        with him; when §1.5 forces me over him, the weakest card that does;
     4. I can win → the cheapest winning card, or the master of the led suit
        when I am second to play;
     5. otherwise discard, and the discard is a MESSAGE (`signalDiscard`).

   The bot chooses only inside `legalMoves`. Following suit, going over the
   card that holds the trick and ruffing when void are the engine's rules
   (README §1.5), never this file's.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, LegalBids, PlayerView, Seat, Suit } from "@bela/engine"
import { cardRank, cardSuit, makeCard, nextSeat, partnerOf, teamOf } from "@bela/engine"
import type { BidChoice, Bot } from "./index"
import {
    aceToCash,
    belaLead,
    declarationRead,
    defensiveLead,
    fillPreferringTen,
    isLastOfADeadSuit,
    partnerAskedForTrump,
    stigljaLead,
    stigljaTakeOver,
    forceOutTheLastTrump,
    tenThatSecuresThePass,
    nineOnPartnersLowTrump,
    bestTrumpSuit,
    callerTrumpLead,
    cheapestCard,
    cheapestDiscard,
    cheapestWinningCard,
    fillCard,
    handTricks,
    isMasterCard,
    isPartnerHoldingTrick,
    isThinLead,
    partnerSignal,
    partnerTrickIsSafe,
    quietLeadCard,
    shouldDrawTrumps,
    shouldSpendAce,
    suitStrength,
    trumpDrawCard,
    weakestCard,
    wouldWinTrick,
} from "./evaluate"

/* ── Bidding ─────────────────────────────────────────────────────────────
   BOT.md §1. The base is the document's "two sure tricks and a half"; every
   adjustment below is one of its lines about WHERE you are sitting, because
   the same six cards are a call in one seat and a pass in another. */

/**
 * Expected tricks over the WHOLE hand (`handTricks`) that a call needs. Six
 * cards are visible when the bidding happens, so this is a number about six
 * cards, not eight — the document says so in its first line about calling.
 */
const BID_THRESHOLD = 1.1

/**
 * …and the trump holding a call needs on its own (`suitStrength`: J 4, 9 3,
 * A 1.5, 10 1, ½ per extra card). Two conditions rather than one, because they
 * are two different questions and the document asks them separately: WHICH
 * suit is about the trumps, WHETHER to call is about the whole hand. Without
 * this one, `handTricks` alone would call on two plain aces and a trump suit
 * of nothing — most of that score is the plain suits, which are worth the same
 * whichever suit ends up named.
 *
 * 4.5 is the jack with one card beside it, or the nine with an ace. Measured:
 * the old rule (`suitStrength >= 5.5` and nothing else) passed so often that a
 * THIRD of all deals ended up as a forced dealer call on a hand nobody wanted
 * — 34.3 % of calls were a mus. At 4.5 that falls to about 4 %.
 */
const MIN_TRUMP_STRENGTH = 4.5
/** "Najlakše je zvati ako je suigrač prvi na igri" — he will show me his hand. */
const PARTNER_LEADS_BONUS = 0.25
/** "Kad si prvi na igri, lakše je diktirati igru." */
const I_LEAD_BONUS = 0.1
/** "Rizik je zvati bez dečka ako ti je igrač prvi na igri" — he cashes his ace. */
const NO_JACK_UNDER_GUN_PENALTY = 0.35
/** "Ako ti je suigrač zadnji na zvanju tj. u musu, pokušaj ga spasiti." */
const RESCUE_PARTNER_BONUS = 0.4

/** Who opens the play this deal: the seat after the dealer (README §1.5). */
function openingSeat(view: PlayerView): Seat {
    return nextSeat(view.dealer)
}

/**
 * The threshold this seat has to clear, moved by the seat's own position
 * (BOT.md §1). Everything here is public before a card is played: who deals,
 * who has passed, and what I hold.
 */
function bidThreshold(view: PlayerView, best: Suit): number {
    const seat = view.seat
    if (seat === null) return BID_THRESHOLD
    let threshold = BID_THRESHOLD

    const opener = openingSeat(view)
    if (opener === partnerOf(seat)) threshold -= PARTNER_LEADS_BONUS
    else if (opener === seat) threshold -= I_LEAD_BONUS

    // The opponent on my left leads: without the jack he takes the first trick
    // off me and I never get the trumps out.
    if (opener !== seat && teamOf(opener) !== teamOf(seat)) {
        if (!view.hand.includes(makeCard("J", best))) threshold += NO_JACK_UNDER_GUN_PENALTY
    }

    // My partner is the dealer and everybody before him has passed: pass and
    // he is on mus, calling something he has not got.
    const partnerOnMus = partnerOf(seat) === view.dealer && view.bidding.passes.length === 2
    if (partnerOnMus) threshold -= RESCUE_PARTNER_BONUS

    return threshold
}

/**
 * The endgame exception, and the only place the SCORE enters the bot's head:
 * "ako je kraj partije i rezultat je izjednačen te onaj koji uzme i prođe je
 * pobjednik, tad se mora zvati i ne dozvoliti protivniku da bira aduta."
 *
 * Read conservatively — one ordinary deal (about 90 card points to the winning
 * side) would carry the opponents over the target while we stay short.
 */
const ONE_DEAL = 90

function mustNotPass(view: PlayerView, target: number): boolean {
    const seat = view.seat
    if (seat === null) return false
    const us = teamOf(seat)
    const them = us === "A" ? "B" : "A"
    return view.score[them] + ONE_DEAL >= target && view.score[us] + ONE_DEAL < target
}

function chooseBid(view: PlayerView, legal: LegalBids, _rng: () => number): BidChoice {
    const best = bestTrumpSuit(view.hand, legal.suits)
    if (!legal.canPass) return best // dealer forced (mus): best suit, no threshold

    const target = view.targetScore
    if (target !== undefined && mustNotPass(view, target)) return best

    if (suitStrength(view.hand, best) < MIN_TRUMP_STRENGTH) return "PASS"
    return handTricks(view.hand, best) >= bidThreshold(view, best) ? best : "PASS"
}

/* ── Leading ─────────────────────────────────────────────────────────────
   BOT.md §5. */

/**
 * Opening a trick, in priority order (BOT.md §5):
 *  1. the suit my partner ASKED for (`partnerSignal`) — he threw its ace, so
 *     his 10 is the master and every trick of it is ours. Answering him is
 *     worth more than anything else on this list;
 *  2. a trump, but only when drawing them has a point (`shouldDrawTrumps`),
 *     and with the caller's own sequencing (`callerTrumpLead`);
 *  3. the long suit, when one lone trump above mine is all that is left
 *     (`forceOutTheLastTrump`) — make its holder spend it on a trick we were
 *     losing anyway;
 *  4. on DEFENCE, the document's own opening book (`defensiveLead`, §7),
 *     which outranks everything below it;
 *  5. a plain ace once the opponents provably cannot ruff (`aceToCash`) —
 *     cashing it also tells my partner to hold his backed 10;
 *  6. an ace worth spending (`shouldSpendAce`), or a 10 that has become the
 *     master of its suit;
 *  7. a quiet lead (`quietLeadCard`), steered by what the table has said —
 *     the suit an opponent on my right showed the ace in, and away from the
 *     suits my partner and the opponent on my left have disclaimed — and never
 *     a singleton or a backed 10 (`isThinLead`, both 2:1 against);
 *  8. the weakest card I have.
 */
function leadCard(view: PlayerView, legal: readonly Card[], trump: Suit): Card {
    const signal = partnerSignal(view)

    // All eight tricks are still ours to take: cash, do not manoeuvre.
    const chase = stigljaLead(view, legal)
    if (chase !== null) return chase

    // As the caller's partner, on lead with the bela: the king says "bela",
    // the queen says "bela and the nine" (BOT.md §11).
    const bela = belaLead(view, legal)
    if (bela !== null) return bela

    if (shouldDrawTrumps(view)) {
        const sequenced = callerTrumpLead(view, legal)
        if (sequenced !== null) return sequenced
        const draw = trumpDrawCard(view, legal)
        if (draw !== null) return draw
    }

    // The suit my partner ASKED for (`partnerSignal`) — he threw its ace, so
    // his 10 is the master and every trick of it is ours.
    //
    // It sits BELOW the trump draw, and that order is a fix (2026-09-09,
    // reported): above it, a caller holding the top trumps answered the
    // request with a plain lead and never drew at all. Drawing is the thing
    // that makes his suit cashable in the first place — the request keeps,
    // the trumps do not.
    if (signal.wants !== null) {
        const asked = legal.filter((card) => cardSuit(card) === signal.wants)
        // Lead him the suit low: his 10 is the master, mine is the entry.
        if (asked.length > 0) return weakestCard(asked, trump)
    }

    // "Podigravati 7, 8 i 9 znači: vrati aduta." He said it; this answers.
    if (partnerAskedForTrump(view)) {
        const trumps = legal.filter((card) => cardSuit(card) === trump)
        if (trumps.length > 0) return weakestCard(trumps, trump)
    }

    // One trump left in the deal and it beats mine: force it out with the long
    // suit rather than leading into it (BOT.md §5).
    const force = forceOutTheLastTrump(view, legal)
    if (force !== null) return force

    // On defence the document has its own opening book (BOT.md §7), and it
    // outranks cashing an ace: its first rule is not to open your ace suit.
    const defensive = defensiveLead(view, legal)
    if (defensive !== null) return defensive

    const cash = aceToCash(view, legal)
    if (cash !== null) return cash

    const aces = legal.filter((card) => cardRank(card) === "A" && cardSuit(card) !== trump)
    const worthSpending = aces.filter((card) => shouldSpendAce(view, cardSuit(card)))
    if (worthSpending.length > 0) {
        // Prefer an ace with its own 10 behind it: the 10 is then the master
        // of the suit on the next lead.
        const backedByTen = worthSpending.find((card) =>
            view.hand.includes(makeCard("10", cardSuit(card))),
        )
return backedByTen ?? (worthSpending[0] as Card)
    }

    // A 10 whose ace is gone is the master of its suit — the same sure trick
    // an ace is, under the same ruff caveat.
    const masterTens = legal.filter(
        (card) =>
            cardRank(card) === "10" &&
            cardSuit(card) !== trump &&
            isMasterCard(view, card) &&
            shouldSpendAce(view, cardSuit(card)),
    )
    if (masterTens.length > 0) return masterTens[0] as Card

    // Nothing to attack with: open quietly. Two exclusions, both of them
    // things somebody has already told me. The aces I decided to keep must not
    // leak back in as "the lowest card of my shortest suit" when that suit is
    // a singleton ace. And the suits my partner discarded from are suits he has
    // said he has nothing in (`partnerSignal.avoids`), so opening one of them
    // asks a question he has already answered — dropped only if avoiding them
    // would leave nothing to lead.
    const kept = new Set<Card>(aces)
    const read = declarationRead(view)
    // A suit the opponent on my RIGHT has shown the ace in is the one to open:
    // he spends it before I have to commit anything.
    if (read.prefer.length > 0) {
        const preferred = legal.filter(
            (card) => !kept.has(card) && read.prefer.includes(cardSuit(card)),
        )
        if (preferred.length > 0) return weakestCard(preferred, trump)
    }
    const speaking = legal.filter(
        (card) =>
            !kept.has(card) &&
            !signal.avoids.includes(cardSuit(card)) &&
            !read.avoid.includes(cardSuit(card)),
    )
    const pool = speaking.length > 0 ? speaking : legal
    const quiet = quietLeadCard(view, pool, kept)
    if (!isThinLead(view, quiet)) return quiet

    // The quiet lead came out a singleton or a backed 10. Take the cheapest
    // card of a suit I actually hold more than one of instead — but only a
    // PLAIN one. Falling back to a trump here would be a trump lead made for
    // no reason at all, which is worse than the singleton it is avoiding, and
    // `shouldDrawTrumps` has already said this is not the moment for one.
    const solid = pool.filter(
        (card) => !kept.has(card) && cardSuit(card) !== trump && !isThinLead(view, card),
    )
return solid.length > 0 ? quietLeadCard(view, solid, kept) : quiet
}

function chooseCard(view: PlayerView, legal: Card[], _rng: () => number): Card {
    if (legal.length === 1) return legal[0] as Card
    const trump = view.bidding.trump
    if (trump === null) return legal[0] as Card

    if (view.trick.cards.length === 0) return leadCard(view, legal, trump)

    if (isPartnerHoldingTrick(view)) {
        // Never take a trick my own partner already holds by choice: the
        // points land on our side either way, so beating him only burns a
        // card that would have won a LATER trick. When the rules leave no
        // choice (§1.5: I must go over him in the led suit, or I am void and
        // must ruff him), take it as CHEAPLY as possible — the trick is ours
        // already, a trump jack spent on it is a jack thrown away.
        // He opened with a low trump: the nine is the card that answers it.
        const nine = nineOnPartnersLowTrump(view, legal)
        if (nine !== null) return nine
        const notBeating = legal.filter((card) => !wouldWinTrick(view, card))
        // §1.5 leaves no choice but to take it off him: the weakest card that
        // does, since the trick is ours either way.
        if (notBeating.length === 0) return weakestCard(legal, trump)
        // "Na suigračevo nošenje nastoj upuniti svaki bod" — but only once
        // nobody after me can take it (`partnerTrickIsSafe`). Until then the
        // cheapest card, and the ace waits for a trick that is actually ours.
        if (partnerTrickIsSafe(view)) {
            const fill = fillCard(view, notBeating)
            // Defending, and the fill came out an ace with its own 10 beside
            // it: the 10 goes instead, so the caller reads the ace as his
            // partner's (BOT.md §4).
            const swap = fillPreferringTen(view, fill, notBeating)
            if (swap !== null) return swap
            // A 10 I would otherwise keep goes in when it is the card that
            // carries us over the pass (BOT.md §8).
            const securing = tenThatSecuresThePass(view, notBeating)
            if (securing !== null) return securing
            return fill
        }
        // A trick given away while the štiglja is alive is 90 points given
        // away, so it is taken rather than left to the seat behind me.
        const take = stigljaTakeOver(view, legal)
        if (take !== null) return take
        // Not safe yet, so no points go in — but the card still has to come
        // from somewhere, and a free discard is a message (`signalDiscard`).
        return cheapestCard(notBeating, trump)
    }

    const winner = cheapestWinningCard(view, legal)
    if (winner !== null) {
        // Second to play with the master of the led suit in hand: take the
        // trick with it rather than with a 9 that the third player is then
        // FORCED to go over (§1.5) — the cheap "winner" is only provisional,
        // and the master wins the same trick for certain (ruffs aside).
        if (view.trick.cards.length === 1 && cardSuit(winner) !== trump) {
            const master = legal.find(
                (card) => cardSuit(card) === cardSuit(winner) && isMasterCard(view, card),
            )
            if (master !== undefined) return master
        }
        return winner
    }

    // The opponents are taking this one. What I throw is the one thing I can
    // still control, and BOT.md §2 says it is a sentence, not a leftover.
    // The last card of a suit nobody else holds still forces a trump out of
    // somebody later, so it is not the one thrown away here.
    const throwable = legal.filter((card) => !isLastOfADeadSuit(view, card))
    const pool = throwable.length > 0 ? throwable : legal
    return cheapestDiscard(view.hand, pool, trump)
}

export const heuristicBot: Bot = {
    chooseBid,
    chooseCard,
}
