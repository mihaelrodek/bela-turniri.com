/* ──────────────────────────────────────────────────────────────────────────
   Who a player actually is, according to THIS app (README §4).

   A Firebase ID token only carries what Google put in it: `name` and
   `picture`. `picture` is the Google account photo — so a player who
   uploaded an avatar in their bela-turniri profile still sat down at the
   card table wearing their Google one (reported 2026-09-08). The profile
   lives in the main app's Postgres, which this process has no business
   touching, so it asks the backend over the same internal channel the stats
   reporter already uses: `BACKEND_INTERNAL_URL` + `X-Internal-Token`.

   Rules this module holds itself to:
     • NEVER block a login. Every failure path — no token configured, backend
       down, timeout, garbage body — resolves to `null` and the caller keeps
       the token's own claims. Signing in must not depend on the backend
       being up.
     • One request per uid per TTL, and one in flight at a time: a reconnect
       storm (a dropped wifi, four tabs) must not become a request storm.
     • Cache the MISS too, for a shorter time. A player with no profile row
       yet is a normal state (profiles are created lazily), and re-asking on
       every hello would be the most common request of all.
   ────────────────────────────────────────────────────────────────────── */

import { KARMA_MAX, LIMITS, isAvatarPreset } from "@bela/protocol"
import type { PlayerGameStats, GameStatRecord, PlayerReliability } from "@bela/protocol"
import type { Config } from "./config.js"
import { log } from "./log.js"

export interface AppProfile {
    displayName: string | null
    avatarUrl: string | null
    /**
     * "Ime za igru" — the name this player chose for the card table, or null
     * when they never set one. It WINS over `displayName` (see
     * `withAppProfile` in auth.ts): a player who typed a name for the table
     * meant it for the table.
     */
    gameName: string | null
    /**
     * The face picked in this app's profile (one of `AVATAR_PRESETS`), or null
     * when they never picked one or the stored value is not a preset this
     * build knows. Only signed-in players can have one — a guest's face lives
     * in their browser and arrives with the `hello`.
     */
    avatarPreset: string | null
    /** Absent on older/fake profile providers; null when backend has no valid record. */
    gameStats?: PlayerGameStats | null
    /**
     * Reliability on the 0..KARMA_MAX scale. Null when the backend did not
     * send one (older backend), in which case the seat shows no chip rather
     * than a made-up "10/10".
     */
    karma?: number | null
    /**
     * What `karma` is made of (2026-09-21 redesign: karma = KARMA_MAX minus
     * abandons in a rolling `windowDays`-day window, nothing earned back by
     * playing). Null when the backend sent none of `recentAbandons` /
     * `recentGames` / `totalAbandons` (older backend) — same "show nothing
     * rather than invent a number" rule as `karma` itself.
     */
    reliability?: PlayerReliability | null
}

/** Why a `setGameName` did not go through. */
export type SetGameNameError = "RATE_LIMITED" | "BAD_REQUEST" | "UNAVAILABLE"

export type SetGameNameResult =
    | { ok: true; name: string; nextChangeAt: number }
    | { ok: false; error: SetGameNameError; nextChangeAt?: number }

export interface ProfileLookup {
    /** The app's own profile for `uid`, or null when unknown/unavailable. Never rejects. */
    get(uid: string): Promise<AppProfile | null>
    /**
     * Write the in-game name for `uid`, through the same internal channel.
     *
     * Unlike `get` this is a USER ACTION, so it does not swallow failures into
     * null — the player tapped "Spremi" and is owed an answer. It still never
     * rejects: every outcome, including the backend being down, comes back as
     * a result the caller can turn into a message.
     */
    setGameName(uid: string, name: string): Promise<SetGameNameResult>
}

const HIT_TTL_MS = 5 * 60_000
const MISS_TTL_MS = 60_000
const REQUEST_TIMEOUT_MS = 3_000

interface CacheEntry {
    value: AppProfile | null
    expiresAt: number
}

/**
 * Which uids are worth asking the backend about.
 *
 * It used to be "real Firebase uids only" — dev and guest users have no
 * profile. GUESTS ARE NOW ASKED TOO (2026-09-09): they cannot have a profile,
 * but they can have an in-game name, which is stored against this very uid
 * precisely so the once-a-week limit has something stable to hold on to. A
 * guest with no name costs one request per `MISS_TTL_MS`, which the cache
 * already absorbs.
 *
 * `dev:` uids stay out: they exist only in local development and there is
 * nothing behind them.
 */
