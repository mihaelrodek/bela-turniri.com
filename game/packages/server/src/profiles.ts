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

import type { Config } from "./config.js"
import { log } from "./log.js"

export interface AppProfile {
    displayName: string | null
    avatarUrl: string | null
}

export interface ProfileLookup {
    /** The app's own profile for `uid`, or null when unknown/unavailable. Never rejects. */
    get(uid: string): Promise<AppProfile | null>
}

const HIT_TTL_MS = 5 * 60_000
const MISS_TTL_MS = 60_000
const REQUEST_TIMEOUT_MS = 3_000

interface CacheEntry {
    value: AppProfile | null
    expiresAt: number
}

/** Only real Firebase uids have a profile — dev and guest users never do. */
function isLookupCandidate(uid: string): boolean {
    return !uid.startsWith("dev:") && !uid.startsWith("guest:")
}

function parseProfile(body: unknown): AppProfile | null {
    if (typeof body !== "object" || body === null) return null
    const raw = body as { displayName?: unknown; avatarUrl?: unknown }
    const displayName = typeof raw.displayName === "string" && raw.displayName.trim().length > 0
        ? raw.displayName.trim().slice(0, 60)
        : null
    const avatarUrl = typeof raw.avatarUrl === "string" && raw.avatarUrl.trim().length > 0
        ? raw.avatarUrl.trim()
        : null
    if (displayName === null && avatarUrl === null) return null
    return { displayName, avatarUrl }
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
    }
}
