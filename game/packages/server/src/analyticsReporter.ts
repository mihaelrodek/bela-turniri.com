import { randomUUID } from "node:crypto"
import type { DealScore, GameState, Seat } from "@bela/engine"
import { loadConfig } from "./config.js"
import { log } from "./log.js"
import type { Room } from "./room.js"

type AnalyticsEventType = "ROOM_CREATED" | "GAME_STARTED" | "GAME_COMPLETED" | "GAME_ABANDONED"

export interface AnalyticsEventBody {
    eventId: string
    runId: string | null
    type: AnalyticsEventType
    occurredAt: string
    data: Record<string, unknown>
}

function seats(room: Room) {
    return ([0, 1, 2, 3] as const).map((seat) => {
        const slot = room.slotAt(seat)
        return {
            seat,
            team: seat === 0 || seat === 2 ? "A" : "B",
            kind: slot?.kind ?? "EMPTY",
            guest: slot?.kind === "PLAYER" && slot.user.guest === true,
        }
    })
}

function dealPayload(state: GameState, deal: DealScore) {
    const distance = state.dealNo - deal.dealNo
    const dealer = ((state.dealer - distance + 400) % 4) as Seat
    const callPosition = ((deal.caller - dealer + 4) % 4) || 4
    return {
        dealNo: deal.dealNo,
        trump: deal.trump,
        caller: deal.caller,
        callerTeam: deal.callerTeam,
        callPosition,
        passed: deal.passed,
        cardPoints: deal.cardPoints,
        declarationPoints: deal.declarationPoints,
        stiglja: deal.stiglja,
        belot: deal.belot ?? null,
        total: deal.total,
    }
}

/**
 * A demo room is invisible to the admin analytics — ALWAYS, including the rare
 * game a real visitor played in one (DEMO-LOBBY.md §3, "demo sobe u admin
 * analitici").
 *
 * The all-or-nothing choice is deliberate. These events are aggregates: seat
 * kinds, durations, autoplay rates, call positions per deal. A room where three
 * of the four "players" are fabricated poisons every one of those averages
 * whether or not a real person sat in the fourth chair, and a half-reported
 * lifecycle (a GAME_COMPLETED with no ROOM_CREATED) is worse than none at all.
 * The real person's own record is a separate question and is answered by
 * `statsReporter`, which counts a table of fake people exactly as a table of
 * bots: §8.1's "both teams need a human" rule fails, so nothing is reported —
 * the same outcome the player would get practising against bots.
 */
function isDemoRoom(room: Room): boolean {
    // `Boolean`, not `!== null`: the reporter tests hand this module hand-built
    // room-shaped objects that have no `demo` field at all.
    return Boolean(room.demo)
}

function emit(body: AnalyticsEventBody): void {
    void (async () => {
        const cfg = loadConfig(process.env)
        if (!cfg.gameResultsToken) return
        try {
            const res = await fetch(`${cfg.backendInternalUrl}/internal/game-analytics`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Internal-Token": cfg.gameResultsToken,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(5_000),
            })
            if (!res.ok) log.warn("analytics.report.badStatus", { type: body.type, status: res.status })
        } catch (err) {
            log.warn("analytics.report.networkError", { type: body.type, err })
        }
    })()
}

export function reportRoomCreated(room: Room): void {
    if (isDemoRoom(room)) return
    emit({
        eventId: randomUUID(),
        runId: null,
        type: "ROOM_CREATED",
        occurredAt: new Date(room.createdAt).toISOString(),
        data: { roomId: room.id, ...room.analyticsOptions() },
    })
}

export function reportGameStarted(runId: string, room: Room, startedAt: number): void {
    if (isDemoRoom(room)) return
    emit({
        eventId: `${runId}:started`, runId, type: "GAME_STARTED",
        occurredAt: new Date(startedAt).toISOString(),
        data: { roomId: room.id, ...room.analyticsOptions(), seats: seats(room) },
    })
}

export function reportGameCompleted(
    runId: string,
    room: Room,
    state: GameState,
    startedAt: number,
    autoPlayedActions: number,
): void {
    if (isDemoRoom(room)) return
    emit({
        eventId: `${runId}:completed`, runId, type: "GAME_COMPLETED",
        occurredAt: new Date().toISOString(),
        data: {
            roomId: room.id,
            ...room.analyticsOptions(),
            seats: seats(room),
            durationMs: Math.max(0, Date.now() - startedAt),
            autoPlayedActions,
            winnerTeam: state.winner,
            score: state.score,
            deals: state.history.map((deal) => dealPayload(state, deal)),
        },
    })
}

export function reportGameAbandoned(
    runId: string,
    room: Room,
    state: GameState,
    startedAt: number,
    autoPlayedActions: number,
    reason: string,
): void {
    if (isDemoRoom(room)) return
    emit({
        eventId: `${runId}:abandoned`, runId, type: "GAME_ABANDONED",
        occurredAt: new Date().toISOString(),
        data: {
            roomId: room.id,
            ...room.analyticsOptions(),
            seats: seats(room),
            durationMs: Math.max(0, Date.now() - startedAt),
            autoPlayedActions,
            reason,
            phase: state.phase,
            score: state.score,
            deals: state.history.map((deal) => dealPayload(state, deal)),
        },
    })
}