function isLookupCandidate(uid: string): boolean {
    return !uid.startsWith("dev:")
}

function parseStatRecord(value: unknown): GameStatRecord | null {
    if (typeof value !== "object" || value === null) return null
    const row = value as Partial<GameStatRecord>
    if (![row.games, row.wins, row.losses, row.winRate].every((v) => typeof v === "number" && Number.isFinite(v))) return null
    return { games: row.games!, wins: row.wins!, losses: row.losses!, winRate: row.winRate! }
}

function parseGameStats(value: unknown): PlayerGameStats | null {
    if (typeof value !== "object" || value === null) return null
    const raw = value as { global?: unknown; byTargetScore?: unknown }
    const global = parseStatRecord(raw.global)
    if (!global) return null
    const byTargetScore: PlayerGameStats["byTargetScore"] = {}
    if (typeof raw.byTargetScore === "object" && raw.byTargetScore !== null) {
        for (const key of ["163", "501", "701", "1001"] as const) {
            const row = parseStatRecord((raw.byTargetScore as Record<string, unknown>)[key])
            if (row) byTargetScore[key] = row
        }
    }
    return { global, byTargetScore }
}

/** A finite, non-negative, rounded count — or null when `value` is not a usable number. */
function parseCount(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null
    return Math.max(0, Math.round(value))
}

/**
 * `PlayerReliability` from the internal profile body's `recentAbandons` /
 * `recentGames` / `totalAbandons` / `windowDays` (KARMA-CONTRACT.md). Null
 * when NONE of the three counts is a usable number — an older backend that
 * only ever sent `karma` looks exactly like that, and the client must show
 * nothing rather than a fabricated all-zero trail. `windowDays` defaults to
 * 30 on its own (it is meaningless without the counts, but missing it alone
 * must not blank out counts the backend did send).
 */
function parseReliability(raw: {
    recentAbandons?: unknown
    recentGames?: unknown
    totalAbandons?: unknown
    windowDays?: unknown
}): PlayerReliability | null {
    const recentAbandons = parseCount(raw.recentAbandons)
    const recentGames = parseCount(raw.recentGames)
    const totalAbandons = parseCount(raw.totalAbandons)
    if (recentAbandons === null && recentGames === null && totalAbandons === null) return null
    return {
        recentAbandons: recentAbandons ?? 0,
        recentGames: recentGames ?? 0,
        totalAbandons: totalAbandons ?? 0,
        windowDays: parseCount(raw.windowDays) ?? 30,
    }
}

function parseProfile(body: unknown): AppProfile | null {
    if (typeof body !== "object" || body === null) return null
    const raw = body as {
        displayName?: unknown
        avatarUrl?: unknown
        gameName?: unknown
        avatarPreset?: unknown
        gameStats?: unknown
        karma?: unknown
        recentAbandons?: unknown
        recentGames?: unknown
        totalAbandons?: unknown
        windowDays?: unknown
    }
    const displayName = typeof raw.displayName === "string" && raw.displayName.trim().length > 0
        ? raw.displayName.trim().slice(0, 60)
        : null
    const avatarUrl = typeof raw.avatarUrl === "string" && raw.avatarUrl.trim().length > 0
        ? raw.avatarUrl.trim()
        : null
    const gameName = typeof raw.gameName === "string" && raw.gameName.trim().length > 0
        ? raw.gameName.trim().slice(0, LIMITS.playerNameMax)
        : null
    // Validated against the list rather than passed through: an unknown id
    // would reach `BelaAvatar`, which renders nothing for one, and the seat
    // would go blank instead of falling back to initials.
    const avatarPreset = isAvatarPreset(raw.avatarPreset) ? raw.avatarPreset : null
    const gameStats = parseGameStats(raw.gameStats)
    // Karma (and its `reliability` breakdown) stay OUT of the emptiness test
    // below: the backend answers with a karma for every uid, including
    // guests with no profile row, so counting it would turn every "no
    // profile" miss into a hit and cache it for the long TTL. A seat with
    // nothing else to say still gets none.
    const karma = typeof raw.karma === "number" && Number.isFinite(raw.karma)
        ? Math.max(0, Math.min(KARMA_MAX, Math.round(raw.karma)))
        : null
    const reliability = parseReliability(raw)
    if (displayName === null && avatarUrl === null && gameName === null && avatarPreset === null && gameStats === null) return null
    return { displayName, avatarUrl, gameName, avatarPreset, gameStats, karma, reliability }
}

