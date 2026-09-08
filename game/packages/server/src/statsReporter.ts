/* ──────────────────────────────────────────────────────────────────────────
   Statistika igrača (README §8) — Node is a reporter only, no persistence
   here. On `GAME_OVER` (see `gameRoom.ts`'s `schedule()`), the room hands us
   its final `GameState` and we tell the Quarkus backend about it, but only
   when §8.1's counting rule holds: BOTH teams need at least one human seat
   (team A = seats 0/2, team B = seats 1/3, same split as the engine's
   `teamOf`). A whole-bot team on either side means the game isn't counted.

   Best-effort and fire-and-forget by design: a failure here (network down,
   backend down, missing token) must never affect the room, the socket, or
   anything a player can see. `reportGameResult` therefore never throws and
   its caller never needs to await it.
   ────────────────────────────────────────────────────────────────────── */

import { randomUUID } from "node:crypto"
import type { GameState, Seat, Team } from "@bela/engine"
import { loadConfig } from "./config.js"
import { log } from "./log.js"
import type { Room, SeatSlot } from "./room.js"

const SEATS: readonly Seat[] = [0, 1, 2, 3]

function teamOf(seat: Seat): Team {
    return seat === 0 || seat === 2 ? "A" : "B"
}

function isHumanSlot(slot: SeatSlot): slot is Extract<SeatSlot, { kind: "PLAYER" }> {
    return slot !== null && slot.kind === "PLAYER"
}

function isHumanSeat(room: Room, seat: Seat): boolean {
    return isHumanSlot(room.slotAt(seat))
}

/** README §8.1, NORMATIVE: counted only if both teams have >= 1 human seat. */
function isEligible(room: Room): boolean {
    const teamAHasHuman = isHumanSeat(room, 0) || isHumanSeat(room, 2)
    const teamBHasHuman = isHumanSeat(room, 1) || isHumanSeat(room, 3)
    return teamAHasHuman && teamBHasHuman
}

interface ResultPlayer {
    isGuest?: boolean
    seat: Seat
    team: Team
    uid: string | null
    isBot: boolean
}

/** The exact wire shape from README §8.4. */
export interface GameResultBody {
    resultId: string
    playedAt: string
    targetScore: number
    winnerTeam: Team
    scoreA: number
    scoreB: number
    dealsCount: number
    players: ResultPlayer[]
}

function buildBody(room: Room, state: GameState, winner: Team): GameResultBody {
    const players: ResultPlayer[] = SEATS.map((seat) => {
        const slot = room.slotAt(seat)
        const human = isHumanSlot(slot)
        return {
            seat,
            team: teamOf(seat),
            uid: human && !slot.user.guest ? slot.uid : null,
            ...(human && slot.user.guest ? { isGuest: true } : {}),
            isBot: !human,
        }
    })
    return {
        resultId: randomUUID(),
        playedAt: new Date().toISOString(),
        targetScore: room.targetScore,
        winnerTeam: winner,
        scoreA: state.score.A,
        scoreB: state.score.B,
        dealsCount: state.history.length,
        players,
    }
}

let warnedNoToken = false

/**
 * Report a finished game to the backend's internal stats endpoint
 * (`POST {backendInternalUrl}/internal/game-results`, README §8.4).
 * Fire-and-forget: never throws, callers don't need to await it.
 */
export function reportGameResult(room: Room, state: GameState): void {
    doReport(room, state).catch((err: unknown) => {
        log.error("stats.report.unexpected", { err })
    })
}

async function doReport(room: Room, state: GameState): Promise<void> {
    if (!isEligible(room)) {
        log.debug("stats.report.skipped", { reason: "not-eligible" })
        return
    }
    if (state.winner === null) {
        // Shouldn't happen — this is only called once phase is GAME_OVER —
        // but never send a malformed body if it somehow does.
        log.warn("stats.report.skipped", { reason: "no-winner" })
        return
    }

    const cfg = loadConfig(process.env)
    if (!cfg.gameResultsToken) {
        if (!warnedNoToken) {
            warnedNoToken = true
            log.warn("stats.report.noToken", {
                msg: "GAME_RESULTS_TOKEN nije postavljen — statistika partija se ne šalje backendu.",
            })
        }
        return
    }

    const body = buildBody(room, state, state.winner)
    let res: Response
    try {
        res = await fetch(`${cfg.backendInternalUrl}/internal/game-results`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Token": cfg.gameResultsToken,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5_000),
        })
    } catch (err) {
        log.warn("stats.report.networkError", { err })
        return
    }
    if (!res.ok) {
        log.warn("stats.report.badStatus", { status: res.status })
    }
}
