/* Redaction — the only thing that ever leaves the server.

   Everything a seat must not know (other hands, undealt stock, other players'
   declarations before trump selection) is stripped here. See the doc
   comments on PlayerView in types.ts. */

import type { Card, Declaration, GameState, PlayerView, Seat, TrickReview, WonTrick } from "./types"
import { DEFAULT_TRICK_REVIEW, SEATS } from "./types"
import { legalBids, legalMoves } from "./rules"
import { currentDealPoints, declarationPoints } from "./scoring"
import { teamOf } from "./seats"

/**
 * The completed tricks of this deal in the order they were won.
 *
 * `tricksWon` is bucketed per team, so the global order has to be restored —
 * and every stored trick carries its own `no`, so restoring it is a sort.
 * (This used to walk the win chain backwards from the current trick's leader,
 * re-deriving each previous leader from the index of its winning card. It
 * worked, but it inferred bookkeeping the state can simply hold.)
 */
export function completedTricksInOrder(state: GameState): WonTrick[] {
    return [...state.tricksWon.A, ...state.tricksWon.B].sort((a, b) => a.no - b.no)
}

/** A defensive copy — a review must never hand out the state's own arrays. */
function copyTrick(trick: WonTrick): WonTrick {
    return {
        ...trick,
        plays: trick.plays.map((play) => ({ ...play })),
        cards: trick.cards.slice(),
    }
}

/**
 * May this seat review the completed tricks (README §1.8)?
 *
 * `leaderPair` is the pair of the seat that LEADS the current trick — the one
 * who opened it — not the seat whose turn it happens to be. In DEAL_DONE /
 * GAME_OVER `trick.leader` is the winner of the last trick, which keeps the
 * answer defined at every moment of the deal.
 *
 * A spectator (`seat === null`) has no pair, so only `all` lets them look.
 */
function mayReviewTricks(state: GameState, seat: Seat | null): boolean {
    const rule: TrickReview = state.config.trickReview ?? DEFAULT_TRICK_REVIEW
    if (rule === "all") return true
    if (rule === "off") return false
    if (seat === null) return false
    return teamOf(seat) === teamOf(state.trick.leader)
}

/**
 * Whose declarations may this seat see (README §1.4)?
 *
 * Own always — they are this seat's own eight cards, so there is nothing to
 * leak. On top of that, once trump is set, the seats of the team that WON the
 * declarations contest: those points are announced at the table and the deal
 * cannot be followed without them.
 *
 * The losing pair's declarations are simply lost, and they are never sent to
 * anybody. This used to hand every seat's declarations to every player the
 * moment trump was chosen — an opponent's terca is three named cards of a hand
 * they have not played yet, so that was three cards of free information every
 * deal, rendered right in the reveal overlay.
 *
 * A spectator (`seat === null`) has no own hand, so they get the scoring
 * team's and nothing else.
 */
function visibleDeclarations(
    state: GameState,
    seat: Seat | null,
    revealed: boolean,
): Partial<Record<Seat, Declaration[]>> {
    const out: Partial<Record<Seat, Declaration[]>> = {}
    if (seat !== null) out[seat] = state.declarations[seat].slice()
    if (!revealed) return out

    const scoringTeam = state.declarationsScoringTeam
    if (scoringTeam === null) return out
    for (const s of SEATS) {
        if (teamOf(s) === scoringTeam) out[s] = state.declarations[s].slice()
    }
    return out
}

export function viewFor(state: GameState, seat: Seat | null): PlayerView {
    const tricks = completedTricksInOrder(state)
    const revealed = state.bidding.trump !== null

    const declarations = visibleDeclarations(state, seat, revealed)

    const handSizes: Record<Seat, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
    for (const s of SEATS) handSizes[s] = state.hands[s].length

    const played: Card[] = []
    for (const trick of tricks) played.push(...trick.cards)

    const turn: Seat | null =
        state.phase === "BIDDING"
            ? state.bidding.turn
            : state.phase === "PLAYING"
              ? state.trick.turn
              : null

    const bids =
        seat !== null && state.phase === "BIDDING" && state.bidding.turn === seat
            ? legalBids(state, seat)
            : null

    return {
        seat,
        phase: state.phase,
        dealNo: state.dealNo,
        dealer: state.dealer,
        hand: seat === null ? [] : state.hands[seat].slice(),
        handSizes,
        bidding: { ...state.bidding, passes: state.bidding.passes.slice() },
        trick: { ...state.trick, cards: state.trick.cards.map((c) => ({ ...c })) },
        tricksWon: { A: state.tricksWon.A.length, B: state.tricksWon.B.length },
        currentDealPoints: currentDealPoints(state),
        lastTrick: tricks.length === 0 ? null : ((tricks[tricks.length - 1] as WonTrick) ?? null),
        // The whole review, or nothing at all. Hiding it in the UI instead
        // would leave it in the frame for anyone with devtools.
        trickHistory: mayReviewTricks(state, seat) ? tricks.map(copyTrick) : null,
        declarations,
        declarationPoints: declarationPoints(state),
        declarationsRevealed: revealed,
        declarationsScoringTeam: revealed ? state.declarationsScoringTeam : null,
        belaDeclared: state.belaDeclared,
        dealScore: state.dealScore,
        score: { ...state.score },
        history: state.history.slice(),
        winner: state.winner,
        turn,
        legalMoves: seat === null ? [] : legalMoves(state, seat),
        legalBids: bids,
        played,
    }
}
