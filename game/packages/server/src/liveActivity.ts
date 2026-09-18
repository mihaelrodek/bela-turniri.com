/* ──────────────────────────────────────────────────────────────────────────
   Live Activities (iOS) / Live Updates (Android) — the server half
   (README §3 "Live Activity").

   A player whose app is in the foreground updates their own lock-screen
   activity from the socket. This module covers the rest: a player whose
   connection is DOWN (the seat-hold window, `room.ts`) or whose iOS app has
   handed us an ActivityKit token. For them the game state is pushed through
   the backend (`POST {BACKEND_INTERNAL_URL}/internal/live-activity`), which
   relays it over FCM.

   Rules this module holds itself to — the same ones as `statsReporter.ts`:
     • NEVER throws into the game and never blocks it. The notifier is
       fire-and-forget with a 3 s timeout; a missing `GAME_RESULTS_TOKEN`
       disables it with one log line.
     • One update per uid per second at most, TRAILING edge: a burst of moves
       sends its first state at once and its last state when the second is up,
       so the lock screen never ends on a stale intermediate.
     • Only real changes go out. The ContentState is rebuilt per recipient on
       every game broadcast and compared with what that recipient last saw —
       including while they were connected and updating locally, so dropping
       the socket does not by itself trigger a redundant push.
   ────────────────────────────────────────────────────────────────────── */

import type { GameState, Seat, Team } from "@bela/engine"
import type { LiveActivityState } from "@bela/protocol"
import type { Config } from "./config.js"
import { log } from "./log.js"
import type { SeatSlot } from "./room.js"

const SEATS: readonly Seat[] = [0, 1, 2, 3]

/** Apple's own ceiling for a Live Activity: after 12 h iOS ends it anyway. */
export const TOKEN_TTL_MS = 12 * 60 * 60_000
const REQUEST_TIMEOUT_MS = 3_000
const DEFAULT_THROTTLE_MS = 1_000

/* ───────────────────────── tokens ───────────────────────── */

export interface LiveActivityTokens {
    activityToken?: string
    pushToStartToken?: string
}

interface StoredTokens extends LiveActivityTokens {
    expiresAt: number
}

/**
 * iOS tokens per uid, in memory only. A token is useless after the activity
 * it belongs to has ended, and iOS ends every activity after 12 h, so nothing
 * here is worth surviving a restart — the app re-sends on its next `hello`.
 */
export class LiveActivityTokenStore {
    private readonly byUid = new Map<string, StoredTokens>()
    private readonly now: () => number

    constructor(now: () => number = Date.now) {
        this.now = now
    }

    /** MERGES: ActivityKit hands out the push-to-start and the activity token at different moments. */
    set(uid: string, tokens: LiveActivityTokens): void {
        const previous = this.get(uid)
        this.byUid.set(uid, {
            activityToken: tokens.activityToken ?? previous?.activityToken,
            pushToStartToken: tokens.pushToStartToken ?? previous?.pushToStartToken,
            expiresAt: this.now() + TOKEN_TTL_MS,
        })
    }

    get(uid: string): LiveActivityTokens | null {
        const stored = this.byUid.get(uid)
        if (!stored) return null
        if (stored.expiresAt <= this.now()) {
            this.byUid.delete(uid)
            return null
        }
        return stored
    }

    forget(uid: string): void {
        this.byUid.delete(uid)
    }
}

/* ───────────────────────── notifier ───────────────────────── */

/** The exact body of `POST /internal/live-activity`. */
export interface LiveActivityBody {
    uid: string
    event: "update" | "end"
    state: LiveActivityState
    iosActivityToken?: string
    iosPushToStartToken?: string
}

/** Where bodies go. `send` must never throw and never be awaited by the game. */
export interface LiveActivityNotifier {
    send(body: LiveActivityBody): void
}

/** The backend channel: `BACKEND_INTERNAL_URL` + `X-Internal-Token`, like the stats reporter. */
export function createLiveActivityNotifier(cfg: Config): LiveActivityNotifier {
    const token = cfg.gameResultsToken
    if (!token) {
        log.info("liveActivity.disabled", {
            msg: "GAME_RESULTS_TOKEN nije postavljen — Live Activity ažuriranja se ne šalju backendu.",
        })
        return { send: () => undefined }
    }
    const url = `${cfg.backendInternalUrl}/internal/live-activity`
    return {
        send(body: LiveActivityBody): void {
            try {
                fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Internal-Token": token },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                }).then(
                    (res) => {
                        if (!res.ok) log.warn("liveActivity.badStatus", { status: res.status, event: body.event })
                    },
                    (err: unknown) => log.warn("liveActivity.networkError", { err }),
                )
            } catch (err) {
                // `fetch` itself throwing synchronously (bad URL) must not reach the game either.
                log.warn("liveActivity.sendFailed", { err })
            }
        },
    }
}

