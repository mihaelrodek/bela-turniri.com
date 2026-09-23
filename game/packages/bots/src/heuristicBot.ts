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
import { cardPoints, cardRank, cardSuit, makeCard, nextSeat, partnerOf, teamOf } from "@bela/engine"
import type { BidChoice, Bot } from "./index"
import {
    aceOverCheapWinner,
    aceAfterMyWin,
    aceToCash,
    belaLead,
    declarationRead,
    defensiveLead,
    defensiveTrumpCapture,
    fillPreferringTen,
    isLastOfADeadSuit,
    jackOverAceOnTrumpLead,
    lowTrumpBackAfterJack,
    partnerAskedForTrump,
    plainBeforeLastTrump,
    partnerLowPlainLeadAsksForTrump,
    stigljaDefenceDiscard,
    stigljaHandOver,
    stigljaLead,
    stigljaTrumpRun,
    singletonLead,
    suitToReturnToPartner,
    stigljaTakeOver,
    forceOutTheLastTrump,
    hasBackedTen,
    tenThatSecuresThePass,
    highTrumpOnPartnersLowTrump,
    bestTrumpSuit,
    callerLeadsToPartnersNine,
    callerLengthTrumpLead,
    declaredNineThrough,
    callerTrumpLead,
    continueAceSuit,
    cheapestCard,
    cheapestDiscard,
    cheapestWinningCard,
    fillCard,
    handTricks,
    isMasterCard,
    isPartnerHoldingTrick,
    isThinLead,
    openingTrumpForCallingPartner,
    partnerSignal,
    partnerTrickIsSafe,
    sureWinnerToCash,
    onlyPartnerCanHoldTrumps,
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

    // My partner is the dealer, so I speak SECOND, with exactly one pass in
    // (the opener's): pass and he is one opponent away from a mus, calling
    // something he has not got. This read `=== 2` until 2026-09-21, which no
    // seat can ever see here — the rule had never fired (measured: 0 in 185 000
    // deals).
    const partnerOnMus = partnerOf(seat) === view.dealer && view.bidding.passes.length === 1
    if (partnerOnMus) threshold -= RESCUE_PARTNER_BONUS

    return threshold
}

/**
 * The endgame exception, and the only place the SCORE enters the bot's head:
 * "ako je kraj partije i rezultat je izjednačen te onaj koji uzme i prođe je
 * pobjednik, tad se mora zvati i ne dozvoliti protivniku da bira aduta."
 *
 * "Izjednačen" is read as: BOTH sides are one ordinary deal (about 90 card
 * points) from the target, so whoever takes the deal and passes wins the game
 * and the trump is worth fighting for. If only the opponents are that close,
 * calling gains nothing — we cannot win the game this deal either way, and a
 * forced call on a weak hand is a fall that hands them all the points and the
 * game (seen: 572 vs 924 on 1001, a bot called on 7/8/10 and fell).
 */
const ONE_DEAL = 90

function mustNotPass(view: PlayerView, target: number): boolean {
    const seat = view.seat
    if (seat === null) return false
    const us = teamOf(seat)
    const them = us === "A" ? "B" : "A"
    const window = endgameWindow(target)
    return view.score[them] + window >= target && view.score[us] + window >= target
}

/**
 * How close to the target "kraj partije" begins. One ordinary deal (90) on the
 * long games — but never more than a QUARTER of the target: in the quick game
 * to 163 a flat 90 made the whole game an endgame from the second deal on
 * (owner, 2026-09-21), so there it starts at 122, not at 73.
 */
function endgameWindow(target: number): number {
    return Math.min(ONE_DEAL, Math.round(target / 4))
}

/**
 * How close the OPPONENTS are to the target, 0 (nowhere near) to 1 (any deal
 * they take ends the game). A ramp, not a line: 930, 950 and 990 on 1001 are
 * three different amounts of danger, and none of them is a switch.
 *
 * Near the finish every point they get is game, so a call that falls is not a
 * lost deal but a lost game — better to pass and let THEM call and risk the
 * fall. Only a hand that is very likely to make the call is worth the risk.
 */
const DANGER_RAMP_START = 120
const DANGER_RAMP_SPAN = 100

