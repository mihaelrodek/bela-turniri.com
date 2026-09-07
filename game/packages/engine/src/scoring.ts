/* Deal scoring — README §1.6.

   card points  = 152 in the cards + 10 for the last trick (+ 90 for a štiglja)
   declarations = only the winning team's declarations (README §1.4) + bela
   pass/fall    = the calling team passes iff C > O; otherwise it gets 0 and the
                  opponents get C + O. No rounding to tens. */

import type { DealScore, GameState, Team } from "./types"
import { EngineError } from "./types"
import { trickPoints } from "./rules"
import { opponentTeam, teamOf } from "./seats"

const LAST_TRICK_BONUS = 10
const STIGLJA_BONUS = 90

export function scoreDeal(state: GameState): DealScore {
    const trump = state.bidding.trump
    const caller = state.bidding.caller
    if (trump === null || caller === null) {
        throw new EngineError("BAD_PHASE", "Podjela se ne može bodovati bez aduta.")
    }

    const cardPointsByTeam: Record<Team, number> = { A: 0, B: 0 }
    for (const team of ["A", "B"] as Team[]) {
        for (const won of state.tricksWon[team]) {
            cardPointsByTeam[team] += trickPoints(won.cards, trump)
        }
    }

    const trickCount = state.tricksWon.A.length + state.tricksWon.B.length
    if (trickCount > 0) {
        // The leader of the (now empty) current trick is the winner of the last one.
        cardPointsByTeam[teamOf(state.trick.leader)] += LAST_TRICK_BONUS
    }

    let stiglja: Team | null = null
    if (state.tricksWon.A.length === 8) stiglja = "A"
    else if (state.tricksWon.B.length === 8) stiglja = "B"
    if (stiglja !== null) cardPointsByTeam[stiglja] += STIGLJA_BONUS

    const declarationPoints: Record<Team, number> = { A: 0, B: 0 }
    const scoringTeam = state.declarationsScoringTeam
    if (scoringTeam !== null) {
        for (const seat of [0, 1, 2, 3] as const) {
            if (teamOf(seat) !== scoringTeam) continue
            for (const declaration of state.declarations[seat]) {
                declarationPoints[scoringTeam] += declaration.points
            }
        }
    }
    if (state.belaDeclared !== null) declarationPoints[state.belaDeclared] += 20

    const callerTeam = teamOf(caller)
    const other = opponentTeam(callerTeam)
    const callerTotal = cardPointsByTeam[callerTeam] + declarationPoints[callerTeam]
    const otherTotal = cardPointsByTeam[other] + declarationPoints[other]
    const passed = callerTotal > otherTotal

    const total: Record<Team, number> = { A: 0, B: 0 }
    if (passed) {
        total[callerTeam] = callerTotal
        total[other] = otherTotal
    } else {
        total[callerTeam] = 0
        total[other] = callerTotal + otherTotal
    }

    return {
        dealNo: state.dealNo,
        trump,
        caller,
        callerTeam,
        cardPoints: cardPointsByTeam,
        declarationPoints,
        stiglja,
        passed,
        total,
    }
}
