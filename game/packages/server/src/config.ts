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
     GAME_DEMO_LOBBY       PRE-LAUNCH ONLY. "1" fills the lobby with fake
                           people so a test group sees a living lobby
                           (game/DEMO-LOBBY.md). Unset = not a line of that
                           code runs. MUST be unset for a real launch and for
                           any app-store submission.
     GAME_DEMO_ROOMS       "8-12"  — band the number of demo rooms wanders in
     GAME_DEMO_PLAYING     "5-6"   — how many of them are mid-game
     GAME_DEMO_WATCHABLE   "2"     — how many of THOSE allow spectators
     GAME_RESULTS_TOKEN    shared secret sent as `X-Internal-Token` when
                           reporting a finished game's stats. No safe default:
                           unset means stats reporting is skipped entirely
                           (one warning logged at startup use), never a crash.
   ────────────────────────────────────────────────────────────────────── */

import { DEFAULTS } from "@bela/protocol"
// Type-only: the demo modules themselves are loaded only behind `demo !== null`.
import type { DemoDirectorConfig } from "./demo/types.js"
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
    /**
     * PRE-LAUNCH ONLY (game/DEMO-LOBBY.md). Non-null = the demo director runs
     * and fake players are visible to everyone. `null` in every other case, and
     * the single thing the rest of the server checks.
     */
    demo: DemoDirectorConfig | null
}

/** Everything time-based, so tests can make a whole game run in milliseconds. */
export interface Timings {
    declarationsMs: number
    turnTimeoutMs: number
    reconnectGraceMs: number
    botThinkMinMs: number
    botThinkMaxMs: number
    /**
     * How long a scored deal may stay on screen before the next one is dealt
     * WITHOUT being acked. Since 2026-09-20 this is only the fallback: each
     * connected human seat sends `game.nextDeal` when it closes its summary
     * and the table advances as soon as the last of them has (gameRoom.ts).
     * Kept just above the client's own auto-dismiss (`DealSummary`'s
     * `AUTO_CLOSE_MS` plus the ~2.3 s the event queue spends on the last card
     * and the trick sweep) so the dialog is gone first either way.
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
}

export const DEFAULT_TIMINGS: Timings = {
    declarationsMs: 8_000,
    turnTimeoutMs: DEFAULTS.turnTimeoutMs,
    reconnectGraceMs: DEFAULTS.reconnectGraceMs,
    botThinkMinMs: DEFAULTS.botThinkMinMs,
    botThinkMaxMs: DEFAULTS.botThinkMaxMs,
    dealDoneAutoMs: 5_000,
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

/** Hard ceilings for the demo lobby — a typo in an env var must not open 900
 *  fake rooms on a small VPS. */
const DEMO_MAX_ROOMS = 40

function clamp(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n))
}

/**
 * `"8-12"` → `[8, 12]`, `"9"` → `[9, 9]`, anything unparseable → `fallback`.
 * The result is always ordered and inside `[lo, hi]`.
 */
function envRange(
    v: string | undefined,
    fallback: readonly [number, number],
    lo: number,
    hi: number,
): readonly [number, number] {
    const raw = v?.trim()
    if (!raw) return fallback
    const parts = raw.split("-").map((s) => Number.parseInt(s.trim(), 10))
    const from = parts[0]
    const to = parts.length > 1 ? parts[1] : parts[0]
    if (from === undefined || to === undefined || !Number.isFinite(from) || !Number.isFinite(to)) {
        return fallback
    }
    const a = clamp(from, lo, hi)
    const b = clamp(to, lo, hi)
    return a <= b ? [a, b] : [b, a]
}

/**
 * The demo lobby's shape, or null when `GAME_DEMO_LOBBY` is off.
 *
 * Every band is clamped against the next one out — "playing" can never exceed
 * "total" and "watchable" never exceeds the upper end of "playing" — so a
 * half-filled-in `.env` produces a smaller lobby rather than a director that
 * can never satisfy its own targets.
 */
function loadDemoConfig(env: EnvLike): DemoDirectorConfig | null {
    if (!envBool(env["GAME_DEMO_LOBBY"])) return null
    const totalRooms = envRange(env["GAME_DEMO_ROOMS"], [8, 12], 1, DEMO_MAX_ROOMS)
    const playingRooms = envRange(env["GAME_DEMO_PLAYING"], [5, 6], 0, totalRooms[1])
    const watchableRooms = clamp(envInt(env["GAME_DEMO_WATCHABLE"], 2), 0, playingRooms[1])
    return { totalRooms, playingRooms, watchableRooms }
}

export function loadConfig(env: EnvLike = process.env, overrides: Partial<Config> = {}): Config {
    const projectId = env["FIREBASE_PROJECT_ID"]?.trim()
    const rawLevel = env["GAME_LOG_LEVEL"]?.trim().toLowerCase()
    const devAllowAnon = envBool(env["GAME_DEV_ALLOW_ANON"])
    const base: Config = {
        port: envInt(env["GAME_PORT"], 8285),
        host: env["GAME_HOST"]?.trim() || "0.0.0.0",
        firebaseProjectId: projectId && projectId.length > 0 ? projectId : null,
        devAllowAnon,
        corsOrigins: envList(env["GAME_CORS_ORIGINS"]),
        logLevel: isLogLevel(rawLevel) ? rawLevel : "info",
        // Dev default, not the docker one: `backend` only resolves inside the
        // compose network, and docker-compose.prod.yaml sets this explicitly
        // anyway. Defaulting to the docker name meant every local run silently
        // failed its profile/stats calls against a host that cannot resolve.
        backendInternalUrl: env["BACKEND_INTERNAL_URL"]?.trim() || "http://localhost:8085/api",
        // Match Quarkus' documented dev/test fallback when anonymous dev
        // users are enabled. Production never enables that flag and still
        // requires an explicit shared secret.
        gameResultsToken: env["GAME_RESULTS_TOKEN"]?.trim()
            || (devAllowAnon ? "dev-secret-change-me" : null),
        demo: loadDemoConfig(env),
    }
    return { ...base, ...overrides }
}

export function resolveTimings(overrides: Partial<Timings> = {}): Timings {
    return { ...DEFAULT_TIMINGS, ...overrides }
}