function opponentDanger(view: PlayerView, target: number): number {
    const seat = view.seat
    if (seat === null) return 0
    const them = teamOf(seat) === "A" ? "B" : "A"
    const danger = (view.score[them] - (target - DANGER_RAMP_START)) / DANGER_RAMP_SPAN
    return Math.min(1, Math.max(0, danger))
}

/** Trump holding (`suitStrength`) that still justifies a call at full danger:
 *  the jack and the nine and an ace — or the same strength in length. */
const DANGER_MIN_TRUMP_STRENGTH = 8
/** Extra expected tricks over the whole hand a call needs at full danger. */
const DANGER_EXTRA_TRICKS = 1.5

/**
 * "Tad se mora zvati i ne dozvoliti protivniku da bira aduta" — but not at any
 * price (reported 2026-09-21: 92:90 in a game to 163, a call on 8-Q-A of trump).
 * Two limits on the endgame rule:
 *   - if my pass leaves an OPPONENT on mus (he deals and I am the last to
 *     speak before him), he does not get to CHOOSE anything — he is forced onto
 *     whatever he holds, which is the best thing that can happen to us;
 *   - a hand with no trump worth the name is a fall, and a fall at this score
 *     is the game. The bar is far below an ordinary call (the jack alone, or
 *     the nine alone, clears it), but 8-Q-A does not.
 */
const ENDGAME_MIN_TRUMP_STRENGTH = 4

function worthAForcedEndgameCall(view: PlayerView, best: Suit): boolean {
    const seat = view.seat
    if (seat === null) return false
    const opponentDeals = teamOf(view.dealer) !== teamOf(seat)
    const lastBeforeDealer = nextSeat(seat) === view.dealer
    if (opponentDeals && lastBeforeDealer) return false
    return suitStrength(view.hand, best) >= ENDGAME_MIN_TRUMP_STRENGTH
}

function chooseBid(view: PlayerView, legal: LegalBids, _rng: () => number): BidChoice {
    const best = bestTrumpSuit(view.hand, legal.suits)
    if (!legal.canPass) return best // dealer forced (mus): best suit, no threshold

    const target = view.targetScore
    if (target !== undefined && mustNotPass(view, target) && worthAForcedEndgameCall(view, best)) return best

    // Passing is only the safe choice when somebody ELSE then decides. With my
    // partner the dealer (I speak second, one pass in), my pass leaves HIM one opponent away from a mus with a
    // hand he did not choose — a likelier fall than my own middling call — so
    // the ramp stands down and the ordinary rescue bonus applies.
    const partnerOnMus =
        view.seat !== null && partnerOf(view.seat) === view.dealer && view.bidding.passes.length === 1
    const danger = target === undefined || partnerOnMus ? 0 : opponentDanger(view, target)
    const strength = suitStrength(view.hand, best)
    const minStrength = MIN_TRUMP_STRENGTH + danger * (DANGER_MIN_TRUMP_STRENGTH - MIN_TRUMP_STRENGTH)
    const threshold = bidThreshold(view, best) + danger * DANGER_EXTRA_TRICKS
    if (strength >= minStrength && handTricks(view.hand, best) >= threshold && !isBareJackCall(view.hand, best)) return best

    // The document's two minimum hands that the yardstick above misses, both
    // only for the seat that OPENS the play and only at an ordinary score
    // (BOT.md §1, "zvanje po dokumentu"). Measured neutral over 2000 paired
    // games (50.1 % ± 2.2) — they fire about four times per hundred games —
    // and kept for fidelity to the document, not for strength.
    if (danger === 0 && view.seat !== null && openingSeat(view) === view.seat) {
        const documented = documentedMinimumCall(view.hand, legal.suits)
        if (documented !== null) return documented
    }
    return "PASS"
}

