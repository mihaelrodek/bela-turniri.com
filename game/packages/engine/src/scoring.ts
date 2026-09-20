/* Deal scoring — README §1.6.

   card points  = 152 in the cards + 10 for the last trick (+ 90 for a štiglja)
   declarations = only the winning team's declarations (README §1.4) + bela;
                  `declarationPoints(state)` is the single source of that sum
   confirmation = declarations (bela included) only count for a team that
                  takes AT LEAST ONE TRICK in the deal — the trick may be worth
                  0. A team left without a trick hands them to the opponents,
                  exactly as a fallen caller does (`confirmedDeclarationPoints`)
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

/**
 * Declarations have to be CONFIRMED BY A TRICK (2026-09-20, user report: the
 * opponents declared 150, took no trick, and still kept them — "ako netko ima
 * zvanja on ta zvanja mora POTVRDITI sa jednim stihom ... inace ta zvanja idu
 * protivnickoj ekipi isto kao i kod pada").
 *
 * `declarationPoints` stays what it always was — what each pair has DECLARED,
 * which is what the scoreboard shows while the deal runs. This is what those
 * declarations are WORTH given the tricks taken so far:
 *
 *   • a pair with at least one trick (a trick of 0 points counts) keeps its own;
 *   • a pair with no trick yet has nothing provable — mid-deal its points are
 *     simply not there yet (`final: false`), which is what keeps a pair from
 *     winning a `dosta` race on declarations alone before taking a trick;
 *   • once all eight tricks are in (`final: true`), a pair that took none
 *     hands everything it declared, bela included, to the other pair.
 */
export function confirmedDeclarationPoints(state: GameState, final: boolean): Record<Team, number> {
    const declared = declarationPoints(state)
    const confirmed: Record<Team, number> = { A: 0, B: 0 }
    for (const team of ["A", "B"] as Team[]) {
        if (state.tricksWon[team].length > 0) confirmed[team] += declared[team]
        else if (final) confirmed[opponentTeam(team)] += declared[team]
    }
    return confirmed
}

/**
 * What each team has PROVABLY collected in the deal in progress, at this very
 * instant — the figure the `dosta` race is run on (README §1.7).
 *
 * "Provable" means: points nobody at the table can still take away.
 *   • card points of the tricks already taken (`currentDealPoints`),
 *   • the declarations of the pair whose declarations stand, plus 20 for an
 *     announced bela — but only once that pair has CONFIRMED them with a trick
 *     (`confirmedDeclarationPoints`); until then nobody can prove them,
 *   • the last trick's +10 and a štiglja's +90 ONLY once the eighth trick is
 *     in, because until then neither exists.
 *
 * What it deliberately does NOT contain is the pass/fall verdict of §1.6:
 * a fall is decided when the deal is settled, and the `dosta` race is decided
 * earlier, at the instant the target is crossed. See `dostaOutcome`.
 */
export function provisionalDealPoints(state: GameState): Record<Team, number> {
    const points = currentDealPoints(state)

    if (state.tricksWon.A.length + state.tricksWon.B.length === 8) {
        // The leader of the (now empty) current trick is the winner of the last one.
        points[teamOf(state.trick.leader)] += LAST_TRICK_BONUS
        if (state.tricksWon.A.length === 8) points.A += STIGLJA_BONUS
        else if (state.tricksWon.B.length === 8) points.B += STIGLJA_BONUS
    }

    const allIn = state.tricksWon.A.length + state.tricksWon.B.length === 8
    const declarations = confirmedDeclarationPoints(state, allIn)
    return { A: points.A + declarations.A, B: points.B + declarations.B }
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

    // Settled deal: a pair without a trick has already lost its declarations
    // to the other pair here, BEFORE pass/fall is judged — so a caller who
    // took every trick passes on the opponents' declarations as well, and a
    // trickless caller falls with nothing (0 > x is never true).
    const declarationPointsByTeam = confirmedDeclarationPoints(state, true)

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