/* ───────────────────────── ContentState ───────────────────────── */

/** The slice of `Room` this module reads — kept narrow so tests can hand-build one. */
export interface LiveActivityRoom {
    readonly id: string
    readonly targetScore: number
    slotAt(seat: Seat): SeatSlot
}

/** The slice of `GameRoom` this module reads. */
export interface LiveActivitySnapshot {
    state: GameState
    turnDeadline: number | null
}

const PHASES: Record<GameState["phase"], LiveActivityState["phase"]> = {
    BIDDING: "bidding",
    PLAYING: "playing",
    DEAL_DONE: "dealDone",
    GAME_OVER: "gameOver",
}

function teamOf(seat: Seat): Team {
    return seat === 0 || seat === 2 ? "A" : "B"
}

function turnSeatOf(state: GameState): Seat | null {
    if (state.phase === "BIDDING") return state.bidding.turn
    if (state.phase === "PLAYING") return state.trick.turn
    return null
}

/**
 * ContentState for the person on `seat`. `ending` forces the terminal shape
 * an `end` event carries even when the game itself is not over (the player
 * left, the room was disposed): phase `gameOver`, no turn, and a winner only
 * if the engine actually has one.
 */
export function buildLiveActivityState(
    room: LiveActivityRoom,
    snap: LiveActivitySnapshot,
    seat: Seat,
    ending = false,
): LiveActivityState {
    const st = snap.state
    const us = teamOf(seat)
    const them: Team = us === "A" ? "B" : "A"
    const over = ending || st.phase === "GAME_OVER"
    const turnSeat = over ? null : turnSeatOf(st)
    return {
        roomId: room.id,
        phase: over ? "gameOver" : PHASES[st.phase],
        scoreUs: st.score[us],
        scoreThem: st.score[them],
        target: room.targetScore,
        yourTurn: turnSeat === seat,
        turnSeat,
        turnDeadline: over ? null : snap.turnDeadline,
        trump: st.bidding.trump,
        winner: over && st.winner !== null ? (st.winner === us ? "us" : "them") : null,
    }
}

/* ───────────────────────── fan-out ───────────────────────── */

interface Entry {
    roomId: string
    /** The ContentState this uid last saw (sent by us or rendered locally), as JSON. */
    lastKey: string | null
    lastSentAt: number
    pending: LiveActivityState | null
    timer: ReturnType<typeof setTimeout> | null
    /** `end` already went out for this room; nothing more until they rejoin or a new game starts. */
    ended: boolean
}

export interface LiveActivityHubOptions {
    throttleMs?: number
    now?: () => number
}

type HumanSlot = Extract<SeatSlot, { kind: "PLAYER" }>

function humanAt(room: LiveActivityRoom, seat: Seat): HumanSlot | null {
    const slot = room.slotAt(seat)
    // A guest has no account, hence no device row in the backend — nothing to reach.
    if (!slot || slot.kind !== "PLAYER" || slot.user.guest === true) return null
    return slot
}

/**
 * One per server. `GameRoom` feeds it every broadcast (`onGameState`), `Room`
 * tells it when a seat's activity must end (`endFor` / `endAll`), `ws.ts`
 * stores tokens in `tokens`.
 */
export class LiveActivityHub {
    readonly tokens: LiveActivityTokenStore
    private readonly notifier: LiveActivityNotifier
    private readonly throttleMs: number
    private readonly now: () => number
    private readonly entries = new Map<string, Entry>()

    constructor(notifier: LiveActivityNotifier, tokens?: LiveActivityTokenStore, options: LiveActivityHubOptions = {}) {
        this.notifier = notifier
        this.now = options.now ?? Date.now
        this.tokens = tokens ?? new LiveActivityTokenStore(this.now)
        this.throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS
    }

    /** Called after every game broadcast. Cheap when nothing changed. */
    onGameState(room: LiveActivityRoom, snap: LiveActivitySnapshot): void {
        // GAME_OVER is announced once, by `endAll`, never as an update.
        if (snap.state.phase === "GAME_OVER") return
        for (const seat of SEATS) {
            const slot = humanAt(room, seat)
            if (!slot) continue
            const entry = this.entryFor(room.id, slot.uid)
            if (entry.ended) continue
            const state = buildLiveActivityState(room, snap, seat)
            const key = JSON.stringify(state)
            if (key === entry.lastKey) continue
            // Recorded even when nothing is sent: a connected player's app
            // rendered this state itself, so it is what their lock screen shows.
            entry.lastKey = key
            const tokens = this.tokens.get(slot.uid)
            const reachable = !slot.connected || tokens?.activityToken !== undefined || tokens?.pushToStartToken !== undefined
            if (!reachable) {
                // Back in the foreground: a trailing update would only overwrite
                // what the app is already drawing.
                this.clearPending(entry)
                continue
            }
            this.throttled(slot.uid, entry, state)
        }
    }

