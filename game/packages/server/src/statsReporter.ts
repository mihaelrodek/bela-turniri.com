/* ──────────────────────────────────────────────────────────────────────────
   Statistika igrača (README §8) — Node is a reporter only, no persistence
   here. On `GAME_OVER` (see `gameRoom.ts`'s `schedule()`), the room hands us
   its final `GameState` and we tell the Quarkus backend about it.

   TWO rules, deliberately separated (2026-09-22):

   * §8.1 ELIGIBILITY — "counts for the competitive record": BOTH teams need
     at least one human seat (team A = seats 0/2, team B = seats 1/3, same
     split as the engine's `teamOf`). This is unchanged, and it now travels
     on the wire as `eligible` instead of deciding whether we send anything.
   * §8.7 RECORDING — "visible to analytics": every finished game with AT
     LEAST ONE real human seat (an account or a guest) is reported. A game a
     person played with three bots, or inside the demo lobby against fake
     people, used to vanish before it reached the backend and so was invisible
     to the admin dashboard too. Only an all-bot / all-demo table is skipped.

   Best-effort and fire-and-forget by design: a failure here (network down,
   backend down, missing token) must never affect the room, the socket, or
   anything a player can see. `reportGameResult` therefore never throws and
   its caller never needs to await it.
   ────────────────────────────────────────────────────────────────────── */

import { createHash, randomUUID } from "node:crypto"
import type { GameState, Seat, Team } from "@bela/engine"
import { loadConfig } from "./config.js"
// The only runtime import from `demo/`: two constants and a pure predicate, no
// side effects and nothing to initialise, so the flag-off server is unchanged.
import { isDemoUid } from "./demo/types.js"
import { log } from "./log.js"
import type { GameReplay } from "./replay.js"
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

/**
 * README §8.7: is there any REAL person at this table at all? A `PLAYER` slot
 * is one, whether they signed in or are playing as a guest; a `BOT` is not,
 * and neither is a `DEMO` seat (a fake person from the demo lobby — it looks
 * like a player on the wire, but nobody is sitting there).
 */
function hasAnyHuman(room: Room): boolean {
    return SEATS.some((seat) => isHumanSeat(room, seat))
}

/** What kind of thing occupies a seat, as recorded for analytics (§8.7). */
type SeatKindWire = "PLAYER" | "GUEST" | "BOT" | "DEMO"

interface ResultPlayer {
    isGuest?: boolean
    seat: Seat
    team: Team
    uid: string | null
    isBot: boolean
    /**
     * The display name as shown above the seat at the table. This is the only
     * handle a guest ever has — they have no uid by design — so without it
     * the admin list can count guests but never name them.
     */
    name: string
    kind: SeatKindWire
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
    /** §8.1's verdict, carried rather than acted on (§8.7). */
    eligible: boolean
    players: ResultPlayer[]
    /**
     * The full replay of the game (README §8.8), or absent.
     *
     * It rides on THIS request rather than on a second one so the whole
     * report keeps one idempotency key (`resultId`), one token and one
     * failure mode: a replay can never be stored for a game whose result
     * was not, and a retry cannot store it twice.
     *
     * Optional in both directions: an older backend ignores the field
     * (Quarkus' Jackson does not fail on unknown properties, and the DTO
     * declares it explicitly since 2026-09-23), and an older game server
     * simply does not send it.
     */
    replay?: GameReplay
}

/**
 * Ceiling on the serialised replay, in bytes. A real 1001 game measures a few
 * tens of kilobytes; half a megabyte is far past anything the cap in
 * `replay.ts` can produce, so crossing it means something is wrong. The
 * result is then reported WITHOUT the replay — the statistics matter more
 * than the archive, and one oversized body must not cost a recorded game.
 */
const MAX_REPLAY_BYTES = 512 * 1024

/** Never longer than a seat label can be; the backend column is varchar(64). */
function trimName(raw: string | null | undefined, fallback: string): string {
    const name = (raw ?? "").trim()
    return (name.length === 0 ? fallback : name).slice(0, 64)
}

function seatPlayer(room: Room, seat: Seat): ResultPlayer {
    const slot = room.slotAt(seat)
    const team = teamOf(seat)
    if (slot !== null && slot.kind === "BOT") {
        return { seat, team, uid: null, isBot: true, name: trimName(slot.name, "Bot"), kind: "BOT" }
    }
    if (slot !== null && slot.kind === "DEMO") {
        // A fake person carries no uid anywhere outside this process — see
        // `doReportAbandonment` for the same rule on the karma path. `isBot`
        // stays true so a backend that only understands the old wire shape
        // still reads this seat as "not a real account".
        return { seat, team, uid: null, isBot: true, name: trimName(slot.identity.name, "Demo"), kind: "DEMO" }
    }
    if (isHumanSlot(slot)) {
        const guest = slot.user.guest === true
        return {
            seat,
            team,
            uid: guest ? null : slot.uid,
            ...(guest ? { isGuest: true } : {}),
            isBot: false,
            name: trimName(slot.user.name, guest ? "Gost" : "Igrač"),
            kind: guest ? "GUEST" : "PLAYER",
        }
    }
    // Empty seat at GAME_OVER: impossible in practice (the room fills a
    // vacated seat with a bot before play continues), but the backend needs
    // exactly four seats, so describe it as the bot it effectively was.
    return { seat, team, uid: null, isBot: true, name: "Bot", kind: "BOT" }
}

