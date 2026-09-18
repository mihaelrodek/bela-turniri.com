import type { QueryClient, QueryKey } from "@tanstack/react-query"
import { qk } from "../queryClient"
import type { TournamentCard, TournamentDetails } from "../types/tournaments"

/* ──────────────────────────────────────────────────────────────────────────
   First-screen data seed ("SSR-lite").

   The waterfall this removes: parse index.html → download the module graph →
   boot React → mount TournamentsPage → *only then* issue the three REST calls
   the first screen is made of. The data request used to start after the whole
   bundle had landed, even though nothing about it depends on the bundle.

   So index.html fires it itself, from an inline classic <script> at the top of
   <head>, and parks the promise on `window.__belaSeed`. By the time main.tsx
   runs, the answer is usually already there; this module drops it into the
   react-query cache under the very same `qk` keys the pages use, so the first
   React render is a cache hit instead of a spinner.

   Three properties worth keeping in mind when touching this:

   • The seed is ANONYMOUS by construction (see ShellRenderService.java) — and
     for an anonymous visitor it is also AUTHORITATIVE, because it is the exact
     answer the same endpoints would give them. Only a SIGNED-IN caller can see
     something different: a user who blocked an organiser sees fewer rows, and
     an organiser sees own-tournament affordances. So the invalidation is
     conditional on the session rather than unconditional: `applySeed` records
     the keys it wrote, and `revalidateSeedForUser` (called by AuthProvider at
     the first `onAuthStateChanged`) invalidates them only when someone is
     signed in. A guest's three first-screen queries are therefore NOT refetched
     on mount at all — the seed stays fresh until the normal 30 s staleTime,
     which removes three requests from every anonymous first load.

   • `updatedAt` is the server's `generatedAt`, not `Date.now()`. The
     localStorage persister rehydrates a moment later and react-query's
     `hydrate()` only overwrites an entry whose `dataUpdatedAt` is OLDER than
     the persisted one — so an honest timestamp is what makes "whichever is
     fresher wins" resolve correctly in both directions.

   • Nothing here is load-bearing. A failed, slow, or missing seed (the
     endpoint not deployed yet, an offline cold load, a route with no seed)
     leaves the app exactly as it was: `main.tsx` waits at most
     `SEED_WAIT_MS` and then renders, and the pages fetch for themselves.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Payload of `GET /api/seed?path=…` — mirrors
 * `ShellRenderService.SeedPayload` field for field.
 *
 * Note what it is NOT: a list of `{queryKey, data}` pairs. The server never
 * names a cache key; it returns named buckets and the client builds the keys
 * from its own `qk` registry, so a key rename stays a one-file change here
 * instead of a silent miss against a string the backend hard-coded.
 */
export type ShellSeed = {
    /** Epoch millis the payload was computed — becomes react-query's `updatedAt`. */
    generatedAt: number
    /** The normalised path the seed answers for (`/turniri` or `/turniri/<segment>`). */
    path: string
    /** `qk.tournaments({ status: "upcoming" })` */
    upcoming: TournamentCard[]
    /** `qk.tournaments({ status: "finished", limit: finishedLimit })` */
    finished: TournamentCard[]
    /** The page size the server used — echoed so the key needs no shared constant. */
    finishedLimit: number
    /** `qk.tournamentsCount("finished")` */
    finishedTotal: number
    /** The raw URL segment the detail payload is keyed by, or null on a list seed. */
    detailsKey: string | null
    /** `qk.tournamentDetails(detailsKey)` */
    details: TournamentDetails | null
}

declare global {
    interface Window {
        /** Set by the inline bootstrap script in index.html. Resolves to null
         *  on any failure — it never rejects, so no caller needs a catch. */
        __belaSeed?: Promise<ShellSeed | null>
    }
}

/**
 * How long the first render may wait for the seed.
 *
 * The seed request is fired before the module graph is even parsed, so on a
 * healthy backend it has been in flight for hundreds of milliseconds by the
 * time we get here and this wait is usually zero. The cap exists for the bad
 * day: a cold JVM or a saturated link must not hold the app hostage behind a
 * request that is, by design, optional. If it lands after the deadline it is
 * still applied — to whatever the pages haven't fetched for themselves yet.
 */
export const SEED_WAIT_MS = 400

/** The promise index.html parked, if this route was seeded at all. */
export function seedPromise(): Promise<ShellSeed | null> | null {
    if (typeof window === "undefined") return null
    return window.__belaSeed ?? null
}

