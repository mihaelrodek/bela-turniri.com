/* Redaction — the only thing that ever leaves the server.

   Everything a seat must not know (other hands, undealt stock, other players'
   declarations before the first trick is over) is stripped here. See the doc
   comments on PlayerView in types.ts. */

import type { Card, Declaration, GameState, PlayerView, Seat, Team, WonTrick } from "./types"
import { SEATS } from "./types"
import { legalBids, legalMoves, winningCardIndex } from "./rules"
import { seatFrom, teamOf } from "./seats"

/**
 * The completed tricks of this deal in the order they were won.
 *
 * `tricksWon` is bucketed per team, so the global order has to be rebuilt. It
 * is recoverable without extra bookkeeping: the leader of the current trick is
 * the winner of the last completed one, and inside a stored trick the cards are
 * in play order, so leader = winner − indexOfWinningCard (mod 4). Walking that
 * chain backwards names the team of each previous trick unambiguously.
 */
export function completedTricksInOrder(state: GameState): WonTrick[] {
    const total = state.tricksWon.A.length + state.tricksWon.B.length
    if (total === 0) return []
    const trump = state.bidding.trump
    if (trump === null) return [...state.tricksWon.A, ...state.tricksWon.B]

    const remaining: Record<Team, WonTrick[]> = {
        A: state.tricksWon.A.slice(),
        B: state.tricksWon.B.slice(),
    }
    const out: WonTrick[] = []
    let winner: Seat = state.trick.leader

    for (let i = 0; i < total; i++) {
        const trick = remaining[teamOf(winner)].pop()
        if (trick === undefined || trick.winner !== winner) {
            // Inconsistent bookkeeping: fall back to a stable, if unordered, list.
            return [...state.tricksWon.A, ...state.tricksWon.B]
        }
        out.unshift(trick)
        winner = seatFrom(trick.winner - winningCardIndex(trick.cards, trump))
    }
    return out
}

export function viewFor(state: GameState, seat: Seat | null): PlayerView {
    const tricks = completedTricksInOrder(state)
    const revealed = tricks.length > 0

    const declarations: Partial<Record<Seat, Declaration[]>> = {}
    if (revealed) {
        for (const s of SEATS) declarations[s] = state.declarations[s].slice()
    } else if (seat !== null) {
        declarations[seat] = state.declarations[seat].slice()
    }

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
        lastTrick: tricks.length === 0 ? null : ((tricks[tricks.length - 1] as WonTrick) ?? null),
        declarations,
        declarationsRevealed: revealed,
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