/**
 * The jack and ONE small trump with nothing beside them (BOT.md §15.21,
 * reported 2026-09-21: the bot called on J + K of trump and an empty hand).
 * Calling on the jack and a king is ordinary — but only with something to go
 * with it: a plain ace, or length (three trumps). Alone it guarantees exactly
 * one trick, the jack's, and the seat bonuses in `bidThreshold` (partner
 * leads, rescue the dealer…) were enough to talk the yardstick into it:
 * `handTricks` of J + K is 1.0 and the threshold drops to 0.85 and below.
 *
 * True when the call would be that hand: at most two trumps, no second top
 * trump among them (J + 9 is two sure tricks and stays a call), and not one
 * plain ace. The forced calls — the dealer on mus, and the endgame "must not
 * pass" — do not come through here; they have no pass to fall back on.
 */
function isBareJackCall(hand: readonly Card[], trump: Suit): boolean {
    const trumps = hand.filter((card) => cardSuit(card) === trump)
    if (trumps.length > 2) return false
    const top = trumps.filter((card) => ["J", "9", "A"].includes(cardRank(card)))
    if (top.length >= 2) return false
    return !hand.some((card) => cardSuit(card) !== trump && cardRank(card) === "A")
}

/**
 * "Belu i devetku u zamišljenom adutu te bezec desetku u strancu (ako je prvi
 * na igri)" and "četiri karte u istoj boji (ako je prvi na igri)". The bela
 * hand comes first: it names a suit with two honours and twenty points of
 * declaration in it, the length hand names a suit that may hold nothing.
 */
const ALL_SUITS: readonly Suit[] = ["HERC", "KARA", "PIK", "TREF"]