/* ── Seed revalidation bookkeeping ────────────────────────────────────────
   The seed and the auth state resolve independently and in either order, so
   both directions are handled:

   • seed first  → the keys pile up in `seededKeys` and `revalidateSeedForUser`
                   drains them when the session becomes known.
   • auth first  → `authKnown` is already set, so `applySeed` decides on the
                   spot for each key it writes (a late seed still gets the
                   right treatment).
   ────────────────────────────────────────────────────────────────────── */

/** Keys written by `applySeed` before the session was known. */
let seededKeys: QueryKey[] = []
/** True once `revalidateSeedForUser` has run for this document. */
let authKnown = false
/** Whether that run saw a signed-in user. */
let seedNeedsRefetch = false

function markSeeded(client: QueryClient, key: QueryKey) {
    if (!authKnown) {
        seededKeys.push(key)
        return
    }
    if (seedNeedsRefetch) invalidateSeeded(client, key)
}

/**
 * `refetchType: "active"` and not `"none"`: by the time the session is known
 * the pages are already mounted, so `"none"` would mark the entry stale and
 * then wait for a remount that never comes. `"active"` refetches what is on
 * screen right now and leaves an unmounted key merely stale, to be refetched
 * if and when something subscribes to it.
 */
function invalidateSeeded(client: QueryClient, key: QueryKey) {
    void client.invalidateQueries({ queryKey: key, exact: true, refetchType: "active" })
}

/**
 * Tell the seed whose session it is looking at. Called exactly once, from
 * `AuthProvider`'s first `onAuthStateChanged` callback.
 *
 * Signed in → every seeded key is invalidated, because the anonymous seed may
 * differ from what this caller is entitled to see. Signed out → nothing
 * happens: the seed IS the anonymous answer, so refetching it would spend
 * three requests to receive the bytes we already have.
 */
export function revalidateSeedForUser(client: QueryClient, isSignedIn: boolean): void {
    authKnown = true
    seedNeedsRefetch = isSignedIn
    const keys = seededKeys
    seededKeys = []
    if (!isSignedIn) return
    for (const key of keys) invalidateSeeded(client, key)
}

/**
 * Write a seed into the query cache.
 *
 * Idempotent and always safe to call late: an entry that already holds data
 * is left alone, because that data came either from a real fetch (newer and
 * caller-aware) or from an earlier apply of this same seed.
 */
export function applySeed(client: QueryClient, seed: ShellSeed): void {
    const put = (key: QueryKey, data: unknown) => {
        if (data === undefined || data === null) return
        // Never overwrite what the app already holds — see the doc comment.
        if (client.getQueryData(key) !== undefined) return
        // `updatedAt` is the server's `generatedAt`, which is what makes the
        // localStorage persister's "whichever is fresher wins" resolve
        // correctly — see the header.
        client.setQueryData(key, data, { updatedAt: seed.generatedAt })
        // Revalidate only for a signed-in caller; see markSeeded above.
        markSeeded(client, key)
    }

    // Exactly the three entries TournamentsPage opens with. `finishedLimit`
    // comes from the server so the key matches even if FINISHED_PREVIEW_LIMIT
    // and its backend twin ever drift — a drifted seed then lands under a key
    // nobody reads, which is a miss, not a bug.
    if (seed.upcoming?.length) {
        put(qk.tournaments({ status: "upcoming" }), seed.upcoming)
    }
    if (seed.finished?.length) {
        put(qk.tournaments({ status: "finished", limit: seed.finishedLimit }), seed.finished)
    }
    if (seed.finished?.length || seed.finishedTotal > 0) {
        put(qk.tournamentsCount("finished"), seed.finishedTotal)
    }

    // The detail page (hooks/useTournamentData → qk.tournamentDetails) keyed by
    // whatever the URL carried, uuid or slug — `useParams` hands the page that
    // exact string, so the server echoes it back rather than us re-parsing it.
    if (seed.detailsKey && seed.details) {
        put(qk.tournamentDetails(seed.detailsKey), seed.details)
    }
}

/**
 * Install the seed, then resolve — waiting at most {@link SEED_WAIT_MS}.
 *
 * The late-arrival handler is registered on the seed promise BEFORE the race,
 * so when the seed wins the race its `applySeed` has already run by the time
 * this resolves (same promise, and `.then` callbacks fire in registration
 * order). When it loses, the handler stays armed and fills whatever the
 * mounted pages haven't fetched by then.
 */
export function installSeed(client: QueryClient): Promise<void> {
    const pending = seedPromise()
    if (!pending) return Promise.resolve()

    pending.then((seed) => {
        if (seed) applySeed(client, seed)
    }).catch(() => {
        /* the inline script already swallows failures; belt and braces */
    })

    return new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, SEED_WAIT_MS)
        pending.then(() => {
            window.clearTimeout(timer)
            resolve()
        }).catch(() => {
            window.clearTimeout(timer)
            resolve()
        })
    })
}
