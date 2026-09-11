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

import { LIMITS, isAvatarPreset } from "@bela/protocol"
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

function parseProfile(body: unknown): AppProfile | null {
    if (typeof body !== "object" || body === null) return null
    const raw = body as { displayName?: unknown; avatarUrl?: unknown; gameName?: unknown; avatarPreset?: unknown }
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
    if (displayName === null && avatarUrl === null && gameName === null && avatarPreset === null) return null
    return { displayName, avatarUrl, gameName, avatarPreset }
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
    }
    return 0
}
