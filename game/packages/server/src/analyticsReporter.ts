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
    emit({
        eventId: randomUUID(),
        runId: null,
        type: "ROOM_CREATED",
        occurredAt: new Date(room.createdAt).toISOString(),
        data: { roomId: room.id, ...room.analyticsOptions() },
    })
}

export function reportGameStarted(runId: string, room: Room, startedAt: number): void {
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
