/* Deal scoring — README §1.6.

   card points  = 152 in the cards + 10 for the last trick (+ 90 for a štiglja)
   declarations = only the winning team's declarations (README §1.4) + bela;
                  `declarationPoints(state)` is the single source of that sum
   pass/fall    = the calling team passes iff C > O; otherwise it gets 0 and the
                  opponents get C + O. No rounding to tens. */

import type { DealScore, GameState, Team } from "./types"
import { EngineError } from "./types"
import { trickPoints } from "./rules"
import { opponentTeam, teamOf } from "./seats"

const LAST_TRICK_BONUS = 10
const STIGLJA_BONUS = 90

/** Card points collected so far in completed tricks of this deal. Final
 * bonuses are deliberately excluded; scoreDeal applies them at settlement. */
export function currentDealPoints(state: GameState): Record<Team, number> {
    const trump = state.bidding.trump
    if (trump === null) return { A: 0, B: 0 }

    const points: Record<Team, number> = { A: 0, B: 0 }
    for (const team of ["A", "B"] as Team[]) {
        for (const won of state.tricksWon[team]) points[team] += trickPoints(won.cards, trump)
    }

    return points
}

/**
 * The declaration bonus each team has banked in this deal so far — the ONE
 * arithmetic for it, shared by `scoreDeal` (which puts it in `DealScore`) and
 * by `viewFor` (which puts it on the scoreboard as "+150"). Two derivations of
 * the same number would eventually disagree, and a live figure that does not
 * match the deal summary is worse than no live figure.
 *
 * It is:
 *   - every declaration of the team that won the declarations contest
 *     (README §1.4); the other team's are lost and count 0, and
 *   - **+20 for an announced bela**, to whichever team announced it.
 *
 * Bela is deliberately IN. It is not part of the "strongest declaration"
 * contest — it scores for its holder no matter who wins that — but it is
 * declaration points all the same, it is public the moment the first of K/Q
 * of trump is played, and `DealScore.declarationPoints` has always included
 * it. Excluding it here would make the scoreboard's "+x" jump by 20 at
 * settlement for no reason a player could see.
 *
 * Before trump selection there are no declarations and no bela, so this is
 * `{A: 0, B: 0}`. Nothing secret is exposed: the scoring team's declarations
 * are sent to everyone anyway (§1.4) and this is only their sum, and a bela
 * has by definition already been announced at the table.
 */
export function declarationPoints(state: GameState): Record<Team, number> {
    const points: Record<Team, number> = { A: 0, B: 0 }

    const scoringTeam = state.declarationsScoringTeam
    if (scoringTeam !== null) {
        for (const seat of [0, 1, 2, 3] as const) {
            if (teamOf(seat) !== scoringTeam) continue
            for (const declaration of state.declarations[seat]) {
                points[scoringTeam] += declaration.points
            }
        }
    }
    if (state.belaDeclared !== null) points[state.belaDeclared] += 20

    return points
}

export function scoreDeal(state: GameState): DealScore {
    const trump = state.bidding.trump
    const caller = state.bidding.caller
    if (trump === null || caller === null) {
        throw new EngineError("BAD_PHASE", "Podjela se ne može bodovati bez aduta.")
    }

    const cardPointsByTeam = currentDealPoints(state)

    const trickCount = state.tricksWon.A.length + state.tricksWon.B.length
    if (trickCount > 0) {
        // The leader of the (now empty) current trick is the winner of the last one.
        cardPointsByTeam[teamOf(state.trick.leader)] += LAST_TRICK_BONUS
    }

    let stiglja: Team | null = null
    if (state.tricksWon.A.length === 8) stiglja = "A"
    else if (state.tricksWon.B.length === 8) stiglja = "B"
    if (stiglja !== null) cardPointsByTeam[stiglja] += STIGLJA_BONUS

    const declarationPointsByTeam = declarationPoints(state)

    const callerTeam = teamOf(caller)
    const other = opponentTeam(callerTeam)
    const callerTotal = cardPointsByTeam[callerTeam] + declarationPointsByTeam[callerTeam]
    const otherTotal = cardPointsByTeam[other] + declarationPointsByTeam[other]
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
        declarationPoints: declarationPointsByTeam,
        stiglja,
        passed,
        total,
    }
}