export function createProfileLookup(cfg: Config): ProfileLookup {
    const cache = new Map<string, CacheEntry>()
    const inflight = new Map<string, Promise<AppProfile | null>>()
    let warnedNoToken = false

    async function fetchProfile(uid: string): Promise<AppProfile | null> {
        const url = `${cfg.backendInternalUrl.replace(/\/+$/, "")}/internal/profiles/${encodeURIComponent(uid)}`
        try {
            const res = await fetch(url, {
                headers: { "X-Internal-Token": cfg.gameResultsToken ?? "" },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            })
            if (!res.ok) {
                log.warn("profile.lookup.status", { uid, status: res.status })
                return null
            }
            return parseProfile(await res.json())
        } catch (err) {
            log.warn("profile.lookup.failed", { uid, err: String(err) })
            return null
        }
    }

    return {
        async get(uid) {
            if (!isLookupCandidate(uid)) return null
            if (!cfg.gameResultsToken) {
                if (!warnedNoToken) {
                    warnedNoToken = true
                    log.warn("profile.lookup.disabled", {
                        reason: "GAME_RESULTS_TOKEN unset — seats keep their Firebase token names/avatars",
                    })
                }
                return null
            }

            const now = Date.now()
            const hit = cache.get(uid)
            if (hit && hit.expiresAt > now) return hit.value

            const pending = inflight.get(uid)
            if (pending) return pending

            const request = fetchProfile(uid)
                .then((value) => {
                    cache.set(uid, {
                        value,
                        expiresAt: Date.now() + (value ? HIT_TTL_MS : MISS_TTL_MS),
                    })
                    return value
                })
                .finally(() => {
                    inflight.delete(uid)
                })

            inflight.set(uid, request)
            return request
        },

        async setGameName(uid, name) {
            // Synthetic dev users exist only in this process and cannot have
            // a backend profile row. Let the socket update their connection
            // and room state instead of turning every local rename into a
            // misleading BAD_REQUEST. The real account/guest paths below
            // still use the backend's seven-day rule.
            if (cfg.devAllowAnon && uid.startsWith("dev:")) {
                return { ok: true, name, nextChangeAt: 0 }
            }
            if (!isLookupCandidate(uid) || !cfg.gameResultsToken) {
                return { ok: false, error: "UNAVAILABLE" }
            }
            const url = `${cfg.backendInternalUrl.replace(/\/+$/, "")}`
                + `/internal/profiles/${encodeURIComponent(uid)}/game-name`
            try {
                const res = await fetch(url, {
                    method: "PUT",
                    headers: {
                        "X-Internal-Token": cfg.gameResultsToken,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ name }),
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                })
                const body: unknown = await res.json().catch(() => null)

                if (res.ok) {
                    const raw = body as { gameName?: unknown; nextChangeAt?: unknown }
                    const saved = typeof raw?.gameName === "string" ? raw.gameName : name
                    // The cached profile now names the wrong player: drop it
                    // rather than patch it, so the next read is the truth. The
                    // WRITE itself carries the name and nothing else, so the
                    // player's `avatarPreset` is untouched by a rename.
                    cache.delete(uid)
                    return { ok: true, name: saved, nextChangeAt: parseInstant(raw?.nextChangeAt) }
                }

                const err = body as { code?: unknown; details?: { nextChangeAt?: unknown } }
                if (res.status === 409 && err?.code === "GAME_NAME_RATE_LIMITED") {
                    // `details.nextChangeAt` is [iso, epochMillis] — the second
                    // entry exists so nobody has to parse a date here.
                    const detail = err.details?.nextChangeAt
                    const millis = Array.isArray(detail) ? detail[1] : undefined
                    return { ok: false, error: "RATE_LIMITED", nextChangeAt: parseInstant(millis) }
                }
                if (res.status === 400) return { ok: false, error: "BAD_REQUEST" }
                log.warn("profile.setName.failed", { uid, status: res.status })
                return { ok: false, error: "UNAVAILABLE" }
            } catch (e) {
                log.warn("profile.setName.threw", { uid, err: e })
                return { ok: false, error: "UNAVAILABLE" }
            }
        },
    }
}

/** An epoch-ms number, or a string holding one, or 0 when it is neither. */
function parseInstant(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const n = Number(value)
        if (Number.isFinite(n)) return n
        const parsed = Date.parse(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return 0
}