function buildBody(
    room: Room,
    state: GameState,
    winner: Team,
    resultId?: string,
    replay?: GameReplay | null,
): GameResultBody {
    return {
        resultId: resultId ?? randomUUID(),
        playedAt: new Date().toISOString(),
        targetScore: room.targetScore,
        winnerTeam: winner,
        scoreA: state.score.A,
        scoreB: state.score.B,
        dealsCount: state.history.length,
        eligible: isEligible(room),
        players: SEATS.map((seat) => seatPlayer(room, seat)),
        ...(replay ? { replay } : {}),
    }
}

/**
 * Drop the replay when it is implausibly large, and say so. Returns the body
 * to send — the same object when the replay fits, a copy without it when it
 * does not. The result is reported either way.
 */
function withinSizeLimit(body: GameResultBody): GameResultBody {
    if (body.replay === undefined) return body
    // Measured in BYTES, not characters: a Croatian name is two bytes per
    // accented letter and the backend's column budget is bytes.
    const bytes = Buffer.byteLength(JSON.stringify(body.replay), "utf8")
    if (bytes <= MAX_REPLAY_BYTES) return body
    log.warn("stats.replay.tooLarge", { bytes, limit: MAX_REPLAY_BYTES })
    const { replay: _dropped, ...rest } = body
    return rest
}

let warnedNoToken = false

/**
 * Report a finished game to the backend's internal stats endpoint
 * (`POST {backendInternalUrl}/internal/game-results`, README §8.4).
 * Fire-and-forget: never throws, callers don't need to await it.
 */
export function reportGameResult(
    room: Room,
    state: GameState,
    resultId?: string,
    replay?: GameReplay | null,
): void {
    doReport(room, state, resultId, replay).catch((err: unknown) => {
        log.error("stats.report.unexpected", { err })
    })
}

/**
 * Report a confirmed abandonment. This is called only by Room after its
 * reconnect grace has elapsed (or after an explicit final abandon), never
 * merely because a websocket closed. The deterministic id keeps an eventual
 * retry idempotent at the backend.
 */
export function reportGameAbandonment(runId: string, uid: string): void {
    doReportAbandonment(runId, uid).catch((err: unknown) => {
        log.error("reliability.report.unexpected", { err })
    })
}

async function doReportAbandonment(runId: string, uid: string): Promise<void> {
    // A fake person has no account to hold karma and must never be named to
    // the backend. They cannot reach here by design (a DEMO seat is not a
    // `PLAYER`, and only a `PLAYER` is ever reported), so this is the belt to
    // that braces — cheap, and it is the one place a leak would be permanent.
    if (!uid || uid.startsWith("guest:") || uid.startsWith("dev:") || isDemoUid(uid)) return
    const cfg = loadConfig(process.env)
    if (!cfg.gameResultsToken) {
        log.warn("reliability.report.noToken", { msg: "GAME_RESULTS_TOKEN nije postavljen — karma se ne može spremiti." })
        return
    }
    const eventId = createHash("sha256").update(`${runId}:${uid}:ABANDONED`).digest("hex")
    let res: Response
    try {
        res = await fetch(`${cfg.backendInternalUrl}/internal/game-reliability-events`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Token": cfg.gameResultsToken,
            },
            body: JSON.stringify({ eventId, userUid: uid, eventType: "ABANDONED", occurredAt: new Date().toISOString() }),
            signal: AbortSignal.timeout(5_000),
        })
    } catch (err) {
        log.warn("reliability.report.networkError", { err })
        return
    }
    if (!res.ok) log.warn("reliability.report.badStatus", { status: res.status })
}

async function doReport(
    room: Room,
    state: GameState,
    resultId?: string,
    replay?: GameReplay | null,
): Promise<void> {
    const cfg = loadConfig(process.env)

    // §8.7: report everything a real person actually played. Eligibility
    // (§8.1) is decided here too, but it travels in the body as `eligible`
    // and only governs the competitive record on the backend.
    //
    // §8.8: a table with NOBODY real on it — bots only, or the demo lobby's
    // fake people — is still not reported, and is deliberately NOT recorded
    // as a replay either: every one of those games is the bot playing itself,
    // which teaches the bot nothing it does not already do. `GAME_REPLAY_BOT_SAMPLE`
    // is the one exception, for deliberately collecting a BASELINE to measure
    // human games against; at its default of 0 this branch behaves exactly as
    // it did before.
    if (!hasAnyHuman(room)) {
        if (!(replay && cfg.replayBotSample > 0 && Math.random() < cfg.replayBotSample)) {
            log.debug("stats.report.skipped", { reason: "no-human" })
            return
        }
        log.debug("stats.report.botSample", { sample: cfg.replayBotSample })
    }
    if (state.winner === null) {
        // Shouldn't happen — this is only called once phase is GAME_OVER —
        // but never send a malformed body if it somehow does.
        log.warn("stats.report.skipped", { reason: "no-winner" })
        return
    }

    if (!cfg.gameResultsToken) {
        if (!warnedNoToken) {
            warnedNoToken = true
            log.warn("stats.report.noToken", {
                msg: "GAME_RESULTS_TOKEN nije postavljen — statistika partija se ne šalje backendu.",
            })
        }
        return
    }

    const body = withinSizeLimit(buildBody(room, state, state.winner, resultId, replay))
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
