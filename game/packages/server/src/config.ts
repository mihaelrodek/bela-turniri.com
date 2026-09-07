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
}

/** Everything time-based, so tests can make a whole game run in milliseconds. */
export interface Timings {
    turnTimeoutMs: number
    reconnectGraceMs: number
    botThinkMinMs: number
    botThinkMaxMs: number
    /** DEAL_DONE auto-advance when no connected human can confirm. */
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
    turnTimeoutMs: DEFAULTS.turnTimeoutMs,
    reconnectGraceMs: DEFAULTS.reconnectGraceMs,
    botThinkMinMs: DEFAULTS.botThinkMinMs,
    botThinkMaxMs: DEFAULTS.botThinkMaxMs,
    dealDoneAutoMs: 4_000,
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
    }
    return { ...base, ...overrides }
}

export function resolveTimings(overrides: Partial<Timings> = {}): Timings {
    return { ...DEFAULT_TIMINGS, ...overrides }
}