    /** A new game in this room: everyone's activity may run again. */
    beginGame(room: LiveActivityRoom): void {
        for (const [uid, entry] of this.entries) {
            if (entry.roomId !== room.id) continue
            this.clearPending(entry)
            this.entries.delete(uid)
        }
    }

    /** They walked back in after an `end` (left, then `room.join`): updates may resume. */
    rejoin(roomId: string, uid: string): void {
        const entry = this.entries.get(uid)
        if (entry && entry.roomId === roomId && entry.ended) this.entries.delete(uid)
    }

    /** Send `end` to the human on `uid`'s seat, then forget their tokens. */
    endFor(room: LiveActivityRoom, snap: LiveActivitySnapshot, uid: string): void {
        for (const seat of SEATS) {
            const slot = humanAt(room, seat)
            if (slot?.uid !== uid) continue
            this.endSeat(room, snap, seat, slot)
            return
        }
    }

    /** Game over or room gone: `end` for every seated human not already ended. */
    endAll(room: LiveActivityRoom, snap: LiveActivitySnapshot): void {
        for (const seat of SEATS) {
            const slot = humanAt(room, seat)
            if (slot) this.endSeat(room, snap, seat, slot)
        }
    }

    /** The room is disposed: drop its bookkeeping so the map cannot grow forever. */
    forgetRoom(roomId: string): void {
        for (const [uid, entry] of this.entries) {
            if (entry.roomId !== roomId) continue
            this.clearPending(entry)
            this.entries.delete(uid)
        }
    }

    dispose(): void {
        for (const entry of this.entries.values()) this.clearPending(entry)
        this.entries.clear()
    }

    /* ── internals ── */

    private endSeat(room: LiveActivityRoom, snap: LiveActivitySnapshot, seat: Seat, slot: HumanSlot): void {
        const entry = this.entryFor(room.id, slot.uid)
        if (entry.ended) return
        // A trailing update landing AFTER the end would resurrect the activity.
        this.clearPending(entry)
        entry.ended = true
        entry.lastKey = null
        this.deliver(slot.uid, "end", buildLiveActivityState(room, snap, seat, true))
        this.tokens.forget(slot.uid)
    }

    private entryFor(roomId: string, uid: string): Entry {
        const existing = this.entries.get(uid)
        if (existing && existing.roomId === roomId) return existing
        // One seat per person (README §3.2), so a uid in a different room is a
        // new table: whatever was pending for the old one is moot.
        if (existing) this.clearPending(existing)
        const fresh: Entry = { roomId, lastKey: null, lastSentAt: Number.NEGATIVE_INFINITY, pending: null, timer: null, ended: false }
        this.entries.set(uid, fresh)
        return fresh
    }

    private throttled(uid: string, entry: Entry, state: LiveActivityState): void {
        if (entry.timer) {
            entry.pending = state
            return
        }
        const wait = entry.lastSentAt + this.throttleMs - this.now()
        if (wait <= 0) {
            entry.lastSentAt = this.now()
            this.deliver(uid, "update", state)
            return
        }
        entry.pending = state
        const timer = setTimeout(() => {
            entry.timer = null
            const latest = entry.pending
            entry.pending = null
            if (!latest || entry.ended || this.entries.get(uid) !== entry) return
            entry.lastSentAt = this.now()
            this.deliver(uid, "update", latest)
        }, wait)
        if (typeof timer.unref === "function") timer.unref()
        entry.timer = timer
    }

    private clearPending(entry: Entry): void {
        if (entry.timer) clearTimeout(entry.timer)
        entry.timer = null
        entry.pending = null
    }

    private deliver(uid: string, event: LiveActivityBody["event"], state: LiveActivityState): void {
        const tokens = this.tokens.get(uid)
        const body: LiveActivityBody = {
            uid,
            event,
            state,
            ...(tokens?.activityToken !== undefined ? { iosActivityToken: tokens.activityToken } : {}),
            ...(tokens?.pushToStartToken !== undefined ? { iosPushToStartToken: tokens.pushToStartToken } : {}),
        }
        try {
            this.notifier.send(body)
        } catch (err) {
            log.warn("liveActivity.notifierThrew", { uid, event, err })
        }
    }
}