function documentedMinimumCall(hand: readonly Card[], suits: readonly Suit[]): Suit | null {
    for (const suit of suits) {
        const holds = (rank: "K" | "Q" | "9"): boolean => hand.includes(makeCard(rank, suit))
        if (!holds("K") || !holds("Q") || !holds("9")) continue
        const backedTenElsewhere = ALL_SUITS.some((other) => other !== suit && hasBackedTen(hand, other))
        if (backedTenElsewhere) return suit
    }
    const long = suits.filter((suit) => hand.filter((card) => cardSuit(card) === suit).length >= 4)
    return long.length > 0 ? bestTrumpSuit(hand, long) : null
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
/**
 * A caller who opens a trick with the trump jack available leads it.
 *
 * J-9-A has its own deliberate sequence in `callerTrumpLead`, so it must not
 * be intercepted here.
 */
function callerJackLead(
    view: PlayerView,
    legal: readonly Card[],
    trump: Suit,
): Card | null {
    if (view.seat === null || view.bidding.caller !== view.seat) return null

    const jack = makeCard("J", trump)
    if (!legal.includes(jack)) return null

    const hasNine = legal.includes(makeCard("9", trump))
    const hasAce = legal.includes(makeCard("A", trump))
    if (hasNine && hasAce) return null

    return jack
}

function chooseLead(view: PlayerView, legal: readonly Card[], trump: Suit): Card {
    const signal = partnerSignal(view)

    // Two cards left: the master trump is saved for the LAST trick and its ten
    // points (BOT.md §15.16). Above everything — no other lead rule is about
    // the last-trick bonus, and several of them would lead the trump here.
    const saveForLast = plainBeforeLastTrump(view, legal)
    if (saveForLast !== null) return saveForLast

    // All eight tricks are still ours to take: cash, do not manoeuvre.
    const chase = stigljaLead(view, legal)
    if (chase !== null) return chase

    // As the caller's partner, on lead with the bela: the king says "bela",
    // the queen says "bela and the nine" (BOT.md §11).
    const bela = belaLead(view, legal)
    if (bela !== null) return bela

    // On the first trick, a voluntary partner call is a direct request for
    // trump. Even a lone 10 goes across to the jack he represented by calling.
    const openingTrump = openingTrumpForCallingPartner(view, legal)
    if (openingTrump !== null) return openingTrump

    // His declaration put the trump nine in my partner's hand: the jack waits
    // and I look for his hand instead; and from his side, the declared nine
    // goes through (BOT.md §15.9). Both sit above the jack lead and the draw,
    // which would otherwise spend the jack on his trumps.
    const toHisNine = callerLeadsToPartnersNine(view, legal)
    if (toHisNine !== null) return toHisNine
    const nineThrough = declaredNineThrough(view, legal)
    if (nineThrough !== null) return nineThrough

    const callerJack = callerJackLead(view, legal, trump)
    if (callerJack !== null) return callerJack

    // The caller who called on LENGTH has no jack, so `shouldDrawTrumps` below
    // will never let him lead a trump at all — and his plain winners are all
    // sitting under a jack somebody else holds. Flushing it with a small trump
    // is his own lead, so it sits here beside the jack lead rather than inside
    // a rule built for hands that hold the top trump (BOT.md §13.3).
    const flush = callerLengthTrumpLead(view, legal)
    if (flush !== null) return flush

    // He led a low trump and I took it with the jack: the trump goes back
    // small, keeping the nine (BOT.md §13.4). It sits ABOVE the draw on
    // purpose — `trumpDrawCard` leads the top trump whenever it holds one, and
    // the top trump is exactly the card this rule exists to keep in hand.
    const backSmall = lowTrumpBackAfterJack(view, legal)
    if (backSmall !== null) return backSmall

    if (shouldDrawTrumps(view)) {
        const sequenced = callerTrumpLead(view, legal)
        if (sequenced !== null) return sequenced
        const draw = trumpDrawCard(view, legal)
        if (draw !== null) return draw
    }

    // Defending normally keeps trumps, except when our master trump can pull
    // an outstanding opposing A/10 for certain. In the reported shape the 9
    // follows the A-winning trick and captures the caller's remaining 10.
    // The draw above stops once the opponents are out of trumps. With every
    // trump I hold a master and no trick lost yet, the run goes ON: each one
    // is a free discard for my partner, and his discards are the only way he
    // can show me where he takes over (BOT.md §14). It sits below the draw so
    // the caller's own sequencing (ace/nine before the jack) still opens.
    const run = stigljaTrumpRun(view, legal)
    if (run !== null) return run

    // Opponents provably out of trump and a plain card nothing can beat: a
    // certain trick, cashed NOW while I still have the lead — a suit left
    // "for later" is a suit that falls with the deal (BOT.md §15.20). Below
    // the štihak run on purpose: while all eight tricks are still on, the
    // trump goes first (a free discard for the partner), the masters after.
    const sure = sureWinnerToCash(view, legal)
    if (sure !== null) return sure

    // Nothing left of my own to win with: the deal is handed to the partner
    // whose ace a declaration has shown — top card first, so I never end up
    // winning a trick in HIS suit (BOT.md §15.13).
    const handOver = stigljaHandOver(view, legal)
    if (handOver !== null) return handOver

    // The ace I kept behind my own 10 goes NOW, while the suit is fresh and
    // nobody has shown a void — not after a quiet small lead from another
    // suit, which would leave it to be thrown away on the last trick
    // (BOT.md §15.18).
    const aceNow = aceAfterMyWin(view, legal)
    if (aceNow !== null) return aceNow

    const capture = defensiveTrumpCapture(view, legal)
    if (capture !== null) return capture

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

    // He opened a suit, I took it with the ace: it goes back to him, low, for
    // the same reason `signal.wants` does — his cards there are the ones that
    // win, mine was only the entry (BOT.md §13.2).
    const owed = suitToReturnToPartner(view)
    if (owed !== null) {
        const back = legal.filter((card) => cardSuit(card) === owed)
        if (back.length > 0) return weakestCard(back, trump)
    }

    // "Podigravati 7, 8 i 9 znači: vrati aduta." He said it; this answers.
    // A low PLAIN opening he let me take with the ace says the same thing: he
    // is holding the jack and wants trump put through (BOT.md §13.2).
    if (partnerAskedForTrump(view) || partnerLowPlainLeadAsksForTrump(view)) {
        // Return only with a master or a genuinely cheap trump. In particular,
        // never lead the 10/A underneath an outstanding 9 merely because the
        // partner asked earlier.
        const draw = trumpDrawCard(view, legal)
        if (draw !== null) return draw
    }

    // One trump left in the deal and it beats mine: force it out with the long
    // suit rather than leading into it (BOT.md §5).
    const force = forceOutTheLastTrump(view, legal)
    if (force !== null) return force

    // On defence the document has its own opening book (BOT.md §7), and it
    // outranks cashing an ace: its first rule is not to open your ace suit.
    // A singleton opened on purpose, so the partner can give it back and I
    // ruff (BOT.md §13.6). Above the defensive book and the quiet lead, both of
    // which would otherwise refuse it as a thin lead (`isThinLead`) — that
    // price list is for singletons led with no plan, this one has the plan.
    const solo = singletonLead(view, legal)
    if (solo !== null) return solo

    const defensive = defensiveLead(view, legal)
    if (defensive !== null) return defensive

    // The ace I just cashed is followed in its own suit, not by a second ace
    // from another one (BOT.md §15.17).
    const sameSuit = continueAceSuit(view, legal)
    if (sameSuit !== null) return sameSuit

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

/**
 * `chooseLead` with one hard stop on top (2026-09-20, reported from a live
 * table): once no OPPONENT can still hold a trump — both have shown void in
 * it, or the counting has located every outstanding one on our own side
 * (`onlyPartnerCanHoldTrumps`) — every trump still out is in my partner's
 * hand, and leading one does nothing except pull his. The
 * individual rules above each have their own idea of when a trump lead has a
 * point; this is the one condition under which none of them can be right, so
 * it is enforced here, once, instead of being repeated in every one of them.
 *
 * Only a hand with nothing BUT trumps still leads one — there is no choice.
 */
function leadCard(view: PlayerView, legal: readonly Card[], trump: Suit): Card {
    const card = chooseLead(view, legal, trump)
    if (cardSuit(card) !== trump || !onlyPartnerCanHoldTrumps(view)) return card

    const plain = legal.filter((c) => cardSuit(c) !== trump)
    if (plain.length === 0) return card
    // Ask again with the trumps off the menu, so the plain lead is still the
    // one the rules would pick (a master to cash, the suit partner asked for).
    const again = chooseLead(view, plain, trump)
    return cardSuit(again) !== trump ? again : quietLeadCard(view, plain, new Set())
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
        // He opened with a low trump: answer with the nine, or with the jack
        // when the nine may still be outside. K/10 only gamble on its seat.
        const highTrump = highTrumpOnPartnersLowTrump(view, legal)
        if (highTrump !== null) return highTrump
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
        // Last to play, holding the ace AND the ten of the led plain suit: the
        // cheap winner keeps 21 points in a suit that is about to be ruffed,
        // so the ace goes in now (BOT.md §13.1). It sits inside this branch on
        // purpose — it may only ever change HOW the trick is won, never turn a
        // duck into a win, and the partner-holds-the-trick case above owns its
        // own rules about aces (§4) and must not be second-guessed here.
        const cashed = aceOverCheapWinner(view, legal)
        if (cashed !== null) return cashed

        // Trump led, both the jack and the ace in hand, and the nine still
        // behind me: the jack wins what the ace would only offer up
        // (BOT.md §13.5). Same placement argument as above — it decides HOW
        // the trick is taken, never whether.
        const overAce = jackOverAceOnTrumpLead(view, legal)
        if (overAce !== null) return overAce

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
    // They are running for all eight: the discard must not be the card that
    // would have stopped them (BOT.md §14).
    const guarded = stigljaDefenceDiscard(view, legal)
    if (guarded !== null) return guarded

    // "The last card of a dead suit stays home" is a TEMPO idea worth a few
    // points at most (it makes somebody ruff later). It must never be paid for
    // with an ace: reported 2026-09-21, two cards left, one of them the lone 7
    // of a dead suit — protected, so the OTHER card, an ace worth eleven, was
    // thrown on the opponents' trick. When the protection would cost ten
    // points or more, the cheapest card overall goes instead.
    const throwable = legal.filter((card) => !isLastOfADeadSuit(view, card))
    const cheapestOverall = cheapestDiscard(view.hand, legal, trump)
    const cheapestProtected = throwable.length > 0 ? cheapestDiscard(view.hand, throwable, trump) : cheapestOverall
    const protectionCost = cardPoints(cheapestProtected, trump) - cardPoints(cheapestOverall, trump)
    const pool = throwable.length > 0 && protectionCost < 10 ? throwable : legal
    return cheapestDiscard(view.hand, pool, trump)
}

export const heuristicBot: Bot = {
    chooseBid,
    chooseCard,
}
