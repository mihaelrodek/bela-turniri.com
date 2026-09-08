/* ──────────────────────────────────────────────────────────────────────────
   Environment configuration + runtime timings (README §4).

   Env:
     GAME_PORT             default 8285
     GAME_HOST             default 0.0.0.0
     FIREBASE_PROJECT_ID   required to verify real Firebase ID tokens
     GAME_DEV_ALLOW_ANON   "1" / "true" → `hello { devName }` without a token
     GAME_CORS_ORIGINS     comma list; when set, the upgrade `Origin` header
                           must match one of them
     GAME_LOG_LEVEL        error | warn | info | debug
     BACKEND_INTERNAL_URL  base URL of the Quarkus backend for server-to-server
                           calls (README §8.4, `statsReporter.ts`). Default
                           `http://backend:8085/api` (prod-in-docker service
                           name); override for local dev, e.g.
                           `http://localhost:8085/api`.
     GAME_RESULTS_TOKEN    shared secret sent as `X-Internal-Token` when
                           reporting a finished game's stats. No safe default:
                           unset means stats reporting is skipped entirely
                           (one warning logged at startup use), never a crash.
   ────────────────────────────────────────────────────────────────────── */

import { DEFAULTS } from "@bela/protocol"
import { isLogLevel, type LogLevel } from "./log.js"

export interface Config {
    port: number
    host: string
    firebaseProjectId: string | null
    devAllowAnon: boolean
    /** `null` = no Origin check at all. */
    corsOrigins: string[] | null
    logLevel: LogLevel
    /** Base URL of the Quarkus backend, no trailing slash (README §4, §8.4). */
    backendInternalUrl: string
    /** Shared secret for `X-Internal-Token`; `null` = stats reporting is disabled. */
    gameResultsToken: string | null
}

/** Everything time-based, so tests can make a whole game run in milliseconds. */
export interface Timings {
    declarationsMs: number
    turnTimeoutMs: number
    reconnectGraceMs: number
    botThinkMinMs: number
    botThinkMaxMs: number
    /**
     * How long a scored deal stays on screen before the next one is dealt.
     * Unconditional since 2026-09-08 — nobody has to confirm a summary. Kept
     * just above the client's 3 s auto-dismiss so the dialog is gone first.
     */
    dealDoneAutoMs: number
    /** Empty room is deleted this long after the last member leaves. */
    emptyRoomTtlMs: number
    /** Finished room is deleted this long after GAME_OVER. */
    finishedRoomTtlMs: number
    heartbeatMs: number
    /** Terminate after this many missed pongs. */
    heartbeatMisses: number
    /** Lobby broadcast debounce. */
    lobbyDebounceMs: number
}

export interface RateLimits {
    messagesPerSecond: number
    chatPerSecond: number
}

export const DEFAULT_TIMINGS: Timings = {
    declarationsMs: 5200,
    turnTimeoutMs: DEFAULTS.turnTimeoutMs,
    reconnectGraceMs: DEFAULTS.reconnectGraceMs,
    botThinkMinMs: DEFAULTS.botThinkMinMs,
    botThinkMaxMs: DEFAULTS.botThinkMaxMs,
    dealDoneAutoMs: 3_500,
    emptyRoomTtlMs: 5 * 60_000,
    finishedRoomTtlMs: 10 * 60_000,
    heartbeatMs: 25_000,
    heartbeatMisses: 2,
    lobbyDebounceMs: 50,
}

function envBool(v: string | undefined): boolean {
    if (!v) return false
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true" || s === "yes" || s === "on"
}

function envInt(v: string | undefined, fallback: number): number {
    if (v === undefined || v.trim() === "") return fallback
    const n = Number.parseInt(v, 10)
    return Number.isFinite(n) ? n : fallback
}

function envList(v: string | undefined): string[] | null {
    if (v === undefined) return null
    const items = v
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    return items.length > 0 ? items : null
}

export type EnvLike = Record<string, string | undefined>

export function loadConfig(env: EnvLike = process.env, overrides: Partial<Config> = {}): Config {
    const projectId = env["FIREBASE_PROJECT_ID"]?.trim()
    const rawLevel = env["GAME_LOG_LEVEL"]?.trim().toLowerCase()
    const base: Config = {
        port: envInt(env["GAME_PORT"], 8285),
        host: env["GAME_HOST"]?.trim() || "0.0.0.0",
        firebaseProjectId: projectId && projectId.length > 0 ? projectId : null,
        devAllowAnon: envBool(env["GAME_DEV_ALLOW_ANON"]),
        corsOrigins: envList(env["GAME_CORS_ORIGINS"]),
        logLevel: isLogLevel(rawLevel) ? rawLevel : "info",
        // Dev default, not the docker one: `backend` only resolves inside the
        // compose network, and docker-compose.prod.yaml sets this explicitly
        // anyway. Defaulting to the docker name meant every local run silently
        // failed its profile/stats calls against a host that cannot resolve.
        backendInternalUrl: env["BACKEND_INTERNAL_URL"]?.trim() || "http://localhost:8085/api",
        gameResultsToken: env["GAME_RESULTS_TOKEN"]?.trim() || null,
    }
    return { ...base, ...overrides }
}

export function resolveTimings(overrides: Partial<Timings> = {}): Timings {
    return { ...DEFAULT_TIMINGS, ...overrides }
}
